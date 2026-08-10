"use client";

import Link from "next/link";
import { DEMO_VERTICALS, type DemoVerticalId } from "@elora/core";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  cn,
} from "@elora/ui";
import { Check, Globe, Layers } from "lucide-react";

import { openVerticalAction } from "@/app/(site)/actions";

/**
 * Troca de base de demonstração, de dentro do produto.
 *
 * ## Por que fica aqui, e não só na landing page
 *
 * Porque o momento de trocar é no meio da conversa com o cliente — "e se fosse
 * um e-commerce?" — e sair do produto para o site para voltar quebra o ritmo da
 * demonstração. O botão precisa estar onde a pessoa já está olhando.
 *
 * ## Cada item é um formulário
 *
 * A troca é uma escrita no servidor: recarrega o armazém e revalida o layout.
 * Um `onClick` com `fetch` faria a mesma coisa e perderia duas garantias — o
 * `redirect` para `/inicio` (necessário porque a rota atual pode ser o detalhe
 * de um contato que não existe na base nova) e o funcionamento sem JavaScript.
 *
 * O item de menu do Radix precisa continuar sendo o alvo do teclado, então o
 * `form` envolve o item e o envio sai do próprio item — não de um botão extra.
 */
export function DemoSwitcher({
  activeId,
  collapsed = false,
}: {
  activeId: DemoVerticalId;
  collapsed?: boolean;
}) {
  const active = DEMO_VERTICALS.find((vertical) => vertical.id === activeId) ?? DEMO_VERTICALS[0];

  const trigger = (
    <button
      type="button"
      className={cn(
        "border-sidebar-border/60 hover:bg-sidebar-accent flex w-full items-center gap-2 rounded-lg border border-dashed p-1.5 text-left transition-colors",
        collapsed && "justify-center",
      )}
    >
      <Layers className="text-sidebar-muted size-4 shrink-0" aria-hidden />
      {collapsed ? null : (
        <span className="min-w-0 flex-1">
          <span className="text-sidebar-muted block text-[10px] uppercase leading-tight tracking-wide">
            Base de demonstração
          </span>
          <span className="block truncate text-xs font-medium">{active.name}</span>
        </span>
      )}
    </button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <Tooltip side="right" content={`Base: ${active.name}`}>
            {trigger}
          </Tooltip>
        ) : (
          trigger
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent side="right" align="end" className="w-72">
        <DropdownMenuLabel>Trocar a base de demonstração</DropdownMenuLabel>
        <p className="text-muted-foreground px-2 pb-2 text-[11px] leading-snug">
          Recarrega contatos, conversas, funis e campanhas. Vale para toda a instância — em
          apresentação simultânea, combine antes quem troca.
        </p>

        {DEMO_VERTICALS.map((vertical) => (
          <form key={vertical.id} action={openVerticalAction}>
            <input type="hidden" name="vertical" value={vertical.id} />
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full">
                <Check
                  className={cn("size-3.5", vertical.id === activeId ? "opacity-100" : "opacity-0")}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-xs font-medium">{vertical.name}</span>
                  <span className="text-muted-foreground block truncate text-[11px]">
                    {vertical.company}
                  </span>
                </span>
              </button>
            </DropdownMenuItem>
          </form>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin">
            <Globe /> Voltar à área comercial
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
