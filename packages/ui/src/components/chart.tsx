"use client";

import * as React from "react";

import { cn } from "../lib/cn";

/**
 * Primitivas de gráfico do CRM.
 *
 * Regras seguidas em todas elas:
 * - marcas finas: linha de 2 px, ponto de 8 px, topo de barra arredondado em 4 px;
 * - 2 px de respiro entre preenchimentos vizinhos, para a barra não virar bloco;
 * - grade e eixo recessivos; o dado é a única coisa saturada;
 * - texto em tinta de texto, nunca na cor da série — a cor fica na marca;
 * - camada de hover por padrão: todo gráfico responde ao ponteiro;
 * - legenda sempre que houver duas séries ou mais.
 *
 * A paleta (`--chart-1` a `--chart-6`) foi validada para daltonismo e contraste
 * nas duas superfícies. Ver `docs/design-system.md`.
 */

export const SERIES_TOKENS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

export function seriesColor(index: number): string {
  return `hsl(${SERIES_TOKENS[index % SERIES_TOKENS.length]})`;
}

/** Mede o container para desenhar em pixels reais — sem distorcer traço nem ponto. */
function useMeasure<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

/* ------------------------------------------------------------------ */
/* Moldura e legenda                                                    */
/* ------------------------------------------------------------------ */

export function ChartFrame({
  title,
  description,
  legend,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  legend?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("flex min-w-0 flex-col gap-3", className)}>
      {title || actions ? (
        <figcaption className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? (
              <p className="font-display text-sm font-semibold leading-tight tracking-tight">
                {title}
              </p>
            ) : null}
            {description ? (
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
        </figcaption>
      ) : null}
      {legend}
      {children}
    </figure>
  );
}

