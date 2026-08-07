-- =============================================================================
-- Fundação: organizações, event store, outbox e idempotência
-- Referência: plano seções 7.3 (RLS), 8 (modelo orientado a eventos), 17 (dados)
--
-- ATENÇÃO — ESTE ARQUIVO NUNCA FOI EXECUTADO.
--
-- Não existe Postgres, Docker nem CLI do Supabase no ambiente onde ele foi
-- escrito, então nada aqui foi validado contra um banco de verdade. É um
-- artefato para revisão e para a primeira execução assistida, não uma migração
-- testada. Rode em projeto descartável antes de qualquer coisa.
--
-- O que ESTÁ verificado é a camada acima: os tipos, a política de retentativa e
-- a deduplicação têm testes que passam (`pnpm test`). O que este arquivo faz é
-- dar a essas mesmas garantias um lugar durável.
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- Organização e associação
-- =============================================================================

create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  timezone    text not null default 'America/Sao_Paulo',
  created_at  timestamptz not null default now()
);

-- A associação é o que a RLS consulta em toda política. Sem ela, "o usuário
-- pertence a esta organização?" não tem resposta no banco.
create table if not exists organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null,
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_idx on organization_members (user_id);

-- -----------------------------------------------------------------------------
-- Função de associação.
--
-- `stable` e não `volatile`: o planejador passa a poder chamá-la uma vez por
-- consulta em vez de uma vez por linha. Numa tabela de mensagens, essa
-- diferença é a que separa uma consulta de 5 ms de uma de 5 s.
--
-- `security definer` com `search_path` fixo: sem o `search_path`, um schema
-- malicioso no caminho poderia sequestrar a resolução de nome dentro de uma
-- função que roda com privilégio elevado.
-- -----------------------------------------------------------------------------
create or replace function public.is_member_of(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
      from organization_members m
     where m.organization_id = org
       and m.user_id = auth.uid()
  );
$$;

-- =============================================================================
-- Event store
--
-- Append-only por natureza: um fato não muda. Não há `updated_at`, e a ausência
-- é intencional — se alguém precisar "corrigir" um evento, o certo é publicar um
-- novo que o compense, não reescrever a história.
-- =============================================================================

