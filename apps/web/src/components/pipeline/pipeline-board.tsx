"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Company, Contact, Deal, Pipeline, PipelineStage, Tag, User } from "@crm/core";
import {
  daysSince,
  formatCurrencyCents,
  formatDate,
  formatNumber,
  formatPercent,
  offsetIso,
} from "@crm/core";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
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
  DropdownMenuTrigger,
  EmptyState,
  KeyValue,
  ProgressBar,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TagChip,
  cn,
} from "@crm/ui";
import { AlertTriangle, Briefcase, ChevronDown, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { Metric, MetricStrip } from "@/components/shell/metric-strip";
import { DealCardBody, DraggableDealCard } from "./deal-card";

function StageColumn({
  stage,
  deals,
  boardTotal,
  contactById,
  userById,
  tagById,
  onOpenDeal,
}: {
  stage: PipelineStage;
  deals: Deal[];
  /** Total em aberto do funil, para a coluna mostrar seu peso relativo. */
  boardTotal: number;
  contactById: Map<string, Contact>;
  userById: Map<string, User>;
  tagById: Map<string, Tag>;
  onOpenDeal: (dealId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((sum, deal) => sum + deal.amountCents, 0);
  const weighted = deals.reduce(
    (sum, deal) => sum + (deal.amountCents * deal.probability) / 100,
    0,
  );
  const share = boardTotal > 0 ? (total / boardTotal) * 100 : 0;

  const tone = stage.kind === "ganha" ? "success" : stage.kind === "perdida" ? "danger" : "accent";

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="bg-surface rounded-t-lg px-3 pb-2.5 pt-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-xs font-semibold uppercase tracking-wide">{stage.name}</h3>
          <Badge variant="neutral">{deals.length}</Badge>
        </div>
        <p className="text-primary mt-0.5 text-sm font-semibold tabular-nums">
          {formatCurrencyCents(total)}
        </p>
        {stage.kind === "aberta" ? (
          <p className="text-muted-foreground text-[11px] tabular-nums">
            ponderado {formatCurrencyCents(weighted)} · {stage.probability}%
          </p>
        ) : null}

        {/* Peso da etapa no funil. A barra responde "onde está o dinheiro"
            antes de qualquer número ser lido. */}
        <ProgressBar
          value={share}
          tone={tone}
          className="mt-2"
          label={`${stage.name}: ${formatPercent(share)} do valor em aberto`}
        />
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "bg-surface-sunken min-h-32 flex-1 space-y-2 rounded-b-lg p-2 transition-colors",
          isOver && "bg-accent-soft ring-accent ring-1 ring-inset",
        )}
      >
        {deals.length === 0 ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-[11px]">
            {isOver ? "Solte aqui para mover" : "Nenhum negócio nesta etapa"}
          </p>
        ) : (
          deals.map((deal) => (
            <DraggableDealCard
              key={deal.id}
              deal={deal}
              contact={contactById.get(deal.contactId)}
              owner={userById.get(deal.ownerId)}
              stage={stage}
              tagById={tagById}
              onOpen={onOpenDeal}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function PipelineBoard({
  pipelines,
  dealsByPipeline,
  contacts,
  companies,
  users,
  tags,
}: {
  pipelines: Pipeline[];
  dealsByPipeline: Record<string, Deal[]>;
  contacts: Contact[];
  companies: Company[];
  users: User[];
  tags: Tag[];
}) {
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<
    Record<string, { stageId: string; stageEnteredAt: string }>
  >({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [openDealId, setOpenDealId] = useState<string | null>(null);
  /** "5 parados" só serve se for possível ver quais são os cinco. */
  const [onlyStalled, setOnlyStalled] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const contactById = useMemo(() => new Map(contacts.map((item) => [item.id, item])), [contacts]);
  const companyById = useMemo(() => new Map(companies.map((item) => [item.id, item])), [companies]);
  const userById = useMemo(() => new Map(users.map((item) => [item.id, item])), [users]);
  const tagById = useMemo(() => new Map(tags.map((item) => [item.id, item])), [tags]);

  const pipeline = pipelines.find((item) => item.id === pipelineId) ?? pipelines[0];
  const stageById = useMemo(
    () => new Map((pipeline?.stages ?? []).map((stage) => [stage.id, stage])),
    [pipeline],
  );

  const deals = useMemo(() => {
    const base = pipeline ? (dealsByPipeline[pipeline.id] ?? []) : [];
    return base.map((deal) => {
      const override = overrides[deal.id];
      if (!override) return deal;
      const stage = stageById.get(override.stageId);
      return {
        ...deal,
        stageId: override.stageId,
        stageEnteredAt: override.stageEnteredAt,
        probability: stage?.probability ?? deal.probability,
      };
    });
  }, [pipeline, dealsByPipeline, overrides, stageById]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return deals.filter((deal) => {
      if (ownerIds.length > 0 && !ownerIds.includes(deal.ownerId)) return false;
      if (term) {
        const contact = contactById.get(deal.contactId);
        const haystack = [deal.title, deal.product, contact?.fullName ?? ""]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [deals, ownerIds, search, contactById]);

  /**
   * O recorte "só parados" muda o que aparece no quadro, mas não os indicadores.
   * Se mudasse os dois, o próprio número que motivou o clique sumiria da faixa.
   */
  const visible = useMemo(() => {
    if (!onlyStalled) return filtered;
    return filtered.filter((deal) => {
      const stage = stageById.get(deal.stageId);
      return stage?.kind === "aberta" && daysSince(deal.stageEnteredAt) > stage.stalledAfterDays;
    });
  }, [filtered, onlyStalled, stageById]);

  const dealsByStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const stage of pipeline?.stages ?? []) map.set(stage.id, []);
    for (const deal of visible) {
      const list = map.get(deal.stageId);
      if (list) list.push(deal);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.amountCents - a.amountCents);
    }
    return map;
  }, [visible, pipeline]);

  const metrics = useMemo(() => {
    const open = filtered.filter((deal) => stageById.get(deal.stageId)?.kind === "aberta");
    const won = filtered.filter((deal) => stageById.get(deal.stageId)?.kind === "ganha");
    const lost = filtered.filter((deal) => stageById.get(deal.stageId)?.kind === "perdida");

    const openTotal = open.reduce((sum, deal) => sum + deal.amountCents, 0);
    const weighted = open.reduce(
      (sum, deal) => sum + (deal.amountCents * deal.probability) / 100,
      0,
    );
    const wonTotal = won.reduce((sum, deal) => sum + deal.amountCents, 0);
    const conversion =
      won.length + lost.length > 0 ? (won.length / (won.length + lost.length)) * 100 : 0;
    const stalled = open.filter((deal) => {
      const stage = stageById.get(deal.stageId);
      return stage ? daysSince(deal.stageEnteredAt) > stage.stalledAfterDays : false;
    });

    return { open, won, lost, openTotal, weighted, wonTotal, conversion, stalled };
  }, [filtered, stageById]);

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const dealId = String(event.active.id);
    const targetStageId = event.over ? String(event.over.id) : null;
    if (!targetStageId) return;

    const deal = deals.find((item) => item.id === dealId);
    const stage = stageById.get(targetStageId);
    if (!deal || !stage || deal.stageId === targetStageId) return;

    setOverrides((current) => ({
      ...current,
      [dealId]: { stageId: targetStageId, stageEnteredAt: offsetIso({}) },
    }));

    toast.success(`Movido para "${stage.name}"`, {
      description:
        stage.kind === "perdida"
          ? "Motivo de perda é obrigatório nesta etapa — abra o negócio para registrar."
          : `Probabilidade ajustada para ${stage.probability}%. Evento deal.stage_changed emitido.`,
    });
  }

  const draggingDeal = draggingId ? deals.find((deal) => deal.id === draggingId) : undefined;
  const openDeal = openDealId ? deals.find((deal) => deal.id === openDealId) : undefined;
  const openDealStage = openDeal ? stageById.get(openDeal.stageId) : undefined;
  const openDealContact = openDeal ? contactById.get(openDeal.contactId) : undefined;

  if (!pipeline) {
    return (
      <EmptyState
        icon={<Briefcase />}
        title="Nenhum funil configurado"
        description="Crie um funil para acompanhar oportunidades por etapa, valor e previsão."
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Filtros */}
      <div className="bg-surface shadow-inset-hairline flex shrink-0 flex-wrap items-center gap-2 px-4 py-2.5">
        <Select value={pipelineId} onValueChange={setPipelineId}>
          <SelectTrigger className="w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
          placeholder="Buscar negócio, produto ou contato"
          className="w-72"
          aria-label="Buscar negócios"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Users />
              Responsável
              {ownerIds.length > 0 ? <Badge variant="primary">{ownerIds.length}</Badge> : null}
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Filtrar por responsável</DropdownMenuLabel>
            {users.map((user) => (
              <DropdownMenuItem
                key={user.id}
                onSelect={(event) => {
                  event.preventDefault();
                  setOwnerIds((current) =>
                    current.includes(user.id)
                      ? current.filter((id) => id !== user.id)
                      : [...current, user.id],
                  );
                }}
              >
                <Checkbox checked={ownerIds.includes(user.id)} tabIndex={-1} />
                <Avatar initials={user.initials} hue={user.accentHue} size="xs" />
                {user.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" className="ml-auto">
          <Plus />
          Novo negócio
        </Button>
      </div>

      {/* Indicadores.
          Faixa de uma linha, não cartões: o quadro precisa de altura para os
          cartões de negócio, e cinco cartões de indicador comiam a primeira
          dobra inteira. */}
      <MetricStrip
        className="shadow-inset-hairline border-b-0"
        trailing={
          metrics.stalled.length > 0 ? (
            <button
              type="button"
              onClick={() => setOnlyStalled((value) => !value)}
              aria-pressed={onlyStalled}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                onlyStalled
                  ? "bg-warning text-warning-foreground"
                  : "bg-warning-soft text-warning hover:brightness-95",
              )}
            >
              <AlertTriangle className="size-3" aria-hidden />
              {metrics.stalled.length} parados
              {onlyStalled ? " · mostrando só estes" : ""}
            </button>
          ) : null
        }
      >
        <Metric label="em aberto" value={formatCurrencyCents(metrics.openTotal)} />
        <Metric
          label="ponderado"
          value={formatCurrencyCents(metrics.weighted)}
          hint="pela probabilidade da etapa"
        />
        <Metric label="ganho" value={formatCurrencyCents(metrics.wonTotal)} tone="success" />
        <Metric
          label="conversão"
          value={`${metrics.conversion.toFixed(0)}%`}
          tone={metrics.conversion >= 50 ? "success" : "warning"}
          hint={`${metrics.won.length} ganhos / ${metrics.lost.length} perdidos`}
        />
      </MetricStrip>

      {/* Quadro */}
      {/* O `id` fixo não é enfeite: sem ele o dnd-kit numera o `aria-describedby`
          a partir de um contador global, que começa em zero no servidor e
          continua de onde parou no cliente — e a hidratação acusa divergência. */}
      <DndContext
        id="pipeline-board"
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full gap-3 p-4">
            {pipeline.stages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={dealsByStage.get(stage.id) ?? []}
                boardTotal={metrics.openTotal}
                contactById={contactById}
                userById={userById}
                tagById={tagById}
                onOpenDeal={setOpenDealId}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {draggingDeal ? (
            <div className="w-72 rotate-2">
              <DealCardBody
                deal={draggingDeal}
                contact={contactById.get(draggingDeal.contactId)}
                owner={userById.get(draggingDeal.ownerId)}
                stage={stageById.get(draggingDeal.stageId)}
                tagById={tagById}
                dragging
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="bg-surface text-muted-foreground shadow-inset-hairline shrink-0 px-4 py-2 text-[11px]">
        Arraste um cartão entre etapas ou dê duplo clique para abrir o negócio. Cada movimentação
        gera o evento <code className="font-mono">deal.stage_changed</code> com autor, etapa
        anterior e horário.
      </div>

      {/* Detalhe do negócio */}
      <Dialog open={Boolean(openDeal)} onOpenChange={(open) => !open && setOpenDealId(null)}>
        <DialogContent className="w-[min(92vw,34rem)]">
          {openDeal ? (
            <>
              <DialogHeader>
                <DialogTitle>{openDeal.title}</DialogTitle>
                <DialogDescription>
                  {openDeal.product} · {openDealContact?.fullName ?? "sem contato"}
                </DialogDescription>
              </DialogHeader>

              <div className="overflow-y-auto p-5">
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="text-primary text-2xl font-semibold tabular-nums">
                    {formatCurrencyCents(openDeal.amountCents, true)}
                  </span>
                  <Badge variant={openDealStage?.kind === "ganha" ? "success" : "info"}>
                    {openDealStage?.name}
                  </Badge>
                </div>

                <div className="mb-4">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-muted-foreground text-xs">Probabilidade</span>
                    <span className="text-xs font-semibold tabular-nums">
                      {openDeal.probability}%
                    </span>
                  </div>
                  <ProgressBar value={openDeal.probability} tone="accent" label="Probabilidade" />
                </div>

                <dl>
                  <KeyValue label="Contato" value={openDealContact?.fullName ?? "—"} />
                  <KeyValue
                    label="Empresa"
                    value={
                      openDeal.companyId ? (companyById.get(openDeal.companyId)?.name ?? "—") : "—"
                    }
                  />
                  <KeyValue
                    label="Responsável"
                    value={userById.get(openDeal.ownerId)?.name ?? "—"}
                  />
                  <KeyValue
                    label="Previsão de fechamento"
                    value={formatDate(openDeal.expectedCloseDate)}
                  />
                  <KeyValue
                    label="Nesta etapa há"
                    value={`${daysSince(openDeal.stageEnteredAt)} dias`}
                  />
                  <KeyValue
                    label="Valor ponderado"
                    value={formatCurrencyCents((openDeal.amountCents * openDeal.probability) / 100)}
                  />
                  {openDeal.lostReason ? (
                    <KeyValue label="Motivo da perda" value={openDeal.lostReason} />
                  ) : null}
                </dl>

                {openDeal.tagIds.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {openDeal.tagIds.map((tagId) => {
                      const tag = tagById.get(tagId);
                      return tag ? <TagChip key={tag.id} name={tag.name} hue={tag.hue} /> : null;
                    })}
                  </div>
                ) : null}

                <div className="mt-5">
                  <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold uppercase tracking-wide">
                    Mover para
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {pipeline.stages
                      .filter((stage) => stage.id !== openDeal.stageId)
                      .map((stage) => (
                        <Button
                          key={stage.id}
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            setOverrides((current) => ({
                              ...current,
                              [openDeal.id]: {
                                stageId: stage.id,
                                stageEnteredAt: offsetIso({}),
                              },
                            }));
                            toast.success(`Movido para "${stage.name}"`);
                            setOpenDealId(null);
                          }}
                        >
                          {stage.name}
                        </Button>
                      ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <span className="text-muted-foreground mr-auto text-[11px]">
                  {formatNumber(openDeal.probability)}% · {openDealStage?.name}
                </span>
                <Button variant="outline" size="sm" onClick={() => setOpenDealId(null)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
