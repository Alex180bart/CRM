"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { Search, X } from "lucide-react";

import { cn } from "../lib/cn";

const fieldBase =
  "w-full rounded-md border border-input bg-surface text-sm text-foreground placeholder:text-muted-foreground/70 transition-[border-color,box-shadow] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-60";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-9 px-3", className)} {...props} />;
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, "min-h-20 px-3 py-2 leading-relaxed", className)}
      {...props}
    />
  );
});

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(function Label({ className, ...props }, ref) {
  return (
    <LabelPrimitive.Root
      ref={ref}
      className={cn("text-muted-foreground text-xs font-medium", className)}
      {...props}
    />
  );
});

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

/** Campo de busca com ícone e botão de limpar — usado em todas as listas densas. */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ className, value, onClear, ...props }, ref) {
    const hasValue = typeof value === "string" && value.length > 0;
    return (
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          ref={ref}
          type="search"
          value={value}
          className={cn(
            fieldBase,
            "h-9 pr-8",
            "[&::-webkit-search-cancel-button]:hidden",
            className,
          )}
          style={{ paddingLeft: "2.125rem" }}
          {...props}
        />
        {hasValue && onClear ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Limpar busca"
            className="text-muted-foreground hover:bg-muted hover:text-foreground absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    );
  },
);
