"use client";

import { AnimatedNumber, cn } from "@elora/ui";
import {
  ArrowRight,
  Bot,
  Check,
  CircleDot,
  Clock3,
  ListChecks,
  Mail,
  MessageSquare,
  Pause,
  Split,
  Tag,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

/**
 * As telas do produto, desenhadas.
 *
 * Mesma decisão do `product-preview.tsx`, e vale repetir porque agora são oito:
 * captura de tela envelhece, não acompanha o tema e não anima. Desenhadas em
 * JSX, as prévias herdam token, funcionam em claro e escuro, escalam sem borrar
 * e o texto dentro delas é texto de verdade — o que importa para quem lê a
 * página com leitor de tela e para quem a encontra pela busca.
 *
 * ## O que estas prévias podem e não podem fazer
 *
 * Podem simplificar: menos colunas, menos linhas, densidade um pouco maior que
 * a real. **Não podem inventar recurso.** Toda peça aqui existe no produto — o
 * transbordo por SLA, o ponderado por probabilidade, a janela silenciosa da
 * campanha, o passo de confirmação humana do agente. Uma prévia que promete o
 * que a tela não faz é a forma mais cara de gerar cancelamento no terceiro mês.
 *
 * ## Uma moldura só
 *
 * `PreviewFrame` dá a barra de navegador a todas. Sem ela, cada prévia flutuaria
 * como um cartão qualquer e a página perderia a leitura de "isto é um
 * aplicativo". Com oito molduras diferentes, perderia a de "é o mesmo produto".
 *
 * ## Todas se movem, e o movimento diz o que a tela faz
 *
 * Não é enfeite: cada prévia anima **o gesto que aquele módulo resolve**. O
 * pipeline arrasta um negócio de etapa; o contato preenche a linha do tempo em
 * ordem; o chatbot desenha o fluxo nó a nó; a campanha enche os lotes; o agente
 * executa os passos e responde; o analytics conta os números. Uma tela parada
 * comunica "imagem de um produto"; a mesma tela em movimento comunica "produto
 * funcionando", que é a diferença que a seção inteira existe para produzir.
 *
 * As classes vivem em `packages/ui/src/styles/tokens.css` (`.preview-*`), porque
 * é lá que o corte de `prefers-reduced-motion` alcança. Todo laço decorativo
 * repousa **invisível** e toda entrada repousa **no lugar** — ver o bloco
 * "Prévias do produto" naquele arquivo.
 *
 * ## Por que `"use client"` está declarado
 *
 * Este arquivo já era cliente por herança: quem o consome é `product-showcase`,
 * que é cliente. Declarar torna a fronteira explícita e permite passar função de
 * formatação a `AnimatedNumber` sem que um `import` futuro a partir de um Server
 * Component quebre com "functions cannot be passed to client components".
 */

/** Índice de escalonamento, para as classes `.preview-*` lerem. */
function step(index: number): React.CSSProperties {
  return { "--preview-index": index } as React.CSSProperties;
}

/** Fração de preenchimento de uma barra que cresce por `scaleX`. */
function fill(fraction: number, index = 0): React.CSSProperties {
  return { "--bar-fill": fraction, "--preview-index": index } as React.CSSProperties;
}

export function PreviewFrame({
  path,
  children,
  className,
  label,
}: {
  path: string;
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div
      className={cn(
        "border-border/60 bg-surface shadow-overlay overflow-hidden rounded-2xl border",
        className,
      )}
      role="img"
      aria-label={label}
    >
      <div className="border-border bg-surface-sunken flex items-center gap-2 border-b px-3 py-2">
        <span className="flex gap-1.5">
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
        </span>
        <span className="bg-surface border-border text-muted-foreground ml-2 flex-1 truncate rounded-md border px-2 py-1 text-[11px]">
          {path}
        </span>
      </div>
      {children}
    </div>
  );
}

/* Pipeline ---------------------------------------------------------------------- */

interface PipelineCard {
  title: string;
  owner: string;
  value: string;
  tag: string;
  /** Passou do tempo máximo da etapa — o chip muda de cor. */
  stalled?: boolean;
}

/**
 * Os números desta prévia fecham, e isso não é preciosismo.
 *
 * A versão anterior mostrava uma coluna somando R$ 968 mil com um cartão de
 * R$ 1,95 mi dentro dela. Numa prévia cujo argumento é "o funil mostra o que
 * está parado" e numa página que vende número auditável, aritmética que não
 * fecha desmonta o argumento inteiro — e desmonta com quem lê com atenção, que
 * é exatamente quem estava perto de comprar.
 *
 * A regra: soma dos cartões = total da coluna; ponderado = total × fill; e o
 * cabeçalho soma as três colunas. Ao mexer em qualquer valor, refaça as três.
 */
const PIPELINE_COLUMNS: Array<{
  name: string;
  total: string;
  weighted: string;
  fill: number;
  cards: PipelineCard[];
}> = [
  {
    name: "Visita realizada",
    total: "R$ 2,53 mi", // 880 + 1.650
    weighted: "R$ 1,01 mi · 40%",
    fill: 40,
    cards: [
      {
        title: "AP-2214 Setor Bueno",
        owner: "Marina D.",
        value: "R$ 880.000",
        tag: "Financiamento",
      },
      {
        title: "Casa Jardim Goiás",
        owner: "Cláudio B.",
        value: "R$ 1.650.000",
        tag: "Alto padrão",
      },
    ],
  },
  {
    name: "Proposta em análise",
    total: "R$ 1,95 mi",
    weighted: "R$ 1,17 mi · 60%",
    fill: 60,
    cards: [
      { title: "Cobertura Vertice", owner: "Marina D.", value: "R$ 1.950.000", tag: "Investidor" },
    ],
  },
  {
    name: "Crédito e jurídico",
    total: "R$ 265 mil",
    weighted: "R$ 225 mil · 85%",
    fill: 85,
    cards: [
      {
        title: "MCMV Aparecida",
        owner: "Élton R.",
        value: "R$ 265.000",
        tag: "Parado 8 d",
        stalled: true,
      },
    ],
  },
];

export function PipelinePreview() {
  return (
    <PreviewFrame
      path="app.elora.com.br/pipeline"
      label="Prévia do Pipeline: colunas por etapa com valor total, valor ponderado pela probabilidade e cartões de negócio."
    >
      <div className="border-border flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b px-4 py-2.5">
        {/* 2,53 + 1,95 + 0,265 = 4,745 mi · ponderado 1,01 + 1,17 + 0,225 = 2,405 mi */}
        <span className="text-sm">
          <span className="figure font-semibold">R$ 4,75 mi</span>{" "}
          <span className="text-muted-foreground text-[11px] uppercase">em aberto</span>
        </span>
        <span className="text-sm">
          <span className="figure font-semibold">R$ 2,41 mi</span>{" "}
          <span className="text-muted-foreground text-[11px] uppercase">ponderado</span>
        </span>
        <span className="text-sm">
          <span className="figure text-success font-semibold">R$ 1,65 mi</span>{" "}
          <span className="text-muted-foreground text-[11px] uppercase">ganho</span>
        </span>
        <span className="text-muted-foreground ml-auto text-[11px]">
          ciclo médio 74 dias · visita → proposta 23%
        </span>
      </div>

      <div className="bg-surface-sunken grid gap-2 p-3 sm:grid-cols-3">
        {PIPELINE_COLUMNS.map((column, columnIndex) => (
          <div key={column.name} className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide">{column.name}</p>
            <p className="figure mt-0.5 text-sm font-semibold">{column.total}</p>
            <p className="text-muted-foreground text-[10px]">ponderado {column.weighted}</p>
            <div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full">
              <div
                className="preview-bar-x bg-accent h-full w-full rounded-full"
                style={fill(column.fill / 100, columnIndex)}
              />
            </div>

            <div className="relative mt-2 space-y-2">
              {/*
                O fantasma vive na coluna do meio, e só nela: é o negócio que
                acabou de sair de "Visita realizada" e se encaixa em "Proposta em
                análise". Duas cópias viajando ao mesmo tempo virariam confete —
                o gesto que a prévia precisa mostrar é **um** cartão mudando de
                etapa, não um funil em polvorosa.
              */}
              {columnIndex === 1 ? (
                <div
                  className="preview-ghost bg-surface border-accent/60 shadow-overlay pointer-events-none absolute inset-x-0 top-0 z-10 rounded-lg border p-2.5"
                  aria-hidden
                >
                  <p className="truncate text-[11px] font-medium">{column.cards[0].title}</p>
                  <p className="text-muted-foreground truncate text-[10px]">
                    {column.cards[0].owner}
                  </p>
                  <p className="figure mt-1 text-xs font-semibold">{column.cards[0].value}</p>
                  <span className="bg-accent-soft text-accent-ink mt-1.5 inline-flex rounded px-1.5 py-0.5 text-[9px] font-medium">
                    movendo etapa
                  </span>
                </div>
              ) : null}

              {column.cards.map((card, cardIndex) => (
                <div
                  key={card.title}
                  style={step(columnIndex + cardIndex)}
                  className="preview-in bg-surface border-border/70 shadow-card rounded-lg border p-2.5"
                >
                  <p className="truncate text-[11px] font-medium">{card.title}</p>
                  <p className="text-muted-foreground truncate text-[10px]">{card.owner}</p>
                  <p className="figure mt-1 text-xs font-semibold">{card.value}</p>
                  <span
                    className={cn(
                      "mt-1.5 inline-flex rounded px-1.5 py-0.5 text-[9px] font-medium",
                      card.stalled
                        ? "bg-warning-soft text-warning"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {card.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

/* Analytics --------------------------------------------------------------------- */

const SERIES = [38, 52, 44, 61, 73, 58, 81, 69, 92, 77, 88, 96];
const CHANNELS = [
  { name: "WhatsApp", share: 62 },
  { name: "Webchat", share: 18 },
  { name: "E-mail", share: 12 },
  { name: "Instagram", share: 8 },
];

export function AnalyticsPreview() {
  const max = Math.max(...SERIES);

  return (
    <PreviewFrame
      path="app.elora.com.br/analytics"
      label="Prévia do Analytics: indicadores de atendimento, série de conversas por hora e volume por canal."
    >
      <div className="p-4">
        {/*
          Os quatro números contam a partir de zero na montagem.

          `AnimatedNumber` serve à leitura, não ao enfeite: a contagem dura 700 ms
          com desaceleração, o que dá tempo de perceber a ordem de grandeza antes
          de o valor assentar. O custo por atendimento conta em **centavos** e é
          formatado na saída — o componente arredonda, e um valor fracionário
          animaria de 0,0 a 0,5 e pararia lá, mostrando um preço errado.
        */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            {
              label: "Conversas hoje",
              value: 1_284,
              format: (value: number) => value.toLocaleString("pt-BR"),
              hint: "+12% vs. ontem",
              icon: MessageSquare,
            },
            {
              label: "Primeira resposta",
              value: 40,
              format: (value: number) => `${value} s`,
              hint: "meta 60 s",
              icon: Timer,
            },
            {
              label: "Resolvido por IA",
              value: 61,
              format: (value: number) => `${value}%`,
              hint: "+4 p.p. no mês",
              icon: Bot,
              up: true,
            },
            {
              label: "Custo / atendimento",
              value: 53,
              format: (value: number) => `R$ ${(value / 100).toFixed(2).replace(".", ",")}`,
              hint: "−R$ 0,08",
              icon: TrendingUp,
              up: true,
            },
          ].map((tile) => (
            <div key={tile.label} className="border-border bg-surface rounded-lg border p-2.5">
              <tile.icon className="text-muted-foreground size-3.5" aria-hidden />
              <p className="figure mt-1.5 text-lg font-semibold leading-none">
                <AnimatedNumber value={tile.value} format={tile.format} />
              </p>
              <p className="text-muted-foreground mt-1 text-[10px] leading-tight">{tile.label}</p>
              {/*
                Verde só onde há variação a comemorar. "Meta 60 s" é referência,
                não melhora — pintá-la de sucesso ensina o olho a ignorar a cor,
                e aí ela para de significar alguma coisa nos ladrilhos em que
                significava.
              */}
              <p
                className={cn(
                  "text-[10px] leading-tight",
                  tile.up ? "text-success" : "text-muted-foreground",
                )}
              >
                {tile.hint}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <div className="border-border bg-surface rounded-lg border p-3">
            <p className="text-[11px] font-semibold">Conversas por hora</p>
            <p className="text-muted-foreground text-[10px]">08h às 19h · hoje</p>
            <div className="mt-3 flex h-24 items-end gap-1.5">
              {/*
                A coluna já nasce com a altura final e sobe por `scaleY` a partir
                da base. Animar `height` daria o mesmo efeito e pagaria layout em
                doze elementos a cada quadro — numa página em que o recálculo de
                estilo é o gargalo medido.
              */}
              {SERIES.map((value, index) => (
                <span
                  key={index}
                  className="preview-bar-y bg-chart-1/85 min-w-0 flex-1 rounded-t-[3px]"
                  style={{ height: `${(value / max) * 100}%`, ...step(index) }}
                />
              ))}
            </div>
            <div className="text-muted-foreground mt-1.5 flex justify-between text-[9px]">
              <span>08h</span>
              <span>13h</span>
              <span>19h</span>
            </div>
          </div>

          <div className="border-border bg-surface rounded-lg border p-3">
            <p className="text-[11px] font-semibold">Volume por canal</p>
            <ul className="mt-3 space-y-2">
              {CHANNELS.map((channel, index) => (
                <li key={channel.name}>
                  <div className="flex items-baseline justify-between text-[10px]">
                    <span>{channel.name}</span>
                    <span className="figure">{channel.share}%</span>
                  </div>
                  <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "preview-bar-x h-full w-full rounded-full",
                        ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4"][index],
                      )}
                      style={fill(channel.share / 100, index + 6)}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground border-border mt-3 border-t pt-2 text-[9px] leading-tight">
              Toda métrica tem definição escrita no dicionário — número solto não vira decisão.
            </p>
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}

/* Chatbot Builder ---------------------------------------------------------------- */

const NODES = [
  { id: "inicio", label: "Início", detail: "Webchat · site", icon: CircleDot, x: 4, y: 8 },
  {
    id: "pergunta",
    label: "Qual seu pedido?",
    detail: "Pergunta → variável",
    icon: MessageSquare,
    x: 4,
    y: 40,
  },
  { id: "condicao", label: "Encontrou o pedido?", detail: "Condição", icon: Split, x: 4, y: 72 },
];

export function ChatbotPreview() {
  return (
    <PreviewFrame
      path="app.elora.com.br/chatbots/bot_webchat_site"
      label="Prévia do Chatbot Builder: canvas com nós de início, pergunta, condição e ramificação, ao lado do painel de validação."
    >
      <div className="grid lg:grid-cols-[1fr_200px]">
        <div className="grid-surface bg-surface-sunken relative min-h-[300px] p-4">
          {/*
            O fluxo se monta na frente de quem olha: nó, traço, nó, traço, e os
            dois ramos por último. É a ordem em que alguém o desenharia — e é o
            argumento da aba, que é sobre o **construtor**, não sobre o bot.
          */}
          <div className="space-y-3">
            {NODES.map((node, index) => (
              <div key={node.id} className="relative">
                <div
                  style={step(index)}
                  className="preview-in bg-surface border-border shadow-card w-full max-w-[240px] rounded-lg border p-2.5"
                >
                  <span className="flex items-center gap-1.5">
                    <node.icon className="text-accent size-3.5" aria-hidden />
                    <span className="text-[11px] font-semibold">{node.label}</span>
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-[10px]">
                    {node.detail}
                  </span>
                </div>
                {index < NODES.length - 1 ? (
                  <span
                    className="preview-draw border-border absolute left-5 top-full h-3 border-l-2 border-dashed"
                    style={step(index)}
                    aria-hidden
                  />
                ) : null}
              </div>
            ))}

            <div className="ml-6 grid gap-2 sm:grid-cols-2">
              <div
                style={step(NODES.length)}
                className="preview-in bg-surface border-success/40 shadow-card rounded-lg border p-2.5"
              >
                <span className="text-success flex items-center gap-1.5 text-[11px] font-semibold">
                  <Check className="size-3.5" aria-hidden />
                  Sim
                </span>
                <span className="text-muted-foreground mt-0.5 block text-[10px]">
                  Responde status e encerra
                </span>
              </div>
              <div
                style={step(NODES.length + 1)}
                className="preview-in bg-surface border-accent/50 shadow-card rounded-lg border p-2.5"
              >
                <span className="text-accent-ink flex items-center gap-1.5 text-[11px] font-semibold">
                  <Users className="size-3.5" aria-hidden />
                  Não
                </span>
                <span className="text-muted-foreground mt-0.5 block text-[10px]">
                  Transfere para fila com resumo
                </span>
              </div>
            </div>
          </div>
        </div>

        <aside className="border-border border-t p-3 lg:border-l lg:border-t-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide">Antes de publicar</p>
          <ul className="mt-2 space-y-2">
            {[
              { ok: true, text: "Todo caminho termina em encerramento ou transferência" },
              { ok: true, text: "Nenhum nó órfão" },
              { ok: true, text: "Variáveis do formulário já preenchidas" },
              { ok: false, text: "Fila de transbordo sem escala no domingo" },
            ].map((check, index) => (
              <li
                key={check.text}
                style={step(index + NODES.length + 2)}
                className="preview-in flex gap-1.5 text-[10px] leading-snug"
              >
                {check.ok ? (
                  <Check className="text-success mt-0.5 size-3 shrink-0" aria-hidden />
                ) : (
                  <Clock3 className="text-warning mt-0.5 size-3 shrink-0" aria-hidden />
                )}
                <span className={check.ok ? "text-muted-foreground" : "text-warning"}>
                  {check.text}
                </span>
              </li>
            ))}
          </ul>

          <p className="text-muted-foreground border-border mt-3 border-t pt-2 text-[9px] leading-tight">
            O simulador e o webchat rodam o <strong>mesmo</strong> motor. O que você aprova aqui é o
            que o visitante vê.
          </p>
        </aside>
      </div>
    </PreviewFrame>
  );
}

/* Campanhas ----------------------------------------------------------------------- */

export function CampaignPreview() {
  return (
    <PreviewFrame
      path="app.elora.com.br/campanhas/cmp_carrinho_agosto"
      label="Prévia de Campanhas: acompanhamento de disparo por lote, funil de entrega e proteções de disparo em massa."
    >
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Recuperação de carrinho — agosto</p>
            <p className="text-muted-foreground text-[11px]">
              WhatsApp · template carrinho_abandonado_v4 · público 1.502
            </p>
          </div>
          {/*
            `.glow-pulse` marca o que está **vivo** — aqui, o disparo em curso. É
            o mesmo uso do agente em execução e do canal recebendo; o halo é
            opacidade de uma camada pronta, não uma sombra crescendo.
          */}
          <span className="glow-pulse bg-info-soft text-info inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
            <Zap className="size-3" aria-hidden />
            enviando
          </span>
        </div>

        {/*
          O funil bate com os lotes: três lotes de 250 concluídos mais metade do
          quarto dão 875 enviadas, e cada degrau seguinte é menor que o anterior.
          A versão anterior dizia 980 enviadas com 875 despachadas nos lotes
          logo abaixo — duas peças da mesma tela discordando à distância de dois
          centímetros.
        */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { label: "Enviadas", value: 875 },
            { label: "Entregues", value: 841 },
            { label: "Lidas", value: 636 },
            { label: "Respostas", value: 114 },
            { label: "Convertidas", value: 66 },
          ].map((tile, index) => (
            <div
              key={tile.label}
              style={step(index)}
              className="preview-in border-border bg-surface rounded-lg border p-2"
            >
              <p className="figure text-sm font-semibold leading-none">
                <AnimatedNumber value={tile.value} />
              </p>
              <p className="text-muted-foreground mt-1 text-[10px]">{tile.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
          <div className="border-border bg-surface rounded-lg border p-3">
            <p className="text-[11px] font-semibold">Lotes</p>
            <ul className="mt-2 space-y-1.5">
              {[
                { index: 1, size: 250, status: "enviado" },
                { index: 2, size: 250, status: "enviado" },
                { index: 3, size: 250, status: "enviado" },
                { index: 4, size: 250, status: "enviando" },
                { index: 5, size: 250, status: "pendente" },
                { index: 6, size: 252, status: "pendente" },
              ].map((batch, position) => (
                <li key={batch.index} className="flex items-center gap-2 text-[10px]">
                  <span className="text-muted-foreground w-10 shrink-0">Lote {batch.index}</span>
                  <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                    {/*
                      Os lotes enchem em cadeia, de cima para baixo — que é a
                      ordem em que o worker os despacha. O quarto para na metade,
                      porque é o que está em curso; os dois últimos ficam em zero.
                      A fração final viaja em `--bar-fill`, então o quadro de
                      repouso mostra o progresso certo, não a barra cheia.
                    */}
                    <span
                      className={cn(
                        "preview-bar-x block h-full w-full rounded-full",
                        batch.status === "enviado"
                          ? "bg-success"
                          : batch.status === "enviando"
                            ? "bg-accent"
                            : "bg-transparent",
                      )}
                      style={fill(
                        batch.status === "enviado" ? 1 : batch.status === "enviando" ? 0.5 : 0,
                        position,
                      )}
                    />
                  </span>
                  <span className="text-muted-foreground w-14 shrink-0 text-right">
                    {batch.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-border bg-surface rounded-lg border p-3">
            <p className="text-[11px] font-semibold">Proteções ativas</p>
            <ul className="mt-2 space-y-1.5">
              {[
                { icon: Check, text: "Exige consentimento de marketing" },
                { icon: Check, text: "Respeita lista de supressão" },
                { icon: Pause, text: "Janela silenciosa 21h – 8h" },
                { icon: Clock3, text: "Limite de frequência: 7 dias" },
                { icon: Zap, text: "Cancela sozinha acima de 8% de erro" },
              ].map((rule) => (
                <li
                  key={rule.text}
                  className="text-muted-foreground flex gap-1.5 text-[10px] leading-snug"
                >
                  <rule.icon className="text-success mt-0.5 size-3 shrink-0" aria-hidden />
                  {rule.text}
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground border-border mt-2 border-t pt-2 text-[9px] leading-tight">
              1.840 no segmento, 338 excluídos com o motivo de cada um — público final de 1.502.
            </p>
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}

/* Contato 360º -------------------------------------------------------------------- */

const TIMELINE = [
  {
    icon: MessageSquare,
    title: "Mensagem recebida — Pedido #248-9910 parado",
    detail: "WhatsApp · há 7 minutos",
    tone: "accent" as const,
  },
  {
    icon: Bot,
    title: "Agente de IA consultou o pedido",
    detail: "Ferramenta consultar_pedido · confiança 0,94 · R$ 0,004",
  },
  {
    icon: Zap,
    title: "Automação abriu tarefa para o time de logística",
    detail: 'Regra "rastreio parado há mais de 48 h" · há 1 hora',
  },
  {
    icon: Mail,
    title: "Campanha entregue — Recuperação de carrinho",
    detail: "Entregue e lida · voltou ao checkout em 12 minutos",
  },
  {
    icon: Check,
    title: "Consentimento de marketing registrado",
    detail: "Base legal: consentimento · versão v1.2",
  },
];

export function ContactPreview() {
  return (
    <PreviewFrame
      path="app.elora.com.br/contatos/cnt_001"
      label="Prévia do Contato 360º: ficha do contato com identificadores, campos e linha do tempo unificada."
    >
      <div className="grid lg:grid-cols-[210px_1fr]">
        <aside className="border-border bg-surface-sunken border-b p-3 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2">
            <span className="bg-accent-soft text-accent-ink flex size-9 items-center justify-center rounded-full text-xs font-semibold">
              AC
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">Aline Castilho</p>
              <p className="text-muted-foreground truncate text-[10px]">Cliente desde 2025</p>
            </div>
          </div>

          <dl className="mt-3 space-y-1.5">
            {[
              ["Telefone", "+55 11 98745-0012"],
              ["E-mail", "aline.c@exemplo.com"],
              ["Último pedido", "#248-9910"],
              ["Ticket médio", "R$ 612"],
              ["Score", "78"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground text-[9px] uppercase tracking-wide">
                  {label}
                </dt>
                <dd className="figure truncate text-[11px]">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-3 flex flex-wrap gap-1">
            {["Cliente recorrente", "Pedido atrasado"].map((tag) => (
              <span
                key={tag}
                className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[9px]"
              >
                {tag}
              </span>
            ))}
          </div>
        </aside>

        <div className="p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold">Linha do tempo</p>
            <span className="text-muted-foreground text-[10px]">
              mensagem · negócio · campanha · automação
            </span>
          </div>

          {/*
            As interações entram em ordem, e o traço entre elas se desenha entre
            uma e a seguinte. É o argumento da aba desenhado em movimento: a
            linha do tempo é **derivada dos eventos**, então ela se preenche
            sozinha conforme as coisas acontecem — não é um campo que alguém
            digitou.

            A primeira entrada carrega `.glow-pulse`: é a que acabou de chegar, e
            o halo é o que diz "isto é agora" sem gastar uma segunda cor.
          */}
          <ol className="mt-3 space-y-3">
            {TIMELINE.map((entry, index) => (
              <li key={entry.title} style={step(index)} className="preview-in flex gap-2.5">
                <span className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full",
                      entry.tone === "accent"
                        ? "glow-pulse bg-accent-soft text-accent-ink"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <entry.icon className="size-3" aria-hidden />
                  </span>
                  {index < TIMELINE.length - 1 ? (
                    <span
                      className="preview-draw bg-border mt-1 w-px flex-1"
                      style={step(index)}
                      aria-hidden
                    />
                  ) : null}
                </span>
                <span className="min-w-0 pb-1">
                  <span className="block text-[11px] font-medium leading-snug">{entry.title}</span>
                  <span className="text-muted-foreground block text-[10px] leading-snug">
                    {entry.detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </PreviewFrame>
  );
}

/* Agente de IA --------------------------------------------------------------------- */

export function AgentPreview() {
  return (
    <PreviewFrame
      path="app.elora.com.br/agentes/agt_atendimento"
      label="Prévia do editor de agente de IA: instrução, ferramentas permitidas, guardas e simulador com rastro por passo."
    >
      <div className="grid lg:grid-cols-[1fr_1fr]">
        <div className="border-border border-b p-3 lg:border-b-0 lg:border-r">
          <p className="text-[10px] font-semibold uppercase tracking-wide">
            Ferramentas permitidas
          </p>
          <ul className="mt-2 space-y-1.5">
            {[
              { name: "consultar_pedido", kind: "leitura" },
              { name: "buscar_na_base", kind: "leitura" },
              { name: "consultar_politica_troca", kind: "leitura" },
              { name: "alterar_endereco", kind: "escrita" },
              { name: "gerar_reembolso", kind: "escrita" },
            ].map((tool, index) => (
              <li
                key={tool.name}
                style={step(index)}
                className="preview-in border-border bg-surface flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
              >
                <code className="truncate text-[10px]">{tool.name}</code>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium",
                    tool.kind === "leitura"
                      ? "bg-success-soft text-success"
                      : "bg-warning-soft text-warning",
                  )}
                >
                  {tool.kind === "leitura" ? "executa" : "pede aprovação"}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide">Guardas</p>
          <ul className="text-muted-foreground mt-1.5 space-y-1 text-[10px]">
            <li>Confiança mínima 0,72 — abaixo disso, transfere</li>
            <li>Teto de R$ 0,40 por conversa</li>
            <li>Fila de transbordo validada contra o catálogo</li>
          </ul>
        </div>

        <div className="p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide">Rastro do simulador</p>

          {/*
            Os passos entram na ordem em que o laço os produz, e o atraso entre
            eles é o que faz a prévia parecer uma execução em vez de um relatório
            dela. Os índices continuam depois da coluna da esquerda, para que o
            olho leia "configurei as ferramentas, e então ele rodou".
          */}
          <ol className="mt-2 space-y-2">
            {[
              { step: "1", text: "Intenção: rastreio_pedido", meta: "0,94 · 320 ms" },
              { step: "2", text: "consultar_pedido(248-9910)", meta: "executada · 180 ms" },
              { step: "3", text: "Resposta ao cliente", meta: "812 tokens · R$ 0,004" },
              {
                step: "4",
                text: "alterar_endereco — pendente",
                meta: "aguarda clique humano",
                pending: true,
              },
            ].map((row, index) => (
              <li key={row.step} style={step(index + 5)} className="preview-in flex gap-2">
                <span className="border-border text-muted-foreground figure flex size-5 shrink-0 items-center justify-center rounded-full border text-[9px]">
                  {row.step}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[10px] font-medium leading-snug",
                      row.pending && "text-accent-ink",
                    )}
                  >
                    {row.text}
                  </span>
                  <span className="text-muted-foreground block text-[9px] leading-snug">
                    {row.meta}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          {/*
            A resposta ao cliente, escrita depois dos passos.

            O cursor pisca no fim da frase e **repousa apagado**: sob movimento
            reduzido, um cursor congelado aceso ao lado de um texto completo seria
            lido como campo em foco esperando digitação.
          */}
          <div
            style={step(9)}
            className="preview-in bg-chat-in text-chat-in-foreground mt-3 rounded-lg rounded-bl-sm px-2.5 py-2 text-[10px] leading-snug"
          >
            <span className="text-accent-ink mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide">
              <Bot className="size-3" aria-hidden />
              Agente responde
            </span>
            Seu pedido está retido em Cajamar, com reentrega amanhã. Já registrei o pedido de troca
            de endereço — assim que um atendente confirmar, eu te aviso por aqui.
            <span className="preview-caret bg-accent ml-0.5 inline-block h-3 w-px align-text-bottom" />
          </div>

          <div className="bg-accent-soft text-accent-ink mt-3 flex items-start gap-1.5 rounded-md p-2 text-[10px] leading-snug">
            <ArrowRight className="mt-0.5 size-3 shrink-0" aria-hidden />
            Escrita nunca é executada pelo agente. Ela vira pendência no Inbox, com o parâmetro à
            vista de quem confirma.
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}

/* Automações ----------------------------------------------------------------------- */

/**
 * Os três passos de uma regra: aconteceu isto, confira aquilo, faça isso.
 *
 * O conteúdo não é inventado — o gatilho é `sem_resposta` (`conversation.idle`)
 * e as ações são `notificar_equipe`, `criar_tarefa` e `enviar_whatsapp`, todas
 * de `RULE_ACTION_LABEL` em `types/rules.ts`. Uma prévia que mostrasse um bloco
 * que o construtor não oferece seria a forma mais cara de gerar frustração na
 * primeira semana de uso.
 */
const RULE_STEPS = [
  {
    kind: "Quando",
    icon: Timer,
    title: "Ficou sem responder",
    detail: "conversation.idle · fila Pedidos e rastreio · 2 h",
  },
  {
    kind: "Se",
    icon: Split,
    title: "Etapa do negócio é Proposta em análise",
    detail: "e valor acima de R$ 500",
  },
];

const RULE_ACTIONS = [
  { icon: Users, label: "Notificar equipe", detail: "imediato · canal #comercial" },
  { icon: ListChecks, label: "Criar tarefa", detail: "imediato · dono do negócio" },
  { icon: MessageSquare, label: "Enviar WhatsApp", detail: "após 30 min · retomada_v2" },
];

export function AutomationPreview() {
  return (
    <PreviewFrame
      path="app.elora.com.br/automacoes/rule_retomada"
      label="Prévia de Automações: uma regra com gatilho, condição e três ações, ao lado do histórico de execução."
    >
      <div className="grid lg:grid-cols-[1fr_210px]">
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Retomada de proposta parada</p>
            {/*
              O halo marca a regra **ligada**. Uma automação desligada com o
              mesmo peso visual da ligada é o defeito que faz alguém jurar que a
              régua está rodando quando não está.
            */}
            <span className="glow-pulse bg-success-soft text-success inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
              <Zap className="size-3" aria-hidden />
              ativa
            </span>
          </div>

          {/*
            Os passos entram em sequência e o trilho entre eles acende com uma
            faísca descendo — `.rule-rail[data-live]` é o mesmo trilho do
            construtor de automações do produto, não uma peça desenhada só para
            a prévia. O movimento é a confirmação de que o passo de cima está
            completo; não há selo de "ok" competindo com o conteúdo.
          */}
          <div className="mt-3 space-y-0">
            {RULE_STEPS.map((entry, index) => (
              <div key={entry.title}>
                <div
                  style={step(index)}
                  className="preview-in border-border bg-surface shadow-card rounded-lg border p-2.5"
                >
                  <span className="text-muted-foreground text-[9px] font-semibold uppercase tracking-wide">
                    {entry.kind}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <entry.icon className="text-accent size-3.5" aria-hidden />
                    <span className="text-[11px] font-semibold">{entry.title}</span>
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-[10px]">
                    {entry.detail}
                  </span>
                </div>
                <div
                  className="rule-rail ml-5 h-4"
                  data-live="true"
                  style={{ ["--rail-index" as string]: index }}
                  aria-hidden
                />
              </div>
            ))}

            <div
              style={step(RULE_STEPS.length)}
              className="preview-in border-border bg-surface shadow-card rounded-lg border p-2.5"
            >
              <span className="text-muted-foreground text-[9px] font-semibold uppercase tracking-wide">
                Então
              </span>
              <ul className="mt-1.5 space-y-1.5">
                {RULE_ACTIONS.map((action, index) => (
                  <li
                    key={action.label}
                    style={step(RULE_STEPS.length + 1 + index)}
                    className="preview-in bg-surface-sunken flex items-center gap-2 rounded-md px-2 py-1.5"
                  >
                    <action.icon className="text-accent-ink size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-medium leading-tight">
                        {action.label}
                      </span>
                      <span className="text-muted-foreground block text-[9px] leading-tight">
                        {action.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <aside className="border-border border-t p-3 lg:border-l lg:border-t-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide">Últimos 30 dias</p>

          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              { label: "execuções", value: 412 },
              { label: "conversões", value: 37 },
            ].map((tile) => (
              <div key={tile.label} className="border-border bg-surface rounded-lg border p-2">
                <p className="figure text-sm font-semibold leading-none">
                  <AnimatedNumber value={tile.value} />
                </p>
                <p className="text-muted-foreground mt-1 text-[9px]">{tile.label}</p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide">Histórico</p>
          <ul className="mt-2 space-y-1.5">
            {[
              { ok: true, text: "Aline Castilho", meta: "há 4 min · 3 ações" },
              { ok: true, text: "Rogério Prado", meta: "há 26 min · 3 ações" },
              { ok: false, text: "Marina Duarte", meta: "condição não bateu · 1 h" },
              { ok: true, text: "Ana Beatriz L.", meta: "há 2 h · 3 ações" },
            ].map((run, index) => (
              <li
                key={run.text}
                style={step(index + 4)}
                className="preview-in flex items-start gap-1.5 text-[10px] leading-snug"
              >
                {run.ok ? (
                  <Check className="text-success mt-0.5 size-3 shrink-0" aria-hidden />
                ) : (
                  <Tag className="text-muted-foreground mt-0.5 size-3 shrink-0" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{run.text}</span>
                  <span className="text-muted-foreground block text-[9px]">{run.meta}</span>
                </span>
              </li>
            ))}
          </ul>

          <p className="text-muted-foreground border-border mt-3 border-t pt-2 text-[9px] leading-tight">
            Regra é <strong>aconteceu isto, confira aquilo, faça isso</strong> — e acabou. O
            acompanhamento por semanas é jornada, com estado próprio por participante.
          </p>
        </aside>
      </div>
    </PreviewFrame>
  );
}
