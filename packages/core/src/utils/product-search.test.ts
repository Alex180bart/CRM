/**
 * Testes da busca de catálogo.
 *
 * O alvo são as falhas silenciosas de uma caixa de busca: acento que esconde o
 * produto, segundo termo que não refina, contexto que atropela o que foi
 * digitado e ordem que muda sozinha quando alguém cadastra item novo. Nenhuma
 * delas gera erro — todas geram "não achei" ou "veio coisa errada", que é o que
 * faz o vendedor parar de usar a busca e rolar a lista.
 */

import { describe, expect, it } from "vitest";

import { searchProducts } from "./product-search";
import type { Product } from "../types/commerce";

function product(patch: Partial<Product> & { key: string; name: string }): Product {
  return {
    id: `prod_${patch.key}`,
    organizationId: "org",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    kind: "produto",
    summary: "",
    description: "",
    priceCents: 10_000,
    recurrence: "unico",
    maxDiscountPct: 10,
    includes: [],
    salesNotes: "",
    checkout: { mode: "link", baseUrl: "https://exemplo.com" },
    active: true,
    ...patch,
  };
}

const CATALOG: Product[] = [
  product({
    key: "trilho_eletrificado",
    name: "Trilho eletrificado 1,5 m",
    summary: "Trilho com quatro spots direcionáveis.",
    includes: ["4 spots GU10"],
    salesNotes: "Combina com o kit de pendentes em sala integrada.",
  }),
  product({
    key: "kit_luminarias",
    name: "Kit 3 luminárias pendentes",
    summary: "Trio de pendentes em vidro fosco.",
    salesNotes: "Objeção comum é o pé-direito alto. Combina com trilho.",
  }),
  product({
    key: "clareamento",
    name: "Clareamento dental",
    kind: "servico",
    summary: "Sessão em consultório com moldeira.",
  }),
  product({
    key: "cupula_avulsa",
    name: "Cúpula avulsa de reposição",
    summary: "Peça de reposição para pendente trincado.",
  }),
  product({
    key: "descontinuado",
    name: "Trilho antigo 1 m",
    active: false,
  }),
];

describe("consulta", () => {
  it("ignora acento nos dois lados", () => {
    const comAcento = searchProducts(CATALOG, "cúpula");
    const semAcento = searchProducts(CATALOG, "cupula");

    expect(comAcento[0]?.product.key).toBe("cupula_avulsa");
    expect(semAcento[0]?.product.key).toBe("cupula_avulsa");
  });

  it("acha por começo de palavra", () => {
    expect(searchProducts(CATALOG, "clar")[0]?.product.key).toBe("clareamento");
  });

  it("prefere quem casou no nome a quem casou nas notas de venda", () => {
    const result = searchProducts(CATALOG, "trilho");

    expect(result[0]?.product.key).toBe("trilho_eletrificado");
    expect(result.map((match) => match.product.key)).toContain("kit_luminarias");
  });

  it("exige todos os termos: o segundo refina em vez de ampliar", () => {
    const um = searchProducts(CATALOG, "trilho");
    const dois = searchProducts(CATALOG, "trilho clareamento");

    expect(um.length).toBeGreaterThan(0);
    expect(dois).toHaveLength(0);
  });

  it("descarta palavras de função para não empatar tudo", () => {
    // "de" sozinho casaria com metade do catálogo; a consulta vale pelo resto.
    const result = searchProducts(CATALOG, "peça de reposição");

    expect(result[0]?.product.key).toBe("cupula_avulsa");
  });

  it("não devolve produto inativo", () => {
    const chaves = searchProducts(CATALOG, "trilho").map((match) => match.product.key);

    expect(chaves).not.toContain("descontinuado");
  });

  it("devolve inativo quando pedido explicitamente", () => {
    const chaves = searchProducts(CATALOG, "trilho", { includeInactive: true }).map(
      (match) => match.product.key,
    );

    expect(chaves).toContain("descontinuado");
  });

  it("diz onde casou", () => {
    const [primeiro] = searchProducts(CATALOG, "trilho");

    expect(primeiro.reasons).toContain("nome");
  });
});

describe("contexto da conversa", () => {
  it("sugere sem nada digitado", () => {
    const result = searchProducts(CATALOG, "", {
      context: "Cúpula chegou trincada, preciso de reposição",
    });

    expect(result[0]?.product.key).toBe("cupula_avulsa");
    expect(result[0]?.fromContext).toBe(true);
  });

  it("não atropela o que foi digitado", () => {
    // A conversa é de estética; a consulta é de iluminação. Quem manda é a
    // consulta — trazer clareamento aqui seria ignorar o pedido.
    const chaves = searchProducts(CATALOG, "trilho", {
      context: "Quero fazer clareamento dental",
    }).map((match) => match.product.key);

    expect(chaves).not.toContain("clareamento");
  });

  it("descarta o termo que casa com quase todo o catálogo", () => {
    /**
     * "pendente" aparece em três dos quatro ativos. Um termo assim não distingue
     * nada dentro do catálogo, e contá-lo faria todo item ganhar o selo de
     * sugerido — que foi o defeito observado na tela: sugestão em tudo é
     * sugestão em nada.
     */
    const result = searchProducts(CATALOG, "", { context: "pendente pendentes" });

    expect(result.every((match) => !match.fromContext)).toBe(true);
  });

  it("ignora termo curto demais para distinguir", () => {
    const result = searchProducts(CATALOG, "", { context: "kit" });

    expect(result.every((match) => !match.fromContext)).toBe(true);
  });

  it("desempata entre quem já casou", () => {
    const semContexto = searchProducts(CATALOG, "pendente");
    const comContexto = searchProducts(CATALOG, "pendente", {
      context: "cúpula trincada, peça de reposição",
    });

    expect(semContexto[0]?.product.key).not.toBe("cupula_avulsa");
    expect(comContexto[0]?.product.key).toBe("cupula_avulsa");
  });
});

describe("estabilidade", () => {
  it("empate resolve por nome, não por ordem de cadastro", () => {
    const original = searchProducts(CATALOG, "");
    const embaralhado = searchProducts([...CATALOG].reverse(), "");

    expect(embaralhado.map((match) => match.product.key)).toEqual(
      original.map((match) => match.product.key),
    );
  });

  it("respeita o limite", () => {
    expect(searchProducts(CATALOG, "", { limit: 2 })).toHaveLength(2);
  });
});
