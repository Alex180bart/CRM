import * as React from "react";

import { cn } from "../lib/cn";

/* Cabeçalho de seção ------------------------------------------------------- */

export function SectionHeading({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-foreground text-sm font-semibold tracking-tight">
          {title}
        </h2>
        {description ? <p className="text-muted-foreground mt-0.5 text-xs">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* Indicador numérico ------------------------------------------------------- */

export interface StatTileProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  trend?: { direction: "up" | "down" | "flat"; label: string; good?: boolean };
  icon?: React.ReactNode;
  chart?: React.ReactNode;
  className?: string;
}

export function StatTile({ label, value, hint, trend, icon, chart, className }: StatTileProps) {
  const trendColor =
    trend === undefined
      ? ""
      : trend.direction === "flat"
        ? "text-muted-foreground"
        : trend.good
          ? "text-success"
          : "text-destructive";

  return (
    <div className={cn("bg-card shadow-card flex flex-col rounded-lg p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground truncate text-xs font-medium">{label}</p>
        {icon ? (
          <span className="text-muted-foreground/70 shrink-0 [&_svg]:size-4">{icon}</span>
        ) : null}
      </div>

      <p className="figure text-foreground mt-2 text-[1.75rem] font-semibold leading-none">
        {value}
      </p>

      {trend || hint ? (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {trend ? (
            <span
              className={cn(
                "truncate whitespace-nowrap text-[11px] font-medium tabular-nums",
                trendColor,
              )}
            >
              {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}{" "}
              {trend.label}
            </span>
          ) : null}
          {hint ? (
            <span className="text-muted-foreground truncate whitespace-nowrap text-[11px]">
              {hint}
            </span>
          ) : null}
        </div>
      ) : null}

      {chart ? <div className="-mx-1 mt-3">{chart}</div> : null}
    </div>
  );
}

/* Barra de progresso ------------------------------------------------------- */

export function ProgressBar({
  value,
  tone = "accent",
  className,
  label,
}: {
  value: number;
  tone?: "accent" | "success" | "warning" | "danger" | "primary";
  className?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const toneClass = {
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
    primary: "bg-primary",
  }[tone];

  return (
    <div
      className={cn("bg-muted h-1.5 w-full overflow-hidden rounded-full", className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", toneClass)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* Par rótulo/valor --------------------------------------------------------- */

export function KeyValue({
  label,
  value,
  className,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5", className)}>
      <dt className="text-muted-foreground shrink-0 text-xs">{label}</dt>
      <dd
        className={cn(
          "text-foreground min-w-0 truncate text-right text-xs font-medium",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/* Ponto de status ---------------------------------------------------------- */

export function StatusDot({
  tone,
  pulse,
  className,
}: {
  tone: "success" | "warning" | "danger" | "info" | "neutral" | "accent";
  pulse?: boolean;
  className?: string;
}) {
  const toneClass = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
    info: "bg-info",
    accent: "bg-accent",
    neutral: "bg-muted-foreground/50",
  }[tone];

  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)} aria-hidden>
      <span className={cn("size-2 rounded-full", toneClass)} />
      {pulse ? (
        <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", toneClass)} />
      ) : null}
    </span>
  );
}

/* Rótulo de seção discreto ------------------------------------------------- */

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-muted-foreground text-[11px] font-medium uppercase tracking-wider",
        className,
      )}
    >
      {children}
    </p>
  );
}
