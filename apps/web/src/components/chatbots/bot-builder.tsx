"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BotFlow, BotFlowVersion, BotNode, FlowNode } from "@crm/core";
import {
  BOT_NODE_LABEL,
  FLOW_STATUS_LABEL,
  formatDate,
  formatNumber,
  formatPercent,
  hasBlockingIssue,
  offsetIso,
  validateFlow,
} from "@crm/core";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  KeyValue,
  Textarea,
  Tooltip,
} from "@crm/ui";
import { ArrowLeft, ChevronDown, History, Play, Rocket, Shield } from "lucide-react";
import { toast } from "sonner";

import { Metric, MetricStrip } from "@/components/shell/metric-strip";
import { BlockPalette } from "@/components/flow/block-palette";
import { FlowCanvas } from "@/components/flow/flow-canvas";
import { NodeInspector } from "@/components/flow/node-inspector";
import { BOT_NODE_META } from "@/components/flow/node-meta";
import { PhoneSimulator } from "@/components/flow/phone-simulator";
import { useFlowSimulator } from "@/components/flow/use-simulator";
import { ValidationPanel } from "@/components/flow/validation-panel";

const TERMINAL_KINDS = ["transferir", "finalizar"];
const ENTRY_KINDS = ["inicio"];
const QUESTION_KINDS = ["pergunta"];

const STATUS_TONE = {
  rascunho: "neutral",
  em_revisao: "warning",
  aprovado: "info",
  publicado: "success",
  arquivado: "neutral",
} as const;

function defaultConfigFor(kind: string): BotNode["config"] {
  switch (kind) {
    case "mensagem":
      return { texto: "Escreva a mensagem que o contato vai receber." };
    case "pergunta":
      return {
        pergunta: "O que você deseja perguntar?",
        variavel: "resposta",
        tipo: "texto",
        timeoutMinutos: 10,
      };
    case "condicao":
      return {
        campo: "contato.ciclo_de_vida",
        operador: "igual_a",
        valor: "cliente",
        simulationPort: "sim",
      };
    case "http":
      return { metodo: "GET", url: "https://", timeoutSegundos: 8, credencial: "" };
    case "ia":
      return {
        tarefa: "classificacao",
        intencoes: ["quero contratar", "dúvida sobre imposto", "problema com documento"],
        instrucao:
          "Leia a conversa e decida o que o contato quer. Não confirme nem conteste valores de imposto — encaminhe.",
        // Transferência ligada por padrão: bot sem saída para gente é o pior caso.
        acoes: ["consultar_crm", "buscar_conhecimento", "transferir_humano"],
        modelo: "gemini-2.5-flash",
        temperatura: 0.2,
        confiancaMinima: 70,
        custoMaximoCentavos: 10,
        timeoutSegundos: 12,
      };
    case "transferir":
      return { fila: "Suporte fiscal", prioridade: "normal", incluirResumo: true };
    case "aguardar":
      return { duracaoHoras: 24 };
    case "crm":
      return { acao: "adicionar_tag", tag: "" };
    case "variavel":
      return { nome: "nova_variavel", expressao: "" };
    case "finalizar":
      return { resultado: "resolvido_pelo_bot", resolverConversa: true };
    default:
      return {};
  }
}

function defaultOutputsFor(kind: string): BotNode["outputs"] {
  if (TERMINAL_KINDS.includes(kind)) return [];
  if (kind === "condicao") {
    return [
      { id: "sim", label: "Sim" },
      { id: "nao", label: "Não" },
    ];
  }
  if (kind === "pergunta") {
    return [
      { id: "out", label: "Respondido" },
      { id: "sem_resposta", label: "Sem resposta", fallback: true },
    ];
  }
  if (kind === "ia") {
    // Espelha as intenções padrão. O inspetor reescreve isto quando a tarefa muda.
    return [
      { id: "quero_contratar", label: "quero contratar" },
      { id: "duvida_sobre_imposto", label: "dúvida sobre imposto" },
      { id: "problema_com_documento", label: "problema com documento" },
      { id: "outro", label: "Nenhuma das intenções" },
      { id: "erro", label: "Falha ou baixa confiança", fallback: true },
    ];
  }
  if (kind === "http") {
    return [
      { id: "ok", label: "Sucesso" },
      { id: "erro", label: "Falha", fallback: true },
    ];
  }
  return [{ id: "out", label: "Continuar" }];
}

