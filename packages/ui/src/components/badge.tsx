import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";

/**
 * Selo de estado.
 *
 * Sem traço: fundo suave e tinta da própria família. O traço só volta na
 * variante `outline`, usada quando o selo precisa aparecer sobre uma
 * superfície da mesma cor do fundo suave.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-muted-foreground",
        primary: "bg-primary-soft text-primary",
        accent: "bg-accent-soft text-accent-ink",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-destructive-soft text-destructive",
        info: "bg-info-soft text-info",
        outline: "border border-border bg-transparent text-muted-foreground",
        solid: "bg-primary text-primary-foreground",
      },
      size: {
        sm: "h-5 px-1.5 text-[11px]",
        md: "h-6 px-2 text-xs",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

/**
 * Chip de tag colorido por matiz. A cor vem do dado (`hue`), mas saturação e
 * luminosidade são fixas para que nenhuma tag destoe do sistema visual.
 */
export function TagChip({
  name,
  hue,
  className,
  onRemove,
}: {
  name: string;
  hue: number;
  className?: string;
  onRemove?: () => void;
}) {
  return (
    <span
      className={cn(
        // A tag nunca quebra em duas linhas: encolhe com reticências e mantém a pílula íntegra.
        "inline-flex h-5 max-w-40 items-center gap-1 truncate whitespace-nowrap rounded-md px-1.5 text-[11px] font-medium",
        className,
      )}
      title={name}
      style={{
        backgroundColor: `hsl(${hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
        color: `hsl(${hue} 52% var(--hue-fg-l))`,
      }}
    >
      {name}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded px-0.5 leading-none opacity-60 hover:opacity-100"
          aria-label={`Remover tag ${name}`}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export { badgeVariants };
