import * as React from "react";

import { cn } from "../lib/cn";

const sizeClass = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-xl",
} as const;

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  initials: string;
  /** Matiz HSL — deriva uma cor estável por pessoa sem sair da paleta. */
  hue?: number;
  size?: keyof typeof sizeClass;
  ring?: boolean;
}

/**
 * Avatar por iniciais. Não carregamos foto de contato no protótipo: além de
 * evitar requisição externa, reduz exposição de dado pessoal sem necessidade.
 */
export function Avatar({
  initials,
  hue = 218,
  size = "md",
  ring,
  className,
  ...props
}: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase",
        sizeClass[size],
        ring && "ring-surface ring-2",
        className,
      )}
      style={{
        backgroundColor: `hsl(${hue} 58% var(--hue-bg-l) / var(--hue-bg-a))`,
        color: `hsl(${hue} 52% var(--hue-fg-l))`,
      }}
      aria-hidden
      {...props}
    >
      {initials.slice(0, 2)}
    </span>
  );
}

const presenceColor = {
  disponivel: "bg-success",
  ocupado: "bg-destructive",
  ausente: "bg-warning",
  offline: "bg-muted-foreground/50",
} as const;

export function PresenceDot({
  presence,
  className,
}: {
  presence: keyof typeof presenceColor;
  className?: string;
}) {
  return (
    <span
      className={cn("ring-surface size-2 rounded-full ring-2", presenceColor[presence], className)}
      aria-hidden
    />
  );
}

export function AvatarWithPresence({
  initials,
  hue,
  size = "md",
  presence,
  className,
}: AvatarProps & { presence?: keyof typeof presenceColor }) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <Avatar initials={initials} hue={hue} size={size} />
      {presence ? (
        <PresenceDot presence={presence} className="absolute -bottom-0.5 -right-0.5" />
      ) : null}
    </span>
  );
}
