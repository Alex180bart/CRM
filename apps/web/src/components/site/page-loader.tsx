import { cn } from "@elora/ui";

/**
 * Carregador de rota do site público.
 *
 * ## Por que o site precisava de um, e o workspace já tinha
 *
 * `(workspace)/loading.tsx` existe desde sempre; `(site)` não tinha nenhum. Sem
 * fronteira de suspensão, o roteador do App Router espera o segmento inteiro
 * antes de trocar a tela — e o intervalo é **silencioso**. Foi essa a causa de
 * "clico e não acontece nada": não acontecia nada mesmo, visualmente, até o
 * servidor responder.
 *
 * ## Por que um navegador desenhado, e não o cubo do workspace
 *
 * As duas esperas são diferentes e devem parecer diferentes. No workspace, quem
 * espera já está dentro do produto e a barra lateral continua na tela — o cubo
 * diz "estou montando a sua área". Aqui quem espera está **lendo uma página**, e
 * o que vem é outra página: o esqueleto de documento antecipa a forma do que
 * chega, que é a única coisa útil que um carregador pode comunicar.
 *
 * ## O que mudou em relação ao componente de referência
 *
 * **`styled-components` ficou de fora.** É uma segunda camada de estilo em cima
 * do Tailwind, com runtime próprio, para uma peça só. Toda a folha do produto
 * vive em `tokens.css`, e é lá que estas animações estão.
 *
 * **A cor sai de token.** A referência trazia `#00ccff`, `#222`, `#111`,
 * `#2d2d2d` e `#505050` — uma peça de tema escuro fixo. Aqui o traço é o âmbar
 * da marca e as superfícies saem dos tokens, então a peça acompanha o tema e a
 * paleta da organização. `Haettenschweiler` também saiu: é fonte do Windows, e
 * some em qualquer outro sistema.
 *
 * **As animações estão sob o `prefers-reduced-motion` global.** No original elas
 * ficavam no `styled-components`, fora do alcance do corte da folha. E o
 * esqueleto pulsa por `opacity` em vez de `fill`: animar `fill` repinta a forma
 * a cada quadro, e o gargalo medido deste front é justamente pintura e layout.
 *
 * **Tem texto.** Quem desligou animação vê a peça parada — e aí o rótulo é o
 * único indicador de que algo está acontecendo. Mesma razão do cubo.
 */
export function PageLoader({
  label = "Carregando",
  hint = "Preparando a página.",
  className,
}: {
  label?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "page-loader flex min-h-[26rem] flex-col items-center justify-center gap-6 p-10",
        className,
      )}
      /* `status`, não `alert`: é andamento, não interrupção — não rouba o foco. */
      role="status"
      aria-live="polite"
    >
      <svg
        viewBox="0 0 900 620"
        className="text-muted-foreground/25 h-auto w-full max-w-lg"
        aria-hidden
      >
        {/*
          A grade é o plano de fundo, e usa `currentColor` com opacidade baixa —
          é o que faz a mesma peça funcionar no tema claro e no escuro sem um
          segundo arquivo.
        */}
        <g stroke="currentColor" strokeWidth="0.75">
          {[0, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((x) => (
            <line key={`v${x}`} x1={x} y1={0} x2={x} y2={620} />
          ))}
          {[0, 100, 200, 300, 400, 500, 600].map((y) => (
            <line key={`h${y}`} x1={0} y1={y} x2={900} y2={y} />
          ))}
        </g>

        {/*
          Os traços correm de fora até o quadro, com atraso escalonado. É a
          metáfora que a peça carrega: os canais chegando à mesma tela.
        */}
        <g
          className="text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.9"
        >
          <path className="page-loader-trace" d="M60 380 H250 V180" />
          <path className="page-loader-trace" d="M840 260 H650 V440" />
          <path className="page-loader-trace" d="M450 580 V440 H250" />
          <path className="page-loader-trace" d="M520 60 V180 H650" />
        </g>

        {/* O documento que está chegando. */}
        <g>
          <rect
            x={250}
            y={180}
            width={400}
            height={260}
            rx={10}
            className="fill-surface stroke-border-strong"
            strokeWidth="1.5"
          />
          <path
            d="M250 190 a10 10 0 0 1 10 -10 h380 a10 10 0 0 1 10 10 v22 h-400 z"
            className="fill-surface-sunken"
          />
          <g className="fill-muted-foreground/45">
            <circle cx={266} cy={201} r={4} />
            <circle cx={280} cy={201} r={4} />
            <circle cx={294} cy={201} r={4} />
          </g>

          <g className="fill-muted-foreground/35">
            <rect className="page-loader-skeleton" x={270} y={228} width={360} height={20} rx={4} />
            <rect className="page-loader-skeleton" x={270} y={260} width={200} height={14} rx={4} />
            <rect className="page-loader-skeleton" x={270} y={284} width={300} height={14} rx={4} />
            <rect className="page-loader-skeleton" x={270} y={310} width={360} height={90} rx={6} />
            <rect className="page-loader-skeleton" x={270} y={412} width={180} height={18} rx={4} />
          </g>
        </g>
      </svg>

      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-accent-ink text-xs font-semibold uppercase tracking-[0.3em]">{label}</p>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
    </div>
  );
}
