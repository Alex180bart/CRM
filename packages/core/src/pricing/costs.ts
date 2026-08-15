/**
 * Custo de servir, margem e o colchão que absorve desconto.
 *
 * ## O que este arquivo resolve
 *
 * `catalog.ts` diz **quanto cobramos**. Nada dizia quanto custa entregar — e sem
 * isso o desconto é sempre um palpite: o vendedor concede 15% sem saber se
 * sobrou 30% ou 2%. Aqui entra o outro lado da conta.
 *
 * O preço passa a ter origem declarada:
 *
 *     preço de tabela = custo × (1 + margem alvo) × (1 + colchão)
 *
 * O **colchão** existe para ser gasto. É a folga que o desconto consome antes de
 * tocar na margem alvo — e é a diferença entre "dei 15% e ainda ganho o que
 * planejei" e "dei 15% e comi metade do lucro".
 *
 * ## A armadilha do colchão, que é a razão deste arquivo existir
 *
 * Colchão de 18% **não** absorve desconto de 18%. Os dois percentuais têm bases
 * diferentes: o colchão é somado sobre o preço-alvo, e o desconto é subtraído do
 * preço de tabela, que já é maior. Um colchão de 18% absorve
 * `0,18 / 1,18 = 15,25%` de desconto.
 *
 * Quem confunde os dois monta uma tabela achando que aguenta 18% e descobre, no
 * fechamento do trimestre, que cada venda com desconto cheio saiu 2,3% abaixo da
 * margem alvo. `maxDiscountKeepingMargin` faz essa conversão, e é ela que a tela
 * deve mostrar — nunca o colchão cru.
 *
 * ## Repasse não entra na margem — mas a taxa de envio entra
 *
 * O que a Meta cobra é custo **e** receita no mesmo valor: repassamos sem
 * margem. Somá-lo aos dois lados não muda o lucro em reais e **derruba a margem
 * percentual**, porque infla o denominador. Uma operação com muito WhatsApp
 * pareceria menos rentável que uma idêntica sem WhatsApp, e a decisão comercial
 * sairia errada. Por isso a análise recebe a receita já **sem** repasse, e é
 * por isso que `QuoteResult` carrega `passthroughCents` separado desde sempre.
 *
 * A **taxa da plataforma por mensagem** é outra coisa e entra inteira na
 * receita: é preço nosso, sobre um custo nosso, e o custo correspondente está
 * em `perThousandWhatsappTemplatesCents` logo abaixo. Como ela não é repasse,
 * não precisa de tratamento nenhum — cai na receita por já estar no total
 * mensal e fora de `passthroughCents`. Essa é a razão de as duas viverem em
 * linhas separadas desde o cálculo: se estivessem somadas, não haveria como
 * tirar uma da margem sem tirar a outra.
 *
 * ## Estes custos são estimativa, e a tela diz isso
 *
 * Não há telemetria de custo real — não há back-end. Os números abaixo são a
 * ordem de grandeza de uma operação em nuvem gerenciada, e existem para que a
 * conversa sobre desconto seja quantitativa em vez de intuitiva. Ao ligar o
 * faturamento real do provedor, o que muda é esta tabela e nada mais.
 */

import type { PlanKey } from "./catalog";

/* Custo unitário ---------------------------------------------------------------- */

