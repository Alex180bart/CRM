/**
 * Testes do motor de distribuição.
 *
 * O foco não é cobertura de linha: é fixar os comportamentos cuja quebra é
 * silenciosa. Roleta que não avança, capacidade ignorada, habilidade que deixa
 * passar quem não tem — nenhum desses erros produz exceção, e todos aparecem
 * semanas depois como "às vezes cai para a pessoa errada".
 */

import { describe, expect, it } from "vitest";

import { decideAssignment } from "./distribution";
import type { DistributionCandidate } from "./distribution";
import { DEFAULT_DISTRIBUTION } from "../types/organization";
import type { Queue, QueueDistribution, User } from "../types/organization";

function user(id: string, patch: Partial<User> = {}): User {
  return {
    id,
    organizationId: "org",
    name: id,
    email: `${id}@x.com`,
    initials: "XX",
    role: "atendente",
    teamIds: ["team"],
    presence: "disponivel",
    capacity: 5,
    accentHue: 0,
    skills: [],
    acceptingNew: true,
    ...patch,
  };
}

function queue(distribution: Partial<QueueDistribution>): Queue {
  return {
    id: "q",
    organizationId: "org",
    name: "Fila",
    description: "",
    channels: [],
    teamId: "team",
    firstResponseSlaMinutes: 15,
    resolutionSlaMinutes: 480,
    color: "218",
    distribution: { ...DEFAULT_DISTRIBUTION, ...distribution },
    createdAt: "",
    updatedAt: "",
  };
}

function pool(...entries: Array<[User, number]>): DistributionCandidate[] {
  return entries.map(([item, open]) => ({ user: item, openConversations: open }));
}

describe("modo manual", () => {
  it("retém a conversa sem escolher ninguém", () => {
    const decision = decideAssignment({
      queue: queue({ model: "manual" }),
      candidates: pool([user("a"), 0]),
    });

    expect(decision.outcome).toBe("reter");
    expect(decision.userId).toBeUndefined();
  });
});

describe("roleta", () => {
  const base = queue({ model: "roleta", delivery: "direta" });

  it("começa pelo primeiro quando não há cursor", () => {
    const decision = decideAssignment({
      queue: base,
      candidates: pool([user("usr_b"), 0], [user("usr_a"), 0]),
    });

    // Ordena por identificador, não pela ordem do arranjo recebido.
    expect(decision.userId).toBe("usr_a");
  });

  it("avança a partir de quem recebeu por último", () => {
    const candidates = pool([user("usr_a"), 0], [user("usr_b"), 0], [user("usr_c"), 0]);

    expect(decideAssignment({ queue: base, candidates, lastUserId: "usr_a" }).userId).toBe("usr_b");
    expect(decideAssignment({ queue: base, candidates, lastUserId: "usr_b" }).userId).toBe("usr_c");
    // Dá a volta.
    expect(decideAssignment({ queue: base, candidates, lastUserId: "usr_c" }).userId).toBe("usr_a");
  });

  it("recomeça do início quando o cursor aponta para quem saiu", () => {
    const decision = decideAssignment({
      queue: base,
      candidates: pool([user("usr_b"), 0], [user("usr_c"), 0]),
      lastUserId: "usr_a",
    });

    expect(decision.userId).toBe("usr_b");
  });
});

describe("menor carga", () => {
  it("compara ocupação relativa, não número absoluto", () => {
    const decision = decideAssignment({
      queue: queue({ model: "menor_carga", delivery: "direta" }),
      // Folgado tem MAIS conversas, mas proporcionalmente menos ocupação.
      candidates: pool(
        [user("usr_folgado", { capacity: 10 }), 6],
        [user("usr_apertado", { capacity: 4 }), 3],
      ),
    });

    expect(decision.userId).toBe("usr_folgado");
  });
});

describe("elegibilidade", () => {
  const base = queue({ model: "roleta", delivery: "direta" });

  it("nunca distribui para quem está offline, mesmo sem exigir disponibilidade", () => {
    const decision = decideAssignment({
      queue: queue({ model: "roleta", delivery: "direta", requireAvailable: false }),
      candidates: pool([user("usr_a", { presence: "offline" }), 0], [user("usr_b"), 0]),
    });

    expect(decision.userId).toBe("usr_b");
    expect(decision.excluded.map((item) => item.userId)).toContain("usr_a");
  });

  it("aceita ausente e ocupado quando a exigência de disponibilidade está desligada", () => {
    const decision = decideAssignment({
      queue: queue({ model: "roleta", delivery: "direta", requireAvailable: false }),
      candidates: pool([user("usr_a", { presence: "ausente" }), 0]),
    });

    expect(decision.userId).toBe("usr_a");
  });

  it("pula quem pausou o recebimento", () => {
    const decision = decideAssignment({
      queue: base,
      candidates: pool([user("usr_a", { acceptingNew: false }), 0], [user("usr_b"), 0]),
    });

    expect(decision.userId).toBe("usr_b");
  });

  it("pula quem está no teto de capacidade e explica o porquê", () => {
    const decision = decideAssignment({
      queue: base,
      candidates: pool([user("usr_a", { capacity: 2 }), 2], [user("usr_b"), 0]),
    });

    expect(decision.userId).toBe("usr_b");
    expect(decision.excluded[0]?.reason).toContain("capacidade");
  });

  it("retém quando ninguém está elegível", () => {
    const decision = decideAssignment({
      queue: base,
      candidates: pool([user("usr_a", { presence: "offline" }), 0]),
    });

    expect(decision.outcome).toBe("reter");
  });
});

