import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

/* Estados vazios ----------------------------------------------------------- */

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

/**
 * Toda superfície que busca dados precisa de um estado vazio explicativo —
 * dizer o que aconteceu e o que fazer a seguir, não apenas "nenhum resultado".
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center",
        compact ? "px-4 py-8" : "px-6 py-14",
        className,
      )}
    >
      {icon ? (
        <div className="bg-muted text-muted-foreground mb-1 flex size-11 items-center justify-center rounded-full [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <p className="text-foreground text-sm font-semibold">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-sm text-xs leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/* Carregamento ------------------------------------------------------------- */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("skeleton-shimmer animate-shimmer rounded-md", className)} {...props} />
  );
}

export function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2 p-3", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* Alertas ------------------------------------------------------------------ */

const calloutVariants = cva("flex gap-3 rounded-lg border p-3 text-sm", {
  variants: {
    variant: {
      info: "border-info/20 bg-info-soft text-foreground [&_svg]:text-info",
      warning: "border-warning/25 bg-warning-soft text-foreground [&_svg]:text-warning",
      danger: "border-destructive/20 bg-destructive-soft text-foreground [&_svg]:text-destructive",
      success: "border-success/20 bg-success-soft text-foreground [&_svg]:text-success",
      neutral: "border-border bg-muted text-foreground [&_svg]:text-muted-foreground",
    },
  },
  defaultVariants: { variant: "info" },
});

export interface CalloutProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof calloutVariants> {
  icon?: React.ReactNode;
  title?: string;
}

export function Callout({ className, variant, icon, title, children, ...props }: CalloutProps) {
  return (
    <div className={cn(calloutVariants({ variant }), className)} {...props}>
      {icon ? <div className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</div> : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="mb-0.5 text-sm font-semibold">{title}</p> : null}
        <div className="text-muted-foreground text-xs leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
