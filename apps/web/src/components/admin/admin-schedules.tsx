"use client";

import { useState } from "react";
import type { BusinessSchedule, ScheduleException, ScheduleDay, TimeRange } from "@elora/core";
import {
  canDeleteSchedule,
  checkRanges,
  describeRanges,
  evaluateSchedule,
  formatDateTime,
  now,
  summarizeBusinessSchedule,
  warnScheduleCoverage,
  weekdayName,
  weeklyHours,
} from "@elora/core";
import type { Queue, User } from "@elora/core";
import {
  Badge,
  Button,
  Callout,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Reveal,
  StatusDot,
  Textarea,
  Tooltip,
  cn,
} from "@elora/ui";
import { CalendarOff, CircleAlert, Clock, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDelete, RowActions } from "./admin-editors";

/**
 * Escalas de atendimento.
 *
 * ## Por que o estado "agora" aparece em cada cartão
 *
 * Uma escala é uma tabela de horários, e tabela de horários é a coisa mais
 * fácil de configurar errado sem perceber: troca-se 18:00 por 08:00 e o
 * expediente inverte sem que nada na tela mude de cor. O selo "aberto agora /
 * fechado agora" é a única verificação barata que pega esse erro no ato — e é
 * calculado pela mesma função que a distribuição e o widget usam, não por uma
 * segunda leitura do mesmo horário.
 */

