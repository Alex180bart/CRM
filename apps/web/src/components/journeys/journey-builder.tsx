"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  Contact,
  FlowNode,
  Journey,
  JourneyEnrollment,
  JourneyNode,
  JourneyVersion,
} from "@elora/core";
import {
  FLOW_STATUS_LABEL,
  formatCountdown,
  formatDate,
  formatPercent,
  formatRelative,
  hasBlockingIssue,
  JOURNEY_NODE_LABEL,
  offsetIso,
  REENTRY_LABEL,
  validateFlow,
} from "@elora/core";
import {
  Avatar,
  Badge,
  Button,
  Callout,
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
  EmptyState,
  KeyValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  cn,
} from "@elora/ui";
import { ArrowLeft, ChevronDown, Clock, History, Play, Rocket, Target, Users } from "lucide-react";
import { toast } from "sonner";

import { Metric, MetricStrip } from "@/components/shell/metric-strip";
import { BlockPalette } from "@/components/flow/block-palette";
import { FlowCanvas } from "@/components/flow/flow-canvas";
import { NodeInspector } from "@/components/flow/node-inspector";
import { JOURNEY_NODE_META } from "@/components/flow/node-meta";
import { SimulatorPanel } from "@/components/flow/simulator-panel";
import { useFlowSimulator } from "@/components/flow/use-simulator";
import { ValidationPanel } from "@/components/flow/validation-panel";

const ENTRY_KINDS = ["gatilho"];
const TERMINAL_KINDS = ["saida"];
const MAX_SIMULATION_STEPS = 40;

const STATUS_TONE = {
  rascunho: "neutral",
  em_revisao: "warning",
  aprovado: "info",
  publicado: "success",
  arquivado: "neutral",
} as const;

const ENROLLMENT_TONE = {
  ativo: "info",
  aguardando: "warning",
  concluido: "success",
  saiu: "neutral",
  erro: "danger",
} as const;

function defaultConfigFor(kind: string): JourneyNode["config"] {
  switch (kind) {
    case "gatilho":
      return { evento: "contact.created", filtro: "", reentrada: "unica" };
    case "condicao":
      return {
        campo: "contato.score",
        operador: "maior_ou_igual",
        valor: "50",
        simulationPort: "sim",
      };
    case "espera":
      return { duracaoDias: 1 };
    case "enviar_whatsapp":
      return { template: "", numero: "WhatsApp Comercial", limiteFrequencia: "1 por 7 dias" };
    case "enviar_email":
      return { template: "", assunto: "" };
    case "criar_tarefa":
      return { titulo: "", prazoDias: 1, responsavel: "proprietario_do_contato" };
    case "webhook":
      return { metodo: "POST", url: "https://", timeoutSegundos: 8 };
    case "adicionar_tag":
      return { tag: "" };
    case "mover_etapa":
      return { funil: "Vendas — contabilidade", etapa: "Qualificação" };
    case "notificar_equipe":
      return { time: "Atendimento", canal: "interno", prioridade: "normal" };
    case "meta":
      return { evento: "meeting.scheduled", janelaDias: 21 };
    case "saida":
      return { motivo: "fim_do_fluxo" };
    default:
      return {};
  }
}

function defaultOutputsFor(kind: string): JourneyNode["outputs"] {
  if (TERMINAL_KINDS.includes(kind)) return [];
  if (kind === "condicao") {
    return [
      { id: "sim", label: "Sim" },
      { id: "nao", label: "Não" },
    ];
  }
  if (kind === "webhook") {
    return [
      { id: "ok", label: "Sucesso" },
      { id: "erro", label: "Falha", fallback: true },
    ];
  }
  if (kind === "meta") return [{ id: "atingida", label: "Meta atingida" }];
  return [{ id: "out", label: "Continuar" }];
}

