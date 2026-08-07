/**
 * Escalas de demonstração.
 *
 * Três escalas porque três são o mínimo que exercita o que o tipo permite: uma
 * comercial com intervalo de almoço (duas faixas no mesmo dia), uma estendida
 * que inclui sábado, e uma de plantão que abre em janela curta. As exceções são
 * feriados nacionais reais de 2026 e uma véspera com expediente reduzido — é o
 * caso que só a `ScheduleException` com faixas resolve.
 */

import type { BusinessSchedule } from "../types/scheduling";
import { offsetIso } from "../utils/datetime";
import { ORG_ID } from "./organization";

const COMMERCIAL = [
  { from: "09:00", to: "12:00" },
  { from: "13:30", to: "18:00" },
];

/** Feriados de 2026 que caem depois do instante de referência do protótipo. */
const HOLIDAYS_2026 = [
  { date: "2026-09-07", label: "Independência" },
  { date: "2026-10-12", label: "Nossa Senhora Aparecida" },
  { date: "2026-11-02", label: "Finados" },
  { date: "2026-11-15", label: "Proclamação da República" },
  { date: "2026-12-25", label: "Natal" },
].map((holiday) => ({ ...holiday, ranges: [] }));

export const businessSchedules: BusinessSchedule[] = [
  {
    id: "sched_comercial",
    organizationId: ORG_ID,
    name: "Comercial",
    description: "Expediente padrão do escritório, com intervalo de almoço.",
    timezone: "America/Sao_Paulo",
    days: [
      { weekday: 0, ranges: [] },
      { weekday: 1, ranges: COMMERCIAL },
      { weekday: 2, ranges: COMMERCIAL },
      { weekday: 3, ranges: COMMERCIAL },
      { weekday: 4, ranges: COMMERCIAL },
      { weekday: 5, ranges: COMMERCIAL },
      { weekday: 6, ranges: [] },
    ],
    exceptions: [
      ...HOLIDAYS_2026,
      {
        date: "2026-12-24",
        label: "Véspera de Natal",
        ranges: [{ from: "09:00", to: "12:00" }],
      },
    ],
    outsideMessage:
      "Nosso atendimento é de segunda a sexta, das 9h às 12h e das 13h30 às 18h. Deixe sua mensagem que respondemos na próxima abertura.",
    createdAt: offsetIso({ days: -300 }),
    updatedAt: offsetIso({ days: -18 }),
  },
  {
    id: "sched_estendido",
    organizationId: ORG_ID,
    name: "Estendido com sábado",
    description: "Atendimento comercial ampliado — usado nas filas de lead novo.",
    timezone: "America/Sao_Paulo",
    days: [
      { weekday: 0, ranges: [] },
      { weekday: 1, ranges: [{ from: "08:00", to: "20:00" }] },
      { weekday: 2, ranges: [{ from: "08:00", to: "20:00" }] },
      { weekday: 3, ranges: [{ from: "08:00", to: "20:00" }] },
      { weekday: 4, ranges: [{ from: "08:00", to: "20:00" }] },
      { weekday: 5, ranges: [{ from: "08:00", to: "20:00" }] },
      { weekday: 6, ranges: [{ from: "09:00", to: "13:00" }] },
    ],
    exceptions: HOLIDAYS_2026,
    outsideMessage:
      "Atendemos de segunda a sexta das 8h às 20h e aos sábados das 9h às 13h. Responderemos assim que abrirmos.",
    createdAt: offsetIso({ days: -180 }),
    updatedAt: offsetIso({ days: -9 }),
  },
  {
    id: "sched_plantao_fiscal",
    organizationId: ORG_ID,
    name: "Plantão fiscal",
    description: "Janela curta de plantão nos dias de vencimento de guias.",
    timezone: "America/Sao_Paulo",
    days: [
      { weekday: 0, ranges: [] },
      { weekday: 1, ranges: [{ from: "08:00", to: "10:00" }] },
      { weekday: 2, ranges: [] },
      { weekday: 3, ranges: [] },
      { weekday: 4, ranges: [] },
      { weekday: 5, ranges: [{ from: "08:00", to: "10:00" }] },
      { weekday: 6, ranges: [] },
    ],
    exceptions: HOLIDAYS_2026,
    outsideMessage:
      "O plantão fiscal atende às segundas e sextas, das 8h às 10h. Fora disso, use a fila de suporte fiscal.",
    createdAt: offsetIso({ days: -60 }),
    updatedAt: offsetIso({ days: -4 }),
  },
];
