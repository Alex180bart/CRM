/**
 * Testes da normalização do conteúdo.
 *
 * O conteúdo vem de um arquivo em disco, e a classe de defeito que interessa é
 * "o arquivo está torto e a página caiu". A regra sob teste é a de tolerância:
 * campo ausente ou de tipo errado cai no padrão, e o resto do documento continua
 * valendo. Recusar o documento inteiro por causa de um ícone digitado errado
 * transformaria um problema de trinta segundos num incidente da landing page.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_SITE_CONTENT } from "./defaults";
import { freeContentId, normalizeSiteContent } from "./normalize";

describe("normalizeSiteContent", () => {
  it("devolve o padrão para qualquer entrada inútil", () => {
    for (const input of [null, undefined, 42, "texto", [], {}]) {
      expect(normalizeSiteContent(input).landing.hero.titleLead).toBe(
        DEFAULT_SITE_CONTENT.landing.hero.titleLead,
      );
    }
  });

  it("preserva o que foi editado e completa o que falta", () => {
    const result = normalizeSiteContent({
      landing: { hero: { titleLead: "Outro título" } },
    });

    expect(result.landing.hero.titleLead).toBe("Outro título");
    expect(result.landing.hero.subtitle).toBe(DEFAULT_SITE_CONTENT.landing.hero.subtitle);
    expect(result.footer.legal).toBe(DEFAULT_SITE_CONTENT.footer.legal);
  });

  it("aceita texto vazio sem devolvê-lo ao padrão", () => {
    /**
     * Apagar a chamada de uma seção é edição legítima — várias nascem vazias.
     * Cair no padrão aqui produziria o campo que se preenche sozinho depois de
     * salvo, que é o defeito mais irritante de um editor.
     */
    const result = normalizeSiteContent({ landing: { problem: { body: "" } } });
    expect(result.landing.problem.body).toBe("");
  });

  it("troca ícone inexistente pelo do padrão, sem descartar o cartão", () => {
    const result = normalizeSiteContent({
      landing: { moduleCards: [{ id: "m1", icon: "IconeQueNaoExiste", title: "Meu módulo" }] },
    });

    expect(result.landing.moduleCards).toHaveLength(1);
    expect(result.landing.moduleCards[0].title).toBe("Meu módulo");
    expect(result.landing.moduleCards[0].icon).toBe(
      DEFAULT_SITE_CONTENT.landing.moduleCards[0].icon,
    );
  });

  it("distingue lista vazia de lista ausente", () => {
    /**
     * Remover todos os cartões é intenção — a página esconde a seção. Ausência é
     * arquivo incompleto, e aí o padrão precisa aparecer.
     */
    expect(normalizeSiteContent({ landing: { securityCards: [] } }).landing.securityCards).toEqual(
      [],
    );
    expect(normalizeSiteContent({ landing: {} }).landing.securityCards).toEqual(
      DEFAULT_SITE_CONTENT.landing.securityCards,
    );
  });

  it("inventa identificador para item que veio sem um", () => {
    const result = normalizeSiteContent({ faq: [{ question: "P", answer: "R" }] });
    expect(result.faq[0].id).toBeTruthy();
  });

  it("completa item excedente a partir do molde do primeiro", () => {
    // Nove módulos quando o padrão tem oito: o nono não tem par de onde herdar.
    const cards = Array.from({ length: 9 }, (_, index) => ({
      id: `m${index}`,
      title: `T${index}`,
    }));
    const result = normalizeSiteContent({ landing: { moduleCards: cards } });

    expect(result.landing.moduleCards).toHaveLength(9);
    expect(result.landing.moduleCards[8].icon).toBe(
      DEFAULT_SITE_CONTENT.landing.moduleCards[0].icon,
    );
  });

  it("descarta entrada não textual de lista de textos", () => {
    const result = normalizeSiteContent({ landing: { segments: ["Contabilidade", 7, null] } });
    expect(result.landing.segments).toEqual(["Contabilidade"]);
  });

  it("é idempotente", () => {
    // Normalizar o resultado de uma normalização não pode mudar nada — é o que
    // permite chamá-la na leitura e de novo na escrita sem medo.
    const once = normalizeSiteContent(DEFAULT_SITE_CONTENT);
    expect(normalizeSiteContent(once)).toEqual(once);
  });
});

describe("freeContentId", () => {
  it("evita identificador já usado", () => {
    expect(freeContentId("item", ["item-1", "item-2"])).toBe("item-3");
    expect(freeContentId("item", ["item-3"])).toBe("item-2");
  });

  it("é determinístico", () => {
    // Sorteio produziria chave diferente entre servidor e cliente na prévia — o
    // mesmo defeito de hidratação que `datetime.ts` evita do lado do tempo.
    expect(freeContentId("x", ["x-1"])).toBe(freeContentId("x", ["x-1"]));
  });
});
