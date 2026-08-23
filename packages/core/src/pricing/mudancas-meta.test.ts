import { describe, expect, it } from "vitest";

import { CURRENT_META_RATES, META_RATE_TABLES, META_RATE_TABLES_ANUNCIADAS, mudancasDeTarifa } from "./meta-rates";
import { WHATSAPP_PRICE_BY_CATEGORY } from "./catalog";
import { formatDate, formatDateOnly } from "../utils/datetime";

/**
 * A mudança que a Meta já anunciou não pode passar em branco.
 *
 * Em 1º de outubro de 2026 a mensagem de serviço deixa de ser gratuita. A página
 * publicava "não é cobrada" sem prazo, e a tabela de repasse trazia zero — dois
 * lugares que ficariam **falsos numa data marcada**, sem nada no repositório
 * apontando para isso. O tipo de defeito que ninguém encontra procurando: ele
 * aparece quando um cliente compara a nossa fatura com a da Meta.
 */
describe("mudanças anunciadas da tabela da Meta", () => {
  const ANTES = "2026-08-16T12:00:00-03:00";
  const DEPOIS = "2026-10-02T12:00:00-03:00";

  it("mantém as anunciadas fora da lista que está em vigor", () => {
    // `CURRENT_META_RATES` é `META_RATE_TABLES[0]`, e `catalog.ts` lê o repasse de
    // lá na carga do módulo. Uma tabela futura naquela lista passaria a cobrar
    // hoje um preço de outubro — sem erro, só fatura maior.
    for (const anunciada of META_RATE_TABLES_ANUNCIADAS) {
      expect(META_RATE_TABLES).not.toContain(anunciada);
    }
    expect(CURRENT_META_RATES.ratesMicros.servico).toBe(0);
  });

  it("avisa com dias restantes enquanto a data não chegou", () => {
    const [mudanca, ...resto] = mudancasDeTarifa(ANTES);

    expect(resto).toHaveLength(0);
    expect(mudanca?.estado).toBe("anunciada");
    expect(mudanca?.dias).toBeGreaterThan(0);
    expect(mudanca?.message).toContain("serviço");
  });

  /**
   * Este é o estado que o aviso existe para produzir. Passada a vigência sem
   * alguém promover a tabela, o produto continua cobrando por uma tabela que a
   * Meta já substituiu — e o simulador precisa dizer isso em vermelho.
   */
  it("acusa atraso depois da vigência", () => {
    const [mudanca] = mudancasDeTarifa(DEPOIS);

    expect(mudanca?.estado).toBe("atrasada");
    expect(mudanca?.dias).toBeLessThanOrEqual(0);
    expect(mudanca?.message).toContain("desatualizado");
  });

  it("declara que a tarifa anunciada é derivada, não transcrita", () => {
    for (const tabela of META_RATE_TABLES_ANUNCIADAS) {
      // Sem esta marca, uma estimativa é indistinguível de um valor conferido —
      // e é assim que ela vira preço praticado sem ninguém decidir.
      expect(tabela.provisional?.motivo).toBeTruthy();
      expect(tabela.provisional?.confirmarAte).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("a página declara até quando o serviço é gratuito", () => {
    const servico = WHATSAPP_PRICE_BY_CATEGORY.servico;

    expect(servico.metaCostMicros).toBe(0);
    expect(servico.billableFrom).toBe("2026-10-01");
    // A data sai da tabela anunciada, não de texto digitado: se a mudança for
    // promovida, o campo tem de sumir sozinho em vez de mentir uma gratuidade.
    expect(servico.billableFrom).toBe(META_RATE_TABLES_ANUNCIADAS[0]?.effectiveFrom);
  });

  it("cobra serviço na tabela anunciada, pela mesma tarifa de utilidade", () => {
    const anunciada = META_RATE_TABLES_ANUNCIADAS[0];

    expect(anunciada?.ratesMicros.servico).toBeGreaterThan(0);
    expect(anunciada?.ratesMicros.servico).toBe(anunciada?.ratesMicros.utilidade);
  });
});

describe("data de calendário não escorrega de fuso", () => {
  /**
   * `formatDate` converte para `America/Sao_Paulo` e, sobre uma data sem hora,
   * devolve o **dia anterior**: a string é lida como meia-noite UTC, que em
   * Brasília ainda é ontem às 21 h. Numa vigência de tabela isso antecipa a data
   * em um dia, e ninguém confere um dia de diferença numa data plausível.
   */
  it("formata a vigência como o dia que ela é", () => {
    expect(formatDateOnly("2026-10-01")).toBe("01/10/2026");
    expect(formatDateOnly("2026-07-01")).toBe("01/07/2026");
    // Tolera instante completo, para o chamador não precisar cortar antes.
    expect(formatDateOnly("2026-10-01T00:00:00-03:00")).toBe("01/10/2026");
    // A armadilha que motivou a função, registrada como contraste.
    expect(formatDate("2026-10-01")).not.toBe("01/10/2026");
  });
});