export function JourneyBuilder({
  journey,
  enrollments,
  contacts,
}: {
  journey: Journey;
  enrollments: JourneyEnrollment[];
  contacts: Contact[];
}) {
  const [versions, setVersions] = useState<JourneyVersion[]>(journey.versions);
  const [activeVersionId, setActiveVersionId] = useState(journey.activeVersionId);
  const [viewVersionId, setViewVersionId] = useState(journey.draftVersionId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rightPanel, setRightPanel] = useState<"inspetor" | "simulador" | "participantes">(
    "inspetor",
  );
  const [publishOpen, setPublishOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [sequence, setSequence] = useState(0);
  const [insertEdgeId, setInsertEdgeId] = useState<string | null>(null);

  const contactById = useMemo(() => new Map(contacts.map((item) => [item.id, item])), [contacts]);

  const version = versions.find((item) => item.id === viewVersionId) ?? versions[0]!;
  const readOnly = version.status === "publicado" || version.status === "arquivado";

  const issues = useMemo(
    () =>
      validateFlow(version.nodes, version.edges, {
        entryKinds: ENTRY_KINDS,
        terminalKinds: TERMINAL_KINDS,
      }),
    [version],
  );

  const blocked = hasBlockingIssue(issues);

  const simulator = useFlowSimulator(version.nodes, version.edges, {
    entryKinds: ENTRY_KINDS,
    terminalKinds: TERMINAL_KINDS,
    questionKinds: [],
    maxSteps: MAX_SIMULATION_STEPS,
  });

  const selectedNode = version.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const nodeLabelById = useMemo(
    () => new Map(version.nodes.map((node) => [node.id, node.label])),
    [version.nodes],
  );

  function updateVersion(updater: (current: JourneyVersion) => JourneyVersion) {
    setVersions((current) =>
      current.map((item) => (item.id === version.id ? updater(item) : item)),
    );
  }

  function updateNode(nodeId: string, updater: (node: JourneyNode) => JourneyNode) {
    updateVersion((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? updater(node) : node)),
    }));
  }

  function handleAddBlockAt(kind: string, position: { x: number; y: number }) {
    const nextSequence = sequence + 1;
    setSequence(nextSequence);
    const id = `jn_novo_${nextSequence}`;

    const newNode: JourneyNode = {
      id,
      kind: kind as JourneyNode["kind"],
      label: JOURNEY_NODE_LABEL[kind as JourneyNode["kind"]] ?? kind,
      summary: "Bloco recém-adicionado. Configure e conecte as saídas.",
      position,
      config: defaultConfigFor(kind),
      outputs: defaultOutputsFor(kind),
    };

    updateVersion((current) => ({ ...current, nodes: [...current.nodes, newNode] }));
    setSelectedNodeId(id);
    setRightPanel("inspetor");
    toast.info(`Bloco "${newNode.label}" adicionado`);
  }

  function handleAddBlock(kind: string) {
    handleAddBlockAt(kind, { x: 160 + (sequence + 1) * 40, y: 620 + (sequence + 1) * 30 });
  }

  /** Remove o bloco e religa as pontas quando o caminho de saída é único. */
  function handleDeleteNode(nodeId: string) {
    const target = version.nodes.find((node) => node.id === nodeId);
    if (!target) return;

    updateVersion((current) => {
      const incoming = current.edges.filter((edge) => edge.target === nodeId);
      const outgoing = current.edges.filter((edge) => edge.source === nodeId);
      const heir = outgoing.length === 1 ? outgoing[0] : undefined;

      return {
        ...current,
        nodes: current.nodes.filter((node) => node.id !== nodeId),
        edges: current.edges
          .filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
          .concat(heir ? incoming.map((edge) => ({ ...edge, target: heir.target })) : []),
      };
    });

    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    toast.success(`"${target.label}" removido`);
  }

  /** Insere um bloco dentro de uma conexão: A→B vira A→NOVO→B. */
  function insertOnEdge(edgeId: string, kind: string) {
    const edge = version.edges.find((item) => item.id === edgeId);
    if (!edge) return;

    const source = version.nodes.find((node) => node.id === edge.source);
    const target = version.nodes.find((node) => node.id === edge.target);

    const nextSequence = sequence + 1;
    setSequence(nextSequence);
    const id = `jn_novo_${nextSequence}`;
    const outputs = defaultOutputsFor(kind);
    const exit = outputs.find((port) => !port.fallback) ?? outputs[0];

    const midpoint =
      source && target
        ? {
            x: Math.round((source.position.x + target.position.x) / 2),
            y: Math.round((source.position.y + target.position.y) / 2) + 90,
          }
        : { x: 200 + nextSequence * 40, y: 600 + nextSequence * 30 };

    const newNode: JourneyNode = {
      id,
      kind: kind as JourneyNode["kind"],
      label: JOURNEY_NODE_LABEL[kind as JourneyNode["kind"]] ?? kind,
      summary: "Bloco inserido no meio da jornada. Ajuste a configuração.",
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
          ? [{ id: `${edgeId}_para_${id}`, source: id, sourcePort: exit.id, target: edge.target }]
          : []),
      ],
    }));

    setSelectedNodeId(id);
    setRightPanel("inspetor");
    toast.success(`"${newNode.label}" inserido na jornada`);
  }

  function handlePublish() {
    if (blocked) {
      toast.error("Publicação bloqueada", {
        description: "Corrija os erros de validação antes de publicar.",
      });
      return;
    }

    const publishedAt = offsetIso({});
    const nextVersionNumber = Math.max(...versions.map((item) => item.version)) + 1;

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
        id: `${journey.id}_v${nextVersionNumber}_draft`,
        journeyId: journey.id,
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
      description: `${journey.stats.active} participantes ativos continuam na versão em que entraram.`,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-border bg-surface shrink-0 border-b px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Voltar para jornadas">
            <Link href="/jornadas">
              <ArrowLeft />
            </Link>
          </Button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-semibold">{journey.name}</h1>
              <Badge variant={STATUS_TONE[version.status]}>
                {FLOW_STATUS_LABEL[version.status]}
              </Badge>
              {version.id === activeVersionId ? <Badge variant="success">em produção</Badge> : null}
            </div>
            <p className="text-muted-foreground truncate text-xs">
              Meta: {journey.goal} · {REENTRY_LABEL[journey.reentryPolicy]}
              {journey.reentryAfterDays ? ` (${journey.reentryAfterDays} dias)` : ""}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Tooltip
              content={`Janela de envio: ${journey.sendWindow.startHour}h às ${journey.sendWindow.endHour}h, horário local do contato.`}
            >
              <Badge variant="neutral">
                <Clock aria-hidden />
                {journey.sendWindow.startHour}h–{journey.sendWindow.endHour}h
              </Badge>
            </Tooltip>
            <Tooltip content="Prioridade entre jornadas concorrentes. A maior vence quando há conflito de frequência.">
              <Badge variant="info">prioridade {journey.priority}</Badge>
            </Tooltip>

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
                  Editar uma jornada publicada cria nova versão e exige análise do impacto sobre
                  participantes ativos.
                </p>
              </DropdownMenuContent>
            </DropdownMenu>

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

      {/* Indicadores em faixa fina — o canvas é a área de trabalho. */}
      <MetricStrip
        trailing={
          <Badge variant="neutral">
            <Target aria-hidden />
            {journey.goal}
          </Badge>
        }
      >
        <Metric label="Ativos" value={journey.stats.active} hint="em execução" />
        <Metric label="Concluídos" value={journey.stats.completed} />
        <Metric label="Meta atingida" value={journey.stats.goalReached} tone="success" />
        <Metric
          label="Conversão"
          value={formatPercent(journey.stats.conversionPct, 1)}
          tone={journey.stats.conversionPct >= 20 ? "success" : "warning"}
          hint="meta 20%"
        />
        <Metric label="Saíram" value={journey.stats.exited} />
        <Metric label="Blocos" value={version.nodes.length} />
      </MetricStrip>

      <div className="flex min-h-0 flex-1">
        <BlockPalette
          metaByKind={JOURNEY_NODE_META}
          labelByKind={JOURNEY_NODE_LABEL}
          onAdd={handleAddBlock}
          disabled={readOnly}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1">
            <FlowCanvas
              nodes={version.nodes}
              edges={version.edges}
              metaByKind={JOURNEY_NODE_META}
              labelByKind={JOURNEY_NODE_LABEL}
              issues={issues}
              selectedNodeId={selectedNodeId}
              onSelectNode={(nodeId) => {
                setSelectedNodeId(nodeId);
                if (nodeId) setRightPanel("inspetor");
              }}
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
        </div>

        {/* Painel direito */}
        <div className="border-border bg-surface flex w-80 shrink-0 flex-col border-l">
          <Tabs
            value={rightPanel}
            onValueChange={(value) => setRightPanel(value as typeof rightPanel)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="shrink-0 px-2">
              <TabsTrigger value="inspetor">Bloco</TabsTrigger>
              <TabsTrigger value="simulador">
                <Play className="size-3" />
                Simulador
              </TabsTrigger>
              <TabsTrigger value="participantes">
                Participantes
                <Badge variant="neutral">{enrollments.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <div className="min-h-0 flex-1 overflow-hidden">
              <TabsContent value="inspetor" className="m-0 h-full">
                <div className="flex h-full">
                  <NodeInspector
                    node={selectedNode as FlowNode | null}
                    meta={selectedNode ? JOURNEY_NODE_META[selectedNode.kind] : undefined}
                    kindLabel={selectedNode ? JOURNEY_NODE_LABEL[selectedNode.kind] : undefined}
                    issues={issues}
                    readOnly={readOnly}
                    onChangeLabel={(value) =>
                      selectedNode &&
                      updateNode(selectedNode.id, (node) => ({ ...node, label: value }))
                    }
                    onChangeSummary={(value) =>
                      selectedNode &&
                      updateNode(selectedNode.id, (node) => ({ ...node, summary: value }))
                    }
                    onChangeConfig={(key, value) =>
                      selectedNode &&
                      updateNode(selectedNode.id, (node) => ({
                        ...node,
                        config: { ...node.config, [key]: value },
                      }))
                    }
                    onDelete={() => selectedNode && handleDeleteNode(selectedNode.id)}
                  />
                </div>
              </TabsContent>

              <TabsContent value="simulador" className="m-0 h-full">
                <div className="flex h-full">
                  <SimulatorPanel
                    entries={simulator.entries}
                    status={simulator.status}
                    awaiting={simulator.awaiting}
                    variables={simulator.variables}
                    steps={simulator.steps}
                    maxSteps={MAX_SIMULATION_STEPS}
                    onStart={simulator.start}
                    onAnswer={simulator.answer}
                    onReset={simulator.reset}
                    onClose={() => setRightPanel("inspetor")}
                  />
                </div>
              </TabsContent>

              <TabsContent value="participantes" className="m-0 h-full overflow-y-auto">
                <div className="p-3">
                  <Callout variant="info" className="mb-3">
                    Cada participante é um registro próprio com status, versão, nó atual e próxima
                    execução. A espera grava <code className="font-mono">next_run_at</code> — nada
                    fica em memória.
                  </Callout>

                  {enrollments.length === 0 ? (
                    <EmptyState
                      icon={<Users />}
                      title="Nenhum participante"
                      description="Quando um contato atender ao gatilho, ele aparece aqui com o nó atual e a próxima execução."
                      compact
                    />
                  ) : (
                    <ul className="space-y-2">
                      {enrollments.map((enrollment) => {
                        const contact = contactById.get(enrollment.contactId);
                        return (
                          <li
                            key={enrollment.id}
                            className={cn(
                              "rounded-lg p-2.5",
                              enrollment.status === "erro" ? "bg-destructive-soft" : "bg-muted/50",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar
                                initials={contact?.avatarInitials ?? "??"}
                                hue={contact?.accentHue ?? 218}
                                size="xs"
                              />
                              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                                {contact?.fullName ?? enrollment.contactId}
                              </span>
                              <Badge variant={ENROLLMENT_TONE[enrollment.status]}>
                                {enrollment.status}
                              </Badge>
                            </div>
                            <dl className="mt-1.5">
                              <KeyValue
                                label="Nó atual"
                                value={
                                  nodeLabelById.get(enrollment.currentNodeId) ??
                                  enrollment.currentNodeId
                                }
                                className="py-0.5"
                              />
                              <KeyValue
                                label="Entrou"
                                value={formatRelative(enrollment.enrolledAt)}
                                className="py-0.5"
                              />
                              {enrollment.nextRunAt ? (
                                <KeyValue
                                  label="Próxima execução"
                                  value={formatCountdown(enrollment.nextRunAt)}
                                  className="py-0.5"
                                />
                              ) : null}
                              {enrollment.goalReachedAt ? (
                                <KeyValue
                                  label="Meta atingida"
                                  value={formatDate(enrollment.goalReachedAt)}
                                  className="py-0.5"
                                />
                              ) : null}
                            </dl>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      <ValidationPanel
        issues={issues}
        onFocusNode={(nodeId) => {
          setSelectedNodeId(nodeId);
          setRightPanel("inspetor");
        }}
      />

      {/* Escolha do bloco a inserir na conexão */}
      <Dialog open={insertEdgeId !== null} onOpenChange={(open) => !open && setInsertEdgeId(null)}>
        <DialogContent className="w-[min(92vw,30rem)]">
          <DialogHeader>
            <DialogTitle>Inserir bloco na conexão</DialogTitle>
            <DialogDescription>
              O bloco entra entre os dois já ligados e as conexões se refazem sozinhas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto p-5">
            {Object.keys(JOURNEY_NODE_META).map((kind) => {
              const meta = JOURNEY_NODE_META[kind];
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
                      {JOURNEY_NODE_LABEL[kind as JourneyNode["kind"]] ?? kind}
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

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar versão {version.version}</DialogTitle>
            <DialogDescription>
              Novos participantes entram nesta versão. Os {journey.stats.active} participantes
              ativos continuam executando a versão em que entraram.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 p-5">
            <dl>
              <KeyValue label="Blocos" value={String(version.nodes.length)} />
              <KeyValue label="Conexões" value={String(version.edges.length)} />
              <KeyValue label="Participantes ativos" value={String(journey.stats.active)} />
              <KeyValue
                label="Erros de validação"
                value={String(issues.filter((i) => i.severity === "erro").length)}
              />
            </dl>

            <div className="space-y-1.5">
              <label
                htmlFor="journey-change-note"
                className="text-muted-foreground text-xs font-medium"
              >
                Nota da versão
              </label>
              <Textarea
                id="journey-change-note"
                value={changeNote}
                onChange={(event) => setChangeNote(event.target.value)}
                placeholder="Descreva o que mudou e qual o impacto esperado sobre os participantes ativos."
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
