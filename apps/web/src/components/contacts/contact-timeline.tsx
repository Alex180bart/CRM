"use client";

import { useMemo, useState } from "react";
import type { ActivityKind, ChannelKind, TimelineEntry } from "@crm/core";
import {
  ACTIVITY_LABEL,
  daysSince,
  differenceInCalendarDays,
  formatDateTime,
  formatDayHeading,
  formatRelative,
} from "@crm/core";
import { Badge, Button, EmptyState, Tooltip, cn } from "@crm/ui";
import {
  Activity,
  Bot,
  CalendarClock,
  CheckSquare,
  History,
  Mail,
  Megaphone,
  MessageSquare,
  MoveRight,
  Phone,
  ShieldCheck,
  StickyNote,
  Users,
  type LucideIcon,
} from "lucide-react";

import { ChannelIcon } from "@/lib/channel";

const KIND_STYLE: Record<ActivityKind, { icon: LucideIcon; hue: number }> = {
  nota: { icon: StickyNote, hue: 38 },
  tarefa: { icon: CheckSquare, hue: 208 },
  ligacao: { icon: Phone, hue: 190 },
  reuniao: { icon: Users, hue: 250 },
  mensagem: { icon: MessageSquare, hue: 145 },
  email: { icon: Mail, hue: 208 },
  mudanca_etapa: { icon: MoveRight, hue: 30 },
  campanha: { icon: Megaphone, hue: 330 },
  consentimento: { icon: ShieldCheck, hue: 160 },
  automacao: { icon: Bot, hue: 280 },
  sistema: { icon: Activity, hue: 218 },
};

const PERIODS = [
  { id: "7", label: "7 dias" },
  { id: "30", label: "30 dias" },
  { id: "90", label: "90 dias" },
  { id: "todos", label: "Tudo" },
] as const;

type Period = (typeof PERIODS)[number]["id"];

/**
 * Linha do tempo do contato com filtro por tipo de evento, canal e período —
 * exatamente o que a seção 9.2 do plano exige da visão única.
 */
export function ContactTimeline({ entries }: { entries: TimelineEntry[] }) {
  const [kinds, setKinds] = useState<ActivityKind[]>([]);
  const [channels, setChannels] = useState<ChannelKind[]>([]);
  const [period, setPeriod] = useState<Period>("30");

  const availableKinds = useMemo(() => {
    const set = new Set(entries.map((entry) => entry.kind));
    return Array.from(set);
  }, [entries]);

  const availableChannels = useMemo(() => {
    const set = new Set(entries.map((entry) => entry.channel).filter(Boolean) as ChannelKind[]);
    return Array.from(set);
  }, [entries]);

  const filtered = useMemo(() => {
    const limitDays = period === "todos" ? null : Number(period);

    return entries.filter((entry) => {
      if (kinds.length > 0 && !kinds.includes(entry.kind)) return false;
      if (channels.length > 0 && (!entry.channel || !channels.includes(entry.channel)))
        return false;
      // `daysSince` usa o instante de referência do pacote core, e não o relógio
      // do navegador — servidor e cliente filtram exatamente o mesmo conjunto.
      if (limitDays !== null && daysSince(entry.occurredAt) > limitDays) return false;
      return true;
    });
  }, [entries, kinds, channels, period]);

  function toggle<T>(list: T[], value: T, setter: (next: T[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  return (
    <div className="flex flex-col">
      {/* Filtros */}
      <div className="border-border bg-surface sticky top-0 z-10 space-y-2 border-b px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground mr-1 text-[11px] font-semibold uppercase tracking-wide">
            Tipo
          </span>
          {availableKinds.map((kind) => {
            const active = kinds.includes(kind);
            const Icon = KIND_STYLE[kind].icon;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => toggle(kinds, kind, setKinds)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="size-3" aria-hidden />
                {ACTIVITY_LABEL[kind]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground mr-1 text-[11px] font-semibold uppercase tracking-wide">
            Canal
          </span>
          {availableChannels.map((channel) => {
            const active = channels.includes(channel);
            return (
              <button
                key={channel}
                type="button"
                onClick={() => toggle(channels, channel, setChannels)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] transition-colors",
                  active
                    ? "border-accent bg-accent-soft text-accent-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <ChannelIcon kind={channel} className="size-3" />
              </button>
            );
          })}

          <span className="ml-auto flex items-center gap-1">
            <CalendarClock className="text-muted-foreground size-3.5" aria-hidden />
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                aria-pressed={period === item.id}
                className={cn(
                  "h-6 rounded-md px-2 text-[11px] transition-colors",
                  period === item.id
                    ? "bg-primary-soft text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </span>

          {kinds.length > 0 || channels.length > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setKinds([]);
                setChannels([]);
              }}
            >
              Limpar
            </Button>
          ) : null}
        </div>
      </div>

      {/* Eventos */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<History />}
          title="Nenhum evento neste recorte"
          description="Amplie o período ou remova os filtros de tipo e canal para ver o histórico completo."
        />
      ) : (
        <ol className="relative px-4 py-4">
          <span className="bg-border absolute bottom-4 left-[2.05rem] top-4 w-px" aria-hidden />

          {filtered.map((entry, index) => {
            const previous = filtered[index - 1];
            const newDay =
              !previous || differenceInCalendarDays(entry.occurredAt, previous.occurredAt) !== 0;
            const style = KIND_STYLE[entry.kind];
            const Icon = style.icon;

            return (
              <li key={entry.id}>
                {newDay ? (
                  <div className="relative z-10 mb-2 mt-4 first:mt-0">
                    <span className="bg-muted text-muted-foreground inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                      {formatDayHeading(entry.occurredAt)}
                    </span>
                  </div>
                ) : null}

                <div className="relative flex gap-3 py-1.5">
                  <span
                    className="ring-surface relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ring-4"
                    style={{
                      backgroundColor: `hsl(${style.hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
                      color: `hsl(${style.hue} 55% var(--hue-fg-l))`,
                    }}
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </span>

                  <div className="bg-card shadow-card min-w-0 flex-1 rounded-lg p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-foreground min-w-0 flex-1 text-xs font-medium">
                        {entry.title}
                      </p>
                      <Tooltip content={formatDateTime(entry.occurredAt)}>
                        <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                          {formatRelative(entry.occurredAt)}
                        </span>
                      </Tooltip>
                    </div>

                    {entry.description ? (
                      <p className="text-muted-foreground mt-1 line-clamp-3 text-[11px] leading-relaxed">
                        {entry.description}
                      </p>
                    ) : null}

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">{ACTIVITY_LABEL[entry.kind]}</Badge>
                      {entry.channel ? <ChannelIcon kind={entry.channel} withBackground /> : null}
                      {entry.actorLabel ? (
                        <span className="text-muted-foreground text-[11px]">
                          {entry.actorLabel}
                        </span>
                      ) : null}
                      {entry.domainEvent ? (
                        <Tooltip content="Evento de domínio que originou este registro. É a chave para rastrear até a origem.">
                          <code className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 font-mono text-[10px]">
                            {entry.domainEvent}
                          </code>
                        </Tooltip>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
