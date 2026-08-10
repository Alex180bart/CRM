/**
 * Regras de preço, desconto e link de pagamento.
 *
 * Testadas pelo mesmo critério do barramento de eventos: o defeito aqui é
 * **invisível**. Preço errado na tela alguém vê; um centavo de diferença entre o
 * que a proposta mostra e o que o link cobra só aparece na conciliação, semanas
 * depois. E o portão de desconto que deixa passar não falha — ele simplesmente
 * não acontece, e ninguém percebe até a margem do trimestre fechar.
 */

import { describe, expect, it } from "vitest";

import type { Product, ProposalItem } from "../types/commerce";
import {
  buildCheckoutUrl,
  buildProposalItem,
  canTransition,
  checkDiscount,
  computeTotals,
  lineTotalCents,
  slugifySeller,
  statusAfterSubmit,
  validateCheckoutBaseUrl,
} from "./commerce";

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod_1",
    organizationId: "org_1",
    createdAt: "2026-01-01T00:00:00-03:00",
    updatedAt: "2026-01-01T00:00:00-03:00",
    key: "servico",
    name: "Serviço",
    kind: "servico",
    summary: "",
    description: "",
    priceCents: 10_000,
    recurrence: "unico",
    maxDiscountPct: 10,
    includes: [],
    salesNotes: "",
    checkout: { mode: "link", baseUrl: "https://pagar.exemplo.com.br/servico" },
    active: true,
    ...overrides,
  };
}

describe("slugifySeller", () => {
  it("remove acento sem comer a letra", () => {
    expect(slugifySeller("José Nogueira Ávila")).toBe("jose-nogueira-avila");
  });

  it("colapsa pontuação e espaço num hífen só", () => {
    expect(slugifySeller("Ana   Maria  d'Ávila")).toBe("ana-maria-d-avila");
  });

  it("não deixa hífen sobrando nas pontas", () => {
    expect(slugifySeller("  Rafael Souza  ")).toBe("rafael-souza");
  });
});

describe("lineTotalCents", () => {
  /**
   * O caso que motivou arredondar só no fim.
   *
   * Com 7 unidades de R$ 33,33 e 33% de desconto, as duas ordens divergem em um
   * centavo — e o cliente confere exatamente esta conta na calculadora do
   * celular:
   *
   * - arredondando no fim: 23.331 × 0,67 = 15.631,77 → **15.632**;
   * - arredondando no unitário: round(3.333 × 0,67) = 2.233; × 7 = **15.631**.
   *
   * Um centavo parece nada até a conciliação do mês não fechar, quando a
   * diferença não tem dono e ninguém sabe de onde saiu.
   */
  it("arredonda uma vez, sobre o bruto", () => {
    expect(lineTotalCents(3_333, 7, 33)).toBe(15_632);

    // A ordem errada, explicitada: é 1 centavo a menos.
    const arredondandoAntes = Math.round(3_333 * 0.67) * 7;
    expect(arredondandoAntes).toBe(15_631);
    expect(lineTotalCents(3_333, 7, 33) - arredondandoAntes).toBe(1);
  });

  it("desconto zero devolve o bruto", () => {
    expect(lineTotalCents(9_900, 2, 0)).toBe(19_800);
  });
});

describe("buildProposalItem", () => {
  it("copia preço, nome e teto do produto", () => {
    const item = buildProposalItem(product({ name: "Abertura", maxDiscountPct: 20 }), 1, 5);
    expect(item.name).toBe("Abertura");
    expect(item.unitPriceCents).toBe(10_000);
    expect(item.maxDiscountPct).toBe(20);
  });

  /**
   * A cópia é o ponto do desenho: reajuste posterior não pode mexer em proposta
   * já montada. Sem isso, o cliente que recebeu R$ 100 ontem veria R$ 150 hoje
   * no mesmo histórico de conversa.
   */
  it("não acompanha o produto depois de montado", () => {
    const original = product({ priceCents: 10_000 });
    const item = buildProposalItem(original, 1, 0);
    original.priceCents = 15_000;
    expect(item.unitPriceCents).toBe(10_000);
  });

  it("recorta quantidade e desconto para a faixa válida", () => {
    expect(buildProposalItem(product(), 0, -5).quantity).toBe(1);
    expect(buildProposalItem(product(), 2.4, 140).discountPct).toBe(100);
  });
});

describe("computeTotals", () => {
  /**
   * Recorrente e avulso não se somam num número só. R$ 300/mês com R$ 900 de
   * abertura não é "R$ 1.200" — esse valor não existe em nenhum boleto.
   */
  it("separa recorrente de avulso", () => {
    const items: ProposalItem[] = [
      buildProposalItem(product({ id: "a", priceCents: 30_000, recurrence: "mensal" }), 1, 0),
      buildProposalItem(product({ id: "b", priceCents: 90_000, recurrence: "unico" }), 1, 0),
    ];

    const totals = computeTotals(items);
    expect(totals.recurringCents).toBe(30_000);
    expect(totals.oneOffCents).toBe(90_000);
    expect(totals.totalCents).toBe(120_000);
  });

  it("desconto sai da diferença entre bruto e líquido", () => {
    const items = [buildProposalItem(product({ priceCents: 20_000 }), 2, 25)];
    const totals = computeTotals(items);
    expect(totals.subtotalCents).toBe(40_000);
    expect(totals.totalCents).toBe(30_000);
    expect(totals.discountCents).toBe(10_000);
  });
});

