# Elora

> **O elo, agora.**

Plataforma omnichannel da **Contabilidade Facilitada**: atendimento, CRM 360º, automação visual e
inteligência artificial em um só lugar — o que o mercado vende como quatro produtos separados.

| Categoria               | Módulos da Elora                                | O que o mercado cobra em separado    |
| ----------------------- | ----------------------------------------------- | ------------------------------------ |
| Atendimento omnichannel | Inbox, Webchat, WhatsApp, filas e distribuição  | Zendesk, Octadesk, Movidesk, Digisac |
| CRM de relacionamento   | Contatos, Contato 360º, Pipeline                | Pipedrive, Ploomes, Agendor, Moskit  |
| Automação de marketing  | Campanhas, Jornadas, E-mail Studio, Automações  | RD Station, HubSpot, Marketing Cloud |
| IA aplicada             | Agentes, Chatbot Builder, copiloto do atendente | Take Blip, Weni, Intercom Fin        |

**Sobre o nome.** _Elora_ junta **elo** — o vínculo com o cliente, que é a definição de CRM — e
**ágora**, a praça grega onde comércio, deliberação e conversa aconteciam no mesmo lugar. A
terminação `-ora` fecha em _agora_, que é a promessa de qualquer plataforma de atendimento em tempo
real. Três camadas em três sílabas, e nenhuma precisa ser explicada ao usuário.

A fonte da verdade do produto continua sendo `docs/referencia/plano-completo-crm-v2.txt` (35 seções).

---

## Estado atual, sem maquiagem

A regra deste repositório é não fingir que algo funciona. O que existe se divide em três camadas:

| Camada                                   | Situação                                                                                                                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Funciona de ponta a ponta**            | Webchat (widget embutido em site de cliente → Inbox → resposta do atendente), copiloto do atendente, redação de e-mail por IA, agente de atendimento com ferramentas e avaliação, escrita real na Administração, barramento de eventos com outbox |
| **Fronteira pronta, sem persistência**   | Webhook do WhatsApp — verificação e assinatura HMAC validadas de verdade; a mensagem ainda não vira conversa                                                                                                                                      |
| **Front-end sobre base de demonstração** | Todo o resto: Inbox, Contatos, Pipeline, Campanhas, Jornadas, E-mail Studio, Analytics                                                                                                                                                            |

**Não há back-end, Supabase nem autenticação real.** A camada de escrita de conversas, contatos e
negócios ainda vive em estado de componente. Isso é o próximo grande bloco de trabalho, não um
detalhe pendente.

Os recursos de IA dependem de `GEMINI_API_KEY` no `.env` da raiz (`OPENAI_API_KEY` é opcional, e
entra como reserva). Sem nenhuma das duas, a aplicação sobe normalmente e os painéis de IA mostram o
estado "desligado" em vez de quebrar.

---

## Módulos

