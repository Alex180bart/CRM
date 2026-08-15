/**
 * Imposto sobre a receita da Elora.
 *
 * ## Por que isto não estava na conta, e por que faltava
 *
 * `costs.ts` respondia "quanto custa entregar" e `catalog.ts`, "quanto
 * cobramos". Faltava o pedaço que sai antes de sobrar: no Simples Nacional o
 * imposto incide sobre a **receita bruta**, não sobre o lucro. Uma margem de 65%
 * calculada sem ele é uma margem de 65% que não existe — e a diferença aparece
 * na apuração do mês, quando a venda já foi feita e o desconto já foi dado.
 *
 * ## O preço de tabela é com imposto embutido
 *
 * Decisão comercial, e ela define a direção da conta: `R$ 399` é o que sai na
 * fatura, e o imposto sai de dentro desse valor. Não se soma nada ao preço; o
 * que se faz é **descontar** o imposto da receita antes de comparar com o custo.
 *
 * É por isso que `analyzeMargin` passou a receber a receita já líquida, e não a
 * bruta. Somar o imposto ao preço seria o outro modelo — legítimo, e é para onde
 * a reforma empurra o mercado —, mas exigiria mudar a fatura, não só o cálculo.
 *
 * ## A armadilha do repasse, e ela é cara
 *
 * O Simples tributa **faturamento**, sem deduzir custo. Então cada real de
 * repasse da Meta que passa pela nossa nota é receita tributada com margem zero:
 * paga imposto e não sobra nada para pagá-lo. Pior, ele **empurra a RBT12 para
 * cima** e eleva a alíquota efetiva de toda a receita, inclusive da que tem
 * margem.
 *
 * `passthroughTaxDrag` mede exatamente esse prejuízo. As duas saídas conhecidas
 * são o cliente ter a conta da Meta no nome dele (a Meta fatura direto, e o
 * repasse nunca entra na nossa nota) ou embutir o imposto na taxa da plataforma.
 * A escolha é comercial; o cálculo existe para ela ser feita com número.
 *
 * ## O que este arquivo deliberadamente não faz
 *
 * Não modela a transição da reforma. Em 2026 o optante pelo Simples continua
 * recolhendo IBS e CBS **dentro do DAS**, e a alíquota-teste de 1% não muda o
 * que ele paga. O que muda de verdade é a opção de recolher IBS/CBS **fora** do
 * Simples para gerar crédito cheio ao cliente — decisão estratégica de quem
 * vende para empresa em Lucro Real, e que altera a nota, não esta função.
 * Fingir modelá-la produziria um número plausível e errado.
 *
 * Fonte das tabelas: Lei Complementar 123/2006, Anexos III e V.
 */

/* Tabelas do Simples ------------------------------------------------------------- */

export type TaxRegime = "simples_anexo_iii" | "simples_anexo_v";

export interface SimplesBracket {
  /** Teto da faixa de receita bruta em 12 meses, em centavos. `null` é a última. */
  upTo: number | null;
  /** Alíquota nominal da faixa, em pontos percentuais. */
  nominalRatePct: number;
  /** Parcela a deduzir, em centavos. É o que torna a escada contínua. */
  deductionCents: number;
  /**
   * Na sexta faixa, **o ISS sai do DAS** e é recolhido à parte.
   *
   * É a pegadinha da tabela, e ela inverte o sinal do resultado se passar
   * despercebida: a fórmula da sexta faixa devolve 15,00% na virada dos
   * R$ 3,6 milhões, contra 17,51% na quinta — parece que crescer barateia o
   * imposto. Não barateia: o que caiu foi o **DAS**, porque o ISS deixou de
   * estar dentro dele. Somando o ISS municipal por fora, a conta volta a subir.
   *
   * Sem este campo, o modelo prometeria uma queda de imposto justamente na
   * faixa em que a empresa mais precisa de previsão.
   */
  issOutsideDas?: boolean;
}

/**
 * Alíquota de ISS usada quando ele sai do DAS.
 *
 * Varia por município entre o piso constitucional de 2% e o teto de 5%. O padrão
 * é o **teto**, de propósito: numa régua de margem, errar para cima produz uma
 * proposta conservadora, e errar para baixo produz uma venda que não fecha a
 * conta. Ao confirmar a alíquota do município da empresa, troque aqui.
 */
export const DEFAULT_ISS_RATE_PCT = 5;

