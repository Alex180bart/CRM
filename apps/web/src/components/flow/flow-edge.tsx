"use client";

import { useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { cn } from "@crm/ui";
import { Plus } from "lucide-react";

/**
 * Aresta do editor de fluxo.
 *
 * A versão anterior desenhava a linha em `--border` — quase branco sobre o
 * canvas claro, praticamente invisível. Aqui a linha usa um **degradê entre as
 * matizes dos dois blocos que ela conecta**: a cor conta de onde a conexão sai
 * e para onde vai, sem precisar de legenda.
 *
 * A linha também é ponto de edição: o "+" no meio insere um bloco naquele
 * ponto do fluxo, e a mesma área aceita um bloco arrastado da paleta.
 */

export interface CrmEdgeData extends Record<string, unknown> {
  sourceHue: number;
  targetHue: number;
  /** Caminho de exceção — tracejado, para não parecer fluxo normal. */
  fallback: boolean;
  /** Percorrido pelo simulador agora. */
  active: boolean;
  readOnly: boolean;
  onInsert?: (edgeId: string) => void;
  onDropKind?: (edgeId: string, kind: string) => void;
}

export function CrmFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  data,
  selected,
}: EdgeProps) {
  const edge = (data ?? {}) as CrmEdgeData;
  const { getZoom } = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const [dropTarget, setDropTarget] = useState(false);

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const gradientId = `edge-grad-${id}`;
  const sourceColor = `hsl(${edge.sourceHue ?? 218} 62% 52%)`;
  const targetColor = `hsl(${edge.targetHue ?? 218} 62% 52%)`;

  const emphasised = edge.active || selected || hovered || dropTarget;
  const width = edge.active ? 3 : emphasised ? 2.75 : 2;

  return (
    <>
      {/* O degradê usa coordenadas do canvas para acompanhar a curva. */}
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
        >
          <stop offset="0%" stopColor={sourceColor} />
          <stop offset="100%" stopColor={targetColor} />
        </linearGradient>
      </defs>

      {/* Traço largo e transparente: alvo de ponteiro confortável. */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ pointerEvents: "stroke" }}
      />

      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: `url(#${gradientId})`,
          strokeWidth: width,
          strokeDasharray: edge.fallback ? "7 5" : undefined,
          opacity: edge.fallback && !emphasised ? 0.75 : 1,
          transition: "stroke-width 0.18s ease, opacity 0.18s ease",
        }}
      />

      {/* Faísca que corre pela linha enquanto o simulador a percorre. */}
      {edge.active ? (
        <path
          d={path}
          fill="none"
          stroke={targetColor}
          strokeWidth={width + 1}
          strokeLinecap="round"
          className="flow-edge-pulse"
          style={{ filter: "drop-shadow(0 0 3px hsl(var(--accent) / 0.5))" }}
        />
      ) : null}

      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div className="flex items-center gap-1">
            {label ? (
              <span
                className={cn(
                  "shadow-card rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                  edge.fallback
                    ? "bg-warning-soft text-warning"
                    : "bg-surface text-muted-foreground",
                )}
              >
                {label}
              </span>
            ) : null}

            {/* Inserir bloco no meio do fluxo */}
            {!edge.readOnly ? (
              <button
                type="button"
                aria-label="Inserir bloco nesta conexão"
                onClick={(event) => {
                  event.stopPropagation();
                  edge.onInsert?.(id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  setDropTarget(true);
                }}
                onDragLeave={() => setDropTarget(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDropTarget(false);
                  const kind = event.dataTransfer.getData("application/crm-block");
                  if (kind) edge.onDropKind?.(id, kind);
                }}
                className={cn(
                  "shadow-card flex items-center justify-center rounded-full transition-all duration-200",
                  dropTarget
                    ? "bg-accent text-accent-foreground ring-accent/30 size-8 ring-4"
                    : hovered || selected
                      ? "bg-primary text-primary-foreground size-6"
                      : "bg-surface text-muted-foreground size-4 opacity-0",
                  // O alvo cresce quando um bloco está sendo arrastado sobre ele.
                  "hover:opacity-100",
                )}
                style={{
                  // Mantém o botão legível em qualquer zoom.
                  transform: `scale(${Math.min(1.4, Math.max(0.8, 1 / getZoom()))})`,
                }}
              >
                <Plus className={dropTarget ? "size-4" : "size-3"} />
              </button>
            ) : null}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
