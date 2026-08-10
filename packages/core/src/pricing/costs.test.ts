/**
 * Custo, margem e colchão de desconto.
 *
 * O defeito que estes testes existem para impedir não aparece na tela: uma
 * margem calculada errado continua desenhando uma barra bonita e um número
 * plausível. Só o fechamento do trimestre denuncia — meses depois, com as vendas
 * já feitas.
 */

import { describe, expect, it } from "vitest";

import {
  MARGIN_BY_PLAN,
  UNIT_COSTS,
  analyzeMargin,
  derivePrice,
  estimateMonthlyCost,
  maxDiscountKeepingMargin,
} from "./costs";
import {
  CURRENT_META_RATES,
  META_RATE_TABLES,
  rateStaleness,
  ratesEffectiveAt,
} from "./meta-rates";

describe("maxDiscountKeepingMargin", () => {
  /**
   * A armadilha inteira, num teste.
   *
   * Colchão e desconto têm bases diferentes: o colchão é somado sobre o
   * preço-alvo, o desconto é subtraído do preço de tabela, que já é maior. Quem
   * trata os dois como o mesmo número monta uma tabela achando que aguenta 18% e
   * vende 2,3 pontos abaixo da margem alvo o trimestre inteiro.
   */
  it("18% de colchão absorvem 15,25% de desconto, não 18%", () => {
    expect(maxDiscountKeepingMargin(18)).toBeCloseTo(15.254, 2);
  });

  it("sem colchão, qualquer desconto come a margem", () => {
    expect(maxDiscountKeepingMargin(0)).toBe(0);
    expect(maxDiscountKeepingMargin(-5)).toBe(0);
  });

  /** A conversão é sempre menor que o colchão — nunca igual, nunca maior. */
  it("é sempre menor que o colchão informado", () => {
    for (const cushion of [5, 10, 22, 30, 50]) {
      expect(maxDiscountKeepingMargin(cushion)).toBeLessThan(cushion);
    }
  });

  it("o desconto máximo devolve exatamente o preço-alvo", () => {
    const policy = MARGIN_BY_PLAN.profissional;
    const derived = derivePrice(100_000, policy);
    const realized = derived.listPriceCents * (1 - derived.maxDiscountPct / 100);

    expect(Math.round(realized)).toBe(derived.targetPriceCents);
  });
});

describe("derivePrice", () => {
  it("empilha margem e colchão nessa ordem", () => {
    const derived = derivePrice(100_000, {
      targetMarginPct: 50,
      discountCushionPct: 20,
      floorMarginPct: 30,
    });

    expect(derived.targetPriceCents).toBe(150_000);
    expect(derived.listPriceCents).toBe(180_000);
  });
});

describe("estimateMonthlyCost", () => {
  const base = {
    seats: 10,
    contacts: 10_000,
    conversations: 5_000,
    emails: 30_000,
    aiReplies: 4_000,
    whatsappNumbers: 2,
  };

  it("soma as sete parcelas", () => {
    const cost = estimateMonthlyCost(base);
    expect(cost.lines).toHaveLength(7);
    expect(cost.totalCents).toBe(cost.lines.reduce((sum, line) => sum + line.totalCents, 0));
  });

  it("cresce com o volume", () => {
    const menor = estimateMonthlyCost(base);
    const maior = estimateMonthlyCost({ ...base, contacts: 100_000, aiReplies: 40_000 });
    expect(maior.totalCents).toBeGreaterThan(menor.totalCents);
  });

  /** Operação vazia ainda custa: a infra base existe antes do primeiro contato. */
  it("nunca é zero", () => {
    const vazia = estimateMonthlyCost({
      seats: 0,
      contacts: 0,
      conversations: 0,
      emails: 0,
      aiReplies: 0,
      whatsappNumbers: 0,
    });
    expect(vazia.totalCents).toBe(UNIT_COSTS.perAccountCents);
  });
});

