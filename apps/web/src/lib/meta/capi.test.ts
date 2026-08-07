/**
 * Testes da montagem de evento para a Conversions API.
 *
 * O que está coberto aqui é o mesmo tipo de defeito do hashing: nada disso
 * levanta exceção. Um `event_time` em milissegundos é aceito e descartado; um
 * evento sem identificador é aceito e nunca atribuído; um envio sem
 * consentimento é aceito e vira problema de conformidade. Tudo falha em
 * silêncio, do outro lado, semanas depois.
 */

import { describe, expect, it } from "vitest";

import { buildEvent, buildEventsPayload, canSend, isWithinBackdateWindow } from "./capi";

const AGORA = Date.parse("2026-08-03T12:00:00Z");

describe("montagem do evento", () => {
  it("converte o instante para segundos", () => {
    const event = buildEvent({
      eventName: "Purchase",
      match: { email: "cliente@empresa.com" },
      occurredAt: "2026-08-01T10:00:00Z",
    });

    // Milissegundos colocariam o evento no ano 56.000 e ele seria descartado
    // sem nenhum erro aparecer no lote.
    expect(event.event_time).toBe(Math.floor(Date.parse("2026-08-01T10:00:00Z") / 1000));
    expect(String(event.event_time)).toHaveLength(10);
  });

  it("hasheia o que é dado pessoal e preserva o resto", () => {
    const event = buildEvent({
      eventName: "Lead",
      match: { email: "a@b.co", externalId: "ct_9", phone: "11999998888" },
      occurredAt: AGORA / 1000,
    });

    expect(event.user_data.em?.[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(event.user_data.ph?.[0]).toMatch(/^[a-f0-9]{64}$/);
    // `external_id` vai em texto puro por exigência da Meta.
    expect(event.user_data.external_id).toBe("ct_9");
  });

  it("usa o identificador do negócio como chave de deduplicação", () => {
    const event = buildEvent({
      eventName: "Purchase",
      match: { email: "a@b.co" },
      occurredAt: AGORA / 1000,
      eventId: "deal_412",
    });

    // É o que une este envio ao disparo do Pixel no navegador. Sem ele, a mesma
    // venda é contada duas vezes.
    expect(event.event_id).toBe("deal_412");
  });

  it("assume origem gerada pelo sistema quando não é dito", () => {
    const event = buildEvent({ eventName: "Lead", match: {}, occurredAt: AGORA / 1000 });

    // O padrão NÃO é `website`: uma venda do CRM que se declara de site
    // atribuiria a anúncio de tráfego o que o comercial fechou no WhatsApp.
    expect(event.action_source).toBe("system_generated");
  });
});

describe("janela retroativa", () => {
  it("aceita dentro de 62 dias", () => {
    const dias = (n: number) => AGORA - n * 24 * 60 * 60 * 1000;

    expect(isWithinBackdateWindow(new Date(dias(1)).toISOString(), AGORA)).toBe(true);
    expect(isWithinBackdateWindow(new Date(dias(61)).toISOString(), AGORA)).toBe(true);
  });

  it("recusa acima de 62 dias e recusa futuro", () => {
    const dias = (n: number) => AGORA - n * 24 * 60 * 60 * 1000;

    expect(isWithinBackdateWindow(new Date(dias(63)).toISOString(), AGORA)).toBe(false);
    // Futuro não é conversão: é relógio errado, e enviar propaga o erro.
    expect(isWithinBackdateWindow(new Date(AGORA + 3_600_000).toISOString(), AGORA)).toBe(false);
  });
});

describe("decisão de envio", () => {
  const permitido = { nowMs: AGORA, hasMarketingConsent: true, suppressed: false };

  it("barra quem não consentiu, antes de qualquer outra checagem", () => {
    const event = buildEvent({
      eventName: "Purchase",
      match: { email: "a@b.co" },
      occurredAt: AGORA / 1000,
    });

    const result = canSend(event, { ...permitido, hasMarketingConsent: false });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("sem_consentimento");
  });

  it("barra quem está na supressão mesmo tendo consentido antes", () => {
    const event = buildEvent({
      eventName: "Purchase",
      match: { email: "a@b.co" },
      occurredAt: AGORA / 1000,
    });

    // Descadastro posterior vence consentimento anterior — é a ordem que a
    // seção 18 exige, e a que evita continuar usando quem pediu para sair.
    const result = canSend(event, { ...permitido, suppressed: true });

    expect(result.ok === false && result.code).toBe("sem_consentimento");
  });

  it("barra evento sem nenhum sinal de correspondência", () => {
    const event = buildEvent({ eventName: "Lead", match: {}, occurredAt: AGORA / 1000 });
    const result = canSend(event, permitido);

    expect(result.ok === false && result.code).toBe("sem_identificador");
  });

  it("barra conversão fora da janela", () => {
    const event = buildEvent({
      eventName: "Purchase",
      match: { email: "a@b.co" },
      occurredAt: (AGORA - 90 * 24 * 60 * 60 * 1000) / 1000,
    });

    expect(canSend(event, permitido).ok === false).toBe(true);
  });

  it("aprova o caso completo", () => {
    const event = buildEvent({
      eventName: "Purchase",
      match: { email: "a@b.co", phone: "11999998888", externalId: "ct_9" },
      occurredAt: AGORA / 1000,
      eventId: "deal_1",
      actionSource: "phone_call",
    });

    expect(canSend(event, permitido).ok).toBe(true);
  });
});

describe("lote", () => {
  it("recusa acima do limite da Meta em vez de mandar e falhar", () => {
    const event = buildEvent({
      eventName: "Lead",
      match: { email: "a@b.co" },
      occurredAt: AGORA / 1000,
    });

    expect(() => buildEventsPayload(Array.from({ length: 1_001 }, () => event))).toThrow(
      /máximo de 1000|no máximo 1000/,
    );
  });

  it("inclui o código de teste só quando existe", () => {
    const event = buildEvent({
      eventName: "Lead",
      match: { email: "a@b.co" },
      occurredAt: AGORA / 1000,
    });

    expect(buildEventsPayload([event]).test_event_code).toBeUndefined();
    expect(buildEventsPayload([event], "TEST123").test_event_code).toBe("TEST123");
  });
});
