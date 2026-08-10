/**
 * Motor do simulador de preço.
 *
 * Função pura, pelo mesmo motivo de `utils/distribution.ts`: preço é a conta
 * que o cliente confere linha a linha, e "às vezes dá diferente" é o defeito
 * mais caro que um simulador pode ter. Nada aqui lê relógio, sorteia ou toca
 * repositório — a mesma entrada devolve a mesma saída, sempre, no servidor e no
 * navegador.
 *
 * Também não há **nenhum valor** neste arquivo. Todo número vem de
 * `catalog.ts`. Reajustar tabela não deveria exigir ler lógica de cálculo, e
 * misturar as duas coisas garante que um dia alguém corrija o preço em um lugar
 * e esqueça o outro.
 */

import type { AddonKey, BillingCycle, PlanDefinition, PlanKey, WhatsappCategory } from "./catalog";
import {
  ADDON_BY_KEY,
  MAX_SELF_SERVICE_DISCOUNT_PCT,
  MONTHLY_PREMIUM_PCT,
  PLANS,
  PLAN_BY_KEY,
  WHATSAPP_PRICE_BY_CATEGORY,
  WHATSAPP_PRICES,
} from "./catalog";

/* Entrada ------------------------------------------------------------------------ */

export interface AddonSelection {
  key: AddonKey;
  quantity: number;
}

export interface QuoteInput {
  planKey: PlanKey;
  billing: BillingCycle;
  /** Pessoas com acesso. Ignorado na edição de assento ilimitado. */
  seats: number;
  /** Contatos ativos na base. */
  contacts: number;
  /** Conversas tratadas por mês, somando todos os canais. */
  conversations: number;
  /** Mensagens de WhatsApp por mês, por categoria da Meta. */
  whatsapp: Record<WhatsappCategory, number>;
  /** E-mails de marketing e transacionais por mês. */
  emails: number;
  /** Respostas geradas por IA por mês — copiloto, agente e redação. */
  aiReplies: number;
  addons: AddonSelection[];
  /** Implantação assistida entra na primeira fatura. */
  includeSetup: boolean;
  /** Desconto comercial, em porcentagem. Limitado por `MAX_SELF_SERVICE_DISCOUNT_PCT`. */
  discountPct: number;
}

export const DEFAULT_QUOTE_INPUT: QuoteInput = {
  planKey: "profissional",
  billing: "anual",
  seats: 8,
  contacts: 12_000,
  conversations: 6_000,
  whatsapp: { marketing: 4_000, utilidade: 6_000, autenticacao: 0, servico: 18_000 },
  emails: 30_000,
  aiReplies: 4_000,
  addons: [],
  includeSetup: true,
  discountPct: 0,
};

/* Saída -------------------------------------------------------------------------- */

/**
 * A que grupo a linha pertence.
 *
 * `repasse` existe separado de `consumo` porque é dinheiro que não fica com a
 * Elora. Um cliente que compara a fatura da Meta com o orçamento precisa achar
 * a linha; somada à nossa margem, ela desapareceria e a conversa viraria
 * "vocês estão cobrando caro pelo WhatsApp".
 */
export type QuoteLineKind = "plataforma" | "assentos" | "consumo" | "repasse" | "addon" | "unico";

export interface QuoteLine {
  key: string;
  label: string;
  /** A conta em texto: "4.000 contatos × R$ 29 / mil". */
  detail: string;
  kind: QuoteLineKind;
  quantity: number;
  unitLabel: string;
  totalCents: number;
  /** Linha incluída na franquia, mostrada com valor zero para dar contexto. */
  included?: boolean;
}

