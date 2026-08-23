/**
 * Tempo e formatação.
 *
 * O protótipo trabalha com um **instante de referência fixo**. Isso mantém a
 * base de demonstração determinística: servidor e navegador renderizam
 * exatamente o mesmo texto (sem divergência de hidratação) e os contadores de
 * SLA continuam fazendo sentido. Quando a camada real de dados entrar, basta
 * trocar `now()` por `new Date()`.
 */

export const REFERENCE_NOW_ISO = "2026-08-03T17:30:00.000Z";

export const APP_TIME_ZONE = "America/Sao_Paulo";
export const APP_LOCALE = "pt-BR";

export function now(): Date {
  return new Date(REFERENCE_NOW_ISO);
}

export function nowMs(): number {
  return Date.parse(REFERENCE_NOW_ISO);
}

/** Deslocamento a partir do instante de referência, em ISO. */
export function offsetIso(input: {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}): string {
  const ms =
    (input.days ?? 0) * 86_400_000 +
    (input.hours ?? 0) * 3_600_000 +
    (input.minutes ?? 0) * 60_000 +
    (input.seconds ?? 0) * 1_000;
  return new Date(nowMs() + ms).toISOString();
}

const dateTimeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  weekday: "long",
  day: "2-digit",
  month: "long",
});

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/**
 * Data pura (`YYYY-MM-DD`), formatada sem passar por fuso.
 *
 * `formatDate` recebe um instante e o converte para `America/Sao_Paulo` — o que
 * está certo para carimbo de evento e **errado** para data de calendário. Uma
 * string sem hora é interpretada como meia-noite UTC, que em Brasília é o dia
 * anterior às 21 h: `formatDate("2026-10-01")` devolve `30/09/2026`.
 *
 * O erro é discreto e caro. Numa vigência de tabela de preço, ele antecipa a
 * data em um dia — e ninguém confere um dia de diferença numa data plausível.
 * Aqui não há relógio envolvido: a data é reordenada como texto, porque é texto
 * que ela é.
 */
export function formatDateOnly(iso: string): string {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return shortDateFormatter.format(new Date(iso)).replace(".", "");
}

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatDayHeading(iso: string): string {
  const days = differenceInCalendarDays(iso, REFERENCE_NOW_ISO);
  if (days === 0) return "Hoje";
  if (days === -1) return "Ontem";
  return capitalize(weekdayFormatter.format(new Date(iso)));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function startOfDayMs(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return Date.parse(`${parts}T00:00:00.000Z`);
}

export function differenceInCalendarDays(iso: string, referenceIso: string): number {
  return Math.round((startOfDayMs(iso) - startOfDayMs(referenceIso)) / 86_400_000);
}

export function minutesUntil(iso: string): number {
  return Math.round((Date.parse(iso) - nowMs()) / 60_000);
}

export function minutesSince(iso: string): number {
  return Math.round((nowMs() - Date.parse(iso)) / 60_000);
}

export function daysSince(iso: string): number {
  return Math.floor(minutesSince(iso) / (60 * 24));
}

/** "há 12 min", "há 3 h", "há 2 d" — rótulo curto para listas densas. */
export function formatRelative(iso: string): string {
  const minutes = minutesSince(iso);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} d`;
  const months = Math.floor(days / 30);
  return `há ${months} ${months === 1 ? "mês" : "meses"}`;
}

/** "em 8 min", "em 2 h", "atrasado há 15 min" — usado por SLA e tarefas. */
export function formatCountdown(iso: string): string {
  const minutes = minutesUntil(iso);
  if (minutes === 0) return "agora";
  const overdue = minutes < 0;
  const abs = Math.abs(minutes);
  const label =
    abs < 60
      ? `${abs} min`
      : abs < 60 * 24
        ? `${Math.floor(abs / 60)} h ${abs % 60 ? `${abs % 60} min` : ""}`.trim()
        : `${Math.floor(abs / (60 * 24))} d`;
  return overdue ? `atrasado ${label}` : `em ${label}`;
}

/** Duração legível a partir de minutos: 95 → "1 h 35 min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} h ${rest} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}
