import { describe, expect, it } from "vitest";

import { PLANS } from "./catalog";
import { startingPriceCents } from "./calculator";
import { MARGIN_BY_PLAN, analyzeMargin, estimateMonthlyCost } from "./costs";

/**
 * A tabela publicada tem de cobrir o custo de servir o que ela promete.
 *
 * ## Por que este teste existe
 *
 * A edição Corporativo anunciou, por um tempo, "a partir de R$ 3.900" com
 * franquia de 100 mil contatos, 60 mil conversas, 400 mil e-mails, 40 mil
 * respostas de IA e colaboradores ilimitados. O custo estimado de servir tudo
 * isso é de cerca de R$ 4.700 — o piso publicado estava **abaixo do custo**, e
 * nada no repositório acusava. Ninguém escreve um preço achando que dá prejuízo:
 * o erro entra ao mexer numa franquia sem refazer a conta do outro lado.
 *
 * ## O que ele garante, e o que não garante
 *
 * Garante o piso mínimo defensável: **nenhuma edição com preço público custa mais
 * do que cobra**, no pior caso de uso dentro do preço base.
 *
 * Não garante a margem alvo. Com a franquia 100% consumida, nenhuma edição
 * alcança o alvo — e isso é esperado, porque franquia é teto, não média: o
 * cliente típico usa uma fração dela. Amarrar o alvo aqui reprovaria uma tabela
 * comercialmente sadia.
 *
 * E não garante nada sobre o mundo real: `UNIT_COSTS` é estimativa declarada, não
 * telemetria — não há back-end para medir. O que este teste protege é a coerência
 * interna entre o preço publicado e o custo que o próprio projeto afirma ter.
 */
describe("a tabela publicada cobre o custo de servir", () => {
  const cenarioCheio = (plan: (typeof PLANS)[number]) =>
    estimateMonthlyCost({
      seats: plan.minSeats,
      contacts: plan.includedContacts,
      conversations: plan.includedConversations,
      emails: plan.includedEmails,
      aiReplies: plan.includedAiReplies,
      whatsappNumbers: plan.includedWhatsappNumbers,
      whatsappTemplates: plan.includedWhatsappTemplates,
    });

  const comPrecoPublico = PLANS.filter((plan) => !plan.priceOnRequest);

  it("tem ao menos uma edição com preço público e outra sob medida", () => {
    // Se esta asserção cair, o resto do arquivo deixou de testar o que pretende:
    // uma lista vazia passaria por todos os laços abaixo sem verificar nada.
    expect(comPrecoPublico.length).toBeGreaterThan(0);
    expect(PLANS.some((plan) => plan.priceOnRequest)).toBe(true);
  });

  it.each(comPrecoPublico.map((plan) => [plan.name, plan] as const))(
    "%s cobre o custo com a franquia cheia",
    (_nome, plan) => {
      const custo = cenarioCheio(plan).totalCents;
      const receita = startingPriceCents(plan.key);

      expect(receita).toBeGreaterThan(custo);
    },
  );

  /**
   * O imposto é o que separa "cobre o custo" de "sobra dinheiro".
   *
   * A alíquota usada é a pior situação plausível do Simples para uma empresa de
   * software: Anexo V na primeira faixa, quando o Fator R fica abaixo de 28%. Com
   * Fator R cumprido, o Anexo III derruba para 6% e toda margem sobe quase dez
   * pontos — então aprovar aqui aprova nos dois regimes.
   */
  it.each(comPrecoPublico.map((plan) => [plan.name, plan] as const))(
    "%s não fica no prejuízo depois do imposto",
    (_nome, plan) => {
      const analise = analyzeMargin({
        costCents: cenarioCheio(plan).totalCents,
        revenueCents: startingPriceCents(plan.key),
        discountPct: 0,
        policy: MARGIN_BY_PLAN[plan.key],
        taxRatePct: 15.5,
      });

      expect(analise.status).not.toBe("prejuizo");
      expect(analise.grossProfitCents).toBeGreaterThan(0);
    },
  );

  /**
   * O uso típico é que precisa alcançar o piso.
   *
   * Metade da franquia é a régua: é o consumo de um cliente que dimensionou a
   * edição com folga, que é como uma tabela sadia é vendida. Se nem aí a margem
   * chega ao piso da política, o problema não é o cliente — é o preço.
   */
  it.each(comPrecoPublico.map((plan) => [plan.name, plan] as const))(
    "%s alcança o piso de margem no uso típico",
    (_nome, plan) => {
      const custo = estimateMonthlyCost({
        seats: plan.minSeats,
        contacts: Math.round(plan.includedContacts / 2),
        conversations: Math.round(plan.includedConversations / 2),
        emails: Math.round(plan.includedEmails / 2),
        aiReplies: Math.round(plan.includedAiReplies / 2),
        whatsappNumbers: plan.includedWhatsappNumbers,
        whatsappTemplates: Math.round(plan.includedWhatsappTemplates / 2),
      }).totalCents;

      const politica = MARGIN_BY_PLAN[plan.key];
      const analise = analyzeMargin({
        costCents: custo,
        revenueCents: startingPriceCents(plan.key),
        discountPct: 0,
        policy: politica,
        taxRatePct: 15.5,
      });

      expect(analise.marginPct).toBeGreaterThanOrEqual(politica.floorMarginPct);
    },
  );
});