| Tela                  | Rota                      | O que faz                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Início**            | `/inicio`                 | Fila "precisa de você agora" reunindo SLA em risco, tarefas vencidas, aprovações paradas, execuções com erro e canais degradados; pulso do dia por hora; origem das conversas                                                                                                                       |
| **Inbox**             | `/inbox`                  | Filas, filtros, busca, SLA com prazo vivo, conversa sobre plano texturizado, anexos (arrastar, colar, galeria com lightbox, áudio com transcrição), emojis em português, notas internas, respostas rápidas, transferência, janela de 24 h do WhatsApp, **copiloto de IA** e **painel de tabulação** |
| **Contatos**          | `/contatos`               | Tabela com busca, filtros por estágio, proprietário e tag, detecção de duplicidade, ações em massa                                                                                                                                                                                                  |
| **Contato 360º**      | `/contatos/[id]`          | Visão geral, linha do tempo filtrável, conversas, negócios, identificadores e consentimentos com base legal                                                                                                                                                                                         |
| **Pipeline**          | `/pipeline`               | Kanban com arrastar e soltar, dois funis, valor ponderado, negócios parados                                                                                                                                                                                                                         |
| **Campanhas**         | `/campanhas`              | Lista com progresso de envio, construtor de segmentos com motivos de exclusão, biblioteca de templates                                                                                                                                                                                              |
| **Campanha**          | `/campanhas/[id]`         | Funil do envio, lotes, teste A/B, proteções (consentimento, supressão, quiet hours, frequência), fluxo de aprovação                                                                                                                                                                                 |
| **Automações**        | `/automacoes`             | Regras "aconteceu isto → faça aquilo", com gatilho declarando o evento de domínio que escuta                                                                                                                                                                                                        |
| **Chatbot Builder**   | `/chatbots/[id]`          | Editor de blocos, catálogo, inspetor, validação de publicação, versionamento imutável e simulador                                                                                                                                                                                                   |
| **Journey Builder**   | `/jornadas/[id]`          | Editor de jornada, política de reentrada, janela de envio, participantes com nó atual, publicação versionada                                                                                                                                                                                        |
| **E-mail Studio**     | `/email-studio`           | Templates com métricas, módulos de marca travados, brand kits, entregabilidade (SPF/DKIM/DMARC, aquecimento, supressão)                                                                                                                                                                             |
| **Editor de e-mail**  | `/email-studio/[id]`      | Montagem por blocos com prévia real, merge tags, checagem antes do envio, **redação por IA**                                                                                                                                                                                                        |
| **Agentes de IA**     | `/agentes/[id]`           | Instrução, base de conhecimento, ferramentas com allowlist, roteamento, simulador e **conjunto de avaliação executável**                                                                                                                                                                            |
| **Webchat**           | `/webchat/[id]`           | Widget configurável com prévia fiel, domínios autorizados, formulário pré-conversa, contraste calculado e publicação versionada                                                                                                                                                                     |
| **Analytics**         | `/analytics`              | Atendimento, comercial, campanhas e automação por período, mais o dicionário de métricas com definição, fonte e dono                                                                                                                                                                                |
| **Administração**     | `/administracao`          | Pessoas, times, filas com SLA e distribuição, canais, escalas, catálogos, perfis, política de acesso, **aparência** e auditoria — **com escrita real**                                                                                                                                              |
| **Setup do WhatsApp** | `/administracao/whatsapp` | As seis etapas separadas por dono, endereço do webhook, variáveis presentes (nunca o valor) e os últimos eventos recebidos                                                                                                                                                                          |

---

## O que funciona de verdade

### Webchat — o único canal completo hoje

`/webchat/embed.js` monta um `iframe` no site do cliente → `/webchat/frame` renderiza o widget →
`/api/webchat/*` resolve configuração, abre sessão e executa o fluxo de chatbot → a conversa aparece
no Inbox e a resposta do atendente volta ao visitante.

Três coisas que só existem aqui:

1. **Domínios autorizados aplicados pelo navegador.** O trecho de incorporação é público. Conferir o
   cabeçalho `Origin` nas rotas não basta — o widget roda num `iframe` no nosso domínio, então toda
   chamada chega com a nossa origem. A checagem que vale é a diretiva `frame-ancestors` respondida em
   `apps/web/src/middleware.ts`: é o navegador do visitante que se recusa a renderizar num site fora
   da lista.
2. **Contraste calculado contra a página, não contra o rótulo.** Medir só o texto sobre a cor aprova
   qualquer escolha. O que reprova de verdade é a peça contra o branco (WCAG 1.4.11, 3:1).
3. **A prévia não usa token nenhum.** No site do cliente não existe `--primary`; um widget pintado com
   `bg-primary` mudaria junto com o nosso tema e mentiria sobre o resultado.

### Inteligência artificial

Tudo passa pelo **AI Gateway**. A tela chama `repositories.ai`, que chama a rota, que é o único lugar
com a credencial, a escolha de modelo, a política, a validação por schema e a medição de custo.

