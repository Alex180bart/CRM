"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowPort } from "@crm/core";
import { cn } from "@crm/ui";
import { AlertTriangle, CircleAlert, Trash2 } from "lucide-react";

import type { NodeMeta } from "./node-meta";

export interface CrmFlowNodeData extends Record<string, unknown> {
  kind: string;
  kindLabel: string;
  label: string;
  summary: string;
  outputs: FlowPort[];
  meta: NodeMeta;
  issue: "erro" | "alerta" | null;
  /** Destacado enquanto o simulador percorre o fluxo. */
  active: boolean;
  /** Já executado nesta simulação. */
  visited: boolean;
  readOnly: boolean;
  onDelete?: (nodeId: string) => void;
}

/**
 * Bloco do editor visual. A saída é uma porta nomeada: um nó de condição
 * expõe várias, um de mensagem expõe uma. Caminhos de exceção são desenhados
 * em tom de alerta para que fallback não pareça fluxo normal.
 *
 * A remoção fica no próprio bloco, aparecendo no hover. Antes ela existia só
 * no rodapé do inspetor — longe do olho e fora do alcance de quem estava
 * trabalhando no canvas. A tecla `Delete` faz o mesmo.
 */
export function CrmFlowNode({ id, data, selected }: NodeProps) {
  const node = data as CrmFlowNodeData;
  const Icon = node.meta.icon;
  const outputs = node.outputs;

  return (
    <div
      className={cn(
        "group/node bg-card shadow-card relative w-56 rounded-lg border transition-shadow",
        selected ? "border-accent shadow-accent-glow" : "border-border",
        node.active && "border-accent ring-accent/40 ring-2",
        node.visited && !node.active && "border-success/50",
        node.issue === "erro" && !selected && "border-destructive/60",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!border-surface !bg-muted-foreground !size-2.5 !border-2"
      />

      {/* Remover — aparece no hover e no foco por teclado. */}
      {!node.readOnly ? (
        <button
          type="button"
          aria-label={`Remover bloco ${node.label}`}
          onClick={(event) => {
            event.stopPropagation();
            node.onDelete?.(id);
          }}
          className="bg-destructive text-destructive-foreground shadow-raised absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full opacity-0 transition-opacity focus-visible:opacity-100 group-hover/node:opacity-100"
        >
          <Trash2 className="size-3" />
        </button>
      ) : null}

      <div
        className="flex items-center gap-2 rounded-t-lg px-2.5 py-1.5"
        style={{
          backgroundColor: `hsl(${node.meta.hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
          color: `hsl(${node.meta.hue} 55% var(--hue-fg-l))`,
        }}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide">
          {node.kindLabel}
        </span>
        {node.issue ? (
          <span
            className="ml-auto shrink-0"
            title={node.issue === "erro" ? "Erro de validação" : "Alerta"}
          >
            {node.issue === "erro" ? (
              <CircleAlert className="text-destructive size-3.5" />
            ) : (
              <AlertTriangle className="text-warning size-3.5" />
            )}
          </span>
        ) : null}
      </div>

      <div className="px-2.5 py-2">
        <p className="text-foreground text-xs font-medium leading-snug">{node.label}</p>
        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-[11px] leading-snug">
          {node.summary}
        </p>
      </div>

      {outputs.length > 0 ? (
        <div className="border-border border-t px-2.5 py-1.5">
          <ul className="space-y-1">
            {outputs.map((port, index) => (
              <li
                key={port.id}
                className={cn(
                  "flex items-center justify-end gap-1.5 text-[10px]",
                  port.fallback ? "text-warning" : "text-muted-foreground",
                )}
              >
                <span className="truncate">{port.label}</span>
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    port.fallback ? "bg-warning" : "bg-muted-foreground/50",
                  )}
                  aria-hidden
                />
                <Handle
                  type="source"
                  position={Position.Right}
                  id={port.id}
                  style={{ top: `${calcHandleTop(index)}px` }}
                  className={cn(
                    "!border-surface !size-2.5 !border-2",
                    port.fallback ? "!bg-warning" : "!bg-accent",
                  )}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="border-border text-muted-foreground border-t px-2.5 py-1 text-right text-[10px]">
          bloco terminal
        </div>
      )}
    </div>
  );
}

/**
 * Posiciona a alça de cada saída na altura da própria linha da lista.
 * O cabeçalho ocupa ~28 px, o corpo ~46 px e cada linha, 18 px.
 */
function calcHandleTop(index: number): number {
  const HEADER = 28;
  const BODY = 46;
  const ROW = 18;
  return HEADER + BODY + 8 + index * ROW + ROW / 2;
}