interface MutationInput {
  entity: string;
  action: "criar" | "editar" | "excluir";
  id?: string;
  data?: Record<string, unknown>;
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function SchedulesTab({
  schedules,
  queues,
  users,
  onSubmit,
}: {
  schedules: BusinessSchedule[];
  queues: Queue[];
  users: User[];
  onSubmit: (input: MutationInput) => Promise<{ ok: boolean; reason?: string }>;
}) {
  const [editing, setEditing] = useState<BusinessSchedule | "novo" | null>(null);
  const [deleting, setDeleting] = useState<BusinessSchedule | null>(null);

  const reference = now().toISOString();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-prose text-xs leading-relaxed">
          A escala decide quando a distribuição roda e o que o widget responde fora do expediente.
          Fila sem escala atende em qualquer horário — é o padrão, e é o que mantém filas antigas
          funcionando.
        </p>
        <Button variant="outline" size="sm" onClick={() => setEditing("novo")}>
          <Plus />
          Nova escala
        </Button>
      </div>

      <ul className="grid gap-3 lg:grid-cols-2">
        {schedules.map((schedule, index) => {
          const state = evaluateSchedule(schedule, reference);
          const coverage = warnScheduleCoverage(schedule);
          const usedBy = queues.filter((queue) => queue.scheduleId === schedule.id);
          const people = users.filter((user) => user.scheduleId === schedule.id).length;

          return (
            <Reveal key={schedule.id} index={Math.min(index, 6)} as="li">
              <div className="bg-card shadow-card h-full space-y-3 rounded-lg p-5">
                <div className="flex items-start gap-2.5">
                  <div className="min-w-0 flex-1">
                    <RowActions
                      editLabel={`Editar ${schedule.name}`}
                      deleteLabel={`Excluir ${schedule.name}`}
                      deleteDisabledReason={canDeleteSchedule(schedule.id, queues, users)}
                      onEdit={() => setEditing(schedule)}
                      onDelete={() => setDeleting(schedule)}
                    />
                    <h3 className="font-display truncate text-sm font-semibold tracking-tight">
                      {schedule.name}
                    </h3>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                      {schedule.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <StatusDot tone={state.open ? "success" : "neutral"} />
                    {state.open ? "Aberto agora" : "Fechado agora"}
                  </span>
                  <Badge variant="neutral">{weeklyHours(schedule)} h/semana</Badge>
                  {schedule.exceptions.length > 0 ? (
                    <Badge variant="neutral">{schedule.exceptions.length} exceções</Badge>
                  ) : null}
                </div>

                <p className="text-muted-foreground text-xs leading-relaxed">{state.reason}</p>

                {!state.open ? (
                  <p className="text-xs">
                    {state.nextOpeningIso ? (
                      <>
                        Reabre em{" "}
                        <span className="font-medium">{formatDateTime(state.nextOpeningIso)}</span>
                      </>
                    ) : (
                      <span className="text-destructive">
                        Não reabre nos próximos 14 dias — confira o expediente.
                      </span>
                    )}
                  </p>
                ) : null}

                <p className="text-muted-foreground text-xs leading-relaxed">
                  {summarizeBusinessSchedule(schedule)}
                </p>

                {coverage ? (
                  <Callout variant="warning" icon={<CircleAlert />}>
                    {coverage}
                  </Callout>
                ) : null}

                <p className="text-muted-foreground text-[11px]">
                  {usedBy.length === 0 && people === 0
                    ? "Nenhuma fila ou pessoa usa esta escala."
                    : [
                        usedBy.length > 0 ? `${usedBy.length} fila(s)` : null,
                        people > 0 ? `${people} pessoa(s)` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
              </div>
            </Reveal>
          );
        })}
      </ul>

      {editing ? (
        <ScheduleDialog
          open
          onOpenChange={(next) => !next && setEditing(null)}
          schedule={editing === "novo" ? undefined : editing}
          onSubmit={onSubmit}
        />
      ) : null}

      {deleting ? (
        <ConfirmDelete
          open
          onOpenChange={(next) => !next && setDeleting(null)}
          title={`Excluir "${deleting.name}"?`}
          description="A escala sai da lista e não pode ser recuperada."
          consequence="Filas sem escala passam a atender em qualquer horário — inclusive de madrugada."
          onConfirm={() => onSubmit({ entity: "escala", action: "excluir", id: deleting.id })}
        />
      ) : null}
    </div>
  );
}

/* Editor --------------------------------------------------------------------- */

const EMPTY_WEEK: ScheduleDay[] = WEEK_ORDER.map((weekday) => ({ weekday, ranges: [] }));

function ScheduleDialog({
  open,
  onOpenChange,
  schedule,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule?: BusinessSchedule;
  onSubmit: (input: MutationInput) => Promise<{ ok: boolean; reason?: string }>;
}) {
  const [name, setName] = useState(schedule?.name ?? "");
  const [description, setDescription] = useState(schedule?.description ?? "");
  const [outsideMessage, setOutsideMessage] = useState(schedule?.outsideMessage ?? "");
  const [days, setDays] = useState<ScheduleDay[]>(
    schedule?.days ?? EMPTY_WEEK.map((day) => ({ ...day, ranges: [] })),
  );
  const [exceptions, setExceptions] = useState<ScheduleException[]>(schedule?.exceptions ?? []);

  const rangesFor = (weekday: number) => days.find((day) => day.weekday === weekday)?.ranges ?? [];

  const setRanges = (weekday: number, next: TimeRange[]) =>
    setDays((current) => {
      const exists = current.some((day) => day.weekday === weekday);
      return exists
        ? current.map((day) => (day.weekday === weekday ? { ...day, ranges: next } : day))
        : [...current, { weekday, ranges: next }];
    });

  /**
   * Copiar de segunda resolve o caso que é 90% do uso.
   *
   * Sem isso, configurar uma semana comum são dez campos digitados iguais — e
   * digitar dez vezes é como se erra um deles sem notar.
   */
  const copyMondayToWeekdays = () => {
    const monday = rangesFor(1);
    setDays((current) =>
      current.map((day) =>
        day.weekday >= 2 && day.weekday <= 5
          ? { ...day, ranges: monday.map((range) => ({ ...range })) }
          : day,
      ),
    );
  };

  return (
    <ScheduleShell
      open={open}
      onOpenChange={onOpenChange}
      title={schedule ? "Editar escala" : "Nova escala"}
      onSave={() =>
        onSubmit({
          entity: "escala",
          action: schedule ? "editar" : "criar",
          id: schedule?.id,
          data: { name, description, days, exceptions, outsideMessage },
        })
      }
    >
      <div className="space-y-1.5">
        <Label>Nome</Label>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>Descrição</Label>
        <Input
          value={description}
          placeholder="Onde esta escala se aplica."
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label>Expediente da semana</Label>
          <Button variant="ghost" size="xs" onClick={copyMondayToWeekdays}>
            Copiar segunda para ter&ccedil;a a sexta
          </Button>
        </div>

        <ul className="space-y-1.5">
          {WEEK_ORDER.map((weekday) => (
            <DayRow
              key={weekday}
              weekday={weekday}
              ranges={rangesFor(weekday)}
              onChange={(next) => setRanges(weekday, next)}
            />
          ))}
        </ul>
      </div>

      <ExceptionEditor value={exceptions} onChange={setExceptions} />

      <div className="space-y-1.5">
        <Label>Mensagem fora do expediente</Label>
        <Textarea
          rows={3}
          value={outsideMessage}
          placeholder="O que o visitante lê quando escreve fora do horário."
          onChange={(event) => setOutsideMessage(event.target.value)}
        />
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Fica na escala, e não na fila, para que mudar o horário e o aviso seja o mesmo gesto.
        </p>
      </div>
    </ScheduleShell>
  );
}

function DayRow({
  weekday,
  ranges,
  onChange,
}: {
  weekday: number;
  ranges: TimeRange[];
  onChange: (next: TimeRange[]) => void;
}) {
  const refusal = checkRanges(ranges);

  return (
    <li className="flex items-start gap-2">
      <span className="text-muted-foreground w-16 shrink-0 pt-1.5 text-xs">
        {weekdayName(weekday)}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        {ranges.length === 0 ? (
          <span className="text-muted-foreground inline-flex h-8 items-center text-xs">
            Fechado
          </span>
        ) : null}

        {ranges.map((range, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Input
              type="time"
              className="h-8 w-28 text-xs"
              value={range.from}
              aria-label={`Início da faixa ${index + 1} de ${weekdayName(weekday)}`}
              onChange={(event) =>
                onChange(
                  ranges.map((item, position) =>
                    position === index ? { ...item, from: event.target.value } : item,
                  ),
                )
              }
            />
            <span className="text-muted-foreground text-xs">até</span>
            <Input
              type="time"
              className="h-8 w-28 text-xs"
              value={range.to}
              aria-label={`Fim da faixa ${index + 1} de ${weekdayName(weekday)}`}
              onChange={(event) =>
                onChange(
                  ranges.map((item, position) =>
                    position === index ? { ...item, to: event.target.value } : item,
                  ),
                )
              }
            />
            <Tooltip content="Remover faixa">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Remover faixa ${index + 1} de ${weekdayName(weekday)}`}
                onClick={() => onChange(ranges.filter((_, position) => position !== index))}
              >
                <Trash2 />
              </Button>
            </Tooltip>
          </div>
        ))}

        {refusal ? <p className="text-destructive text-[11px]">{refusal}</p> : null}
      </div>

      <Button
        variant="ghost"
        size="xs"
        className="shrink-0"
        onClick={() =>
          onChange([
            ...ranges,
            ranges.length === 0 ? { from: "09:00", to: "18:00" } : { from: "13:30", to: "18:00" },
          ])
        }
      >
        <Plus />
        Faixa
      </Button>
    </li>
  );
}

function ExceptionEditor({
  value,
  onChange,
}: {
  value: ScheduleException[];
  onChange: (next: ScheduleException[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>Feriados e datas especiais</Label>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onChange([...value, { date: "", label: "", ranges: [] }])}
        >
          <Plus />
          Data
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Sem exceções, a escala segue só o dia da semana — e o feriado que cai numa quinta fica
          aberto.
        </p>
      ) : null}

      <ul className="space-y-1.5">
        {value.map((exception, index) => (
          <li key={index} className="flex items-start gap-1.5">
            <Input
              type="date"
              className="h-8 w-36 text-xs"
              value={exception.date}
              aria-label="Data da exceção"
              onChange={(event) =>
                onChange(
                  value.map((item, position) =>
                    position === index ? { ...item, date: event.target.value } : item,
                  ),
                )
              }
            />
            <Input
              className="h-8 flex-1 text-xs"
              value={exception.label}
              placeholder="Nome — aparece no aviso de fechado"
              aria-label="Nome da exceção"
              onChange={(event) =>
                onChange(
                  value.map((item, position) =>
                    position === index ? { ...item, label: event.target.value } : item,
                  ),
                )
              }
            />
            <span
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[11px]",
                exception.ranges.length === 0 ? "text-muted-foreground" : "text-accent-ink",
              )}
            >
              {exception.ranges.length === 0 ? (
                <>
                  <CalendarOff className="size-3" aria-hidden /> fechado
                </>
              ) : (
                <>
                  <Clock className="size-3" aria-hidden /> {describeRanges(exception.ranges)}
                </>
              )}
            </span>
            <Tooltip
              content={
                exception.ranges.length === 0
                  ? "Definir expediente reduzido"
                  : "Voltar a fechar o dia todo"
              }
            >
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Alternar expediente da exceção"
                onClick={() =>
                  onChange(
                    value.map((item, position) =>
                      position === index
                        ? {
                            ...item,
                            ranges:
                              item.ranges.length === 0 ? [{ from: "09:00", to: "12:00" }] : [],
                          }
                        : item,
                    ),
                  )
                }
              >
                <Clock />
              </Button>
            </Tooltip>
            <Tooltip content="Remover data">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Remover data"
                onClick={() => onChange(value.filter((_, position) => position !== index))}
              >
                <Trash2 />
              </Button>
            </Tooltip>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Casca do diálogo ----------------------------------------------------------- */

function ScheduleShell({
  open,
  onOpenChange,
  title,
  onSave,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onSave: () => Promise<{ ok: boolean; reason?: string }>;
  children: React.ReactNode;
}) {
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setRefusal(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="w-[min(94vw,44rem)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Faixas múltiplas por dia cobrem o intervalo de almoço. Feriado é data, não dia da
            semana.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[64vh] space-y-4 overflow-y-auto px-5 py-4">
          {children}
          {refusal ? (
            <Callout variant="danger" icon={<CircleAlert />}>
              {refusal}
            </Callout>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setRefusal(null);
              const result = await onSave();
              setBusy(false);

              if (result.ok) {
                toast.success("Salvo", {
                  description: "A alteração ficou registrada na auditoria.",
                });
                onOpenChange(false);
                return;
              }
              setRefusal(result.reason ?? "A alteração foi recusada.");
            }}
          >
            {busy ? <Loader2 className="animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
