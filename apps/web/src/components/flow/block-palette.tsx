"use client";

import { useMemo, useState } from "react";
import { Button, SearchInput, Tooltip, cn } from "@elora/ui";
import { Plus } from "lucide-react";

import { GROUP_LABEL, type NodeMeta } from "./node-meta";

/**
 * Catálogo de blocos disponíveis. Clicar adiciona o bloco ao centro do canvas —
 * conectar é responsabilidade do usuário, e a validação avisa se ficar solto.
 */
export function BlockPalette({
  metaByKind,
  labelByKind,
  onAdd,
  disabled,
}: {
  metaByKind: Record<string, NodeMeta>;
  labelByKind: Record<string, string>;
  onAdd: (kind: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase();
    const groups = new Map<NodeMeta["group"], Array<{ kind: string; meta: NodeMeta }>>();

    for (const [kind, meta] of Object.entries(metaByKind)) {
      const label = labelByKind[kind] ?? kind;
      if (term && !`${label} ${meta.description}`.toLowerCase().includes(term)) continue;
      const list = groups.get(meta.group) ?? [];
      list.push({ kind, meta });
      groups.set(meta.group, list);
    }

    return Array.from(groups.entries());
  }, [metaByKind, labelByKind, search]);

  return (
    <div className="border-border bg-surface flex w-56 shrink-0 flex-col border-r">
      <div className="border-border border-b p-2">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
          placeholder="Buscar bloco"
          aria-label="Buscar bloco"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {grouped.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-[11px]">
            Nenhum bloco corresponde à busca.
          </p>
        ) : (
          grouped.map(([group, items]) => (
            <div key={group} className="mb-3 last:mb-0">
              <p className="text-muted-foreground mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider">
                {GROUP_LABEL[group]}
              </p>
              <ul className="space-y-0.5">
                {items.map(({ kind, meta }) => {
                  const Icon = meta.icon;
                  return (
                    <li key={kind}>
                      <Tooltip side="right" content={meta.description}>
                        <button
                          type="button"
                          disabled={disabled}
                          // Arrastar leva o bloco ao canvas ou direto para dentro
                          // de uma conexão; clicar continua adicionando ao fim.
                          draggable={!disabled}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("application/crm-block", kind);
                            event.dataTransfer.effectAllowed = "copy";
                          }}
                          onClick={() => onAdd(kind)}
                          className={cn(
                            "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                            disabled
                              ? "text-muted-foreground/50 cursor-not-allowed"
                              : "text-foreground hover:bg-muted",
                          )}
                        >
                          <span
                            className="flex size-5 shrink-0 items-center justify-center rounded"
                            style={{
                              backgroundColor: `hsl(${meta.hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
                              color: `hsl(${meta.hue} 55% var(--hue-fg-l))`,
                            }}
                          >
                            <Icon className="size-3" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {labelByKind[kind] ?? kind}
                          </span>
                          <Plus className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      {disabled ? (
        <div className="border-border border-t p-2">
          <p className="text-muted-foreground text-[11px] leading-relaxed">
            A versão publicada é imutável. Para editar, mude para o rascunho.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function PaletteFooterAction({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="outline" size="sm" className="w-full" onClick={onClick}>
      {label}
    </Button>
  );
}
