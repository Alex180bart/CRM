"use client";

import * as React from "react";

import { cn } from "../lib/cn";

/**
 * Entrada em sequência.
 *
 * A página inteira usa **uma** orquestração: cada seção sobe 10 px e aparece,
 * com 60 ms de atraso por índice. Nada pisca, nada repete em laço. Sob
 * `prefers-reduced-motion` o efeito é anulado no CSS.
 */
export function Reveal({
  index = 0,
  as: Component = "div",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  index?: number;
  as?: React.ElementType;
}) {
  return (
    <Component
      className={cn("reveal", className)}
      style={{ "--reveal-index": index } as React.CSSProperties}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * Número que conta até o valor final na montagem.
 *
 * Serve à leitura, não ao enfeite: a contagem dura 700 ms e usa easing de
 * desaceleração, o que dá tempo de perceber a ordem de grandeza antes de o
 * valor assentar. Quem prefere menos movimento vê o valor final direto.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  durationMs = 700,
}: {
  value: number;
  format?: (value: number) => string;
  className?: string;
  durationMs?: number;
}) {
  const [display, setDisplay] = React.useState(value);
  const frameRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setDisplay(value);
      return;
    }

    const from = 0;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      // easeOutCubic: rápido no começo, assenta no fim.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs]);

  const rounded = Number.isInteger(value) ? Math.round(display) : Number(display.toFixed(1));

  return (
    <span className={className}>{format ? format(rounded) : rounded.toLocaleString("pt-BR")}</span>
  );
}
