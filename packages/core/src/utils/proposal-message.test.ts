/**
 * Testes da mensagem de proposta.
 *
 * O que se fixa aqui é o que o cliente lê. Nenhuma destas falhas gera erro: um
 * total somando recorrente com avulso, um item que sumiu da lista, um prazo
 * ausente — tudo isso produz uma mensagem plausível e errada, e o erro só
 * aparece na primeira fatura, quando já virou reclamação.
 */

import { describe, expect, it } from "vitest";

import { buildProposalMessage, summarizeProposalItems } from "./proposal-message";
import type { ProposalItem } from "../types/commerce";

function item(patch: Partial<ProposalItem> & { name: string; totalCents: number }): ProposalItem {
  return {
    productId: `prod_${patch.name}`,
    productKey: patch.name.toLowerCase().replace(/\s+/g, "_"),
    kind: "produto",
    recurrence: "unico",
    quantity: 1,
    unitPriceCents: patch.totalCents,
    discountPct: 0,
    maxDiscountPct: 20,
    ...patch,
  };
}

const EXPIRES = "2026-08-17T12:00:00.000Z";

/**
 * `Intl` separa "R$" do número com espaço **inquebrável** (U+00A0).
 *
 * Comparar com espaço comum falha por um caractere invisível, e o diff mostra
 * duas linhas idênticas — a meia hora mais frustrante de depuração que um teste
 * de formatação consegue produzir. Normalizar aqui deixa a asserção sobre o
 * conteúdo, que é o que importa.
 */
function plain(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

describe("mensagem", () => {
  it("lista todos os itens com quantidade e preço", () => {
    const text = buildProposalMessage({
      proposal: {
        items: [
          item({ name: "Kit 3 luminárias pendentes", totalCents: 47_900 }),
          item({ name: "Trilho eletrificado", totalCents: 32_900, quantity: 2 }),
        ],
        message: "",
        expiresAt: EXPIRES,
        sellerName: "Priscila",
      },
      contactFirstName: "Marcela",
    });

    expect(plain(text)).toContain("Oi, Marcela!");
    expect(plain(text)).toContain("Kit 3 luminárias pendentes — R$ 479,00");
    expect(plain(text)).toContain("2× Trilho eletrificado — R$ 329,00");
    expect(plain(text)).toContain("Total: R$ 808,00");
  });

  it("separa recorrente de avulso, em vez de somar num número só", () => {
    const text = buildProposalMessage({
      proposal: {
        items: [
          item({ name: "Clube", totalCents: 3_000, recurrence: "mensal" }),
          item({ name: "Instalação", totalCents: 38_900 }),
        ],
        message: "",
        expiresAt: EXPIRES,
        sellerName: "Priscila",
      },
    });

    expect(plain(text)).toContain("R$ 30,00 por mês");
    expect(plain(text)).toContain("R$ 389,00 de entrada");
  });

  it("mostra o desconto na linha em que ele foi dado", () => {
    const text = buildProposalMessage({
      proposal: {
        items: [item({ name: "Trilho", totalCents: 29_610, discountPct: 10 })],
        message: "",
        expiresAt: EXPIRES,
        sellerName: "Priscila",
      },
    });

    expect(plain(text)).toContain("10% de desconto");
  });

  it("sempre diz até quando o preço vale", () => {
    const text = buildProposalMessage({
      proposal: {
        items: [item({ name: "Trilho", totalCents: 32_900 })],
        message: "",
        expiresAt: EXPIRES,
        sellerName: "Priscila",
      },
    });

    expect(plain(text)).toContain("17/08/2026");
  });

  it("inclui a linha escrita pelo vendedor, quando existe", () => {
    const text = buildProposalMessage({
      proposal: {
        items: [item({ name: "Trilho", totalCents: 32_900 })],
        message: "Consegui manter o preço da semana passada.",
        expiresAt: EXPIRES,
        sellerName: "Priscila",
      },
    });

    expect(plain(text)).toContain("Consegui manter o preço da semana passada.");
  });

  it("funciona sem o nome do contato", () => {
    const text = buildProposalMessage({
      proposal: {
        items: [item({ name: "Trilho", totalCents: 32_900 })],
        message: "",
        expiresAt: EXPIRES,
        sellerName: "Priscila",
      },
    });

    expect(plain(text).startsWith("Oi!")).toBe(true);
  });
});

describe("resumo para o prompt", () => {
  it("não leva saudação nem chamada para ação", () => {
    const summary = summarizeProposalItems([
      item({ name: "Trilho", totalCents: 32_900, quantity: 2 }),
      item({ name: "Clube", totalCents: 3_000, recurrence: "mensal", discountPct: 5 }),
    ]);

    expect(plain(summary)).toBe("2× Trilho = R$ 329,00; 1× Clube = R$ 30,00/mês (desconto 5%)");
  });
});
