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
  metaCostMicros,
  metaEffectiveRateMicros,
  microsToCents,
  rateStaleness,
  ratesEffectiveAt,
} from "./meta-rates";
import { effectiveRate, fatorRPct, passthroughTaxDrag, resolveRegime, taxOnSale } from "./taxes";

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
    whatsappTemplates: 20_000,
  };

  it("soma as oito parcelas", () => {
    const cost = estimateMonthlyCost(base);
    expect(cost.lines).toHaveLength(8);
    expect(cost.totalCents).toBe(cost.lines.reduce((sum, line) => sum + line.totalCents, 0));
  });

  /**
   * O custo de despachar mensagem não inclui o que a Meta cobra.
   *
   * Somá-lo aqui contaria o repasse como custo sem contá-lo como receita, e a
   * margem despencaria em toda operação com WhatsApp — exatamente a distorção
   * que separar o repasse existe para evitar.
   */
  it("conta o despacho de mensagens sem embutir a tarifa da Meta", () => {
    const semEnvio = estimateMonthlyCost({ ...base, whatsappTemplates: 0 });
    const comEnvio = estimateMonthlyCost({ ...base, whatsappTemplates: 100_000 });

    const diferenca = comEnvio.totalCents - semEnvio.totalCents;
    expect(diferenca).toBe((100_000 / 1_000) * UNIT_COSTS.perThousandWhatsappTemplatesCents);

    // R$ 40 de despacho para cem mil mensagens. A Meta cobraria R$ 3.500 pelas
    // mesmas, se fossem de utilidade. O piso é uma ordem de grandeza: se o
    // custo de despacho chegasse a 10% da tarifa da Meta, o repasse teria
    // vazado para dentro do custo — que é o defeito que este teste procura, e
    // não o valor exato da estimativa.
    const tarifaMeta = microsToCents(metaCostMicros(CURRENT_META_RATES, "utilidade", 100_000));
    expect(diferenca).toBeLessThan(tarifaMeta / 10);
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

describe("Simples Nacional", () => {
  /**
   * A alíquota efetiva não é a nominal, e confundir as duas custa dinheiro nas
   * duas direções: precificar pela nominal deixa margem na mesa em toda
   * proposta; apurar pela nominal paga imposto a mais.
   */
  it("aplica a fórmula da alíquota efetiva, não a nominal da faixa", () => {
    // RBT12 de R$ 400 mil cai na terceira faixa: nominal 13,5%, dedução R$ 17.640.
    // (400.000 × 0,135 − 17.640) / 400.000 = 9,09%.
    const rate = effectiveRate(40_000_000, "simples_anexo_iii");

    expect(rate.nominalRatePct).toBe(13.5);
    expect(rate.effectiveRatePct).toBeCloseTo(9.09, 2);
  });

  it("a primeira faixa do Anexo III é 6% cheios, sem dedução", () => {
    const rate = effectiveRate(10_000_000, "simples_anexo_iii");
    expect(rate.effectiveRatePct).toBeCloseTo(6, 6);
  });

  /**
   * A escada é contínua: a parcela a deduzir existe justamente para que passar
   * de faixa não produza um salto. Sem ela, faturar um real a mais na virada
   * aumentaria o imposto em milhares — e a empresa aprenderia a parar de vender
   * em novembro.
   */
  it("não tem degrau na virada de faixa", () => {
    const antes = effectiveRate(18_000_000, "simples_anexo_iii").effectiveRatePct;
    const depois = effectiveRate(18_000_100, "simples_anexo_iii").effectiveRatePct;

    expect(Math.abs(depois - antes)).toBeLessThan(0.01);
    expect(depois).toBeGreaterThanOrEqual(antes);
  });

  it("crescer a receita nunca reduz a alíquota, até a quinta faixa", () => {
    let previous = 0;
    // Para na virada dos R$ 3,6 mi de propósito: dali em diante a composição do
    // DAS muda, e o degrau é tratado no teste seguinte.
    for (let rbt12 = 1_000_000; rbt12 <= 360_000_000; rbt12 += 5_000_000) {
      const current = effectiveRate(rbt12, "simples_anexo_iii").effectiveRatePct;
      expect(current).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = current;
    }
  });

  /**
   * A sexta faixa é a pegadinha da tabela, e ela quase entrou errada aqui.
   *
   * A fórmula devolve 15,00% na virada dos R$ 3,6 milhões contra 17,51% na
   * quinta faixa — e a leitura ingênua é que crescer barateia o imposto. Não
   * barateia: o que caiu foi o **DAS**, porque na sexta faixa o ISS sai dele e
   * passa a ser recolhido à parte. Somando o ISS municipal por fora, a carga
   * volta a subir, que é o que de fato acontece com o caixa.
   *
   * Este teste existe para que ninguém "conserte" o degrau removendo o ISS de
   * fora e reintroduza a promessa de que crescer é mais barato.
   */
  it("na sexta faixa o ISS sai do DAS, e a carga total continua subindo", () => {
    const quinta = effectiveRate(360_000_000, "simples_anexo_iii");
    const sexta = effectiveRate(360_000_100, "simples_anexo_iii");

    // O DAS realmente cai — não é erro de conta.
    expect(sexta.dasRatePct).toBeLessThan(quinta.dasRatePct);
    expect(sexta.dasRatePct).toBeCloseTo(15, 1);
    expect(quinta.issOutsideDasPct).toBe(0);

    // A carga total, não. É o que sai do caixa.
    expect(sexta.issOutsideDasPct).toBe(5);
    expect(sexta.effectiveRatePct).toBeGreaterThan(quinta.effectiveRatePct);
  });

  /**
   * O Fator R decide o anexo, e a diferença na primeira faixa é de quase dez
   * pontos — 6% contra 15,5%. Não é ajuste fino: é a margem inteira de uma
   * edição de entrada.
   */
  it("o Fator R decide o anexo no limite de 28%", () => {
    expect(resolveRegime(28_000_000, 100_000_000)).toBe("simples_anexo_iii");
    expect(resolveRegime(27_900_000, 100_000_000)).toBe("simples_anexo_v");
    expect(fatorRPct(28_000_000, 100_000_000)).toBeCloseTo(28, 6);

    const iii = effectiveRate(10_000_000, "simples_anexo_iii").effectiveRatePct;
    const v = effectiveRate(10_000_000, "simples_anexo_v").effectiveRatePct;
    expect(v - iii).toBeCloseTo(9.5, 6);
  });

  /**
   * O repasse é tributado, e este é o número que decide se a conta da Meta deve
   * ficar no nome do cliente.
   */
  it("tributa o repasse junto, e mede o prejuízo separado", () => {
    const tax = taxOnSale({
      grossRevenueCents: 500_000,
      passthroughCents: 150_000,
      rbt12Cents: 120_000_000,
      regime: "simples_anexo_iii",
    });

    expect(tax.taxCents).toBe(Math.round((500_000 * tax.effectiveRatePct) / 100));
    expect(tax.passthroughTaxCents).toBe(Math.round((150_000 * tax.effectiveRatePct) / 100));
    expect(tax.netRevenueCents).toBe(500_000 - tax.taxCents);
    // Doze meses do imposto sobre dinheiro que não é nosso.
    expect(passthroughTaxDrag(150_000, tax.effectiveRatePct)).toBe(tax.passthroughTaxCents * 12);
  });

  /** Receita zero devolve a alíquota da primeira faixa, não divisão por zero. */
  it("responde para receita zero sem quebrar", () => {
    const rate = effectiveRate(0, "simples_anexo_iii");
    expect(rate.effectiveRatePct).toBe(6);
    expect(Number.isFinite(rate.effectiveRatePct)).toBe(true);
  });
});

describe("margem depois do imposto", () => {
  const policy = MARGIN_BY_PLAN.profissional;

  /** Sem contexto tributário, o resultado é idêntico ao de antes de existir imposto. */
  it("sem alíquota informada, a conta é a de sempre", () => {
    const analysis = analyzeMargin({
      costCents: 30_000,
      revenueCents: 100_000,
      discountPct: 0,
      policy,
    });

    expect(analysis.taxCents).toBe(0);
    expect(analysis.netRevenueCents).toBe(100_000);
    expect(analysis.marginPct).toBeCloseTo(70, 6);
  });

  it("o imposto sai da receita antes do custo, e derruba a margem", () => {
    const semImposto = analyzeMargin({
      costCents: 30_000,
      revenueCents: 100_000,
      discountPct: 0,
      policy,
    });
    const comImposto = analyzeMargin({
      costCents: 30_000,
      revenueCents: 100_000,
      discountPct: 0,
      policy,
      taxRatePct: 13,
    });

    expect(comImposto.taxCents).toBe(13_000);
    expect(comImposto.netRevenueCents).toBe(87_000);
    expect(comImposto.marginPct).toBeCloseTo(57, 6);
    expect(semImposto.marginPct - comImposto.marginPct).toBeCloseTo(13, 6);
  });

  /**
   * O imposto do repasse não escala com o desconto.
   *
   * O repasse não é descontável, então o imposto sobre ele é parcela fixa.
   * Tratá-lo como proporcional à receita faria o cálculo de folga encontrar
   * desconto que não existe.
   */
  it("o imposto do repasse reduz a folga de desconto como parcela fixa", () => {
    const semRepasse = analyzeMargin({
      costCents: 30_000,
      revenueCents: 100_000,
      discountPct: 0,
      policy,
      taxRatePct: 13,
    });
    const comRepasse = analyzeMargin({
      costCents: 30_000,
      revenueCents: 100_000,
      discountPct: 0,
      policy,
      taxRatePct: 13,
      passthroughTaxCents: 5_000,
    });

    expect(comRepasse.discountAtFloorPct).toBeLessThan(semRepasse.discountAtFloorPct);
    expect(comRepasse.grossProfitCents).toBe(semRepasse.grossProfitCents - 5_000);
  });

  /**
   * No desconto devolvido por `discountAtFloorPct`, a margem tem de cair
   * exatamente no piso. É a verificação que prova a álgebra da fórmula com
   * imposto — errar o isolamento produz um número plausível e errado.
   */
  it("no desconto máximo a margem cai exatamente no piso", () => {
    const revenueCents = 200_000;
    const costCents = 60_000;
    const taxRatePct = 13;
    const passthroughTaxCents = 4_000;

    const analysis = analyzeMargin({
      costCents,
      revenueCents,
      discountPct: 0,
      policy,
      taxRatePct,
      passthroughTaxCents,
    });

    const x = analysis.discountAtFloorPct / 100;
    const receitaComDesconto = revenueCents * (1 - x);
    const imposto = receitaComDesconto * (taxRatePct / 100) + passthroughTaxCents;
    const lucro = receitaComDesconto - imposto - costCents;

    expect((lucro / receitaComDesconto) * 100).toBeCloseTo(policy.floorMarginPct, 6);
  });
});

describe("tabela da Meta", () => {
  it("a vigente é a mais recente da lista", () => {
    expect(CURRENT_META_RATES).toBe(META_RATE_TABLES[0]);
  });

  /** Mensagem de serviço é gratuita. Cobrá-la faria a conta não bater com a fatura. */
  it("serviço é sempre zero", () => {
    for (const table of META_RATE_TABLES) {
      expect(table.ratesMicros.servico).toBe(0);
    }
  });

  /**
   * A tarifa transcrita da Meta, em micros.
   *
   * O teste fixa o número de propósito: foi um valor errado por seis vezes em
   * autenticação que motivou trocar a unidade, e ele passou meses sem ser
   * notado porque `R$ 0,20` é um preço plausível. Se a Meta reajustar, este
   * teste quebra — e quebrar é o comportamento desejado, porque obriga quem
   * reajusta a conferir a fonte em vez de ajustar um número solto.
   */
  it("guarda a tarifa do Brasil com as quatro casas que a Meta publica", () => {
    expect(CURRENT_META_RATES.ratesMicros).toEqual({
      marketing: 321_700,
      utilidade: 35_000,
      autenticacao: 35_000,
      servico: 0,
    });
  });

  it("a defasagem é medida da conferência, não da vigência", () => {
    const table = META_RATE_TABLES[0]!;
    // Conferida em 14/08/2026 — a vigência é anterior, em 01/07/2026.
    expect(rateStaleness(table, "2026-08-20T12:00:00-03:00").status).toBe("atual");
    expect(rateStaleness(table, "2026-11-20T12:00:00-03:00").status).toBe("revisar");
    expect(rateStaleness(table, "2027-04-20T12:00:00-03:00").status).toBe("vencida");
  });

  /**
   * A escada da Meta é progressiva, como a de contatos.
   *
   * Aplicar a faixa final ao volume inteiro produziria o degrau em que mandar
   * mais mensagens reduz a conta — o mesmo defeito que a tabela de contatos já
   * tem teste para não ter.
   */
  it("aplica a escada de volume por fatia, e crescer nunca reduz a conta", () => {
    const table = CURRENT_META_RATES;

    // Dentro da primeira faixa: tarifa cheia, sem desconto nenhum.
    expect(metaCostMicros(table, "utilidade", 100_000)).toBe(100_000 * 35_000);

    // Uma mensagem acima do teto: as 250 mil primeiras à taxa cheia, uma na
    // faixa seguinte. Se fosse por degrau único, o total cairia 5% de uma vez.
    expect(metaCostMicros(table, "utilidade", 250_001)).toBe(250_000 * 35_000 + 33_300);

    // Marketing não tem escada: a Meta não oferece.
    expect(metaCostMicros(table, "marketing", 9_000_000)).toBe(9_000_000 * 321_700);

    let previous = 0;
    for (let messages = 0; messages <= 3_000_000; messages += 50_000) {
      const current = metaCostMicros(table, "utilidade", messages);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  /**
   * A tarifa média é o que explica a linha depois que a escada entrou.
   *
   * Mostrar "R$ 0,0350 por mensagem" ao lado de um total que saiu da escada é a
   * conta que o cliente refaz na calculadora e não fecha.
   */
  it("devolve a tarifa média efetiva, e ela cai depois da primeira faixa", () => {
    const table = CURRENT_META_RATES;

    expect(metaEffectiveRateMicros(table, "utilidade", 100_000)).toBe(35_000);
    expect(metaEffectiveRateMicros(table, "utilidade", 1_000_000)).toBeLessThan(35_000);
    // Volume zero cai na taxa listada — não em divisão por zero.
    expect(metaEffectiveRateMicros(table, "utilidade", 0)).toBe(35_000);
  });

  /**
   * `microsToCents` arredonda para cima, mas 3,5 centavos exatos não podem
   * virar 4 por erro de ponto flutuante — `35_000 / 10_000` sai
   * `3.5000000000000004` em algumas contas.
   */
  it("converte micros em centavos sem inventar centavo por ponto flutuante", () => {
    expect(microsToCents(0)).toBe(0);
    expect(microsToCents(10_000)).toBe(1);
    expect(microsToCents(35_000)).toBe(4); // 3,5 centavos: para cima, de propósito
    expect(microsToCents(320_000)).toBe(32); // 32 centavos exatos: continua 32
  });

  /**
   * Orçamento assinado em maio precisa continuar explicável em setembro. Sem
   * histórico, a única resposta para "por que este número?" é "mudou".
   *
   * O histórico está vazio hoje: as tabelas anteriores nunca foram transcritas
   * da Meta e foram removidas em vez de mantidas como ficção. Data anterior à
   * primeira transcrição cai na vigente, que é o único comportamento honesto
   * disponível — e é o que este teste fixa.
   */
  it("recupera a tabela que valia numa data, e recua para a vigente sem histórico", () => {
    const atual = ratesEffectiveAt("2026-08-10T00:00:00-03:00");
    expect(atual.effectiveFrom).toBe("2026-07-01");

    expect(ratesEffectiveAt("2026-01-10T00:00:00-03:00")).toBe(CURRENT_META_RATES);
  });
});