| Recurso                   | Onde                    | O que faz                                                                                                                                                                                          |
| ------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copiloto do atendente** | Inbox                   | Analisa a conversa (resumo, intenção, sentimento, urgência, próximo passo, checklist, resposta sugerida), responde pergunta livre em fluxo, sugere e melhora rascunho, ajusta tom em sete direções |
| **Tabulação assistida**   | Inbox                   | O copiloto **propõe**, a aplicação **valida** contra o cadastro, a pessoa **grava**. Lacuna e divergência nunca compartilham botão                                                                 |
| **Redação de e-mail**     | E-mail Studio           | Recebe briefing e devolve assunto, preheader, corpo e chamada validados contra schema                                                                                                              |
| **Agente de atendimento** | Agentes                 | Laço completo: recebe, decide, usa ferramenta, responde, transfere. Leitura executa; **escrita nunca** — vira ação pendente que espera clique de gente                                             |
| **Avaliação**             | `/api/ai/agent/avaliar` | Executa os casos e pontua por dimensão com verificações determinísticas, atreladas à `promptVersion`                                                                                               |

**Três guardas moram na aplicação, não no prompt**: o piso de confiança vira transferência, a fila
escolhida é validada contra o catálogo (fila inventada cai na padrão) e o teto de custo é por
conversa, conferido antes de gastar. Pedir ao modelo que se autocensure funciona às vezes; conferir
funciona sempre.

#### Reserva de provedor

| Ordem | Provedor | Modelo             | Papel                                       |
| ----- | -------- | ------------------ | ------------------------------------------- |
| 1º    | Google   | `gemini-2.5-flash` | atende sempre; é a qualidade do dia a dia   |
| 2º    | OpenAI   | `gpt-4.1-mini`     | entra só quando o primário não pode atender |

**A troca é por disponibilidade, nunca por qualidade.** Só `indisponivel`, `limite_excedido` e
`sem_credencial` acionam a reserva. Recusa de conteúdo seria a mesma dos dois lados, e falha de schema
é problema de prompt. `AiRunMeta` registra **quem atendeu**, não quem devia atender.

### Administração — a primeira parte do produto que escreve

`AdminRepository` grava num armazém preso ao `globalThis`, que sobrevive à navegação e ao
recarregamento e morre no reinício. A escrita nasceu no repositório, não em estado de componente,
para que a troca por Supabase não toque nenhuma tela.

- **Toda escrita devolve `AdminWriteResult`, nunca lança.** "É o último administrador" é resposta com
  motivo escrito, mostrado dentro do diálogo — num toast, some antes da leitura terminar.
- **Toda escrita registra auditoria**, dentro do repositório. Não existe caminho de escrita sem rastro.
- **As regras moram em `utils/admin-rules.ts` e são consultadas duas vezes**: a tela pergunta para
  desabilitar o botão, o repositório pergunta antes de gravar.

A regra de distribuição (`utils/distribution.ts`) é **função pura**: recebe tudo por parâmetro, não lê
relógio e não sorteia. Empate resolve por identificador, `menor_carga` compara ocupação relativa, a
decisão carrega o motivo de cada descarte, e `offline` nunca recebe em nenhuma configuração.

### Barramento de eventos

O webhook faz duas coisas: **valida e publica**. Não resolve contato, não abre conversa, não acorda o
agente — isso acontece depois, em outra transação, com retentativa própria.

- **Evento e entrada de outbox são coisas diferentes.** O evento é o fato, imutável. A entrada é a
  intenção de entregar aquele fato a **um** destino, com contador próprio.
- **A chave de idempotência vem do provedor, nunca do conteúdo.** Duas pessoas mandando "ok" no mesmo
  minuto gerariam a mesma chave por resumo, e a segunda mensagem sumiria.
- **A deduplicação devolve o evento original, não erro.** Tratar reentrega como falha faria a Meta
  reentregar para sempre.

`supabase/migrations/0001_fundacao_eventos.sql` **nunca foi executado** — é artefato para revisão e
primeira execução assistida. Rode em projeto descartável antes de qualquer coisa.

### WhatsApp — fronteira pronta, nada atrás dela

`/api/canais/whatsapp/webhook` faz de verdade as duas coisas que a Meta exige: devolve o desafio da
verificação **em texto puro** e valida `X-Hub-Signature-256` com HMAC sobre o **corpo cru**. Sem
`WHATSAPP_APP_SECRET`, o webhook recusa tudo.

**Falta a mensagem virar conversa**: persistência, idempotência por `waMessageId`, fila e worker. Não
"termine" isso com um `Map` — o do webchat é honesto porque é o nosso widget na nossa máquina; aqui é
o número da empresa na mão do cliente.

