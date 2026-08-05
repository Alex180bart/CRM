import * as React from "react";

import { cn } from "../lib/cn";

/**
 * Cartão do sistema.
 *
 * Sem traço por padrão: a separação vem da superfície branca sobre o plano
 * azulado, mais uma sombra de um degrau. Traço só quando o cartão precisa
 * conviver com outro cartão da mesma cor (variante `outlined`).
 */
export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: "raised" | "flat" | "outlined";
    interactive?: boolean;
  }
>(function Card({ className, variant = "raised", interactive, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        "bg-card text-card-foreground rounded-lg",
        variant === "raised" && "shadow-card",
        variant === "outlined" && "border-border border",
        interactive && "lift press cursor-pointer",
        className,
      )}
      {...props}
    />
  );
});

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...props} />;
  },
);

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function CardTitle({ className, ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={cn("font-display text-sm font-semibold leading-tight tracking-tight", className)}
      {...props}
    />
  );
});

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return (
    <p
      ref={ref}
      className={cn("text-muted-foreground text-xs leading-relaxed", className)}
      {...props}
    />
  );
});

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />;
  },
);

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("shadow-inset-hairline flex items-center gap-2 px-5 py-3", className)}
        {...props}
      />
    );
  },
);
