"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type { FlowEdge, FlowNode, FlowValidationIssue } from "@elora/core";

import { CrmFlowEdge, type CrmEdgeData } from "./flow-edge";
import { CrmFlowNode, type CrmFlowNodeData } from "./flow-node";
import type { NodeMeta } from "./node-meta";

import "@xyflow/react/dist/style.css";

const nodeTypes = { crm: CrmFlowNode };
const edgeTypes = { crm: CrmFlowEdge };

/** Tipo MIME do arrasto vindo da paleta. */
export const BLOCK_DRAG_TYPE = "application/crm-block";

export interface FlowCanvasProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  metaByKind: Record<string, NodeMeta>;
  labelByKind: Record<string, string>;
  issues: FlowValidationIssue[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onMoveNode?: (nodeId: string, position: { x: number; y: number }) => void;
  /** Remoção pelo teclado ou pelo botão do bloco. */
  onDeleteNode?: (nodeId: string) => void;
  /** Clique no "+" da aresta: abre o seletor de bloco. */
  onInsertOnEdge?: (edgeId: string) => void;
  /** Bloco arrastado da paleta e solto sobre a aresta. */
  onDropOnEdge?: (edgeId: string, kind: string) => void;
  /** Bloco arrastado da paleta e solto no canvas vazio. */
  onDropOnCanvas?: (kind: string, position: { x: number; y: number }) => void;
  /** Nó em execução no simulador. */
  activeNodeId?: string | null;
  /** Nós já percorridos na simulação atual. */
  visitedNodeIds?: string[];
  readOnly?: boolean;
}

function FlowCanvasInner({
  nodes: domainNodes,
  edges: domainEdges,
  metaByKind,
  labelByKind,
  issues,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onDeleteNode,
  onInsertOnEdge,
  onDropOnEdge,
  onDropOnCanvas,
  activeNodeId,
  visitedNodeIds = [],
  readOnly,
}: FlowCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const issueByNode = useMemo(() => {
    const map = new Map<string, "erro" | "alerta">();
    for (const issue of issues) {
      if (!issue.nodeId) continue;
      if (map.get(issue.nodeId) === "erro") continue;
      map.set(issue.nodeId, issue.severity);
    }
    return map;
  }, [issues]);

  const visited = useMemo(() => new Set(visitedNodeIds), [visitedNodeIds]);
  const hueByNode = useMemo(() => {
    const map = new Map<string, number>();
    for (const node of domainNodes) {
      map.set(node.id, metaByKind[node.kind]?.hue ?? 218);
    }
    return map;
  }, [domainNodes, metaByKind]);

  const rfNodes: Node<CrmFlowNodeData>[] = useMemo(
    () =>
      domainNodes.map((node) => ({
        id: node.id,
        type: "crm",
        position: node.position,
        selected: node.id === selectedNodeId,
        draggable: !readOnly,
        deletable: !readOnly,
        data: {
          kind: node.kind,
          kindLabel: labelByKind[node.kind] ?? node.kind,
          label: node.label,
          summary: node.summary,
          outputs: node.outputs,
          meta: metaByKind[node.kind] ?? Object.values(metaByKind)[0]!,
          issue: issueByNode.get(node.id) ?? null,
          active: node.id === activeNodeId,
          visited: visited.has(node.id),
          readOnly: Boolean(readOnly),
          onDelete: onDeleteNode,
        },
      })),
    [
      domainNodes,
      selectedNodeId,
      readOnly,
      labelByKind,
      metaByKind,
      issueByNode,
      activeNodeId,
      visited,
      onDeleteNode,
    ],
  );

  const rfEdges: Edge<CrmEdgeData>[] = useMemo(
    () =>
      domainEdges.map((edge) => {
        const source = domainNodes.find((node) => node.id === edge.source);
        const port = source?.outputs.find((output) => output.id === edge.sourcePort);

        return {
          id: edge.id,
          type: "crm",
          source: edge.source,
          sourceHandle: edge.sourcePort,
          target: edge.target,
          targetHandle: "in",
          label: edge.label,
          data: {
            sourceHue: hueByNode.get(edge.source) ?? 218,
            targetHue: hueByNode.get(edge.target) ?? 218,
            fallback: Boolean(port?.fallback),
            active:
              visited.has(edge.source) &&
              (visited.has(edge.target) || edge.target === activeNodeId),
            readOnly: Boolean(readOnly),
            onInsert: onInsertOnEdge,
            onDropKind: onDropOnEdge,
          },
        };
      }),
    [
      domainEdges,
      domainNodes,
      hueByNode,
      visited,
      activeNodeId,
      readOnly,
      onInsertOnEdge,
      onDropOnEdge,
    ],
  );

  const [viewNodes, setViewNodes, onNodesChange] = useNodesState(rfNodes);
  const [viewEdges, setViewEdges] = useEdgesState(rfEdges);

  useEffect(() => setViewNodes(rfNodes), [rfNodes, setViewNodes]);
  useEffect(() => setViewEdges(rfEdges), [rfEdges, setViewEdges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<CrmFlowNodeData>>[]) => {
      onNodesChange(changes);
      if (!onMoveNode) return;
      for (const change of changes) {
        if (change.type === "position" && change.dragging === false && change.position) {
          onMoveNode(change.id, change.position);
        }
      }
    },
    [onNodesChange, onMoveNode],
  );

  /** Solta um bloco da paleta no canvas vazio, na posição do ponteiro. */
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(BLOCK_DRAG_TYPE);
      if (!kind || !onDropOnCanvas) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      // O ponteiro marca o centro do bloco, não o canto — solta onde se vê.
      onDropOnCanvas(kind, { x: position.x - 112, y: position.y - 40 });
    },
    [onDropOnCanvas, screenToFlowPosition],
  );

  return (
    <div
      ref={wrapperRef}
      className="size-full"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(BLOCK_DRAG_TYPE)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={viewNodes}
        edges={viewEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onNodeClick={(_, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(null)}
        onNodesDelete={(deleted) => {
          for (const node of deleted) onDeleteNode?.(node.id);
        }}
        // Só `Delete`: `Backspace` apagaria blocos enquanto se escreve no inspetor.
        deleteKeyCode={readOnly ? null : ["Delete"]}
        nodesConnectable={false}
        edgesFocusable={!readOnly}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        className="bg-surface-sunken"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="hsl(var(--border))" />
        <Controls
          showInteractive={false}
          className="!border-border !bg-surface !shadow-card [&_button]:!border-border [&_button]:!bg-surface [&_button]:!text-foreground !rounded-lg !border"
        />
        <MiniMap
          pannable
          zoomable
          style={{ width: 150, height: 96 }}
          className="!border-border !bg-surface !rounded-lg !border"
          maskColor="hsl(var(--muted) / 0.7)"
          nodeColor={(node) => {
            const data = node.data as CrmFlowNodeData;
            return `hsl(${data.meta?.hue ?? 218} 60% 60%)`;
          }}
        />
      </ReactFlow>
    </div>
  );
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