### Anexos

| Origem      | Situação                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Link**    | Funciona. `/api/media/preview` resolve tipo, tamanho, título e capa no servidor, inclusive vídeo do YouTube por oEmbed |
| **Arquivo** | Não sai do navegador. Vive num `File` em memória com object URL; o caminho real de mídia é trabalho de back-end        |

> **Toda busca de URL informada pelo cliente passa por `lib/net/safe-fetch.ts`**: só http e https, só
> portas 80 e 443, resolução de DNS com todos os endereços conferidos, faixas privadas, loopback,
> link-local e CGNAT bloqueadas, IPv6 expandido byte a byte, e cada salto de redirecionamento
> revalidado. Três rotas dependem dela — prévia de mídia, prévia de site e base de conhecimento dos
> agentes. Afrouxar a validação transforma o servidor em procurador da rede interna.

---

## Como rodar

```bash
pnpm install
cp .env.example .env      # preencha GEMINI_API_KEY para ligar a camada de IA
pnpm dev
```

A aplicação sobe em <http://localhost:3200>. A rota `/` é a **landing page**; o produto começa em
`/inicio`. Duas entradas convivem e não são a mesma coisa: `/entrar` é a área do cliente do site
público (conta com senha, orçamentos salvos e, para a equipe comercial, as bases de demonstração em
`/admin`); `/login` continua sendo a tela de entrada do protótipo do produto, com seleção de perfil e
sem validação de credencial.

O `.env` fica na **raiz** do repositório, não em `apps/web`: é um valor por repositório, e
`apps/web/next.config.mjs` carrega a raiz para o segredo não existir em dois lugares. Nenhuma variável
de IA usa o prefixo `NEXT_PUBLIC_` — a chave do provedor nunca chega ao navegador.

```bash
pnpm typecheck    # tsc --noEmit nos três pacotes
pnpm lint         # eslint, zero avisos tolerados
pnpm test         # vitest — barramento de eventos, outbox, idempotência
pnpm build        # build de produção
pnpm format       # prettier
```

Requisitos: Node ≥ 20.11 e pnpm 9.

> **Não rode `pnpm build` com o `pnpm dev` no ar.** Os dois escrevem em `apps/web/.next`, e o build
> substitui artefatos que o servidor de desenvolvimento mantém abertos. O sintoma não parece
> ambiental: metade das rotas passa a responder `Internal Server Error` em texto puro, 21 bytes, sem
> pilha e sem nada no navegador que aponte a causa. A saída é parar o `dev`, apagar `.next` e subir de
> novo. Para medir desempenho com o `dev` de alguém no ar, use `next build --distDir .next-perf`.

---

## Estrutura

```
elora/
├─ apps/web/                 aplicação Next.js
│  └─ src/
│     ├─ app/                rotas (App Router) e rotas de API
│     ├─ components/         inbox, contacts, pipeline, chatbots, journeys, agents, webchat, admin, flow, shell
│     ├─ lib/ai/             AI Gateway — política, prompts versionados, provedores, runtime do agente
│     ├─ lib/webchat/        servidor de sessões do widget
│     ├─ lib/canais/         WhatsApp e cofre de credenciais
│     └─ lib/net/            guarda contra SSRF
├─ packages/
│  ├─ core/                  tipos canônicos, utilitários, base de demonstração, repositórios
│  ├─ ui/                    design system @elora/ui
│  └─ config/                preset Tailwind
├─ supabase/migrations/      fundação de eventos (ainda não executada)
├─ docs/
│  ├─ referencia/            Plano Completo (fonte da verdade)
│  ├─ arquitetura.md         decisões desta onda e o que muda na próxima
│  └─ design-system.md       tokens, componentes e regras visuais
└─ .claude/agents/           doze especialistas mapeados aos papéis da seção 24
```

---

## Regras que não se negociam

**Acesso a dados passa por repositório.** A aplicação consome as interfaces de
`packages/core/src/repositories/types.ts`. Se você escrever `fetch` ou cliente Supabase dentro de um
componente de tela, está errado.