export interface UnitCosts {
  /** Infra fixa por conta, por mês: banco, observabilidade, filas ociosas. */
  perAccountCents: number;
  /**
   * Armazenamento, índice e leitura por **mil** contatos ativos, por mês.
   *
   * Passou a ser por milheiro quando a unidade anterior — centavos por contato —
   * se mostrou grosseira demais: o mínimo representável era um centavo por
   * contato por mês, o que dá R$ 120 mensais para uma base de 12 mil. A conta
   * real não chega perto disso, e o piso da unidade escondia esse fato.
   */
  perThousandContactsCents: number;
  /** Processamento, mídia e retenção por **mil** conversas tratadas, por mês. */
  perThousandConversationsCents: number;
  /** Provedor de envio, por milheiro de e-mail. */
  perThousandEmailsCents: number;
  /**
   * Provedor de modelo, por milheiro de resposta de IA.
   *
   * É o custo mais volátil da tabela — muda a cada troca de modelo na fila do
   * Gateway. Vale conferir contra `AiRunMeta.costCents` quando houver volume.
   */
  perThousandAiRepliesCents: number;
  /** Suporte humano e licenças por pessoa com acesso, por mês. */
  perSeatCents: number;
  /** Infra e BSP por número de WhatsApp conectado, por mês. */
  perWhatsappNumberCents: number;
  /**
   * Despacho, retentativa e retenção de status, por milheiro de mensagem de
   * modelo enviada.
   *
   * **Não inclui o que a Meta cobra** — aquilo é repasse, e entra e sai da conta
   * pelo mesmo valor. O que está aqui é o nosso custo de colocar a mensagem na
   * fila, tratar o retorno de entrega e guardar o rastro. É pequeno por
   * mensagem e deixa de ser em campanha de milhão.
   */
  perThousandWhatsappTemplatesCents: number;
}

/**
 * Custo estimado de servir um cliente.
 *
 * Um único conjunto para todas as edições, de propósito: o custo de armazenar um
 * contato não muda porque o cliente assinou a edição de cima. O que muda por
 * edição é a **margem alvo**, logo abaixo — e essa é a decisão comercial de
 * verdade.
 */
/**
 * De onde saem estes números, e por que dois deles mudaram.
 *
 * `perAccountCents` é a fatia rateada da infra compartilhada, não uma instância
 * por cliente — o produto é multiempresa e uma conta a mais não sobe um banco a
 * mais. A referência é o Supabase Pro: US$ 25 por organização, 8 GB de disco,
 * 250 GB de tráfego de saída e US$ 10 de crédito de computação inclusos; acima
 * disso, US$ 0,125 por GB de banco, US$ 0,09 por GB de saída e US$ 0,0213 por GB
 * de arquivo. Somando réplica, observabilidade, filas e a folga de computação
 * que o pico exige, R$ 68 por conta é a ordem de grandeza da fatia rateada.
 *
 * ## Contato e conversa estavam errados por uma ordem de grandeza
 *
 * A versão anterior cobrava **3 centavos por contato por mês**. Uma base de 12
 * mil contatos custava R$ 360 mensais — a maior linha do custo de servir, maior
 * que suporte, assentos e IA somados. A conta que a desmente é direta: um
 * contato com histórico ocupa algo como 60 KB entre linha, índice e mensagens;
 * 12 mil contatos são ~0,7 GB, e o Supabase cobra US$ 0,125 por GB de banco.
 * Dá **menos de um real por mês** de armazenamento, não R$ 360.
 *
 * A causa era a unidade, não a estimativa: em centavos por contato, o menor
 * valor representável já era caro demais. Por milheiro, a granularidade cabe.
 *
 * Os valores abaixo têm folga deliberada sobre a fatura crua do provedor —
 * cerca de sete vezes —, e a folga cobre réplica, retenção estendida, tráfego
 * de saída de cada leitura e a computação que a consulta de linha do tempo
 * consome. Ainda é estimativa; deixou de ser estimativa implausível.
 *
 * **Continuam sendo estimativa, e a tela diz isso.** Não há telemetria de custo
 * real enquanto não houver back-end. O que muda ao ligar o faturamento do
 * provedor é esta tabela, e nada mais.
 */
export const UNIT_COSTS: UnitCosts = {
  perAccountCents: 6_800,
  perThousandContactsCents: 600,
  perThousandConversationsCents: 900,
  perThousandEmailsCents: 320,
  perThousandAiRepliesCents: 2_400,
  perSeatCents: 1_900,
  perWhatsappNumberCents: 2_500,
  perThousandWhatsappTemplatesCents: 40,
};

/* Política de margem ------------------------------------------------------------- */

