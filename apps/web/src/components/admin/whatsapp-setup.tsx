"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChannelAccount, Queue, WhatsappDiagnostics } from "@elora/core";
import { formatDateTime } from "@elora/core";
import {
  Badge,
  Button,
  Callout,
  Eyebrow,
  Input,
  Label,
  Reveal,
  StatusDot,
  Tooltip,
  cn,
} from "@elora/ui";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleAlert,
  Copy,
  Hash,
  KeyRound,
  Loader2,
  MessageSquareText,
  Phone,
  PlugZap,
  RefreshCw,
  ShieldAlert,
  TriangleAlert,
  Webhook,
} from "lucide-react";

/**
 * Conexão de um número de WhatsApp.
 *
 * Página própria e não uma aba da Administração porque o processo é longo,
 * atravessa dois sistemas e tem espera de dias no meio. Espremê-lo numa aba ao
 * lado de "Pessoas" faria a etapa que trava — a verificação de negócio — passar
 * despercebida.
 *
 * A tela responde três perguntas, e é por isso que ela existe:
 *
 * 1. **Em que passo eu estou?** — o que depende da Meta e o que depende de nós,
 *    separados, porque as duas frentes correm em paralelo.
 * 2. **O que eu copio para o painel da Meta?** — endereço do webhook e token,
 *    com botão de copiar. Digitar à mão é onde nasce o espaço no fim que faz o
 *    token nunca conferir.
 * 3. **A Meta está chegando aqui?** — o teste e o registro dos últimos eventos.
 *    Sem isso, quem configura fica olhando o painel dizer "assinado" enquanto
 *    nada acontece.
 */

interface SelfTest {
  ok: boolean;
  step?: string;
  message: string;
  publiclyReachable?: boolean;
}

