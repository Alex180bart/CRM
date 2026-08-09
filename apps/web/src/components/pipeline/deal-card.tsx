"use client";

import { useDraggable } from "@dnd-kit/core";
import type { Contact, Deal, PipelineStage, Tag, User } from "@elora/core";
import { daysSince, formatCountdown, formatCurrencyCents } from "@elora/core";
import { Avatar, Badge, TagChip, Tooltip, cn } from "@elora/ui";
import { AlertTriangle, CalendarDays, GripVertical } from "lucide-react";

export function DealCardBody({
  deal,
  contact,
  owner,
  stage,
  tagById,
  dragging,
}: {
  deal: Deal;
  contact?: Contact;
  owner?: User;
  stage?: PipelineStage;
  tagById: Map<string, Tag>;
  dragging?: boolean;
}) {
  const daysInStage = daysSince(deal.stageEnteredAt);
  const stalled = stage ? daysInStage > stage.stalledAfterDays && stage.kind === "aberta" : false;
  const overdue =
    formatCountdown(deal.expectedCloseDate).startsWith("atrasado") && stage?.kind === "aberta";

  return (
    <div
      className={cn(
        "bg-card shadow-card relative rounded-lg p-2.5 transition-shadow",
        dragging ? "shadow-overlay ring-accent ring-2" : "hover:shadow-raised",
        stalled && !dragging && "ring-warning/40 ring-1",
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical
          className="text-muted-foreground/40 mt-0.5 size-3.5 shrink-0 cursor-grab"
          aria-hidden
        />
        <p className="min-w-0 flex-1 text-xs font-medium leading-snug">{deal.title}</p>
      </div>

      <p className="text-muted-foreground mt-1 pl-5 text-[11px]">{contact?.fullName ?? "—"}</p>

      <div className="mt-2 flex items-center justify-between gap-2 pl-5">
        <span className="text-primary text-sm font-semibold tabular-nums">
          {formatCurrencyCents(deal.amountCents)}
        </span>
        {owner ? (
          <Tooltip content={`Responsável: ${owner.name}`}>
            <span>
              <Avatar initials={owner.initials} hue={owner.accentHue} size="xs" />
            </span>
          </Tooltip>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1 pl-5">
        {deal.tagIds.slice(0, 2).map((tagId) => {
          const tag = tagById.get(tagId);
          return tag ? <TagChip key={tag.id} name={tag.name} hue={tag.hue} /> : null;
        })}

        {stalled ? (
          <Tooltip
            content={`Parado há ${daysInStage} dias. A etapa "${stage?.name}" prevê no máximo ${stage?.stalledAfterDays}.`}
          >
            <Badge variant="warning">
              <AlertTriangle aria-hidden />
              {daysInStage} d
            </Badge>
          </Tooltip>
        ) : null}

        {overdue ? (
          <Tooltip content="Previsão de fechamento vencida.">
            <Badge variant="danger">
              <CalendarDays aria-hidden />
              previsão vencida
            </Badge>
          </Tooltip>
        ) : null}
      </div>
    </div>
  );
}

export function DraggableDealCard({
  deal,
  contact,
  owner,
  stage,
  tagById,
  onOpen,
}: {
  deal: Deal;
  contact?: Contact;
  owner?: User;
  stage?: PipelineStage;
  tagById: Map<string, Tag>;
  onOpen: (dealId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });

  return (
    <div
      ref={setNodeRef}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
      onDoubleClick={() => onOpen(deal.id)}
      {...listeners}
      {...attributes}
      aria-label={`Negócio ${deal.title}. Use as teclas de seta para mover entre etapas.`}
    >
      <DealCardBody deal={deal} contact={contact} owner={owner} stage={stage} tagById={tagById} />
    </div>
  );
}
