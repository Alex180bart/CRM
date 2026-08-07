/**
 * Testes do barramento de eventos.
 *
 * Estes são os primeiros testes do repositório, e não é coincidência que
 * cheguem com o barramento: até aqui, o que existia era front — errado, ele
 * aparece na tela. O barramento é a primeira peça cujo defeito é **invisível**:
 * uma deduplicação quebrada não muda nada na interface e cria dois contatos por
 * mensagem; um recuo mal calculado queima as tentativas em segundos e manda para
 * a fila de erro o que teria funcionado no segundo seguinte.
 *
 * O que está coberto aqui é exatamente isso — a parte que ninguém vê falhar.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { backoffMs, idempotencyKey, isExhausted, MAX_ATTEMPTS } from "../utils/events";
import {
  drainOutbox,
  listEvents,
  listOutbox,
  publishEvent,
  replayEntry,
  resetEventStore,
} from "./events-memory";

beforeEach(() => {
  resetEventStore();
});

describe("idempotência", () => {
  it("publica uma vez e deduplica a reentrega", () => {
    const input = {
      name: "message.received" as const,
      source: "webhook:whatsapp",
      idempotencyKey: idempotencyKey("whatsapp", "wamid.ABC"),
      payload: { text: "oi" },
    };

    const primeira = publishEvent(input);
    const segunda = publishEvent(input);

    expect(primeira.deduplicated).toBe(false);
    expect(segunda.deduplicated).toBe(true);

    // O mesmo evento volta, e não um novo com o mesmo conteúdo: quem chamou
    // precisa poder correlacionar com o que já existia.
    expect(segunda.event.id).toBe(primeira.event.id);
    expect(listEvents()).toHaveLength(1);
  });

  it("não cria outbox na reentrega", () => {
    const input = {
      name: "message.received" as const,
      source: "webhook:whatsapp",
      idempotencyKey: idempotencyKey("whatsapp", "wamid.DEF"),
    };

    publishEvent(input);
    const antes = listOutbox().length;

    publishEvent(input);

    /**
     * É a garantia que importa mais que a contagem de eventos.
     * Deduplicar o evento e mesmo assim enfileirar de novo dispararia as
     * automações duas vezes — exatamente o que a seção 8 proíbe.
     */
    expect(listOutbox()).toHaveLength(antes);
  });

  it("trata estados diferentes da mesma mensagem como eventos distintos", () => {
    publishEvent({
      name: "message.status_changed",
      source: "webhook:whatsapp",
      idempotencyKey: idempotencyKey("whatsapp-status", "wamid.X:enviada"),
    });
    publishEvent({
      name: "message.status_changed",
      source: "webhook:whatsapp",
      idempotencyKey: idempotencyKey("whatsapp-status", "wamid.X:entregue"),
    });

    expect(listEvents()).toHaveLength(2);
  });

  it("publica sem chave quando a ação é única por natureza", () => {
    publishEvent({ name: "queue.created", source: "admin" });
    publishEvent({ name: "queue.created", source: "admin" });

    // Sem chave não há deduplicação: duas filas criadas são dois fatos.
    expect(listEvents()).toHaveLength(2);
  });
});

describe("fan-out", () => {
  it("cria uma entrada por destino assinante", () => {
    const result = publishEvent({ name: "message.received", source: "webhook:whatsapp" });

    expect(result.queued).toEqual(["inbox", "automacoes", "analytics"]);
    expect(listOutbox()).toHaveLength(3);
    expect(listOutbox().every((entry) => entry.state === "pendente")).toBe(true);
  });
});

