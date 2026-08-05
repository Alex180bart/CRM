"use client";

import type { ChannelKind, ConversationState, Queue } from "@crm/core";
import { CONVERSATION_STATE_LABEL, OPEN_CONVERSATION_STATES } from "@crm/core";
import { Button, Separator, cn } from "@crm/ui";
import { AlarmClock, Inbox, UserCheck, UserX } from "lucide-react";

import { ChannelIcon, channelStyle } from "@/lib/channel";

export type QuickFilter = "todas" | "minhas" | "nao_atribuidas" | "sla_risco";

const QUICK_FILTERS: Array<{ id: QuickFilter; label: string; icon: typeof Inbox }> = [
  { id: "todas", label: "Todas", icon: Inbox },
  { id: "minhas", label: "Minhas", icon: UserCheck },
  { id: "nao_atribuidas", label: "Não atribuídas", icon: UserX },
  { id: "sla_risco", label: "SLA em risco", icon: AlarmClock },
];

const ALL_STATES: ConversationState[] = [...OPEN_CONVERSATION_STATES, "resolvida", "encerrada"];

const CHANNELS: ChannelKind[] = ["whatsapp", "email", "instagram", "webchat"];

export function InboxFilters({
  queues,
  quickFilter,
  onQuickFilterChange,
  selectedQueueIds,
  onToggleQueue,
  selectedStates,
  onToggleState,
  selectedChannels,
  onToggleChannel,
  counts,
  onReset,
  hasActiveFilters,
}: {
  queues: Queue[];
  quickFilter: QuickFilter;
  onQuickFilterChange: (filter: QuickFilter) => void;
  selectedQueueIds: string[];
  onToggleQueue: (queueId: string) => void;
  selectedStates: ConversationState[];
  onToggleState: (state: ConversationState) => void;
  selectedChannels: ChannelKind[];
  onToggleChannel: (channel: ChannelKind) => void;
  counts: {
    quick: Record<QuickFilter, number>;
    queue: Record<string, number>;
    state: Record<string, number>;
    channel: Record<string, number>;
  };
  onReset: () => void;
  hasActiveFilters: boolean;
}) {
  return (
    // Abaixo de 1280 px a coluna de filtros sai de cena: o espaço vai para a
    // conversa, que é onde o atendente passa o dia.
    <div className="border-border bg-surface hidden w-52 shrink-0 flex-col overflow-y-auto border-r xl:flex">
      <div className="p-2">
        <p className="text-muted-foreground px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider">
          Visões
        </p>
        <ul className="space-y-0.5">
          {QUICK_FILTERS.map((filter) => {
            const Icon = filter.icon;
            const active = quickFilter === filter.id;
            return (
              <li key={filter.id}>
                <button
                  type="button"
                  onClick={() => onQuickFilterChange(filter.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs transition-colors",
                    active
                      ? "bg-primary-soft text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  <span className="flex-1 truncate text-left">{filter.label}</span>
                  <span className="text-muted-foreground text-[11px] tabular-nums">
                    {counts.quick[filter.id]}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Separator />

      <div className="p-2">
        <p className="text-muted-foreground px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider">
          Filas
        </p>
        <ul className="space-y-0.5">
          {queues.map((queue) => {
            const active = selectedQueueIds.includes(queue.id);
            return (
              <li key={queue.id}>
                <button
                  type="button"
                  onClick={() => onToggleQueue(queue.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    active
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  <span
                    className="mt-1 size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: `hsl(${queue.color} 65% 50%)` }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{queue.name}</span>
                    <span className="text-muted-foreground block text-[10px]">
                      SLA {queue.firstResponseSlaMinutes} min
                    </span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                    {counts.queue[queue.id] ?? 0}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Separator />

      <div className="p-2">
        <p className="text-muted-foreground px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider">
          Estado
        </p>
        <ul className="space-y-0.5">
          {ALL_STATES.map((state) => {
            const active = selectedStates.includes(state);
            return (
              <li key={state}>
                <button
                  type="button"
                  onClick={() => onToggleState(state)}
                  aria-pressed={active}
                  className={cn(
                    "flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs transition-colors",
                    active
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/60",
                  )}
                >
                  <span
                    className={cn(
                      "size-3 shrink-0 rounded-[4px] border",
                      active ? "border-accent bg-accent" : "border-input",
                    )}
                    aria-hidden
                  />
                  <span className="flex-1 truncate text-left">
                    {CONVERSATION_STATE_LABEL[state]}
                  </span>
                  <span className="text-muted-foreground text-[11px] tabular-nums">
                    {counts.state[state] ?? 0}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Separator />

      <div className="p-2">
        <p className="text-muted-foreground px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider">
          Canal
        </p>
        <div className="flex flex-wrap gap-1 px-1">
          {CHANNELS.map((channel) => {
            const active = selectedChannels.includes(channel);
            return (
              <button
                key={channel}
                type="button"
                onClick={() => onToggleChannel(channel)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <ChannelIcon kind={channel} className="size-3" />
                {channelStyle(channel).label}
                <span className="tabular-nums opacity-70">{counts.channel[channel] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {hasActiveFilters ? (
        <div className="border-border mt-auto border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" onClick={onReset}>
            Limpar filtros
          </Button>
        </div>
      ) : null}
    </div>
  );
}