export function BotBuilder({ flow }: { flow: BotFlow }) {
  const [versions, setVersions] = useState<BotFlowVersion[]>(flow.versions);
  const [activeVersionId, setActiveVersionId] = useState(flow.activeVersionId);
  const [viewVersionId, setViewVersionId] = useState(flow.draftVersionId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showSimulator, setShowSimulator] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [sequence, setSequence] = useState(0);
  /** Conexão que recebeu clique no "+", aguardando a escolha do bloco. */
  const [insertEdgeId, setInsertEdgeId] = useState<string | null>(null);

  const version = versions.find((item) => item.id === viewVersionId) ?? versions[0]!;
  const readOnly = version.status !== "rascunho";

  const issues = useMemo(
    () =>
      validateFlow(version.nodes, version.edges, {
        entryKinds: ENTRY_KINDS,
        terminalKinds: TERMINAL_KINDS,
        requireHumanHandoff: true,
      }),
    [version],
  );

  const blocked = hasBlockingIssue(issues);

  const simulator = useFlowSimulator(version.nodes, version.edges, {
    entryKinds: ENTRY_KINDS,
    terminalKinds: TERMINAL_KINDS,
    questionKinds: QUESTION_KINDS,
    maxSteps: flow.limits.maxSteps,
  });

  const selectedNode = version.nodes.find((node) => node.id === selectedNodeId) ?? null;

  function updateVersion(updater: (current: BotFlowVersion) => BotFlowVersion) {
    setVersions((current) =>
      current.map((item) => (item.id === version.id ? updater(item) : item)),
    );
  }

  function updateNode(nodeId: string, updater: (node: BotNode) => BotNode) {
    updateVersion((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? updater(node) : node)),
    }));
  }

  function handleAddBlockAt(kind: string, position: { x: number; y: number }) {
    const nextSequence = sequence + 1;
    setSequence(nextSequence);
    const id = `bn_novo_${nextSequence}`;

    const newNode: BotNode = {
      id,
      kind: kind as BotNode["kind"],
      label: BOT_NODE_LABEL[kind as BotNode["kind"]] ?? kind,
      summary: "Bloco recém-adicionado. Configure e conecte as saídas.",
      position,
      config: defaultConfigFor(kind),
      outputs: defaultOutputsFor(kind),
    };

    updateVersion((current) => ({ ...current, nodes: [...current.nodes, newNode] }));
    setSelectedNodeId(id);
    toast.info(`Bloco "${newNode.label}" adicionado`, {
      description: "Conecte as saídas antes de publicar — caminhos soltos bloqueiam a publicação.",
    });
  }

  function handleAddBlock(kind: string) {
    handleAddBlockAt(kind, { x: 120 + (sequence + 1) * 40, y: 760 + (sequence + 1) * 30 });
  }

  /**
   * Remove um bloco.
   *
   * Quando o bloco removido está **no meio** de um caminho, as duas pontas são
   * reconectadas: A→X→B vira A→B. Sem isso, apagar um passo partiria o fluxo em
   * dois e o usuário teria de refazer a ligação à mão toda vez.
   */
  function handleDeleteNode(nodeId: string) {
    const target = version.nodes.find((node) => node.id === nodeId);
    if (!target) return;

    updateVersion((current) => {
      const incoming = current.edges.filter((edge) => edge.target === nodeId);
      const outgoing = current.edges.filter((edge) => edge.source === nodeId);
      // Só religa quando a saída é única: com várias saídas não há como saber
      // qual delas deveria herdar a conexão de entrada.
      const heir = outgoing.length === 1 ? outgoing[0] : undefined;

      const edges = current.edges
        .filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
        .concat(heir ? incoming.map((edge) => ({ ...edge, target: heir.target })) : []);

      return {
        ...current,
        nodes: current.nodes.filter((node) => node.id !== nodeId),
        edges,
      };
    });

    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    toast.success(`"${target.label}" removido`, {
      description: "As conexões vizinhas foram religadas quando havia um caminho único.",
    });
  }

  /**
   * Insere um bloco dentro de uma conexão existente.
   *
   * A conexão A→B some e nascem A→NOVO e NOVO→B, na primeira saída não-fallback
   * do bloco novo. O bloco é posicionado no meio do caminho, para o desenho não
   * embolar.
   */
  function insertOnEdge(edgeId: string, kind: string) {
    const edge = version.edges.find((item) => item.id === edgeId);
    if (!edge) return;

    const source = version.nodes.find((node) => node.id === edge.source);
    const target = version.nodes.find((node) => node.id === edge.target);

    const nextSequence = sequence + 1;
    setSequence(nextSequence);
    const id = `bn_novo_${nextSequence}`;
    const outputs = defaultOutputsFor(kind);
    const exit = outputs.find((port) => !port.fallback) ?? outputs[0];

    const midpoint =
      source && target
        ? {
            x: Math.round((source.position.x + target.position.x) / 2),
            y: Math.round((source.position.y + target.position.y) / 2) + 90,
          }
        : { x: 160 + nextSequence * 40, y: 700 + nextSequence * 30 };

    const newNode: BotNode = {
      id,
      kind: kind as BotNode["kind"],
      label: BOT_NODE_LABEL[kind as BotNode["kind"]] ?? kind,
      summary: "Bloco inserido no meio do fluxo. Ajuste a configuração.",
      position: midpoint,
      config: defaultConfigFor(kind),
      outputs,
    };

    updateVersion((current) => ({
      ...current,
      nodes: [...current.nodes, newNode],
      edges: [
        ...current.edges.map((item) => (item.id === edgeId ? { ...item, target: id } : item)),
        ...(exit
          ? [
              {
                id: `${edgeId}_para_${id}`,
                source: id,
                sourcePort: exit.id,
                target: edge.target,
              },
            ]
          : []),
      ],
    }));

    setSelectedNodeId(id);
    toast.success(`"${newNode.label}" inserido no fluxo`, {
      description: `Entre "${source?.label ?? "origem"}" e "${target?.label ?? "destino"}".`,
    });
  }

  function handlePublish() {
    if (blocked) {
      toast.error("Publicação bloqueada", {
        description: "Existem erros de validação. Corrija os caminhos sem saída antes de publicar.",
      });
      return;
    }

    const publishedAt = offsetIso({});
    const nextVersionNumber = Math.max(...versions.map((item) => item.version)) + 1;
    const newDraftId = `${flow.id}_v${nextVersionNumber}_draft`;

    setVersions((current) => [
      ...current.map((item) =>
        item.id === version.id
          ? {
              ...item,
              status: "publicado" as const,
              publishedAt,
              changeNote: changeNote || item.changeNote,
            }
          : item.status === "publicado"
            ? { ...item, status: "arquivado" as const }
            : item,
      ),
      {
        id: newDraftId,
        flowId: flow.id,
        version: nextVersionNumber,
        status: "rascunho",
        nodes: version.nodes,
        edges: version.edges,
        changeNote: "Novo rascunho criado a partir da versão publicada.",
      },
    ]);

    setActiveVersionId(version.id);
    setViewVersionId(version.id);
    setPublishOpen(false);
    setChangeNote("");

    toast.success(`Versão ${version.version} publicada`, {
      description:
        "A versão publicada é imutável. Um novo rascunho foi criado para as próximas edições.",
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cabeçalho do fluxo */}
      <header className="border-border bg-surface shrink-0 border-b px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Voltar para chatbots">
            <Link href="/chatbots">
              <ArrowLeft />
            </Link>
          </Button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold">{flow.name}</h1>
              <Badge variant={STATUS_TONE[version.status]}>
                {FLOW_STATUS_LABEL[version.status]}
              </Badge>
              {version.id === activeVersionId ? <Badge variant="success">em produção</Badge> : null}
            </div>
            <p className="text-muted-foreground truncate text-xs">{flow.description}</p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <History />
                  Versão {version.version}
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Histórico de versões</DropdownMenuLabel>
                {[...versions]
                  .sort((a, b) => b.version - a.version)
                  .map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onSelect={() => {
                        setViewVersionId(item.id);
                        setSelectedNodeId(null);
                        simulator.reset();
                      }}
                    >
                      <span className="flex-1 truncate">
                        v{item.version} · {FLOW_STATUS_LABEL[item.status]}
                      </span>
                      {item.publishedAt ? (
                        <span className="text-muted-foreground text-[11px] tabular-nums">
                          {formatDate(item.publishedAt)}
                        </span>
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuSeparator />
                <p className="text-muted-foreground px-2 py-1.5 text-[11px] leading-relaxed">
                  A versão publicada é imutável. Editar cria uma nova versão e não altera execuções
                  já iniciadas.
                </p>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant={showSimulator ? "accent" : "outline"}
              size="sm"
              onClick={() => setShowSimulator((value) => !value)}
            >
              <Play />
              Simulador
            </Button>

            <Tooltip
              content={
                blocked
                  ? "Corrija os erros de validação para liberar a publicação."
                  : readOnly
                    ? "Esta versão já está publicada."
                    : "Publica esta versão e cria um novo rascunho."
              }
            >
              <span>
                <Button
                  size="sm"
                  disabled={readOnly || blocked}
                  onClick={() => setPublishOpen(true)}
                >
                  <Rocket />
                  Publicar
                </Button>
              </span>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Indicadores e limites — faixa fina para preservar a área do canvas. */}
      <MetricStrip
        trailing={
          <Tooltip
            content={`Limites por execução: ${flow.limits.maxSteps} passos, ${flow.limits.maxHttpCalls} chamadas HTTP, ${(flow.limits.maxAiCostCents / 100).toFixed(2)} BRL de IA e ${flow.limits.maxDurationMinutes} minutos.`}
          >
            <Badge variant="neutral">
              <Shield aria-hidden />
              limites de segurança ativos
            </Badge>
          </Tooltip>
        }
      >
        <Metric label="Sessões (30 d)" value={formatNumber(flow.stats.sessions30d)} />
        <Metric
          label="Resolvido pelo bot"
          value={formatPercent(flow.stats.resolvedByBotPct)}
          tone={flow.stats.resolvedByBotPct >= 45 ? "success" : "warning"}
          hint="meta 45%"
        />
        <Metric
          label="Transbordo"
          value={formatPercent(flow.stats.handoffPct)}
          hint="para humano"
        />
        <Metric label="Passos/sessão" value={flow.stats.avgStepsPerSession.toFixed(1)} />
        <Metric label="Blocos" value={version.nodes.length} />
      </MetricStrip>

      {/* Editor */}
      <div className="flex min-h-0 flex-1">
        <BlockPalette
          metaByKind={BOT_NODE_META}
          labelByKind={BOT_NODE_LABEL}
          onAdd={handleAddBlock}
          disabled={readOnly}
        />

        <div className="min-w-0 flex-1">
          <FlowCanvas
            nodes={version.nodes}
            edges={version.edges}
            metaByKind={BOT_NODE_META}
            labelByKind={BOT_NODE_LABEL}
            issues={issues}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onMoveNode={
              readOnly
                ? undefined
                : (nodeId, position) => updateNode(nodeId, (node) => ({ ...node, position }))
            }
            onDeleteNode={readOnly ? undefined : handleDeleteNode}
            onInsertOnEdge={readOnly ? undefined : (edgeId) => setInsertEdgeId(edgeId)}
            onDropOnEdge={readOnly ? undefined : insertOnEdge}
            onDropOnCanvas={readOnly ? undefined : handleAddBlockAt}
            activeNodeId={simulator.currentNodeId}
            visitedNodeIds={simulator.visited}
            readOnly={readOnly}
          />
        </div>

        {showSimulator ? (
          <PhoneSimulator
            entries={simulator.entries}
            status={simulator.status}
            awaiting={simulator.awaiting}
            variables={simulator.variables}
            steps={simulator.steps}
            maxSteps={flow.limits.maxSteps}
            onStart={simulator.start}
            onAnswer={simulator.answer}
            onReset={simulator.reset}
            onClose={() => setShowSimulator(false)}
          />
        ) : (
          <NodeInspector
            node={selectedNode as FlowNode | null}
            meta={selectedNode ? BOT_NODE_META[selectedNode.kind] : undefined}
            kindLabel={selectedNode ? BOT_NODE_LABEL[selectedNode.kind] : undefined}
            issues={issues}
            readOnly={readOnly}
            onChangeLabel={(value) =>
              selectedNode && updateNode(selectedNode.id, (node) => ({ ...node, label: value }))
            }
            onChangeSummary={(value) =>
              selectedNode && updateNode(selectedNode.id, (node) => ({ ...node, summary: value }))
            }
            onChangeConfig={(key, value) =>
              selectedNode &&
              updateNode(selectedNode.id, (node) => ({
                ...node,
                config: { ...node.config, [key]: value },
              }))
            }
            onChangeOutputs={(outputs) =>
              selectedNode && updateNode(selectedNode.id, (node) => ({ ...node, outputs }))
            }
            onDelete={() => selectedNode && handleDeleteNode(selectedNode.id)}
          />
        )}
      </div>

      <ValidationPanel issues={issues} onFocusNode={setSelectedNodeId} />

      {/* Escolha do bloco a inserir na conexão */}
      <Dialog open={insertEdgeId !== null} onOpenChange={(open) => !open && setInsertEdgeId(null)}>
        <DialogContent className="w-[min(92vw,30rem)]">
          <DialogHeader>
            <DialogTitle>Inserir bloco na conexão</DialogTitle>
            <DialogDescription>
              O bloco entra entre os dois já ligados e as conexões se refazem sozinhas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 p-5">
            {Object.keys(BOT_NODE_META).map((kind) => {
              const meta = BOT_NODE_META[kind];
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    if (insertEdgeId) insertOnEdge(insertEdgeId, kind);
                    setInsertEdgeId(null);
                  }}
                  className="hover:bg-muted flex items-center gap-2 rounded-lg p-2.5 text-left transition-colors"
                >
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: `hsl(${meta.hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
                      color: `hsl(${meta.hue} 55% var(--hue-fg-l))`,
                    }}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {BOT_NODE_LABEL[kind as BotNode["kind"]] ?? kind}
                    </span>
                    <span className="text-muted-foreground line-clamp-1 text-[11px]">
                      {meta.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Publicação */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar versão {version.version}</DialogTitle>
            <DialogDescription>
              A versão publicada passa a atender novas sessões e se torna imutável. Sessões em
              andamento continuam na versão em que começaram.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 p-5">
            <dl>
              <KeyValue label="Blocos" value={String(version.nodes.length)} />
              <KeyValue label="Conexões" value={String(version.edges.length)} />
              <KeyValue
                label="Alertas"
                value={String(issues.filter((i) => i.severity === "alerta").length)}
              />
              <KeyValue
                label="Erros"
                value={String(issues.filter((i) => i.severity === "erro").length)}
              />
            </dl>

            <div className="space-y-1.5">
              <label htmlFor="change-note" className="text-muted-foreground text-xs font-medium">
                Nota da versão
              </label>
              <Textarea
                id="change-note"
                value={changeNote}
                onChange={(event) => setChangeNote(event.target.value)}
                placeholder="Descreva o que mudou nesta versão. A nota fica no histórico e na auditoria."
                className="min-h-20 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPublishOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handlePublish}>
              <Rocket />
              Publicar versão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