/**
 * Anexo III — serviços, para quem cumpre o Fator R.
 *
 * É onde o SaaS com equipe própria cai: a folha é alta o bastante para que a
 * razão folha/receita passe de 28%, e a alíquota começa em 6% em vez de 15,5%.
 */
export const SIMPLES_ANEXO_III: SimplesBracket[] = [
  { upTo: 18_000_000, nominalRatePct: 6.0, deductionCents: 0 },
  { upTo: 36_000_000, nominalRatePct: 11.2, deductionCents: 936_000 },
  { upTo: 72_000_000, nominalRatePct: 13.5, deductionCents: 1_764_000 },
  { upTo: 180_000_000, nominalRatePct: 16.0, deductionCents: 3_564_000 },
  { upTo: 360_000_000, nominalRatePct: 21.0, deductionCents: 12_564_000 },
  { upTo: null, nominalRatePct: 33.0, deductionCents: 64_800_000, issOutsideDas: true },
];

/**
 * Anexo V — o mesmo serviço, sem Fator R.
 *
 * Existe aqui porque o Fator R não é permanente: contratar por PJ, terceirizar
 * o time ou simplesmente crescer a receita mais rápido que a folha derruba a
 * razão abaixo de 28% e joga a empresa inteira para cá, do mês para o seguinte.
 * Na primeira faixa a diferença é de 6% para 15,5% — quase dez pontos de margem
 * que somem sem nenhuma mudança no produto nem no preço.
 */
export const SIMPLES_ANEXO_V: SimplesBracket[] = [
  { upTo: 18_000_000, nominalRatePct: 15.5, deductionCents: 0 },
  { upTo: 36_000_000, nominalRatePct: 18.0, deductionCents: 450_000 },
  { upTo: 72_000_000, nominalRatePct: 19.5, deductionCents: 990_000 },
  { upTo: 180_000_000, nominalRatePct: 20.5, deductionCents: 1_710_000 },
  { upTo: 360_000_000, nominalRatePct: 23.0, deductionCents: 6_210_000 },
  { upTo: null, nominalRatePct: 30.5, deductionCents: 54_000_000, issOutsideDas: true },
];

export const BRACKETS_BY_REGIME: Record<TaxRegime, SimplesBracket[]> = {
  simples_anexo_iii: SIMPLES_ANEXO_III,
  simples_anexo_v: SIMPLES_ANEXO_V,
};

export const REGIME_LABEL: Record<TaxRegime, string> = {
  simples_anexo_iii: "Simples Nacional — Anexo III",
  simples_anexo_v: "Simples Nacional — Anexo V",
};

/** Teto de receita bruta em 12 meses do Simples Nacional, em centavos. */
export const SIMPLES_CEILING_CENTS = 480_000_000;

/** Razão folha/receita a partir da qual o serviço é tributado pelo Anexo III. */
export const FATOR_R_THRESHOLD_PCT = 28;

/* Alíquota efetiva ---------------------------------------------------------------- */

export interface EffectiveRate {
  regime: TaxRegime;
  bracketIndex: number;
  nominalRatePct: number;
  /** A parcela que sai no DAS: `(RBT12 × nominal − dedução) / RBT12`. */
  dasRatePct: number;
  /** ISS recolhido fora do DAS. Zero fora da sexta faixa. */
  issOutsideDasPct: number;
  /** DAS mais ISS por fora. É a carga que de fato sai da receita. */
  effectiveRatePct: number;
  /** `true` quando a RBT12 passou do teto do Simples. */
  aboveCeiling: boolean;
}

/**
 * A alíquota que se paga, dada a receita bruta dos últimos doze meses.
 *
 * **Não é a alíquota da faixa.** A nominal existe para compor a fórmula com a
 * parcela a deduzir; usá-la direto superestima o imposto em vários pontos —
 * numa RBT12 de R$ 400 mil, a nominal é 13,5% e a efetiva, 9,1%. Precificar pela
 * nominal deixaria dinheiro na mesa em toda proposta.
 *
 * Receita zero devolve a alíquota da primeira faixa em vez de dividir por zero.
 * É o que faz sentido para quem está começando: é a que ele vai pagar.
 */