export interface QuoteResult {
  plan: PlanDefinition;
  billing: BillingCycle;
  /** Assentos efetivamente cobrados, já respeitando mínimo e teto. */
  billedSeats: number;
  /** `true` quando a edição não cobra por assento. */
  unlimitedSeats: boolean;
  lines: QuoteLine[];
  /** Soma das linhas recorrentes, antes do desconto. */
  monthlySubtotalCents: number;
  discountPct: number;
  discountCents: number;
  /** Recorrente por mês, depois do desconto. */
  monthlyTotalCents: number;
  /** Doze meses do recorrente. Não inclui a cobrança única. */
  annualTotalCents: number;
  /** Cobrança única (implantação e add-ons de projeto). */
  oneTimeCents: number;
  /** O que o cliente paga na primeira fatura. */
  firstInvoiceCents: number;
  /** Recorrente dividido pelas pessoas com acesso — a métrica que se compara. */
  costPerSeatCents: number;
  /** Recorrente dividido pelas conversas tratadas. */
  costPerConversationCents: number;
  /** Quanto do total é repasse de provedor. */
  passthroughCents: number;
  /** O que impede o orçamento de valer como está. */
  warnings: QuoteWarning[];
}

export interface QuoteWarning {
  severity: "erro" | "alerta" | "informacao";
  message: string;
}

/* Auxiliares --------------------------------------------------------------------- */

/**
 * Arredonda para cima ao centavo.
 *
 * Para cima, e não para o mais próximo, porque toda diferença de arredondamento
 * aqui é a favor de quem emite a fatura — e um simulador que mostra um centavo
 * a menos que a cobrança real produz a conversa mais desagradável possível por
 * um centavo.
 */
function ceilCents(value: number): number {
  return Math.ceil(value - 1e-9);
}

function applyBilling(cents: number, billing: BillingCycle): number {
  if (billing === "anual") return cents;
  return ceilCents((cents * (100 + MONTHLY_PREMIUM_PCT)) / 100);
}