describe("habilidade", () => {
  const base = queue({
    model: "habilidade",
    delivery: "direta",
    requiredSkills: ["fiscal"],
    tiebreak: "menor_carga",
  });

  it("exclui quem não declarou a competência", () => {
    const decision = decideAssignment({
      queue: base,
      candidates: pool([user("usr_a"), 0], [user("usr_b", { skills: ["fiscal"] }), 4]),
    });

    expect(decision.userId).toBe("usr_b");
    expect(decision.excluded.find((item) => item.userId === "usr_a")?.reason).toContain("fiscal");
  });

  it("soma a exigência da conversa à da fila, em vez de substituí-la", () => {
    const decision = decideAssignment({
      queue: base,
      candidates: pool(
        [user("usr_a", { skills: ["fiscal"] }), 0],
        [user("usr_b", { skills: ["fiscal", "simples_nacional"] }), 0],
      ),
      requiredSkills: ["simples_nacional"],
    });

    expect(decision.userId).toBe("usr_b");
  });
});

describe("proprietário do contato", () => {
  const base = queue({ model: "proprietario", delivery: "direta", tiebreak: "menor_carga" });

  it("entrega ao dono quando ele está elegível, mesmo com mais carga", () => {
    const decision = decideAssignment({
      queue: base,
      candidates: pool([user("usr_dono"), 4], [user("usr_livre"), 0]),
      contactOwnerId: "usr_dono",
    });

    expect(decision.userId).toBe("usr_dono");
    expect(decision.decidedBy).toBe("proprietario");
  });

  it("cai no desempate quando o dono não está elegível", () => {
    const decision = decideAssignment({
      queue: base,
      candidates: pool([user("usr_dono", { presence: "offline" }), 0], [user("usr_livre"), 0]),
      contactOwnerId: "usr_dono",
    });

    expect(decision.userId).toBe("usr_livre");
    expect(decision.decidedBy).toBe("menor_carga");
  });
});

describe("entrega", () => {
  it("na atribuição direta a ordem tem um só, porque não existe recusa", () => {
    const decision = decideAssignment({
      queue: queue({ model: "roleta", delivery: "direta" }),
      candidates: pool([user("usr_a"), 0], [user("usr_b"), 0], [user("usr_c"), 0]),
    });

    expect(decision.outcome).toBe("atribuir");
    expect(decision.order).toHaveLength(1);
  });

  it("na oferta a ordem é limitada por maxOffers", () => {
    const decision = decideAssignment({
      queue: queue({ model: "roleta", delivery: "oferta", maxOffers: 2 }),
      candidates: pool([user("usr_a"), 0], [user("usr_b"), 0], [user("usr_c"), 0]),
    });

    expect(decision.outcome).toBe("oferecer");
    expect(decision.order).toEqual(["usr_a", "usr_b"]);
  });
});

describe("escala", () => {
  it("suspende a distribuição fora do horário quando a fila pede", () => {
    const decision = decideAssignment({
      queue: queue({ model: "roleta", pauseOutsideSchedule: true }),
      candidates: pool([user("usr_a"), 0]),
      scheduleOpen: false,
    });

    expect(decision.outcome).toBe("reter");
    expect(decision.reason).toContain("horário");
  });

  it("distribui fora do horário quando a fila não pede a pausa", () => {
    const decision = decideAssignment({
      queue: queue({ model: "roleta", delivery: "direta", pauseOutsideSchedule: false }),
      candidates: pool([user("usr_a"), 0]),
      scheduleOpen: false,
    });

    expect(decision.outcome).toBe("atribuir");
  });
});

describe("determinismo", () => {
  it("a mesma entrada produz sempre a mesma decisão", () => {
    const input = {
      queue: queue({ model: "menor_carga", delivery: "oferta", maxOffers: 3 }),
      candidates: pool([user("usr_a"), 2], [user("usr_b"), 2], [user("usr_c"), 2]),
    };

    const first = decideAssignment(input);
    const second = decideAssignment(input);

    expect(first.order).toEqual(second.order);
  });
});