describe("checkDiscount", () => {
  it("dentro do teto não pede aprovação", () => {
    const items = [buildProposalItem(product({ maxDiscountPct: 20 }), 1, 20)];
    expect(checkDiscount(items).requiresApproval).toBe(false);
    expect(statusAfterSubmit(items)).toBe("enviada");
  });

  it("um ponto acima do teto já pede", () => {
    const items = [buildProposalItem(product({ maxDiscountPct: 20 }), 1, 21)];
    expect(checkDiscount(items).requiresApproval).toBe(true);
    expect(statusAfterSubmit(items)).toBe("aguardando_aprovacao");
  });

  /**
   * A conferência é por item, e não pela média da proposta. Pela média, 60% num
   * serviço recorrente passaria desde que houvesse um item sem desconto ao lado
   * para diluir — e é a margem do recorrente que o teto existe para proteger.
   */
  it("não deixa um item sem desconto diluir outro fora do teto", () => {
    const items = [
      buildProposalItem(product({ id: "a", maxDiscountPct: 10 }), 1, 60),
      buildProposalItem(product({ id: "b", maxDiscountPct: 40 }), 1, 0),
    ];
    const check = checkDiscount(items);
    expect(check.requiresApproval).toBe(true);
    expect(check.offending).toHaveLength(1);
  });

  it("teto zero recusa qualquer desconto", () => {
    const items = [buildProposalItem(product({ maxDiscountPct: 0 }), 1, 1)];
    expect(checkDiscount(items).requiresApproval).toBe(true);
  });
});

describe("canTransition", () => {
  it("segue o caminho feliz", () => {
    expect(canTransition("rascunho", "enviada")).toBe(true);
    expect(canTransition("enviada", "aceita")).toBe(true);
    expect(canTransition("aceita", "paga")).toBe(true);
  });

  it("não pula o aceite do cliente", () => {
    expect(canTransition("enviada", "paga")).toBe(false);
    expect(canTransition("rascunho", "aceita")).toBe(false);
  });

  /** Estado final não tem saída: estorno é outro fato, com outro registro. */
  it("estado final é final", () => {
    expect(canTransition("paga", "cancelada")).toBe(false);
    expect(canTransition("recusada", "enviada")).toBe(false);
    expect(canTransition("expirada", "aceita")).toBe(false);
  });
});

describe("buildCheckoutUrl", () => {
  const input = {
    baseUrl: "https://pagar.exemplo.com.br/abertura",
    sellerName: "Rafael Souza",
    sellerId: "u_204",
    proposalId: "prop_7f3a",
  };

  it("põe o nome do vendedor no link", () => {
    const result = buildCheckoutUrl(input);
    expect(result.ok).toBe(true);
    expect(result.url).toContain("vendedor=rafael-souza");
    expect(result.url).toContain("vid=u_204");
    expect(result.url).toContain("ref=prop_7f3a");
  });

  /**
   * Base com query já existente foi o caso que derrubou a concatenação de texto:
   * `?plano=anual` + `?vendedor=...` produz dois pontos de interrogação, e a
   * maioria dos servidores lê o segundo como parte do valor do primeiro.
   */
  it("preserva a query que a base já tinha", () => {
    const result = buildCheckoutUrl({ ...input, baseUrl: "https://x.com.br/p?plano=anual" });
    expect(result.ok).toBe(true);
    const url = new URL(result.url!);
    expect(url.searchParams.get("plano")).toBe("anual");
    expect(url.searchParams.get("vendedor")).toBe("rafael-souza");
    expect(result.url!.split("?")).toHaveLength(2);
  });

  /**
   * A recusa mais importante do arquivo. Este endereço vira o `href` de um botão
   * que o cliente clica; `javascript:` ali executa no nosso domínio.
   */
  it("recusa esquema que não seja http ou https", () => {
    for (const baseUrl of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
    ]) {
      expect(buildCheckoutUrl({ ...input, baseUrl }).ok).toBe(false);
    }
  });

  it("recusa endereço vazio ou malformado", () => {
    expect(buildCheckoutUrl({ ...input, baseUrl: "" }).ok).toBe(false);
    expect(buildCheckoutUrl({ ...input, baseUrl: "pagar.exemplo.com.br" }).ok).toBe(false);
  });

  it("valida no cadastro com a mesma régua do envio", () => {
    expect(validateCheckoutBaseUrl("https://ok.com.br/p").ok).toBe(true);
    expect(validateCheckoutBaseUrl("javascript:void(0)").ok).toBe(false);
  });
});