export interface MarginPolicy {
  /** Margem alvo sobre o custo, em pontos percentuais. */
  targetMarginPct: number;
  /** Folga embutida no preço de tabela, para o desconto consumir. */
  discountCushionPct: number;
  /**
   * Piso: abaixo disto a venda precisa de aprovação, não de bom senso.
   *
   * É margem sobre a **receita**, e não sobre o custo — é assim que se compara
   * com o resultado contábil no fim do mês.
   */
  floorMarginPct: number;
}

/**
 * Margem por edição.
 *
 * A escada não é arbitrária. A edição de entrada tem margem menor porque compete
 * com planilha e WhatsApp comum — ali o preço é o argumento. A de cima tem
 * margem maior porque o que se vende é governança, SLA contratual e gestor
 * dedicado, e nenhum desses três é comparável por preço.
 *
 * O colchão anda na direção oposta: quanto maior o contrato, mais o desconto é
 * esperado na mesa de negociação, e mais folga o preço de tabela precisa ter
 * para absorvê-lo sem virar exceção.
 */
export const MARGIN_BY_PLAN: Record<PlanKey, MarginPolicy> = {
  essencial: { targetMarginPct: 55, discountCushionPct: 8, floorMarginPct: 30 },
  profissional: { targetMarginPct: 65, discountCushionPct: 18, floorMarginPct: 40 },
  performance: { targetMarginPct: 70, discountCushionPct: 22, floorMarginPct: 45 },
  corporativo: { targetMarginPct: 72, discountCushionPct: 30, floorMarginPct: 50 },
};

/* Custo de uma operação ---------------------------------------------------------- */

export interface CostBreakdownLine {
  key: string;
  label: string;
  detail: string;
  totalCents: number;
}

export interface CostBreakdown {
  lines: CostBreakdownLine[];
  totalCents: number;
}

/**
 * Quanto custa servir esta operação por mês.
 *
 * Não recebe a edição: o custo é da operação, não do contrato. Duas empresas com
 * o mesmo volume custam o mesmo para servir, ainda que uma pague o dobro da
 * outra — e é exatamente essa diferença que a margem mede.
 */
export function estimateMonthlyCost(input: {
  seats: number;
  contacts: number;
  conversations: number;
  emails: number;
  aiReplies: number;
  whatsappNumbers: number;
  /**
   * Mensagens de modelo enviadas no mês.
   *
   * Opcional para não quebrar quem já chamava esta função sem o campo — ausente
   * vale zero, que é exatamente o comportamento antigo.
   */
  whatsappTemplates?: number;
  costs?: UnitCosts;
}): CostBreakdown {
  const unit = input.costs ?? UNIT_COSTS;

  const lines: CostBreakdownLine[] = [
    {
      key: "conta",
      label: "Infraestrutura base",
      detail: "Banco, filas, observabilidade e retenção — por conta, independente do volume.",
      totalCents: unit.perAccountCents,
    },
    {
      key: "assentos",
      label: "Suporte e licenças por pessoa",
      detail: `${input.seats} pessoa(s) × ${unit.perSeatCents / 100} por mês`,
      totalCents: unit.perSeatCents * Math.max(0, Math.round(input.seats)),
    },
    {
      key: "contatos",
      label: "Armazenamento de contatos",
      detail: `${input.contacts.toLocaleString("pt-BR")} contatos ativos — linha, índice, histórico e o tráfego de cada leitura.`,
      totalCents: Math.round(
        (Math.max(0, input.contacts) / 1_000) * unit.perThousandContactsCents,
      ),
    },
    {
      key: "conversas",
      label: "Processamento de conversas",
      detail: `${input.conversations.toLocaleString("pt-BR")} conversas tratadas por mês — mídia, retenção e consulta de linha do tempo.`,
      totalCents: Math.round(
        (Math.max(0, input.conversations) / 1_000) * unit.perThousandConversationsCents,
      ),
    },
    {
      key: "emails",
      label: "Provedor de e-mail",
      detail: `${input.emails.toLocaleString("pt-BR")} envios por mês`,
      totalCents: Math.round((Math.max(0, input.emails) / 1_000) * unit.perThousandEmailsCents),
    },
    {
      key: "ia",
      label: "Provedor de modelo",
      detail: `${input.aiReplies.toLocaleString("pt-BR")} respostas de IA por mês`,
      totalCents: Math.round(
        (Math.max(0, input.aiReplies) / 1_000) * unit.perThousandAiRepliesCents,
      ),
    },
    {
      key: "numeros",
      label: "Números de WhatsApp",
      detail: `${input.whatsappNumbers} número(s) conectado(s)`,
      totalCents: unit.perWhatsappNumberCents * Math.max(0, Math.round(input.whatsappNumbers)),
    },
    {
      key: "envio_whatsapp",
      label: "Despacho de mensagens de WhatsApp",
      detail: `${(input.whatsappTemplates ?? 0).toLocaleString("pt-BR")} mensagens de modelo — fila, status de entrega e rastro. Não inclui o que a Meta cobra.`,
      totalCents: Math.round(
        (Math.max(0, input.whatsappTemplates ?? 0) / 1_000) *
          unit.perThousandWhatsappTemplatesCents,
      ),
    },
  ];

  return {
    lines,
    totalCents: lines.reduce((sum, line) => sum + line.totalCents, 0),
  };
}

