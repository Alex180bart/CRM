/**
 * Testes da avaliação de escala.
 *
 * Os casos escolhidos são os que quebram sem gerar erro: o fuso lido do
 * processo em vez do da escala, o feriado ignorado porque cai em dia útil, e o
 * intervalo de almoço que some quando só há uma faixa por dia.
 */

import { describe, expect, it } from "vitest";

import { evaluateSchedule, summarizeBusinessSchedule, weeklyHours } from "./schedule";
import type { BusinessSchedule } from "../types/scheduling";

const COMMERCIAL = [
  { from: "09:00", to: "12:00" },
  { from: "13:30", to: "18:00" },
];

function schedule(patch: Partial<BusinessSchedule> = {}): BusinessSchedule {
  return {
    id: "s",
    organizationId: "org",
    name: "Comercial",
    description: "",
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
    exceptions: [],
    outsideMessage: "",
    createdAt: "",
    updatedAt: "",
    ...patch,
  };
}

/* Quarta-feira, 12 de agosto de 2026. UTC-3 em São Paulo. */
const WED_10H = "2026-08-12T13:00:00.000Z"; // 10:00 local
const WED_12H30 = "2026-08-12T15:30:00.000Z"; // 12:30 local — almoço
const WED_20H = "2026-08-12T23:00:00.000Z"; // 20:00 local
const SUN_10H = "2026-08-16T13:00:00.000Z"; // domingo

describe("horário do dia", () => {
  it("está aberto dentro da faixa da manhã", () => {
    expect(evaluateSchedule(schedule(), WED_10H).open).toBe(true);
  });

  /**
   * O caso que só existe porque `ranges` é plural. Com uma faixa por dia, este
   * teste passaria dizendo "aberto" — e o widget prometeria atendimento na hora
   * em que não há ninguém.
   */
  it("está fechado no intervalo entre as faixas", () => {
    const state = evaluateSchedule(schedule(), WED_12H30);
    expect(state.open).toBe(false);
    expect(state.reason).toContain("09:00–12:00 e 13:30–18:00");
  });

  it("está fechado depois do expediente", () => {
    expect(evaluateSchedule(schedule(), WED_20H).open).toBe(false);
  });

  it("está fechado em dia sem faixa nenhuma", () => {
    const state = evaluateSchedule(schedule(), SUN_10H);
    expect(state.open).toBe(false);
    expect(state.reason).toContain("Domingo");
  });
});

describe("fuso", () => {
  /**
   * 13:00 UTC é 10:00 em São Paulo e 14:00 em Lisboa. A mesma escala nas duas
   * cidades tem de responder coisas diferentes — é isto que a leitura por
   * `Intl` com fuso explícito garante, e que `getHours()` do processo quebraria.
   */
  it("lê a hora no fuso da escala, não no do processo", () => {
    const saoPaulo = evaluateSchedule(schedule(), "2026-08-12T11:30:00.000Z"); // 08:30 local
    const lisboa = evaluateSchedule(
      schedule({ timezone: "Europe/Lisbon" }),
      "2026-08-12T11:30:00.000Z", // 12:30 local — almoço em Lisboa
    );

    expect(saoPaulo.open).toBe(false); // antes de abrir
    expect(lisboa.open).toBe(false); // no intervalo
    expect(evaluateSchedule(schedule({ timezone: "Europe/Lisbon" }), WED_10H).open).toBe(true);
  });
});

describe("exceções", () => {
  it("fecha o dia todo num feriado que cai em dia útil", () => {
    const state = evaluateSchedule(
      schedule({ exceptions: [{ date: "2026-08-12", label: "Feriado local", ranges: [] }] }),
      WED_10H,
    );

    expect(state.open).toBe(false);
    expect(state.exceptionLabel).toBe("Feriado local");
  });

  it("aplica expediente reduzido quando a exceção traz faixas", () => {
    const reduced = schedule({
      exceptions: [
        { date: "2026-08-12", label: "Véspera", ranges: [{ from: "09:00", to: "12:00" }] },
      ],
    });

    expect(evaluateSchedule(reduced, WED_10H).open).toBe(true);
    // 14:00 local seria expediente normal, mas a véspera fecha ao meio-dia.
    expect(evaluateSchedule(reduced, "2026-08-12T17:00:00.000Z").open).toBe(false);
  });
});

describe("próxima abertura", () => {
  it("aponta a abertura do mesmo dia quando ainda vai abrir", () => {
    const state = evaluateSchedule(schedule(), "2026-08-12T11:00:00.000Z"); // 08:00 local
    expect(state.nextOpeningIso).toBe("2026-08-12T12:00:00.000Z"); // 09:00 local
  });

  it("pula o fim de semana", () => {
    const state = evaluateSchedule(schedule(), "2026-08-15T13:00:00.000Z"); // sábado
    expect(state.nextOpeningIso).toBe("2026-08-17T12:00:00.000Z"); // segunda, 09:00 local
  });

  it("não devolve abertura quando a escala nunca abre", () => {
    const closed = schedule({ days: schedule().days.map((day) => ({ ...day, ranges: [] })) });
    expect(evaluateSchedule(closed, WED_10H).nextOpeningIso).toBeUndefined();
  });
});

describe("escala ausente", () => {
  it("responde aberto, para não travar fila que nunca configurou horário", () => {
    expect(evaluateSchedule(undefined, WED_20H).open).toBe(true);
  });
});

describe("resumo", () => {
  it("agrupa dias seguidos com o mesmo expediente", () => {
    expect(summarizeBusinessSchedule(schedule())).toBe(
      "Segunda a Sexta, 09:00–12:00 e 13:30–18:00",
    );
  });

  it("soma as faixas sem contar duas vezes", () => {
    expect(weeklyHours(schedule())).toBe(37.5);
  });
});