describe("drenagem", () => {
  it("entrega e marca como entregue", async () => {
    publishEvent({ name: "message.received", source: "webhook:whatsapp" });

    const report = await drainOutbox(async () => {}, Date.now());

    expect(report.delivered).toBe(3);
    expect(report.dead).toBe(0);
    expect(listOutbox().every((entry) => entry.state === "entregue")).toBe(true);
  });

  it("isola a falha de um destino dos demais", async () => {
    publishEvent({ name: "message.received", source: "webhook:whatsapp" });

    await drainOutbox(async (_event, destination) => {
      if (destination === "analytics") throw new Error("analytics fora do ar");
    }, Date.now());

    const porDestino = Object.fromEntries(
      listOutbox().map((entry) => [entry.destination, entry.state]),
    );

    /**
     * É o motivo de a entrada de outbox ser por destino, e não uma por evento.
     * Com um contador só, a falha do analytics reprocessaria o Inbox — que já
     * tinha entregue — e a conversa apareceria duas vezes na tela.
     */
    expect(porDestino.inbox).toBe("entregue");
    expect(porDestino.automacoes).toBe("entregue");
    expect(porDestino.analytics).toBe("falhando");
  });

  it("respeita o recuo e não tenta antes da hora", async () => {
    publishEvent({ name: "queue.created", source: "admin" });

    const agora = Date.now();
    await drainOutbox(async () => {
      throw new Error("falhou");
    }, agora);

    const [entrada] = listOutbox();
    expect(entrada!.attempts).toBe(1);

    // Segunda passada imediata: a entrada é pulada, não tentada.
    const report = await drainOutbox(async () => {
      throw new Error("não deveria ser chamado");
    }, agora);

    expect(report.skipped).toBe(1);
    expect(report.processed).toBe(0);
    expect(listOutbox()[0]!.attempts).toBe(1);
  });

  it("manda para a fila de erro depois do limite de tentativas", async () => {
    publishEvent({ name: "queue.created", source: "admin" });

    let agora = Date.now();

    for (let tentativa = 0; tentativa < MAX_ATTEMPTS; tentativa += 1) {
      await drainOutbox(async () => {
        throw new Error("destino fora do ar");
      }, agora);
      // Avança o relógio além do recuo para a próxima passada ser elegível.
      agora += backoffMs(tentativa + 1) + 1_000;
    }

    const [entrada] = listOutbox();
    expect(entrada!.state).toBe("morto");
    expect(entrada!.attempts).toBe(MAX_ATTEMPTS);
    expect(entrada!.lastError).toContain("fora do ar");
  });

  it("reprocessa uma entrada morta com o contador zerado", async () => {
    publishEvent({ name: "queue.created", source: "admin" });

    let agora = Date.now();
    for (let tentativa = 0; tentativa < MAX_ATTEMPTS; tentativa += 1) {
      await drainOutbox(async () => {
        throw new Error("fora do ar");
      }, agora);
      agora += backoffMs(tentativa + 1) + 1_000;
    }

    const [morta] = listOutbox();
    expect(replayEntry(morta!.id)).toBe(true);

    /**
     * Zerar as tentativas é o ponto: quem reprocessa o faz **depois de
     * corrigir a causa**, e manter o contador daria uma tentativa só antes de
     * morrer de novo — o que faria o botão de reprocessar parecer quebrado.
     */
    expect(listOutbox()[0]!.attempts).toBe(0);
    expect(listOutbox()[0]!.state).toBe("pendente");

    const report = await drainOutbox(async () => {}, agora);
    expect(report.delivered).toBe(1);
  });

  it("recusa reprocessar o que não está morto", async () => {
    publishEvent({ name: "queue.created", source: "admin" });
    const [entrada] = listOutbox();

    expect(replayEntry(entrada!.id)).toBe(false);
  });
});

describe("política de retentativa", () => {
  it("cresce e tem teto", () => {
    expect(backoffMs(1)).toBe(5_000);
    expect(backoffMs(2)).toBe(15_000);
    expect(backoffMs(3)).toBe(45_000);

    // O teto existe para a espera não virar horas: o problema precisa aparecer
    // no mesmo turno de quem opera.
    expect(backoffMs(20)).toBe(20 * 60_000);
  });

  it("esgota exatamente no limite", () => {
    expect(isExhausted(MAX_ATTEMPTS - 1)).toBe(false);
    expect(isExhausted(MAX_ATTEMPTS)).toBe(true);
  });
});
