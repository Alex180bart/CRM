/**
 * Avaliação de escala de atendimento.
 *
 * ## O fuso é da escala, e a conta é feita no fuso dela
 *
 * "Está aberto?" é uma pergunta sobre o **relógio de parede** de quem atende, e
 * o servidor não roda nesse relógio. Comparar `getHours()` do processo com
 * "09:00" funciona na máquina do desenvolvedor e falha em produção — o sintoma é
 * o widget abrindo três horas cedo, e nada no código aponta para o horário.
 *
 * Por isso toda leitura de hora aqui passa por `Intl.DateTimeFormat` com
 * `timeZone` explícito. É a mesma disciplina de `datetime.ts`, pelo mesmo
 * motivo: servidor e navegador têm de chegar ao mesmo texto.
 *
 * ## Exceção ganha do dia da semana, sempre
 *
 * Feriado e véspera são exceções à regra semanal, e o código respeita essa
 * ordem: se existe exceção para a data, a semana nem é consultada. A inversão
 * produziria o erro que ninguém revisa — o 25 de dezembro que caiu numa
 * quinta-feira e ficou aberto porque quinta é dia útil.
 */

import type { BusinessSchedule, ScheduleState, TimeRange } from "../types/scheduling";
import { APP_TIME_ZONE } from "./datetime";

const WEEKDAY_LABEL = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

export function weekdayName(weekday: number): string {
  return WEEKDAY_LABEL[weekday] ?? "";
}

/* Leitura do instante no fuso da escala -------------------------------------- */