**IA passa pelo Gateway.** Dois arquivos, e só eles, podem nomear um provedor: `lib/ai/gateway.ts`
(política, prompt, mascaramento, validação) e `lib/ai/providers.ts` (transporte e reserva). Prompt
novo vai em `lib/ai/prompts.ts` **com versão** — e ao mudar o texto, suba a versão, porque é o que
permite atribuir queda de qualidade.

**Cor sai de token.** Tudo vem de `packages/ui/src/styles/tokens.css`. Componente não escreve
hexadecimal. Duas exceções com dono único: cores derivadas de dado (informam só a matiz) e marcas de
terceiros (a cor faz parte do glifo, e vive em `lib/brand-icons.tsx`).

**Campo usa `border-input`, nunca `border-border`.** Não é estética: limite de componente de interface
tem piso obrigatório de 3:1 pela WCAG 1.4.11.

**Tempo é ancorado.** `packages/core/src/utils/datetime.ts` prende tudo a `REFERENCE_NOW_ISO` e ao
fuso `America/Sao_Paulo`. Nunca use `Date.now()`, `new Date()` ou `toLocaleString` sem `timeZone` em
código renderizado — servidor e cliente divergem e a hidratação quebra.

**Server Component por padrão.** `"use client"` só onde há interação ou estado.

**Toda superfície de dados tem quatro estados**: vazio, carregando, erro e sucesso.

**Multiempresa desde o tipo.** Toda entidade carrega `organizationId`. Quando o back-end entrar, a RLS
valida a associação do usuário à organização.

---

## Camada de dados

As telas consomem **repositórios**, nunca a origem do dado:

```
ContactRepository · ConversationRepository · DealRepository · AutomationRepository
DirectoryRepository · CampaignRepository · EmailStudioRepository · InsightsRepository
GovernanceRepository · AdminRepository · AiRepository
```

Hoje resolvem para a implementação em memória. Quando o Supabase entrar, muda apenas
`packages/core/src/repositories/index.ts` — nenhuma tela precisa ser reescrita.

`AiRepository` é a exceção: já aponta para o Gateway real. Inteligência não tem versão em memória que
valha algo — uma resposta fixa não ensina nada sobre latência, custo ou qualidade do prompt.

---

## Base de demonstração

Tudo é fictício e determinístico. Nenhum dado real de contato, mensagem ou documento é usado.

- 1 organização, 7 usuários, 4 times, 4 filas, 5 contas de canal
- 26 contatos (incluindo uma duplicidade proposital), 6 empresas, 10 tags
- 16 conversas com histórico completo, notas internas, anexos e falhas de entrega
- 18 negócios em 2 funis, 8 tarefas
- 2 chatbots, 2 jornadas e agentes de IA com base de conhecimento e casos de avaliação
- 6 campanhas em estados diferentes, 4 segmentos e 6 templates (um reprovado)
- 4 e-mails montados em blocos, 5 módulos de marca, 2 brand kits, 2 domínios, 10 supressões
- séries de 14 dias, pulso por hora, saúde das automações, custos e 10 entradas de auditoria

A fila da página inicial é **derivada** dos demais dados — SLA em risco vem das conversas, aprovações
vêm das campanhas, erros vêm das jornadas. Nada aparece ali sem um evento por trás.

---

## Identidade visual — Arena Elora

| Papel             | Cor       | HSL           |
| ----------------- | --------- | ------------- |
| Índigo principal  | `#1E1B4B` | `244 47% 20%` |
| Índigo secundário | `#312E81` | `242 48% 34%` |
| Branco            | `#FFFFFF` | superfícies   |
| Âmbar (acento)    | `#DC8F09` | `38 92% 45%`  |

**O símbolo é um anel que não fecha, e a abertura é preenchida pelas três hastes do E** — "elo" e
"Elora" na mesma forma. Vive em `components/shell/logo.tsx`, desenhado em SVG: herda cor de token,
funciona nos dois temas sem segundo arquivo e acompanha a troca de paleta de graça. Não há PNG de
marca no repositório.

Três regras de composição sustentam a interface:

1. **A borda é exceção — e exceção precisa ser vista.** Superfícies se separam por cor e sombra;
   hairline só onde duas regiões roláveis se encontram. O traço tem piso de contraste: `--border` em
   1,86:1, `--border-strong` em 2,68:1, `--input` em **3,41:1** e `--focus-ring` em 3,73:1. O foco não
   usa `--accent`: o âmbar rende 2,63:1 contra branco e não serve para traço fino.
2. **Um acento por tela.** O âmbar marca o que precisa de ação — não decora.
3. **A tipografia carrega a hierarquia.** Sora nos números e títulos, Inter na interface, ambas
   auto-hospedadas via `@fontsource`.

### Aparência configurável

A Administração tem uma aba **Aparência** com duas metades que gravam em lugares diferentes, porque
respondem a perguntas de donos diferentes.

| Decisão                     | Dono        | Onde grava                                   |
| --------------------------- | ----------- | -------------------------------------------- |
| Paleta da instalação        | Organização | `AdminRepository`, com validação e auditoria |
| Padrões de modo e densidade | Organização | idem                                         |
| Permitir escolha individual | Organização | idem                                         |
| Modo e densidade de cada um | Pessoa      | `localStorage` do navegador                  |

São **quatro paletas** — Índigo (padrão), Petróleo, Grafite e Arena clássica, esta última preservando
o azul e a laranja originais. A troca redefine só os tokens de marca: semântica (`--success`,
`--warning`, `--destructive`) e as seis séries de gráfico ficam de fora, porque as primeiras
significam a mesma coisa em qualquer tema e as segundas foram validadas para daltonismo. Cada paleta
carrega o seu `--focus-ring` acima de 3:1.

**A paleta é servida, a preferência é do navegador.** `data-palette` sai do servidor já no HTML;
resolvê-la no cliente pintaria a página com a paleta padrão para repintá-la no primeiro quadro — o
flash mais caro possível, porque atinge todos os tokens de uma vez. Modo e densidade dependem de
`localStorage` e de `prefers-color-scheme`, e por isso continuam no único script inline da aplicação.

**Densidade escala a raiz tipográfica** (15 / 16 / 17 px), e não uma lista de utilitários: o Tailwind
mede espaçamento em `rem`, então padding, gap, altura de linha e texto se movem juntos e na mesma
proporção. Compacto encolhe cada medida em 6,25% — numa lista de conversas, isso devolve uma linha
inteira por tela.

**O Inbox tem plano próprio.** Não usa `surface-sunken`: usa `--chat-canvas`, um bege azulado
texturizado. O desenho entra como **máscara** — o SVG carrega só a forma, a tinta sai de
`--chat-doodle` —, e é isso que permite a mesma textura servir aos dois temas sem duplicar arquivo e
sem quebrar a regra de que cor sai de token.

**Gráfico segue o método.** As primitivas em `packages/ui/src/components/chart.tsx` já carregam as
regras. A paleta `--chart-1..6` foi validada para daltonismo (ΔE ≥ 8 em pares adjacentes) e contraste
nas duas superfícies — não invente uma sétima cor: dobre em "Outros" ou facete.

**Movimento é uma orquestração por página**, e isso é aplicado, não recomendado: toda tela com abas é
envolvida por `<RevealScope>`, que marca a entrada como concluída após 1,2 s. Sem isso, trocar de aba
reexecutava a orquestração inteira — 910 ms de espera para conteúdo que já estava em memória.
`prefers-reduced-motion` anula tudo no CSS.

**Todo efeito é `transform` ou `opacity`.** Não é preferência estética: o gargalo deste front é
recálculo de estilo e layout, não JavaScript (números abaixo), e animar `width`, `top`, `box-shadow`
ou `filter` acrescenta trabalho exatamente onde já dói.

| Efeito            | O que faz                                   | Como evita layout                                                         |
| ----------------- | ------------------------------------------- | ------------------------------------------------------------------------- |
| `.sheen`          | brilho atravessa cartão no hover            | pseudo-elemento que desliza, não posição de fundo                         |
| `.brand-sheen`    | varredura lenta da marca, a cada 12 s       | idem — e devagar, porque fica visível o tempo todo ao lado da navegação   |
| `.underline-grow` | sublinhado da aba ativa cresce do centro    | `scaleX`, em vez de medir o gatilho e reposicionar um indicador           |
| `.stagger`        | entrada de linha de lista, 28 ms por índice | o mesmo par `opacity`/`translateY` de `.reveal`, em cadência de lista     |
| `.glow-pulse`     | halo que respira no que está vivo           | acende uma camada já no tamanho final, em vez de crescer sombra           |
| `.lift-3d`        | cartão se aproxima no hover                 | `perspective` dentro da própria `transform`, sem criar contexto 3D no pai |