export function ChartLegend({
  items,
  className,
}: {
  items: Array<{ label: string; color: string; value?: string }>;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-[3px]"
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          <span className="text-muted-foreground text-[11px]">{item.label}</span>
          {item.value ? (
            <span className="text-foreground text-[11px] font-medium tabular-nums">
              {item.value}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Balão de hover. Vira de lado ao passar da metade para não sair do quadro. */
function ChartTooltip({
  x,
  containerWidth,
  children,
}: {
  x: number;
  containerWidth: number;
  children: React.ReactNode;
}) {
  const flip = x > containerWidth / 2;
  return (
    <div
      className="bg-primary text-primary-foreground shadow-overlay pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-md px-2 py-1 text-[11px] leading-tight"
      style={{
        left: x,
        transform: flip ? "translate(calc(-100% - 10px), -4px)" : "translate(10px, -4px)",
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline — uma série, evolução no tempo                             */
/* ------------------------------------------------------------------ */

export interface SparklinePoint {
  label: string;
  value: number;
}

export function Sparkline({
  data,
  height = 56,
  colorIndex = 0,
  formatValue = (value: number) => value.toLocaleString("pt-BR"),
  className,
}: {
  data: SparklinePoint[];
  height?: number;
  colorIndex?: number;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = React.useState<number | null>(null);

  const color = seriesColor(colorIndex);
  const padY = 6;
  const usableHeight = height - padY * 2;

  const values = data.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const points = data.map((point, index) => ({
    x: data.length > 1 ? (index / (data.length - 1)) * width : width / 2,
    y: padY + usableHeight - ((point.value - min) / span) * usableHeight,
    point,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const last = points[points.length - 1];
  const active = hover === null ? null : points[hover];

  function handleMove(event: React.MouseEvent<HTMLDivElement>) {
    if (width === 0 || data.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - bounds.left) / bounds.width;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1)))));
  }

  return (
    <div
      ref={ref}
      className={cn("relative", className)}
      style={{ height }}
      onMouseMove={handleMove}
      onMouseLeave={() => setHover(null)}
    >
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label="Evolução no período">
          <defs>
            <linearGradient id={`spark-${colorIndex}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.18" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#spark-${colorIndex})`} />
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {active ? (
            <>
              <line
                x1={active.x}
                y1={0}
                x2={active.x}
                y2={height}
                stroke="hsl(var(--border-strong))"
                strokeWidth={1}
              />
              <circle
                cx={active.x}
                cy={active.y}
                r={4}
                fill={color}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              />
            </>
          ) : last ? (
            <circle
              cx={last.x}
              cy={last.y}
              r={4}
              fill={color}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            />
          ) : null}
        </svg>
      ) : null}

      {active ? (
        <ChartTooltip x={active.x} containerWidth={width}>
          <span className="block font-medium">{formatValue(active.point.value)}</span>
          <span className="block opacity-70">{active.point.label}</span>
        </ChartTooltip>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barras verticais — magnitude por categoria ou hora                   */
/* ------------------------------------------------------------------ */

export interface BarPoint {
  label: string;
  value: number;
  /** Destaca a barra (hora atual, etapa selecionada). */
  emphasis?: boolean;
}

export function BarSeries({
  data,
  height = 120,
  colorIndex = 0,
  formatValue = (value: number) => value.toLocaleString("pt-BR"),
  showAxis = true,
  className,
}: {
  data: BarPoint[];
  height?: number;
  colorIndex?: number;
  formatValue?: (value: number) => string;
  showAxis?: boolean;
  className?: string;
}) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = React.useState<number | null>(null);

  const color = seriesColor(colorIndex);
  const axisHeight = showAxis ? 16 : 0;
  const plotHeight = height - axisHeight;
  const max = Math.max(...data.map((point) => point.value), 1);

  const gap = 2;
  const slot = data.length > 0 ? width / data.length : 0;
  const barWidth = Math.max(2, slot - gap);

  return (
    <div ref={ref} className={cn("relative", className)} style={{ height }}>
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label="Distribuição por categoria">
          {/* Linha de base recessiva. */}
          <line
            x1={0}
            y1={plotHeight}
            x2={width}
            y2={plotHeight}
            stroke="hsl(var(--border))"
            strokeWidth={1}
          />
          {data.map((point, index) => {
            const barHeight = Math.max(2, (point.value / max) * (plotHeight - 4));
            const x = index * slot + gap / 2;
            const y = plotHeight - barHeight;
            const isHover = hover === index;

            return (
              <g key={point.label}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={Math.min(4, barWidth / 2)}
                  fill={color}
                  opacity={hover === null ? (point.emphasis ? 1 : 0.75) : isHover ? 1 : 0.35}
                  style={{ transition: "opacity 0.15s ease" }}
                />
                {point.emphasis ? (
                  <rect
                    x={x}
                    y={plotHeight + 2}
                    width={barWidth}
                    height={2}
                    rx={1}
                    fill="hsl(var(--accent))"
                  />
                ) : null}
                <rect
                  x={index * slot}
                  y={0}
                  width={slot}
                  height={plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setHover(index)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
      ) : null}

      {showAxis ? (
        <div className="text-muted-foreground pointer-events-none absolute inset-x-0 bottom-0 flex justify-between text-[10px] tabular-nums">
          <span>{data[0]?.label}</span>
          <span>{data[Math.floor(data.length / 2)]?.label}</span>
          <span>{data[data.length - 1]?.label}</span>
        </div>
      ) : null}

      {hover !== null && data[hover] ? (
        <ChartTooltip x={hover * slot + slot / 2} containerWidth={width}>
          <span className="block font-medium">{formatValue(data[hover]!.value)}</span>
          <span className="block opacity-70">{data[hover]!.label}</span>
        </ChartTooltip>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Funil — etapas ordenadas                                             */
/* ------------------------------------------------------------------ */

/** Rampa ordinal de um só tom: mais escuro = etapa mais avançada. */
const FUNNEL_RAMP = ["216 60% 66%", "216 62% 58%", "216 64% 50%", "217 66% 40%", "218 67% 28%"];

export function FunnelBars({
  stages,
  formatValue = (value: number) => value.toLocaleString("pt-BR"),
  className,
}: {
  stages: Array<{ label: string; value: number; hint?: string }>;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const max = Math.max(...stages.map((stage) => stage.value), 1);

  return (
    <ul className={cn("space-y-2", className)}>
      {stages.map((stage, index) => {
        const share = (stage.value / max) * 100;
        const previous = stages[index - 1];
        const conversion =
          previous && previous.value > 0 ? (stage.value / previous.value) * 100 : null;

        return (
          <li key={stage.label} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-foreground truncate text-xs">{stage.label}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                {conversion !== null ? (
                  <span className="text-muted-foreground text-[11px] tabular-nums">
                    {conversion.toFixed(0)}%
                  </span>
                ) : null}
                <span className="font-display text-foreground text-xs font-semibold tabular-nums">
                  {formatValue(stage.value)}
                </span>
              </span>
            </div>
            <div className="bg-muted h-2.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${Math.max(share, 1.5)}%`,
                  backgroundColor: `hsl(${FUNNEL_RAMP[Math.min(index, FUNNEL_RAMP.length - 1)]})`,
                }}
                title={stage.hint}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Barra de participação — parte do todo                                */
/* ------------------------------------------------------------------ */

export function ShareBar({
  segments,
  formatValue = (value: number) => value.toLocaleString("pt-BR"),
  className,
}: {
  segments: Array<{ label: string; value: number; colorIndex: number }>;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(segment.value / total) * 100}%`,
              backgroundColor: seriesColor(segment.colorIndex),
            }}
            title={`${segment.label}: ${formatValue(segment.value)}`}
          />
        ))}
      </div>
      <ChartLegend
        items={segments.map((segment) => ({
          label: segment.label,
          color: seriesColor(segment.colorIndex),
          value: `${((segment.value / total) * 100).toFixed(0)}%`,
        }))}
      />
    </div>
  );
}