/* Preço derivado do custo --------------------------------------------------------- */

/**
 * O desconto que o colchão aguenta sem tocar na margem alvo.
 *
 * `colchão / (1 + colchão)`. Ver a armadilha no cabeçalho: 18% de colchão
 * absorvem 15,25% de desconto, não 18%.
 */
export function maxDiscountKeepingMargin(cushionPct: number): number {
  if (cushionPct <= 0) return 0;
  const cushion = cushionPct / 100;
  return (cushion / (1 + cushion)) * 100;
}

export interface DerivedPrice {
  costCents: number;
  /** Custo mais a margem alvo. É o preço que a empresa precisa realizar. */
  targetPriceCents: number;
  /** Preço de tabela: alvo mais o colchão. É o que vai para a proposta. */
  listPriceCents: number;
  /** Desconto máximo que ainda entrega a margem alvo. */
  maxDiscountPct: number;
}

/**
 * Preço mínimo defensável para uma operação, dado o custo.
 *
 * Serve de **régua**, não de tabela: o preço praticado continua vindo de
 * `catalog.ts`, porque preço é decisão de mercado e posicionamento, não só de
 * custo. O que esta função responde é "a tabela cobre o custo com a margem que
 * pedimos?" — e quando a resposta é não, o problema está na tabela, não na
 * negociação.
 */
export function derivePrice(costCents: number, policy: MarginPolicy): DerivedPrice {
  const targetPriceCents = Math.round(costCents * (1 + policy.targetMarginPct / 100));
  const listPriceCents = Math.round(targetPriceCents * (1 + policy.discountCushionPct / 100));

  return {
    costCents,
    targetPriceCents,
    listPriceCents,
    maxDiscountPct: maxDiscountKeepingMargin(policy.discountCushionPct),
  };
}

/* Análise de uma venda ------------------------------------------------------------ */

export type MarginStatus = "saudavel" | "atencao" | "prejuizo";

export interface MarginAnalysis {
  costCents: number;
  /** Receita recorrente **sem** repasse. Ver o cabeçalho. */
  revenueCents: number;
  /**
   * Imposto sobre a receita bruta, já incluindo o que incide sobre o repasse.
   *
   * Zero quando a análise roda sem contexto tributário — é o comportamento
   * anterior, preservado para quem chama `analyzeMargin` só para comparar custo
   * com preço.
   */
  taxCents: number;
  /** Receita nossa menos o imposto. É daqui que o custo de servir é pago. */
  netRevenueCents: number;
  grossProfitCents: number;
  /** Margem sobre a receita, que é como o resultado é lido depois. */
  marginPct: number;
  /** Margem alvo da edição, para comparação. */
  targetMarginPct: number;
  floorMarginPct: number;
  /** Quanto do colchão o desconto aplicado já consumiu, de 0 a 100. */
  cushionUsedPct: number;
  /** Desconto que ainda cabe antes de a margem alvo ser tocada. */
  discountHeadroomPct: number;
  /** Desconto que leva a margem exatamente ao piso. */
  discountAtFloorPct: number;
  status: MarginStatus;
}

