/**
 * Testes do simulador de preço.
 *
 * O alvo são os erros que não geram exceção e ninguém percebe olhando a tela:
 * escada de contatos aplicada por degrau único, desconto incidindo sobre
 * repasse de provedor, franquia contada duas vezes, edição recomendada que não
 * comporta o time. Todos produzem um número plausível — e errado.
 */

import { describe, expect, it } from "vitest";

import {
  DEFAULT_QUOTE_INPUT,
  calculateQuote,
  contactOverageCents,
  recommendPlan,
} from "./calculator";
import type { QuoteInput } from "./calculator";
import { MAX_SELF_SERVICE_DISCOUNT_PCT, MONTHLY_PREMIUM_PCT, PLAN_BY_KEY } from "./catalog";
import { SIZE_BAND_BY_KEY, resolveCompanySize } from "./setup";
import type { SetupInput } from "./setup";

/**
 * Implantação mínima, em microempresa.
 *
 * Existe como base dos testes de composição porque é o único enquadramento sem
 * adicional de porte — qualquer outro acrescenta uma linha e quebraria a
 * verificação de "parcela zerada não vira linha" por um motivo que nada tem a
 * ver com o que ela mede.
 */
const MICRO_SETUP: Omit<SetupInput, "planKey"> = {
  whatsappNumbers: 1,
  integrations: 0,
  peopleToTrain: 0,
  contactsToMigrate: 0,
  flows: 0,
  annualRevenueCents: 20_000_000,
  employees: 10,
  businessUnits: 1,
  regulatedSector: false,
};

function input(patch: Partial<QuoteInput> = {}): QuoteInput {
  return { ...DEFAULT_QUOTE_INPUT, ...patch };
}

/** Base sem consumo nenhum: isola a assinatura do resto da conta. */
const EMPTY_USAGE = {
  contacts: 0,
  conversations: 0,
  emails: 0,
  aiReplies: 0,
  whatsapp: { marketing: 0, utilidade: 0, autenticacao: 0, servico: 0 },
  addons: [],
  includeSetup: false,
  discountPct: 0,
} satisfies Partial<QuoteInput>;

describe("assinatura e assentos", () => {
  it("cobra assinatura mais assento no compromisso anual", () => {
    const plan = PLAN_BY_KEY.profissional;
    const result = calculateQuote(input({ ...EMPTY_USAGE, planKey: "profissional", seats: 8 }));

    expect(result.monthlyTotalCents).toBe(plan.platformFeeCents + 8 * plan.seatPriceCents);
  });

  it("acrescenta o prêmio do mensal sobre assinatura e assento", () => {
    const anual = calculateQuote(input({ ...EMPTY_USAGE, billing: "anual", seats: 8 }));
    const mensal = calculateQuote(input({ ...EMPTY_USAGE, billing: "mensal", seats: 8 }));

    expect(mensal.monthlyTotalCents).toBe(
      Math.round((anual.monthlyTotalCents * (100 + MONTHLY_PREMIUM_PCT)) / 100),
    );
  });

  it("eleva ao mínimo de assentos da edição e avisa", () => {
    const result = calculateQuote(input({ ...EMPTY_USAGE, planKey: "performance", seats: 4 }));

    expect(result.billedSeats).toBe(PLAN_BY_KEY.performance.minSeats);
    expect(result.warnings.some((w) => w.severity === "informacao")).toBe(true);
  });

  it("recusa time acima do teto da edição", () => {
    const result = calculateQuote(input({ ...EMPTY_USAGE, planKey: "essencial", seats: 40 }));

    expect(result.warnings.some((w) => w.severity === "erro")).toBe(true);
  });

  it("não cobra assento na edição de colaboradores ilimitados", () => {
    const plan = PLAN_BY_KEY.corporativo;
    const result = calculateQuote(input({ ...EMPTY_USAGE, planKey: "corporativo", seats: 900 }));

    expect(result.unlimitedSeats).toBe(true);
    expect(result.monthlyTotalCents).toBe(plan.platformFeeCents);
  });
});