describe("analyzeMargin", () => {
  const policy = MARGIN_BY_PLAN.profissional;

  it("mede a margem sobre a receita, não sobre o custo", () => {
    const analysis = analyzeMargin({
      costCents: 40_000,
      revenueCents: 100_000,
      discountPct: 0,
      policy,
    });

    // 60 de lucro sobre 100 de receita = 60%. Sobre o custo seria 150%.
    expect(analysis.marginPct).toBeCloseTo(60, 5);
  });

  it("acusa prejuízo quando a receita não cobre o custo", () => {
    const analysis = analyzeMargin({
      costCents: 120_000,
      revenueCents: 100_000,
      discountPct: 15,
      policy,
    });

    expect(analysis.status).toBe("prejuizo");
    expect(analysis.grossProfitCents).toBeLessThan(0);
  });

  it("acusa atenção abaixo do piso da edição", () => {
    const analysis = analyzeMargin({
      costCents: 70_000,
      revenueCents: 100_000,
      discountPct: 10,
      policy,
    });

    expect(analysis.marginPct).toBeCloseTo(30, 5);
    expect(analysis.floorMarginPct).toBe(40);
    expect(analysis.status).toBe("atencao");
  });

  /**
   * `discountAtFloorPct` é o número que o vendedor precisa na mesa: "posso dar
   * mais quanto?". Aplicá-lo tem de aterrissar exatamente no piso.
   */
  it("o desconto até o piso aterrissa no piso", () => {
    const costCents = 30_000;
    const revenueCents = 100_000;
    const analysis = analyzeMargin({ costCents, revenueCents, discountPct: 0, policy });

    const realized = revenueCents * (1 - analysis.discountAtFloorPct / 100);
    const marginAtFloor = ((realized - costCents) / realized) * 100;

    expect(marginAtFloor).toBeCloseTo(policy.floorMarginPct, 4);
  });

  it("o colchão consumido chega a 100% no desconto máximo", () => {
    const maxDiscount = maxDiscountKeepingMargin(policy.discountCushionPct);
    const analysis = analyzeMargin({
      costCents: 30_000,
      revenueCents: 100_000,
      discountPct: maxDiscount,
      policy,
    });

    expect(analysis.cushionUsedPct).toBeCloseTo(100, 5);
    expect(analysis.discountHeadroomPct).toBeCloseTo(0, 5);
  });
});

describe("tabela da Meta", () => {
  it("a vigente é a mais recente da lista", () => {
    expect(CURRENT_META_RATES).toBe(META_RATE_TABLES[0]);
  });

  /** Mensagem de serviço é gratuita. Cobrá-la faria a conta não bater com a fatura. */
  it("serviço é sempre zero", () => {
    for (const table of META_RATE_TABLES) {
      expect(table.ratesCents.servico).toBe(0);
    }
  });

  it("classifica a defasagem em três degraus", () => {
    const table = META_RATE_TABLES[0]!;
    expect(rateStaleness(table, "2026-07-15T12:00:00-03:00").status).toBe("atual");
    expect(rateStaleness(table, "2026-10-15T12:00:00-03:00").status).toBe("revisar");
    expect(rateStaleness(table, "2027-03-15T12:00:00-03:00").status).toBe("vencida");
  });

  /**
   * Orçamento assinado em maio precisa continuar explicável em setembro. Sem
   * histórico, a única resposta para "por que este número?" é "mudou".
   */
  it("recupera a tabela que valia numa data passada", () => {
    const antiga = ratesEffectiveAt("2026-01-10T00:00:00-03:00");
    expect(antiga.effectiveFrom).toBe("2025-07-01");
    expect(antiga.ratesCents.marketing).toBe(38);

    const atual = ratesEffectiveAt("2026-08-10T00:00:00-03:00");
    expect(atual.effectiveFrom).toBe("2026-07-01");
  });
});