**Laço tem de parar em repouso.** O bloco de `prefers-reduced-motion` leva toda animação ao último
quadro, então o último quadro de cada laço é o estado parado — halo apagado, brilho fora da peça,
cubo fechado. Efeito de `hover` não tem esse recurso, e por isso `.sheen` e `.brand-sheen` são
desligados por completo ali.

---

## Desempenho

Medido em build de produção com **Event Timing** (`processingEnd - processingStart`, isto é, o
trabalho de script — sem a latência de quadro do navegador de teste):

| Interação                   | Antes   | Depois  |
| --------------------------- | ------- | ------- |
| Trocar de conversa, mediana | 64,1 ms | 15,9 ms |
| Trocar de conversa, pior    | 76,3 ms | 24,2 ms |
| Digitar uma tecla, mediana  | 4,0 ms  | 2,1 ms  |
| Digitar uma tecla, pior     | 16,8 ms | 3,5 ms  |

**O gargalo deste front não é JavaScript.** Em sete trocas de conversa havia ~300 ms de script contra
~800 ms de recálculo de estilo e layout. Antes de memorizar qualquer coisa, tire um perfil e olhe
`Document::recalcStyle` e `LocalFrameView::UpdateStyleAndLayout` — memorizar componente fora do caminho
crítico já rendeu 3,5 ms aqui, que é trabalho perdido.

As três mudanças que produziram o ganho:

1. **A conversa não é mais remontada.** `key={selected.id}` destruía e recriava a subárvore inteira a
   cada troca. Se a intenção é só zerar estado, faça num efeito preso ao identificador.
2. **`scrollIntoView` só na navegação por teclado.** Força passe síncrono de layout, e nos cliques o
   item já estava visível.
3. **Contexto do copiloto sob demanda.** Percorrer e ordenar todo o histórico era refeito a cada troca
   para algo que só a chamada ao provedor consome.

Se uma mudança levar a troca de conversa acima de ~25 ms ou a tecla acima de ~5 ms, algo regrediu.

---

## Testes

```bash
pnpm test
```

Os testes começam no **barramento de eventos**, de propósito: até ele, o que existia era front —
errado, aparece na tela. O barramento é a primeira peça cujo defeito é **invisível**. Cobrem a
separação entre evento e entrada de outbox, a idempotência por chave do provedor, a deduplicação que
devolve o original e o recuo por `nextAttemptAt`.

---

## Próximos passos

**Fundação de back-end** — Supabase, auth, organizações, RLS, auditoria, event store, outbox, filas,
workers, CI/CD e observabilidade. É o que transforma as telas atuais em produto.

**Camada de escrita** — hoje as mutações de conversa, contato e negócio vivem em estado local do
componente. Entram junto com idempotência, outbox e auditoria reais.

**Executor de distribuição** — a regra existe e é pura, a configuração grava e a prévia funciona;
falta quem execute: gravar a atribuição, contar o tempo da oferta, passar ao próximo e avançar o
cursor da roleta. Não "termine" isso com um `setTimeout` no servidor — oferta expirada precisa
sobreviver a reinício, o que é fila.

**Mídia (seção 11)** — upload, antivírus, armazenamento, expiração, miniatura no servidor e URL
assinada. A interface já trata `url` ausente como "processando mídia", então o back-end entra sem
redesenho.

**Resto da fase 6** — RAG com pgvector (a busca é léxica em memória, e a extração de PDF e Word depende
do caminho de mídia), controle de cota por organização e histórico de rodadas de avaliação para
comparar versões ao longo do tempo.

**WhatsApp de ponta a ponta** — persistência da mensagem, idempotência por `waMessageId`, fila e
worker de envio.
