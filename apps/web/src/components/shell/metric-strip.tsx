import { cn } from "@crm/ui";

export type MetricTone = "neutral" | "warning" | "danger" | "success" | "accent";

const TONE_CLASS: Record<MetricTone, string> = {
  neutral: "text-foreground",
  warning: "text-warning",
  danger: "text-destructive",
  success: "text-success",
  accent: "text-accent",
};

/**
 * Indicador de uma linha só.
 *
 * Telas de trabalho contínuo — inbox, editores de fluxo — pagam caro por cada
 * pixel vertical. Aqui a métrica ocupa uma faixa fina em vez de um cartão.
 */
export function Metric({
  label,
  value,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: string | number;
  tone?: MetricTone;
  hint?: string;
}) {
  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className={cn("text-base font-semibold tabular-nums leading-none", TONE_CLASS[tone])}>
        {value}
      </span>
      <span className="text-muted-foreground text-[11px] uppercase tracking-wide">{label}</span>
      {hint ? <span className="text-muted-foreground/70 text-[11px]">· {hint}</span> : null}
    </span>
  );
}

export function MetricStrip({
  children,
  trailing,
  className,
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-surface flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1 border-b px-4 py-2",
        className,
      )}
    >
      {children}
      {trailing ? <div className="ml-auto flex items-center gap-3">{trailing}</div> : null}
    </div>
  );
}