function formatUnits(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function reais(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/**
 * Cobrança de contato por faixa, no modelo escada.
 *
 * A escada é **progressiva**, não por degrau único: quem tem 120 mil contatos
 * paga a primeira faixa pela primeira fatia e a segunda pelo excedente. A
 * alternativa — aplicar o preço da faixa final a tudo — produz o salto em que
 * cadastrar mil contatos a mais reduz a fatura, que é o tipo de tabela que o
 * cliente descobre e nunca mais confia.
 */
export function contactOverageCents(plan: PlanDefinition, contacts: number): number {
  const billable = Math.max(0, contacts - plan.includedContacts);
  if (billable === 0) return 0;

  let remaining = billable;
  /** Ponto absoluto da base já coberto — as faixas são medidas sobre o total. */
  let cursor = plan.includedContacts;
  let total = 0;

  for (const tier of plan.contactTiers) {
    if (remaining <= 0) break;
    const ceiling = tier.upTo ?? Number.POSITIVE_INFINITY;
    const slice = Math.min(remaining, Math.max(0, ceiling - cursor));
    if (slice <= 0) continue;

    total += ceilCents((slice / 1000) * tier.pricePerThousandCents);
    remaining -= slice;
    cursor += slice;
  }

  // Sobra só acontece se a última faixa tiver teto; a tabela declara `null` na
  // última justamente para isso, e o laço acima cobre o caso por segurança.
  if (remaining > 0) {
    const last = plan.contactTiers[plan.contactTiers.length - 1];
    if (last) total += ceilCents((remaining / 1000) * last.pricePerThousandCents);
  }

  return total;
}

/* Cálculo -------------------------------------------------------------------------- */

export function calculateQuote(input: QuoteInput): QuoteResult {
  const plan = PLAN_BY_KEY[input.planKey] ?? PLANS[0];
  const unlimitedSeats = plan.maxSeats === null && plan.seatPriceCents === 0;
  const warnings: QuoteWarning[] = [];

  const requestedSeats = Math.max(1, Math.floor(input.seats));
  const billedSeats = unlimitedSeats
    ? requestedSeats
    : Math.min(Math.max(requestedSeats, plan.minSeats), plan.maxSeats ?? requestedSeats);

  if (!unlimitedSeats && plan.maxSeats !== null && requestedSeats > plan.maxSeats) {
    warnings.push({
      severity: "erro",
      message: `A edição ${plan.name} vai até ${plan.maxSeats} pessoas. Para ${formatUnits(requestedSeats)}, a edição é a Corporativo.`,
    });
  }

  if (requestedSeats < plan.minSeats && !unlimitedSeats) {
    warnings.push({
      severity: "informacao",
      message: `A edição ${plan.name} tem mínimo de ${plan.minSeats} assentos — o orçamento considera ${plan.minSeats}.`,
    });
  }

  const lines: QuoteLine[] = [];

  /* Assinatura e assentos ------------------------------------------------------- */

  const platformCents = applyBilling(plan.platformFeeCents, input.billing);
  lines.push({
    key: "plataforma",
    label: `Assinatura ${plan.name}`,
    detail:
      input.billing === "anual"
        ? "Assinatura mensal da plataforma, com compromisso anual"
        : `Assinatura mensal da plataforma, com prêmio de ${MONTHLY_PREMIUM_PCT}% por não ter fidelidade`,
    kind: "plataforma",
    quantity: 1,
    unitLabel: "mês",
    totalCents: platformCents,
  });

  if (unlimitedSeats) {
    lines.push({
      key: "assentos",
      label: "Colaboradores",
      detail: `${formatUnits(requestedSeats)} pessoas com acesso — sem cobrança por assento nesta edição`,
      kind: "assentos",
      quantity: requestedSeats,
      unitLabel: "pessoa",
      totalCents: 0,
      included: true,
    });
  } else {
    const seatUnit = applyBilling(plan.seatPriceCents, input.billing);
    lines.push({
      key: "assentos",
      label: "Assentos",
      detail: `${formatUnits(billedSeats)} × ${reais(seatUnit)} por pessoa/mês`,
      kind: "assentos",
      quantity: billedSeats,
      unitLabel: "pessoa",
      totalCents: seatUnit * billedSeats,
    });
  }

  /* Consumo --------------------------------------------------------------------- */

  const contacts = Math.max(0, Math.floor(input.contacts));
  const contactExtra = contactOverageCents(plan, contacts);
  const extraContacts = Math.max(0, contacts - plan.includedContacts);
  lines.push({
    key: "contatos",
    label: "Contatos na base",
    detail:
      extraContacts === 0
        ? `${formatUnits(contacts)} contatos — dentro dos ${formatUnits(plan.includedContacts)} inclusos`
        : `${formatUnits(extraContacts)} contatos além dos ${formatUnits(plan.includedContacts)} inclusos, em faixas progressivas`,
    kind: "consumo",
    quantity: contacts,
    unitLabel: "contato",
    totalCents: applyBilling(contactExtra, input.billing),
    included: extraContacts === 0,
  });

  const conversations = Math.max(0, Math.floor(input.conversations));
  const extraConversations = Math.max(0, conversations - plan.includedConversations);
  lines.push({
    key: "conversas",
    label: "Conversas tratadas",
    detail:
      extraConversations === 0
        ? `${formatUnits(conversations)} conversas — dentro das ${formatUnits(plan.includedConversations)} inclusas`
        : `${formatUnits(extraConversations)} conversas × ${reais(plan.conversationOverageCents)} além da franquia`,
    kind: "consumo",
    quantity: conversations,
    unitLabel: "conversa",
    totalCents: applyBilling(extraConversations * plan.conversationOverageCents, input.billing),
    included: extraConversations === 0,
  });

  const emails = Math.max(0, Math.floor(input.emails));
  const extraEmails = Math.max(0, emails - plan.includedEmails);
  lines.push({
    key: "emails",
    label: "E-mails enviados",
    detail:
      extraEmails === 0
        ? `${formatUnits(emails)} e-mails — dentro dos ${formatUnits(plan.includedEmails)} inclusos`
        : `${formatUnits(extraEmails)} e-mails × ${reais(plan.emailOveragePerThousandCents)} por mil`,
    kind: "consumo",
    quantity: emails,
    unitLabel: "e-mail",
    totalCents: applyBilling(
      ceilCents((extraEmails / 1000) * plan.emailOveragePerThousandCents),
      input.billing,
    ),
    included: extraEmails === 0,
  });

  const aiReplies = Math.max(0, Math.floor(input.aiReplies));
  const extraAi = Math.max(0, aiReplies - plan.includedAiReplies);
  lines.push({
    key: "ia",
    label: "Respostas de IA",
    detail:
      extraAi === 0
        ? `${formatUnits(aiReplies)} respostas — dentro das ${formatUnits(plan.includedAiReplies)} inclusas`
        : `${formatUnits(extraAi)} respostas × ${reais(plan.aiOveragePerThousandCents)} por mil`,
    kind: "consumo",
    quantity: aiReplies,
    unitLabel: "resposta",
    totalCents: applyBilling(
      ceilCents((extraAi / 1000) * plan.aiOveragePerThousandCents),
      input.billing,
    ),
    included: extraAi === 0,
  });

  /* Repasse da Meta -------------------------------------------------------------- */

  let passthroughCents = 0;
  for (const price of WHATSAPP_PRICES) {
    const volume = Math.max(0, Math.floor(input.whatsapp[price.category] ?? 0));
    if (volume === 0) continue;

    const total = volume * price.metaCostCents;
    passthroughCents += total;

    lines.push({
      key: `whatsapp_${price.category}`,
      label: `WhatsApp — ${price.label}`,
      detail:
        price.metaCostCents === 0
          ? `${formatUnits(volume)} mensagens — a Meta não cobra por esta categoria`
          : `${formatUnits(volume)} × ${reais(price.metaCostCents)} por mensagem, repassado sem margem`,
      kind: "repasse",
      quantity: volume,
      unitLabel: "mensagem",
      totalCents: total,
      included: price.metaCostCents === 0,
    });
  }

  /* Add-ons ---------------------------------------------------------------------- */

  let oneTimeCents = 0;

  for (const selection of input.addons) {
    const addon = ADDON_BY_KEY[selection.key];
    if (!addon) continue;

    const quantity = addon.quantifiable ? Math.max(1, Math.floor(selection.quantity)) : 1;

    if (plan.includedAddons.includes(addon.key)) {
      lines.push({
        key: `addon_${addon.key}`,
        label: addon.name,
        detail: `Já incluído na edição ${plan.name}`,
        kind: "addon",
        quantity,
        unitLabel: "mês",
        totalCents: 0,
        included: true,
      });
      continue;
    }

    if (addon.unavailableFor?.includes(plan.key)) {
      warnings.push({
        severity: "erro",
        message: `${addon.name} não está disponível na edição ${plan.name}.`,
      });
      continue;
    }

    const total = addon.priceCents * quantity;

    if (addon.oneTime) {
      oneTimeCents += total;
      lines.push({
        key: `addon_${addon.key}`,
        label: addon.name,
        detail: "Cobrança única, na primeira fatura",
        kind: "unico",
        quantity,
        unitLabel: "projeto",
        totalCents: total,
      });
      continue;
    }

    lines.push({
      key: `addon_${addon.key}`,
      label: addon.name,
      detail:
        quantity > 1
          ? `${quantity} × ${reais(addon.priceCents)} por mês`
          : `${reais(addon.priceCents)} por mês`,
      kind: "addon",
      quantity,
      unitLabel: "mês",
      totalCents: applyBilling(total, input.billing),
    });
  }

  /* Implantação ------------------------------------------------------------------- */

  if (input.includeSetup) {
    oneTimeCents += plan.setupCents;
    lines.push({
      key: "implantacao",
      label: "Implantação assistida",
      detail:
        "Configuração de filas, canais, catálogo e primeira automação, com acompanhamento até o primeiro mês em produção",
      kind: "unico",
      quantity: 1,
      unitLabel: "projeto",
      totalCents: plan.setupCents,
    });
  }

  /* Totais ------------------------------------------------------------------------- */

  const monthlySubtotalCents = lines
    .filter((line) => line.kind !== "unico")
    .reduce((sum, line) => sum + line.totalCents, 0);

  const requestedDiscount = Math.max(0, Math.min(100, input.discountPct));
  const discountPct = Math.min(requestedDiscount, MAX_SELF_SERVICE_DISCOUNT_PCT);

  if (requestedDiscount > MAX_SELF_SERVICE_DISCOUNT_PCT) {
    warnings.push({
      severity: "alerta",
      message: `Desconto acima de ${MAX_SELF_SERVICE_DISCOUNT_PCT}% depende de aprovação comercial. A simulação aplicou ${MAX_SELF_SERVICE_DISCOUNT_PCT}%.`,
    });
  }

  /**
   * O desconto **não** incide sobre o repasse.
   *
   * Descontar o que a Meta cobra significaria pagar a diferença do próprio
   * bolso a cada mensagem — e o prejuízo cresceria justamente com o cliente que
   * mais dispara, que é o oposto do que um desconto por volume deveria fazer.
   */
  const discountableCents = lines
    .filter((line) => line.kind !== "unico" && line.kind !== "repasse")
    .reduce((sum, line) => sum + line.totalCents, 0);

  const discountCents = Math.floor((discountableCents * discountPct) / 100);
  const monthlyTotalCents = monthlySubtotalCents - discountCents;

  if (input.billing === "mensal" && plan.key === "corporativo") {
    warnings.push({
      severity: "alerta",
      message: "A edição Corporativo é contratada apenas no compromisso anual.",
    });
  }

  if (conversations > 0 && input.whatsapp.servico + input.whatsapp.utilidade === 0) {
    warnings.push({
      severity: "informacao",
      message:
        "Nenhuma mensagem de serviço ou utilidade informada. Em atendimento, essa costuma ser a maior fatia — e a de serviço não tem custo de provedor.",
    });
  }

  return {
    plan,
    billing: input.billing,
    billedSeats,
    unlimitedSeats,
    lines,
    monthlySubtotalCents,
    discountPct,
    discountCents,
    monthlyTotalCents,
    annualTotalCents: monthlyTotalCents * 12,
    oneTimeCents,
    firstInvoiceCents: monthlyTotalCents + oneTimeCents,
    costPerSeatCents: requestedSeats > 0 ? Math.round(monthlyTotalCents / requestedSeats) : 0,
    costPerConversationCents: conversations > 0 ? Math.round(monthlyTotalCents / conversations) : 0,
    passthroughCents,
    warnings,
  };
}

/**
 * Qual edição sai mais barata para este dimensionamento.
 *
 * Compara o **total mensal**, não o preço de tabela: uma edição mais cara na
 * assinatura costuma sair na frente assim que o volume passa da franquia, e é
 * exatamente essa inversão que o cliente não consegue enxergar sozinho. Edições
 * que não comportam o time são descartadas antes da comparação — recomendar a
 * mais barata que não cabe seria pior que não recomendar nada.
 */
export function recommendPlan(input: QuoteInput): {
  planKey: PlanKey;
  monthlyTotalCents: number;
  savingsAgainstCurrentCents: number;
} {
  const current = calculateQuote(input);

  const viable = PLANS.filter((plan) => plan.maxSeats === null || input.seats <= plan.maxSeats).map(
    (plan) => ({ plan, quote: calculateQuote({ ...input, planKey: plan.key }) }),
  );

  const cheapest = viable
    .filter((item) => !item.quote.warnings.some((warning) => warning.severity === "erro"))
    .sort((a, b) => a.quote.monthlyTotalCents - b.quote.monthlyTotalCents)[0];

  if (!cheapest) {
    return {
      planKey: input.planKey,
      monthlyTotalCents: current.monthlyTotalCents,
      savingsAgainstCurrentCents: 0,
    };
  }

  return {
    planKey: cheapest.plan.key,
    monthlyTotalCents: cheapest.quote.monthlyTotalCents,
    savingsAgainstCurrentCents: current.monthlyTotalCents - cheapest.quote.monthlyTotalCents,
  };
}

/** Preço a partir de — o número do cartão da edição na landing page. */
export function startingPriceCents(planKey: PlanKey, billing: BillingCycle = "anual"): number {
  const plan = PLAN_BY_KEY[planKey];
  const seats = plan.seatPriceCents === 0 ? 0 : plan.minSeats * plan.seatPriceCents;
  return applyBilling(plan.platformFeeCents + seats, billing);
}

export { WHATSAPP_PRICE_BY_CATEGORY };