interface LocalMoment {
  /** AAAA-MM-DD no fuso da escala. */
  date: string;
  weekday: number;
  minutes: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    });
    formatterCache.set(timezone, formatter);
  }
  return formatter;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function localMoment(iso: string, timezone: string): LocalMoment {
  const parts = formatterFor(timezone).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function within(ranges: TimeRange[], minutes: number): boolean {
  return ranges.some((range) => minutes >= toMinutes(range.from) && minutes < toMinutes(range.to));
}

/* Consulta ------------------------------------------------------------------- */

/**
 * A escala está aberta neste instante?
 *
 * `schedule` ausente responde **aberto**, e a escolha é deliberada: fila sem
 * escala é fila sem restrição de horário. O contrário — assumir fechado quando
 * ninguém configurou — faria toda fila existente parar de distribuir no dia em
 * que este código entrasse.
 */
export function evaluateSchedule(
  schedule: BusinessSchedule | undefined,
  iso: string,
): ScheduleState {
  if (!schedule) {
    return { open: true, reason: "Fila sem escala: atende em qualquer horário." };
  }

  const timezone = schedule.timezone || APP_TIME_ZONE;
  const moment = localMoment(iso, timezone);

  const exception = schedule.exceptions.find((item) => item.date === moment.date);

  if (exception) {
    if (exception.ranges.length === 0) {
      return {
        open: false,
        reason: `${exception.label}: fechado o dia todo.`,
        exceptionLabel: exception.label,
        nextOpeningIso: findNextOpening(schedule, iso, timezone),
      };
    }

    const open = within(exception.ranges, moment.minutes);
    return {
      open,
      reason: open
        ? `${exception.label}: expediente especial, ${describeRanges(exception.ranges)}.`
        : `${exception.label}: hoje o expediente é ${describeRanges(exception.ranges)}.`,
      exceptionLabel: exception.label,
      nextOpeningIso: open ? undefined : findNextOpening(schedule, iso, timezone),
    };
  }

  const day = schedule.days.find((item) => item.weekday === moment.weekday);

  if (!day || day.ranges.length === 0) {
    return {
      open: false,
      reason: `${weekdayName(moment.weekday)} não é dia de atendimento nesta escala.`,
      nextOpeningIso: findNextOpening(schedule, iso, timezone),
    };
  }

  const open = within(day.ranges, moment.minutes);

  return {
    open,
    reason: open
      ? `Dentro do expediente (${describeRanges(day.ranges)}).`
      : `Fora do expediente de hoje (${describeRanges(day.ranges)}).`,
    nextOpeningIso: open ? undefined : findNextOpening(schedule, iso, timezone),
  };
}

/**
 * Próxima abertura, procurando dia a dia por até duas semanas.
 *
 * O teto existe porque escala mal configurada é comum — todos os dias sem faixa,
 * por exemplo — e sem limite a busca não terminaria. Devolver `undefined` faz a
 * tela dizer "esta escala nunca abre", que é exatamente o diagnóstico que a
 * pessoa precisa ler no momento em que salvou a configuração errada.
 */
function findNextOpening(
  schedule: BusinessSchedule,
  iso: string,
  timezone: string,
): string | undefined {
  const startMs = Date.parse(iso);

  for (let step = 0; step <= 14; step += 1) {
    const probeMs = startMs + step * 86_400_000;
    const moment = localMoment(new Date(probeMs).toISOString(), timezone);

    const exception = schedule.exceptions.find((item) => item.date === moment.date);
    const ranges =
      exception?.ranges ??
      schedule.days.find((day) => day.weekday === moment.weekday)?.ranges ??
      [];

    if (exception && exception.ranges.length === 0) continue;

    const next = ranges
      .map((range) => toMinutes(range.from))
      .filter((minutes) => step > 0 || minutes > moment.minutes)
      .sort((a, b) => a - b)[0];

    if (next === undefined) continue;

    // O instante devolvido é reconstruído a partir do minuto local de abertura:
    // somar o delta ao ISO original preserva o fuso sem precisar montar a data.
    return new Date(probeMs + (next - moment.minutes) * 60_000).toISOString();
  }

  return undefined;
}

/* Resumo para a tela --------------------------------------------------------- */

export function describeRanges(ranges: TimeRange[]): string {
  if (ranges.length === 0) return "fechado";
  return ranges.map((range) => `${range.from}–${range.to}`).join(" e ");
}

/**
 * Resume a semana agrupando dias seguidos com o mesmo expediente.
 *
 * "Segunda a sexta, 09:00–12:00 e 13:30–18:00" em vez de cinco linhas iguais.
 * Horário de atendimento é lido por faixa; dia a dia obriga quem lê a fazer o
 * agrupamento de cabeça toda vez.
 */
export function summarizeBusinessSchedule(schedule: BusinessSchedule): string {
  const ordered = [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({
    weekday,
    ranges: schedule.days.find((day) => day.weekday === weekday)?.ranges ?? [],
  }));

  const groups: Array<{ days: number[]; ranges: TimeRange[] }> = [];

  for (const day of ordered) {
    if (day.ranges.length === 0) continue;
    const last = groups[groups.length - 1];
    const sameAsLast =
      last &&
      last.days[last.days.length - 1] === day.weekday - 1 &&
      describeRanges(last.ranges) === describeRanges(day.ranges);

    if (sameAsLast) last.days.push(day.weekday);
    else groups.push({ days: [day.weekday], ranges: day.ranges });
  }

  if (groups.length === 0) return "Nenhum dia com atendimento";

  return groups
    .map((group) => {
      const first = weekdayName(group.days[0]!);
      const last = weekdayName(group.days[group.days.length - 1]!);
      const span = group.days.length === 1 ? first : `${first} a ${last}`;
      return `${span}, ${describeRanges(group.ranges)}`;
    })
    .join(" · ");
}

/** Horas de atendimento por semana — o número que revela escala digitada errada. */
export function weeklyHours(schedule: BusinessSchedule): number {
  const minutes = schedule.days.reduce(
    (total, day) =>
      total +
      day.ranges.reduce((sum, range) => sum + (toMinutes(range.to) - toMinutes(range.from)), 0),
    0,
  );
  return Math.round((minutes / 60) * 10) / 10;
}