export function effectiveRate(
  rbt12Cents: number,
  regime: TaxRegime,
  issRatePct: number = DEFAULT_ISS_RATE_PCT,
): EffectiveRate {
  const brackets = BRACKETS_BY_REGIME[regime];
  const rbt12 = Math.max(0, rbt12Cents);

  if (rbt12 === 0) {
    const first = brackets[0]!;
    return {
      regime,
      bracketIndex: 0,
      nominalRatePct: first.nominalRatePct,
      dasRatePct: first.nominalRatePct,
      issOutsideDasPct: 0,
      effectiveRatePct: first.nominalRatePct,
      aboveCeiling: false,
    };
  }

  const index = brackets.findIndex((bracket) => bracket.upTo === null || rbt12 <= bracket.upTo);
  const bracket = brackets[index]!;

  const dasRatePct = Math.max(
    0,
    (((rbt12 * bracket.nominalRatePct) / 100 - bracket.deductionCents) / rbt12) * 100,
  );
  const issOutsideDasPct = bracket.issOutsideDas ? Math.max(0, issRatePct) : 0;

  return {
    regime,
    bracketIndex: index,
    nominalRatePct: bracket.nominalRatePct,
    dasRatePct,
    issOutsideDasPct,
    effectiveRatePct: dasRatePct + issOutsideDasPct,
    aboveCeiling: rbt12 > SIMPLES_CEILING_CENTS,
  };
}

/**
 * O regime que vale, dado o Fator R.
 *
 * Folha de doze meses sobre receita de doze meses. Igual ou acima de 28%, Anexo
 * III; abaixo, Anexo V. A conta é do mês, não do ano: a razão é recalculada a
 * cada apuração, e é por isso que ela vira alerta na tela quando fica rente ao
 * limite.
 */
export function resolveRegime(payroll12Cents: number, rbt12Cents: number): TaxRegime {
  if (rbt12Cents <= 0) return "simples_anexo_iii";
  const ratio = (payroll12Cents / rbt12Cents) * 100;
  return ratio >= FATOR_R_THRESHOLD_PCT ? "simples_anexo_iii" : "simples_anexo_v";
}

export function fatorRPct(payroll12Cents: number, rbt12Cents: number): number {
  if (rbt12Cents <= 0) return 0;
  return (payroll12Cents / rbt12Cents) * 100;
}

/* Imposto de uma venda ------------------------------------------------------------ */

export interface TaxBreakdown {
  regime: TaxRegime;
  effectiveRatePct: number;
  /** Receita bruta desta venda, incluindo o repasse. É a base do Simples. */
  grossRevenueCents: number;
  /** Imposto sobre a receita bruta inteira. */
  taxCents: number;
  /** Receita bruta menos imposto. É o que resta antes do custo de servir. */
  netRevenueCents: number;
  /**
   * Imposto pago sobre o repasse do provedor.
   *
   * Prejuízo puro: o repasse é receita tributada com margem zero. Sai daqui
   * separado porque é o número que decide se a conta da Meta deve ficar no nome
   * do cliente.
   */
  passthroughTaxCents: number;
}

/**
 * Quanto desta venda vira imposto.
 *
 * `grossRevenueCents` precisa incluir o repasse — o Simples tributa tudo que
 * passa pela nota, e excluí-lo aqui produziria uma margem otimista pelo valor
 * exato do erro que este arquivo existe para mostrar.
 *
 * A alíquota vem da RBT12 da **empresa**, não desta venda: é a receita
 * acumulada que define a faixa, e uma venda pequena numa empresa grande paga a
 * alíquota da empresa grande.
 */
export function taxOnSale(input: {
  grossRevenueCents: number;
  passthroughCents: number;
  rbt12Cents: number;
  regime: TaxRegime;
}): TaxBreakdown {
  const rate = effectiveRate(input.rbt12Cents, input.regime);
  const gross = Math.max(0, input.grossRevenueCents);
  const taxCents = Math.round((gross * rate.effectiveRatePct) / 100);
  const passthrough = Math.max(0, Math.min(input.passthroughCents, gross));

  return {
    regime: input.regime,
    effectiveRatePct: rate.effectiveRatePct,
    grossRevenueCents: gross,
    taxCents,
    netRevenueCents: gross - taxCents,
    passthroughTaxCents: Math.round((passthrough * rate.effectiveRatePct) / 100),
  };
}

/**
 * O custo anual de faturar o repasse do provedor pela nossa nota.
 *
 * Doze meses do imposto pago sobre dinheiro que não é nosso. Um cliente com
 * R$ 1.500 de repasse por mês numa RBT12 de R$ 2 milhões custa cerca de
 * R$ 2.500 por ano só nisto — mais que a assinatura de dois meses dele.
 */
export function passthroughTaxDrag(monthlyPassthroughCents: number, ratePct: number): number {
  return Math.round((monthlyPassthroughCents * 12 * ratePct) / 100);
}