create table if not exists domain_events (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  source           text not null,
  idempotency_key  text,
  subject_type     text,
  subject_id       text,
  payload          jsonb not null default '{}'::jsonb,
  correlation_id   text not null,
  occurred_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- A garantia da seção 8, no lugar certo.
--
-- A deduplicação precisa ser do BANCO, não da aplicação. Dois workers
-- processando a mesma reentrega ao mesmo tempo passariam os dois pelo "já
-- existe?" da aplicação antes de qualquer um inserir. Só o índice único resolve
-- essa corrida — a aplicação trata a violação como "já publicado".
--
-- Parcial (`where ... is not null`) porque evento de ação humana não leva chave,
-- e um índice único sobre nulos impediria o segundo deles em alguns bancos.
-- Por organização porque a chave vem do provedor, e dois clientes podem receber
-- identificadores iguais de provedores diferentes.
-- -----------------------------------------------------------------------------
create unique index if not exists domain_events_idempotency_uk
  on domain_events (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists domain_events_org_time_idx
  on domain_events (organization_id, occurred_at desc);

create index if not exists domain_events_correlation_idx
  on domain_events (correlation_id);

create index if not exists domain_events_subject_idx
  on domain_events (organization_id, subject_type, subject_id);

-- =============================================================================
-- Outbox
--
-- Uma linha por (evento, destino). É o que permite o analytics falhar sem
-- reprocessar o Inbox — comportamento coberto por teste na camada acima.
-- =============================================================================

create table if not exists outbox_events (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references domain_events(id) on delete cascade,
  organization_id  uuid not null references organizations(id) on delete cascade,
  destination      text not null,
  state            text not null default 'pendente'
                     check (state in ('pendente','entregue','falhando','morto')),
  attempts         integer not null default 0,
  next_attempt_at  timestamptz not null default now(),
  last_error       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (event_id, destination)
);

-- -----------------------------------------------------------------------------
-- Índice da fila.
--
-- É o índice que o worker usa a cada ciclo, e o único cuja forma importa para o
-- desempenho: parcial sobre o que ainda não terminou. Sem o `where`, ele cresce
-- com o histórico inteiro de entregas bem-sucedidas — que é justamente o que
-- nunca mais será consultado.
-- -----------------------------------------------------------------------------
create index if not exists outbox_pending_idx
  on outbox_events (organization_id, next_attempt_at)
  where state in ('pendente', 'falhando');

-- =============================================================================
-- Idempotência de requisição
--
-- Diferente da chave do evento: esta protege o CHAMADOR (retry de rede num POST
-- de envio, por exemplo), guardando a resposta para devolver a mesma coisa.
-- =============================================================================

create table if not exists idempotency_keys (
  organization_id uuid not null references organizations(id) on delete cascade,
  scope           text not null,
  key             text not null,
  response        jsonb,
  created_at      timestamptz not null default now(),
  -- Expira: uma chave guardada para sempre vira uma tabela que só cresce, e o
  -- retry de rede que ela protege acontece em segundos, não em meses.
  expires_at      timestamptz not null default now() + interval '24 hours',
  primary key (organization_id, scope, key)
);

create index if not exists idempotency_keys_expiry_idx on idempotency_keys (expires_at);

-- =============================================================================
-- Row Level Security
--
-- Ligada em TODAS as tabelas. Sem `force`, o dono da tabela ignora a política —
-- e o dono é quem roda a migração, o que faria os testes passarem no ambiente
-- errado.
-- =============================================================================

alter table organizations        enable row level security;
alter table organization_members enable row level security;
alter table domain_events        enable row level security;
alter table outbox_events        enable row level security;
alter table idempotency_keys     enable row level security;

alter table domain_events    force row level security;
alter table outbox_events    force row level security;
alter table idempotency_keys force row level security;

create policy org_visible on organizations
  for select using (public.is_member_of(id));

create policy membership_visible on organization_members
  for select using (public.is_member_of(organization_id));

-- -----------------------------------------------------------------------------
-- Eventos: leitura pelo membro, escrita por ninguém.
--
-- Não há política de INSERT de propósito. Quem publica é o serviço, com a chave
-- privilegiada — que ignora RLS. Permitir que o navegador insira em
-- `domain_events` deixaria qualquer usuário forjar um fato, e fato forjado é
-- automação disparada, negócio ganho e métrica adulterada.
-- -----------------------------------------------------------------------------
create policy events_read on domain_events
  for select using (public.is_member_of(organization_id));

-- A fila é interna ao serviço. Nem leitura pelo navegador: a interface lê pelo
-- servidor, que aplica o filtro de organização antes de responder.
create policy outbox_no_client on outbox_events
  for select using (false);

create policy idempotency_no_client on idempotency_keys
  for select using (false);

-- =============================================================================
-- Retirada da fila pelo worker
--
-- `for update skip locked` é a linha que não tem equivalente em memória: com
-- mais de um worker, ela impede que dois puxem a mesma entrada. Sem ela, a
-- mesma mensagem seria entregue duas vezes — e a idempotência do evento não
-- protege aqui, porque a duplicação estaria na ENTREGA, não na publicação.
--
-- Roda com a chave de serviço; RLS não se aplica, e por isso o filtro de
-- organização é explícito no parâmetro.
-- =============================================================================
create or replace function public.claim_outbox(org uuid, batch integer default 25)
returns setof outbox_events
language sql
volatile
security definer
set search_path = public, pg_catalog
as $$
  update outbox_events o
     set attempts   = o.attempts + 1,
         updated_at = now()
   where o.id in (
     select id
       from outbox_events
      where organization_id = org
        and state in ('pendente', 'falhando')
        and next_attempt_at <= now()
      order by created_at
      limit batch
      for update skip locked
   )
  returning o.*;
$$;

revoke all on function public.claim_outbox(uuid, integer) from public, anon, authenticated;