/**
 * Onde esta venda está em relação ao que foi planejado.
 *
 * `revenueCents` precisa chegar **líquido de repasse e já com o desconto
 * aplicado** — é o que efetivamente entra. Passar o subtotal antes do desconto
 * produziria a margem que teríamos se ninguém negociasse, que é justamente o
 * número que não interessa nesta tela.
 */
export function analyzeMargin(input: {
  costCents: number;
  revenueCents: number;
  discountPct: number;
  policy: MarginPolicy;
  /**
   * Alíquota efetiva sobre a receita bruta, em pontos percentuais.
   *
   * Ausente vale zero, e o resultado é idêntico ao de antes de existir imposto
   * nesta conta — é o que permite chamar esta função só para comparar custo com
   * preço, sem arrastar contexto tributário.
   */
  taxRatePct?: number;
  /**
   * Imposto que incide sobre o repasse do provedor, em centavos.
   *
   * Entra separado porque **não escala com o desconto**: o repasse não é
   * descontável, então o imposto sobre ele é uma parcela fixa que o desconto não
   * alivia. Somá-lo à alíquota da receita faria o cálculo de "quanto ainda dá
   * para descontar" achar folga que não existe.
   */
  passthroughTaxCents?: number;
}): MarginAnalysis {
  const { costCents, revenueCents, policy } = input;

  const taxRate = Math.max(0, input.taxRatePct ?? 0) / 100;
  const passthroughTaxCents = Math.max(0, input.passthroughTaxCents ?? 0);

  const taxCents = Math.round(revenueCents * taxRate) + passthroughTaxCents;
  const netRevenueCents = revenueCents - taxCents;
  const grossProfitCents = netRevenueCents - costCents;
  const marginPct = revenueCents > 0 ? (grossProfitCents / revenueCents) * 100 : 0;

  const maxDiscount = maxDiscountKeepingMargin(policy.discountCushionPct);
  const cushionUsedPct =
    maxDiscount > 0 ? Math.min(100, (input.discountPct / maxDiscount) * 100) : 100;

  /**
   * Quanto ainda dá para descontar antes de a margem cair ao piso.
   *
   * Com imposto, a conta deixa de ser `receita − custo` e passa a ser
   * `receita × (1 − x) × (1 − t) − impostoDoRepasse − custo`, comparada ao piso
   * sobre `receita × (1 − x)`. Isolando:
   *
   *     x = 1 − (custo + impostoDoRepasse) / (receita × (1 − t − piso))
   *
   * O denominador pode zerar ou virar negativo quando alíquota mais piso passam
   * de 100% — situação em que não existe desconto possível, e a resposta certa
   * é zero, não um número negativo desenhado na tela.
   */
  const floor = policy.floorMarginPct / 100;
  const denominator = revenueCents * (1 - taxRate - floor);
  const discountAtFloorPct =
    denominator > 0
      ? Math.max(0, (1 - (costCents + passthroughTaxCents) / denominator) * 100)
      : 0;

  const status: MarginStatus =
    grossProfitCents <= 0 ? "prejuizo" : marginPct < policy.floorMarginPct ? "atencao" : "saudavel";

  return {
    costCents,
    revenueCents,
    taxCents,
    netRevenueCents,
    grossProfitCents,
    marginPct,
    targetMarginPct: policy.targetMarginPct,
    floorMarginPct: policy.floorMarginPct,
    cushionUsedPct,
    discountHeadroomPct: Math.max(0, maxDiscount - input.discountPct),
    discountAtFloorPct,
    status,
  };
}