export function WhatsappSetup({
  accounts,
  queues,
}: {
  accounts: ChannelAccount[];
  queues: Queue[];
}) {
  const [diagnostics, setDiagnostics] = useState<WhatsappDiagnostics | null>(null);
  const [test, setTest] = useState<SelfTest | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/canais/whatsapp/diagnostico", { cache: "no-store" });
      if (response.ok) setDiagnostics((await response.json()) as WhatsappDiagnostics);
    } catch {
      // Falha momentânea não apaga o que está na tela: a próxima leitura resolve.
    }
  }, []);

  useEffect(() => {
    void load();
    /**
     * Leitura periódica enquanto a tela está aberta.
     *
     * É o que faz o registro de eventos servir para alguma coisa: quem acabou de
     * salvar no painel da Meta manda uma mensagem do próprio celular e vê ela
     * aparecer aqui em segundos, sem recarregar.
     */
    const timer = setInterval(() => void load(), 5_000);
    return () => clearInterval(timer);
  }, [load]);

  async function runTest() {
    setTesting(true);
    try {
      const response = await fetch("/api/canais/whatsapp/diagnostico", { method: "POST" });
      const result = (await response.json()) as SelfTest;
      setTest(result);
      void load();
    } catch {
      setTest({ ok: false, message: "Não foi possível falar com o servidor." });
    } finally {
      setTesting(false);
    }
  }

  const whatsapp = accounts.filter((account) => account.kind === "whatsapp");
  const queueById = new Map(queues.map((queue) => [queue.id, queue]));

  const serverReady =
    Boolean(diagnostics?.verifyTokenConfigured) && Boolean(diagnostics?.appSecretConfigured);

  return (
    <div className="mx-auto w-full max-w-[72rem] px-5 py-6">
      {/**
       * O aviso vem antes de tudo, e é o mais importante da tela.
       *
       * Alguém pode seguir os seis passos, conectar o número e concluir que o
       * canal está pronto — e não está: mensagem recebida ainda não vira
       * conversa. Descobrir isso com o número da empresa já migrado, e o
       * WhatsApp Business fora do ar no celular do comercial, seria o pior
       * momento possível.
       */}
      <Reveal index={0}>
        <Callout variant="warning" icon={<TriangleAlert />} title="Leia antes de migrar um número">
          <p className="leading-relaxed">
            O webhook desta aplicação já recebe e valida o que a Meta envia, mas{" "}
            <strong>a mensagem ainda não vira conversa no Inbox</strong> — isso depende da fundação
            de back-end (persistência, fila, idempotência), que não existe neste repositório.
          </p>
          <p className="mt-1.5 leading-relaxed">
            E o número que entra na API <strong>sai do aplicativo</strong>: ele deixa de funcionar
            no WhatsApp Business do celular, sem coexistência. Comece por um chip novo ou pelo
            número de teste da Meta — nunca pelo número principal do comercial.
          </p>
        </Callout>
      </Reveal>

      {/* Etapas ------------------------------------------------------------- */}
      <Reveal index={1} className="mt-5">
        <Eyebrow className="mb-2">O caminho, em ordem</Eyebrow>
        <div className="grid gap-3 lg:grid-cols-2">
          <StepCard
            index={1}
            owner="meta"
            icon={<Building2 />}
            title="Verificação de negócio"
            state="pendente"
            summary="Meta Business Manager verificado com CNPJ, comprovante de endereço e site."
            detail="É a etapa mais lenta e a que menos depende de código — dias, às vezes com o documento voltando. Comece por ela hoje, em paralelo com o resto. Sem verificação, o número fica preso no limite mais baixo de conversas por dia."
          />
          <StepCard
            index={2}
            owner="meta"
            icon={<Hash />}
            title="WABA e app"
            state="pendente"
            summary="Criar a conta do WhatsApp Business e um app no Meta for Developers."
            detail="A WABA é a conta que agrupa os números; o app é o que expõe a API e o segredo usado para assinar o webhook. São dois objetos diferentes no painel, e confundi-los é comum."
          />
          <StepCard
            index={3}
            owner="meta"
            icon={<Phone />}
            title="Número e nome de exibição"
            state="pendente"
            summary="Adicionar o número, verificar por SMS ou ligação e submeter o nome que o cliente vê."
            detail="O nome de exibição passa por aprovação e pode ser recusado se não corresponder à marca. E vale repetir: a partir daqui o número não funciona mais no aplicativo."
          />
          <StepCard
            index={4}
            owner="nosso"
            icon={<KeyRound />}
            title="Credenciais no servidor"
            state={serverReady ? "concluida" : "pendente"}
            summary="Quatro variáveis no `.env` da raiz, e reiniciar."
            detail="O token que aparece no painel de teste da Meta expira em 24 horas e não serve para produção — o permanente sai de um usuário do sistema, na configuração do Business Manager."
          >
            <CredentialGrid diagnostics={diagnostics} />
          </StepCard>
          <StepCard
            index={5}
            owner="nosso"
            icon={<Webhook />}
            title="Webhook"
            state={test?.ok ? "concluida" : serverReady ? "em_andamento" : "bloqueada"}
            summary="Cadastrar o endereço e o token no painel, e assinar os campos de mensagem."
            detail="A Meta chama o endereço uma vez para verificar, esperando o desafio de volta em texto puro. Depois disso, passa a entregar mensagens e status."
          />
          <StepCard
            index={6}
            owner="meta"
            icon={<MessageSquareText />}
            title="Templates"
            state="pendente"
            summary="Submeter os modelos que serão usados fora da janela de 24 horas."
            detail="Fora de 24 horas desde a última mensagem do cliente, só sai template aprovado — texto livre é recusado no envio, depois de o atendente achar que respondeu. Categoria errada custa mais e pode ser reclassificada pela Meta."
          />
        </div>
      </Reveal>

      {/* Valores para copiar ------------------------------------------------ */}
      <Reveal index={2} className="mt-5">
        <div className="bg-card shadow-card rounded-lg p-4">
          <div className="mb-3 flex items-center justify-between">
            <Eyebrow>O que colar no painel da Meta</Eyebrow>
            <Button variant="ghost" size="xs" onClick={() => void load()}>
              <RefreshCw />
              Atualizar
            </Button>
          </div>

          <CopyRow
            label="URL de callback"
            value={diagnostics?.webhookUrl ?? "carregando…"}
            hint="É o endereço que a Meta chama. Precisa ser HTTPS e alcançável pela internet."
          />

          <div className="mt-3">
            <Label className="mb-1.5 block">Token de verificação</Label>
            <div className="bg-muted/50 flex items-center gap-2 rounded-lg px-3 py-2">
              {diagnostics?.verifyTokenConfigured ? (
                <>
                  <CheckCircle2 className="text-success size-3.5 shrink-0" aria-hidden />
                  <span className="text-xs">
                    Configurado no servidor. Cadastre na Meta <strong>exatamente</strong> o mesmo
                    valor de <code className="bg-card rounded px-1">WHATSAPP_VERIFY_TOKEN</code>.
                  </span>
                </>
              ) : (
                <>
                  <CircleAlert className="text-warning size-3.5 shrink-0" aria-hidden />
                  <span className="text-xs">
                    Ainda não configurado. Escolha uma frase qualquer, coloque em{" "}
                    <code className="bg-card rounded px-1">WHATSAPP_VERIFY_TOKEN</code> e reinicie.
                  </span>
                </>
              )}
            </div>
            {/**
             * O valor do token nunca chega ao navegador — só a presença. É a
             * mesma regra do `providerStatus()` no AI Gateway: esta tela é
             * administrativa, mas continua sendo uma página web.
             */}
            <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
              O valor não é exibido aqui de propósito: ele vive só no servidor. A tela mostra que
              existe, não qual é.
            </p>
          </div>

          {diagnostics && !diagnostics.publiclyReachable ? (
            <Callout variant="warning" className="mt-3" icon={<ShieldAlert />}>
              Este endereço é local. A Meta chama de fora e não alcança <code>localhost</code> — é o
              motivo número um de a verificação falhar em desenvolvimento. Publique a aplicação, ou
              abra um túnel, antes de cadastrar.
            </Callout>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={testing} onClick={() => void runTest()}>
              {testing ? <Loader2 className="animate-spin" /> : <PlugZap />}
              Testar o webhook
            </Button>
            <span className="text-muted-foreground text-[11px] leading-relaxed">
              O servidor chama o próprio webhook imitando a Meta. Prova a metade que depende de nós.
            </span>
          </div>

          {test ? (
            <Callout
              variant={test.ok ? "success" : "danger"}
              className="mt-3"
              icon={test.ok ? <CheckCircle2 /> : <CircleAlert />}
            >
              {test.message}
            </Callout>
          ) : null}
        </div>
      </Reveal>

      {/* Eventos recebidos --------------------------------------------------- */}
      <Reveal index={3} className="mt-5">
        <div className="bg-card shadow-card rounded-lg p-4">
          <Eyebrow className="mb-1">A Meta está chegando aqui?</Eyebrow>
          <p className="text-muted-foreground mb-3 text-[11px] leading-relaxed">
            Últimos eventos recebidos pelo webhook, do mais recente para o mais antigo. Depois de
            assinar na Meta, mande uma mensagem do seu celular para o número: ela aparece aqui em
            segundos. Some no reinício do servidor — é diagnóstico, não registro.
          </p>

          {!diagnostics?.recentEvents.length ? (
            <p className="text-muted-foreground text-xs">
              Nada recebido ainda. Se você já assinou na Meta e nada aparece, o endereço não está
              alcançável ou o token não confere.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {diagnostics.recentEvents.map((event, index) => (
                <li
                  key={`${event.at}-${index}`}
                  className="bg-muted/40 flex items-start gap-2 rounded-md px-2.5 py-2"
                >
                  <EventBadge kind={event.kind} />
                  <span className="min-w-0 flex-1 text-[11px] leading-relaxed">{event.detail}</span>
                  <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                    {formatDateTime(event.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Reveal>

      {/* Números ------------------------------------------------------------- */}
      <Reveal index={4} className="mt-5">
        <Eyebrow className="mb-2">Números desta organização</Eyebrow>
        {whatsapp.length === 0 ? (
          <p className="text-muted-foreground text-xs">Nenhum número de WhatsApp cadastrado.</p>
        ) : (
          <ul className="space-y-2">
            {whatsapp.map((account) => (
              <li key={account.id} className="bg-card shadow-card rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Phone className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                  <span className="text-xs font-medium">{account.label}</span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {account.address}
                  </span>
                  <Badge
                    variant={
                      account.status === "conectado"
                        ? "success"
                        : account.status === "degradado"
                          ? "warning"
                          : "danger"
                    }
                  >
                    <StatusDot
                      tone={
                        account.status === "conectado"
                          ? "success"
                          : account.status === "degradado"
                            ? "warning"
                            : "danger"
                      }
                    />
                    {account.status}
                  </Badge>
                  {account.qualityRating ? (
                    <Tooltip content="Qualidade atribuída pela Meta. Cai com bloqueio e denúncia, e derruba o limite de envio junto.">
                      <Badge variant={account.qualityRating === "alta" ? "neutral" : "warning"}>
                        qualidade {account.qualityRating}
                      </Badge>
                    </Tooltip>
                  ) : null}
                </div>

                <p className="text-muted-foreground mt-1.5 text-[11px]">
                  Fila: {queueById.get(account.queueId)?.name ?? "não definida"}
                  {account.dailyLimit
                    ? ` · ${account.sentToday ?? 0} de ${account.dailyLimit} hoje`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
          Estado, qualidade e limite são o que a base de demonstração traz. Eles passam a refletir a
          Meta de verdade quando o adaptador de envio e os retornos de status existirem.
        </p>
      </Reveal>
    </div>
  );
}

/* Peças ---------------------------------------------------------------------- */

const STATE_META = {
  pendente: { label: "a fazer", tone: "neutral", icon: Circle },
  em_andamento: { label: "pronto para testar", tone: "warning", icon: Loader2 },
  concluida: { label: "concluída", tone: "success", icon: CheckCircle2 },
  bloqueada: { label: "depende do passo anterior", tone: "neutral", icon: Circle },
} as const;

function StepCard({
  index,
  owner,
  icon,
  title,
  state,
  summary,
  detail,
  children,
}: {
  index: number;
  owner: "meta" | "nosso";
  icon: React.ReactNode;
  title: string;
  state: keyof typeof STATE_META;
  summary: string;
  detail: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const meta = STATE_META[state];
  const Icon = meta.icon;

  return (
    <div
      className={cn("bg-card shadow-card rounded-lg p-3.5", state === "bloqueada" && "opacity-60")}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
            owner === "meta" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
          )}
          aria-hidden
        >
          {icon}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-[11px] tabular-nums">{index}.</span>
            <h3 className="text-xs font-semibold">{title}</h3>
            {/**
             * De quem é a etapa, sempre visível. É o que permite tocar as duas
             * frentes em paralelo em vez de esperar a Meta para começar aqui.
             */}
            <Badge variant="neutral">{owner === "meta" ? "no painel da Meta" : "aqui"}</Badge>
            <Badge variant={meta.tone}>
              <Icon aria-hidden className={state === "em_andamento" ? "animate-spin" : ""} />
              {meta.label}
            </Badge>
          </div>

          <p className="text-muted-foreground mt-1.5 text-[11px] leading-relaxed">{summary}</p>

          {open ? <p className="mt-2 text-[11px] leading-relaxed">{detail}</p> : null}

          {children ? <div className="mt-2.5">{children}</div> : null}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1 text-[11px] transition-colors"
          >
            <ChevronDown
              className={cn("size-3 transition-transform", open && "rotate-180")}
              aria-hidden
            />
            {open ? "Menos" : "O que costuma dar errado"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CredentialGrid({ diagnostics }: { diagnostics: WhatsappDiagnostics | null }) {
  const items: Array<{ name: string; ok: boolean; purpose: string }> = [
    {
      name: "WHATSAPP_VERIFY_TOKEN",
      ok: Boolean(diagnostics?.verifyTokenConfigured),
      purpose: "assina a inscrição do webhook",
    },
    {
      name: "WHATSAPP_APP_SECRET",
      ok: Boolean(diagnostics?.appSecretConfigured),
      purpose: "prova que o corpo veio da Meta",
    },
    {
      name: "WHATSAPP_ACCESS_TOKEN",
      ok: Boolean(diagnostics?.accessTokenConfigured),
      purpose: "envia mensagem e baixa mídia",
    },
    {
      name: "WHATSAPP_PHONE_NUMBER_ID",
      ok: Boolean(diagnostics?.phoneNumberIdConfigured),
      purpose: "identifica o número que envia",
    },
  ];

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.name} className="flex items-center gap-1.5 text-[11px]">
          {item.ok ? (
            <CheckCircle2 className="text-success size-3 shrink-0" aria-hidden />
          ) : (
            <Circle className="text-muted-foreground size-3 shrink-0" aria-hidden />
          )}
          <code className="bg-muted rounded px-1 font-mono">{item.name}</code>
          <span className="text-muted-foreground truncate">— {item.purpose}</span>
        </li>
      ))}
    </ul>
  );
}

function EventBadge({ kind }: { kind: "verificacao" | "mensagem" | "status" | "recusado" }) {
  const map = {
    verificacao: { label: "verificação", variant: "success" },
    mensagem: { label: "mensagem", variant: "success" },
    status: { label: "status", variant: "neutral" },
    recusado: { label: "recusado", variant: "danger" },
  } as const;

  return <Badge variant={map[kind].variant}>{map[kind].label}</Badge>;
}

function CopyRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-[11px]" />
        <Tooltip content="Copiar">
          <Button
            variant="outline"
            size="icon"
            aria-label={`Copiar ${label}`}
            onClick={() => {
              void navigator.clipboard.writeText(value);
              toast.success("Copiado", {
                description: "Cole no campo correspondente do painel da Meta.",
              });
            }}
          >
            <Copy />
          </Button>
        </Tooltip>
      </div>
      <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">{hint}</p>
    </div>
  );
}
