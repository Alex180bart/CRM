/**
 * Comércio nas verticais de demonstração.
 *
 * Existe porque este é um defeito **invisível na tela**: uma vertical sem
 * catálogo não quebra nada — o painel de proposta simplesmente aparece vazio,
 * com a mensagem de "nenhum produto cadastrado", que é indistinguível de uma
 * instalação nova. Quem descobre é quem está demonstrando, na frente do cliente.
 *
 * O mesmo vale para a proposta aceita sem link: a tela tem um estado legítimo
 * para isso (cobrança integrada não conectada), então a ausência do endereço não
 * chama atenção. Só um teste separa "não gerou porque não devia" de "não gerou
 * porque quebrou".
 */

import { describe, expect, it } from "vitest";

import { DEMO_VERTICALS, datasetFor } from "./registry";
import { slugifySeller } from "../utils/commerce";
import { computeTotals } from "../utils/commerce";

describe("verticais de demonstração", () => {
  it("são quatro, e todas aparecem na vitrine", () => {
    expect(DEMO_VERTICALS).toHaveLength(4);
  });

  for (const meta of DEMO_VERTICALS) {
    describe(meta.name, () => {
      const data = datasetFor(meta.id);

      it("tem catálogo com item ativo", () => {
        expect(data.products.length).toBeGreaterThan(0);
        expect(data.products.some((product) => product.active)).toBe(true);
      });

      /**
       * O último item de cada catálogo nasce inativo de propósito: é o que torna
       * demonstrável a regra de que inativo some da montagem de proposta e
       * continua no histórico.
       */
      it("tem ao menos um item inativo, para exercitar a regra", () => {
        expect(data.products.some((product) => !product.active)).toBe(true);
      });

      it("semeia propostas em conversas que existem", () => {
        expect(data.proposals.length).toBeGreaterThan(0);

        const conversationIds = new Set(data.conversations.map((item) => item.id));
        const contactIds = new Set(data.contacts.map((item) => item.id));

        for (const proposal of data.proposals) {
          expect(conversationIds.has(proposal.conversationId)).toBe(true);
          expect(contactIds.has(proposal.contactId)).toBe(true);
        }
      });

      it("cobre os estados que têm tela", () => {
        const states = new Set(data.proposals.map((proposal) => proposal.status));
        for (const expected of ["rascunho", "aguardando_aprovacao", "enviada", "aceita", "paga"]) {
          expect(states).toContain(expected);
        }
      });

      /**
       * O total semeado precisa bater com o que as funções puras calculam. Sem
       * esta conferência, uma mudança no arredondamento deixaria a demonstração
       * mostrando um número que o produto não produz mais.
       */
      it("tem totais coerentes com as regras de preço", () => {
        for (const proposal of data.proposals) {
          const totals = computeTotals(proposal.items);
          expect(proposal.totalCents).toBe(totals.totalCents);
          expect(proposal.discountCents).toBe(totals.discountCents);
        }
      });

      it("só gera link depois do aceite, e com o vendedor dentro", () => {
        for (const proposal of data.proposals) {
          const settled = proposal.status === "aceita" || proposal.status === "paga";

          if (!settled) {
            expect(proposal.checkoutUrl).toBeUndefined();
            continue;
          }

          // Item de cobrança integrada não gera link — e isso é estado legítimo.
          if (!proposal.checkoutUrl) continue;

          const url = new URL(proposal.checkoutUrl);
          expect(url.protocol).toMatch(/^https?:$/);
          expect(url.searchParams.get("vendedor")).toBe(slugifySeller(proposal.sellerName));
          expect(url.searchParams.get("ref")).toBe(proposal.id);
        }
      });

      /**
       * A proposta que espera o gestor tem de estar realmente acima do teto —
       * senão ela é só uma proposta parada, e o portão nunca é exercitado.
       */
      it("a que aguarda aprovação está de fato acima do teto", () => {
        const waiting = data.proposals.find(
          (proposal) => proposal.status === "aguardando_aprovacao",
        );
        expect(waiting).toBeDefined();
        expect(waiting!.items.some((item) => item.discountPct > item.maxDiscountPct)).toBe(true);
        expect(waiting!.approval?.reason).toBeTruthy();
      });
    });
  }
});