describe("escada de contatos", () => {
  it("não cobra nada dentro da franquia", () => {
    const plan = PLAN_BY_KEY.profissional;
    expect(contactOverageCents(plan, plan.includedContacts)).toBe(0);
  });

  it("é progressiva: cada fatia paga o preço da própria faixa", () => {
    const plan = PLAN_BY_KEY.profissional;
    // Franquia 10 mil; primeira faixa até 25 mil; segunda até 100 mil.
    const contacts = 40_000;
    const primeiraFaixa =
      ((25_000 - plan.includedContacts) / 1000) * plan.contactTiers[0].pricePerThousandCents;
    const segundaFaixa = ((contacts - 25_000) / 1000) * plan.contactTiers[1].pricePerThousandCents;

    expect(contactOverageCents(plan, contacts)).toBe(primeiraFaixa + segundaFaixa);
  });

  it("crescer a base nunca reduz a conta", () => {
    const plan = PLAN_BY_KEY.profissional;
    let previous = 0;

    for (let contacts = 0; contacts <= 300_000; contacts += 7_500) {
      const current = contactOverageCents(plan, contacts);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});

describe("repasse do WhatsApp", () => {
  it("não cobra pela categoria de serviço", () => {
    const semServico = calculateQuote(
      input({
        ...EMPTY_USAGE,
        whatsapp: { marketing: 0, utilidade: 0, autenticacao: 0, servico: 0 },
      }),
    );
    const comServico = calculateQuote(
      input({
        ...EMPTY_USAGE,
        whatsapp: { marketing: 0, utilidade: 0, autenticacao: 0, servico: 50_000 },
      }),
    );

    expect(comServico.monthlyTotalCents).toBe(semServico.monthlyTotalCents);
  });

  it("separa o repasse do total, para conferência contra a fatura da Meta", () => {
    const result = calculateQuote(
      input({
        ...EMPTY_USAGE,
        whatsapp: { marketing: 1_000, utilidade: 2_000, autenticacao: 0, servico: 9_000 },
      }),
    );

    const repasseNasLinhas = result.lines
      .filter((line) => line.kind === "repasse")
      .reduce((sum, line) => sum + line.totalCents, 0);

    expect(result.passthroughCents).toBe(repasseNasLinhas);
    expect(result.passthroughCents).toBeGreaterThan(0);
  });

  /**
   * O repasse é o número que o cliente confere contra a fatura da Meta.
   *
   * Fixar o valor esperado a partir dos micros da tabela é o que impede a volta
   * do defeito que motivou a troca de unidade: em centavos inteiros,
   * `R$ 0,0350` virava 3 ou 4, e num disparo grande a diferença passava de
   * centena de reais sem que nada na tela indicasse erro.
   */
  it("cobra a tarifa da Meta com as quatro casas, sem arredondar por mensagem", () => {
    const result = calculateQuote(
      input({
        ...EMPTY_USAGE,
        whatsapp: { marketing: 10_000, utilidade: 0, autenticacao: 0, servico: 0 },
      }),
    );

    // 10.000 × R$ 0,3217 = R$ 3.217,00. Arredondando a tarifa para R$ 0,32 por
    // mensagem, o total sairia R$ 3.200 — R$ 17 a menos do que a Meta cobra.
    expect(result.passthroughCents).toBe(321_700);
  });
});

describe("taxa de envio da plataforma", () => {
  /** É o que faz o plano ser fechado: a operação típica cabe na assinatura. */
  it("não cobra dentro da franquia de mensagens de modelo da edição", () => {
    const plan = PLAN_BY_KEY.profissional;
    const result = calculateQuote(
      input({
        ...EMPTY_USAGE,
        planKey: "profissional",
        whatsapp: {
          marketing: plan.includedWhatsappTemplates,
          utilidade: 0,
          autenticacao: 0,
          servico: 0,
        },
      }),
    );

    expect(result.whatsappTemplateMessages).toBe(plan.includedWhatsappTemplates);
    expect(result.whatsappPlatformFeeCents).toBe(0);
  });

  it("cobra só o excedente, à tarifa da edição", () => {
    const plan = PLAN_BY_KEY.profissional;
    const excedente = 5_000;
    const result = calculateQuote(
      input({
        ...EMPTY_USAGE,
        planKey: "profissional",
        whatsapp: {
          marketing: plan.includedWhatsappTemplates + excedente,
          utilidade: 0,
          autenticacao: 0,
          servico: 0,
        },
      }),
    );

    // 5.000 × R$ 0,03 = R$ 150,00.
    expect(result.whatsappPlatformFeeCents).toBe(
      Math.ceil((excedente * plan.whatsappTemplateFeeMicros) / 10_000),
    );
  });

  /**
   * Mensagem de serviço já foi cobrada como conversa tratada.
   *
   * Contá-la aqui faturaria o mesmo atendimento duas vezes com dois nomes — e o
   * cliente descobre, porque as duas linhas ficam uma embaixo da outra.
   */
  it("não conta mensagem de serviço na franquia nem na taxa", () => {
    const plan = PLAN_BY_KEY.essencial;
    const result = calculateQuote(
      input({
        ...EMPTY_USAGE,
        planKey: "essencial",
        whatsapp: {
          marketing: 0,
          utilidade: 0,
          autenticacao: 0,
          servico: plan.includedWhatsappTemplates * 10,
        },
      }),
    );

    expect(result.whatsappTemplateMessages).toBe(0);
    expect(result.whatsappPlatformFeeCents).toBe(0);
  });

  /**
   * A taxa é receita nossa; o repasse não é.
   *
   * Se a taxa caísse dentro de `passthroughCents`, ela sairia da receita na
   * análise de margem — e a margem sobre WhatsApp, que é justamente o que este
   * modelo existe para ter, apareceria como zero.
   */
  it("entra na receita da análise de margem, ao contrário do repasse", () => {
    const plan = PLAN_BY_KEY.profissional;
    const semExcedente = calculateQuote(
      input({
        ...EMPTY_USAGE,
        planKey: "profissional",
        whatsapp: {
          marketing: plan.includedWhatsappTemplates,
          utilidade: 0,
          autenticacao: 0,
          servico: 0,
        },
      }),
    );
    const comExcedente = calculateQuote(
      input({
        ...EMPTY_USAGE,
        planKey: "profissional",
        whatsapp: {
          marketing: plan.includedWhatsappTemplates + 100_000,
          utilidade: 0,
          autenticacao: 0,
          servico: 0,
        },
      }),
    );

    const ganho = comExcedente.margin.revenueCents - semExcedente.margin.revenueCents;
    expect(ganho).toBe(comExcedente.whatsappPlatformFeeCents);
    expect(comExcedente.whatsappPlatformFeeCents).toBeGreaterThan(0);
  });

  /** Sem franquia consumida, a linha existe mesmo assim — como as outras de consumo. */
  it("sempre desenha a linha, para a franquia ser visível antes de ser estourada", () => {
    const result = calculateQuote(input({ ...EMPTY_USAGE }));
    const linha = result.lines.find((line) => line.key === "whatsapp_plataforma");

    expect(linha).toBeDefined();
    expect(linha!.included).toBe(true);
    expect(linha!.kind).toBe("consumo");
  });
});

describe("desconto", () => {
  it("não incide sobre o repasse de provedor", () => {
    const whatsapp = { marketing: 10_000, utilidade: 0, autenticacao: 0, servico: 0 };
    const semDesconto = calculateQuote(input({ ...EMPTY_USAGE, whatsapp, discountPct: 0 }));
    const comDesconto = calculateQuote(input({ ...EMPTY_USAGE, whatsapp, discountPct: 10 }));

    const baseDescontavel = semDesconto.monthlySubtotalCents - semDesconto.passthroughCents;
    expect(comDesconto.discountCents).toBe(Math.floor((baseDescontavel * 10) / 100));
  });

  it("limita o desconto de autoatendimento e avisa", () => {
    const result = calculateQuote(input({ ...EMPTY_USAGE, discountPct: 60 }));

    expect(result.discountPct).toBe(MAX_SELF_SERVICE_DISCOUNT_PCT);
    expect(result.warnings.some((w) => w.severity === "alerta")).toBe(true);
  });
});

describe("cobrança única", () => {
  it("mantém implantação fora do recorrente e dentro da primeira fatura", () => {
    const semSetup = calculateQuote(input({ ...EMPTY_USAGE, includeSetup: false }));
    const comSetup = calculateQuote(input({ ...EMPTY_USAGE, includeSetup: true }));

    expect(comSetup.monthlyTotalCents).toBe(semSetup.monthlyTotalCents);
    expect(comSetup.oneTimeCents).toBe(comSetup.setup?.totalCents);
    expect(comSetup.firstInvoiceCents).toBe(comSetup.monthlyTotalCents + comSetup.oneTimeCents);
    expect(comSetup.annualTotalCents).toBe(comSetup.monthlyTotalCents * 12);
  });

  /**
   * A implantação deixou de ser um valor fixo por edição e passou a ser composta
   * por porte. A base da edição continua sendo o piso — sem ela, uma implantação
   * mínima sairia por um valor que não paga a hora de quem a executa.
   */
  it("compõe a implantação a partir da base da edição", () => {
    const base = PLAN_BY_KEY[DEFAULT_QUOTE_INPUT.planKey].setupCents;
    const result = calculateQuote(input({ ...EMPTY_USAGE, includeSetup: true }));

    expect(result.setup).toBeDefined();
    expect(result.setup!.totalCents).toBeGreaterThanOrEqual(base);
    expect(result.setup!.lines[0]?.key).toBe("base");
    expect(result.setup!.lines[0]?.totalCents).toBe(base);
  });

  it("cresce com o porte, e a composição explica o porquê", () => {
    const pequena = calculateQuote(
      input({
        ...EMPTY_USAGE,
        includeSetup: true,
        setup: {
          ...MICRO_SETUP,
          peopleToTrain: 5,
        },
      }),
    );

    const grande = calculateQuote(
      input({
        ...EMPTY_USAGE,
        includeSetup: true,
        setup: {
          ...MICRO_SETUP,
          whatsappNumbers: 4,
          integrations: 2,
          peopleToTrain: 40,
          contactsToMigrate: 80_000,
          flows: 6,
        },
      }),
    );

    expect(grande.setup!.totalCents).toBeGreaterThan(pequena.setup!.totalCents);
    expect(grande.setup!.lines.length).toBeGreaterThan(pequena.setup!.lines.length);
    // 40 pessoas em turmas de 12 são 4 turmas, não 3,33.
    expect(grande.setup!.trainingGroups).toBe(4);
  });

  /** Parcela zerada não vira linha: "Integrações: R$ 0" só gera pergunta. */
  it("não lista parcela zerada", () => {
    const result = calculateQuote(
      input({ ...EMPTY_USAGE, includeSetup: true, setup: MICRO_SETUP }),
    );

    expect(result.setup!.lines.map((line) => line.key)).toEqual(["base"]);
  });
});

describe("implantação por porte da empresa", () => {
  /**
   * O porte é o **maior** dos dois critérios, e a linha diz qual mandou.
   *
   * Uma distribuidora com faturamento alto e vinte funcionários é complexa por
   * um motivo; uma rede de lojas com faturamento médio e quatrocentos, por
   * outro. Tomar só um dos dois subdimensionaria metade dos projetos.
   */
  it("enquadra pelo critério mais exigente e declara qual foi", () => {
    const porFaturamento = resolveCompanySize(8_000_000_000, 12);
    expect(porFaturamento.band.key).toBe("media_grande");
    expect(porFaturamento.drivenBy).toBe("faturamento");

    const porGente = resolveCompanySize(20_000_000, 800);
    expect(porGente.band.key).toBe("media_grande");
    expect(porGente.drivenBy).toBe("colaboradores");

    const iguais = resolveCompanySize(20_000_000, 10);
    expect(iguais.band.key).toBe("micro");
    expect(iguais.drivenBy).toBe("ambos");
  });

  /** Microempresa é o porte para o qual a base foi dimensionada. */
  it("não cobra adicional de porte da microempresa", () => {
    const result = calculateQuote(
      input({ ...EMPTY_USAGE, includeSetup: true, setup: MICRO_SETUP }),
    );

    expect(result.setup!.lines.some((line) => line.key === "porte")).toBe(false);
    expect(result.setup!.size.band.key).toBe("micro");
  });

  /**
   * O adicional incide só sobre a base.
   *
   * Aplicá-lo ao total cobraria porte em cima da migração de contatos, que é
   * trabalho de máquina — e produziria a conta em que importar cem mil contatos
   * numa empresa grande custa o dobro de importar cem mil numa pequena.
   */
  it("aplica o adicional de porte sobre a base, não sobre o total", () => {
    const base = PLAN_BY_KEY[DEFAULT_QUOTE_INPUT.planKey].setupCents;
    const result = calculateQuote(
      input({
        ...EMPTY_USAGE,
        includeSetup: true,
        setup: {
          ...MICRO_SETUP,
          annualRevenueCents: 50_000_000_000,
          contactsToMigrate: 100_000,
        },
      }),
    );

    const porte = result.setup!.lines.find((line) => line.key === "porte");
    const banda = SIZE_BAND_BY_KEY.grande;

    expect(result.setup!.size.band.key).toBe("grande");
    expect(porte!.totalCents).toBe(Math.round((base * banda.surchargePct) / 100));
  });

  it("cobra unidade adicional e conformidade de setor regulado", () => {
    const result = calculateQuote(
      input({
        ...EMPTY_USAGE,
        includeSetup: true,
        setup: { ...MICRO_SETUP, businessUnits: 4, regulatedSector: true },
      }),
    );

    const chaves = result.setup!.lines.map((line) => line.key);
    expect(chaves).toContain("unidades");
    expect(chaves).toContain("conformidade");
    // Quatro unidades, três adicionais: a primeira já está na base.
    expect(result.setup!.lines.find((line) => line.key === "unidades")!.quantity).toBe(3);
  });
});

describe("recomendação de edição", () => {
  it("nunca recomenda edição que não comporta o time", () => {
    const recomendada = recommendPlan(input({ seats: 120, planKey: "corporativo" }));
    const plan = PLAN_BY_KEY[recomendada.planKey];

    expect(plan.maxSeats === null || plan.maxSeats >= 120).toBe(true);
  });

  it("compara pelo total, não pelo preço de tabela", () => {
    // Volume alto com time pequeno: a edição cara na assinatura vence pela
    // franquia. Se a comparação fosse por preço de tabela, viria "essencial".
    const recomendada = recommendPlan(
      input({
        seats: 6,
        planKey: "essencial",
        contacts: 80_000,
        conversations: 40_000,
        emails: 300_000,
        aiReplies: 20_000,
      }),
    );

    expect(recomendada.planKey).not.toBe("essencial");
  });
});
