/**
 * Tabela de preços da Elora.
 *
 * ## De onde vem a forma desta tabela
 *
 * Dois modelos, e cada um resolve o que o outro não resolve.
 *
 * Do **Salesforce** vem a edição por assento: o preço acompanha quantas pessoas
 * usam, e o recurso é liberado por degrau. É honesto num produto de atendimento,
 * onde o custo de servir cresce com o time — mas sozinho pune quem tem operação
 * enxuta e volume alto, que é a maioria de e-commerce.
 *
 * Do **RD Station** vem a escada por volume: a base de contatos define a faixa.
 * Sozinha, ela cobra caro de quem tem base grande e adormecida, e barato de quem
 * dispara todo dia para poucos.
 *
 * A Elora cobra **os dois eixos separados**, e essa é a decisão que define o
 * resto: assinatura da plataforma (fixa por edição) + assento + consumo medido
 * (contato, conversa, e-mail, IA). Quem cresce em time paga no assento; quem
 * cresce em volume paga no consumo; ninguém paga pelo crescimento do outro.
 *
 * ## Colaboradores ilimitados existem, e só na edição de cima
 *
 * "Ilimitado" numa edição barata não é generosidade, é um preço por assento
 * escondido dentro de um número redondo — e quebra no dia em que o cliente
 * cadastra a operação inteira. Aqui a edição Corporativo tem assento ilimitado
 * porque a assinatura da plataforma já é dimensionada para uma operação grande,
 * e as demais cobram por pessoa, com teto declarado.
 *
 * ## Repasse de provedor viaja separado da nossa margem
 *
 * A conversa de WhatsApp tem dois custos: o que a Meta cobra por mensagem
 * (repasse, sem margem) e o que a plataforma cobra por conversa tratada. Somá-los
 * numa linha só produziria a conta que ninguém consegue auditar quando a Meta
 * reajusta — e a Meta reajusta. As duas linhas aparecem separadas no simulador
 * pelo mesmo motivo.
 *
 * ## Todo valor aqui é em centavos, inteiro
 *
 * Mesma regra de `types/commerce.ts`: `0,1 + 0,2` vale `0,30000000000000004`, e
 * num orçamento de 36 meses isso vira divergência entre a tela e o contrato. A
 * conversão para reais acontece na formatação, no último instante.
 *
 * **Estes números são a proposta de tabela, não um preço praticado.** Ajustar
 * preço é editar este arquivo e mais nenhum: o cálculo em `calculator.ts` não
 * conhece nenhum valor.
 */

/* Edições ---------------------------------------------------------------------- */

import { CURRENT_META_RATES } from "./meta-rates";

export type PlanKey = "essencial" | "profissional" | "performance" | "corporativo";

/**
 * Compromisso de contratação.
 *
 * `anual` é o preço de tabela; `mensal` acrescenta o prêmio de flexibilidade.
 * A ordem importa na comunicação: anunciar o mensal e "dar desconto no anual"
 * treina o cliente a pedir desconto; anunciar o anual e cobrar prêmio pelo
 * mensal precifica o que a flexibilidade custa de verdade em previsibilidade.
 */
export type BillingCycle = "anual" | "mensal";

export const BILLING_LABEL: Record<BillingCycle, string> = {
  anual: "Compromisso anual",
  mensal: "Mensal, sem fidelidade",
};

/** Prêmio cobrado sobre o preço de tabela quando não há compromisso anual. */
export const MONTHLY_PREMIUM_PCT = 25;

export interface ContactTier {
  /** Teto da faixa, em contatos. `null` é a última faixa. */
  upTo: number | null;
  /** Preço por mil contatos adicionais, por mês. */
  pricePerThousandCents: number;
}

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  tagline: string;
  /** Para quem esta edição foi desenhada — usado no cartão da LP. */
  audience: string;
  /** Assinatura da plataforma, por mês, no compromisso anual. */
  platformFeeCents: number;
  /** Preço por assento, por mês, no compromisso anual. Zero = ilimitado. */
  seatPriceCents: number;
  minSeats: number;
  /** Teto de assentos. `null` significa ilimitado. */
  maxSeats: number | null;
  includedContacts: number;
  /** Conversas tratadas por mês, incluídas na assinatura. */
  includedConversations: number;
  includedEmails: number;
  /** Respostas de IA por mês incluídas (copiloto, agente e redação). */
  includedAiReplies: number;
  contactTiers: ContactTier[];
  /** Taxa da plataforma por conversa além da franquia. */
  conversationOverageCents: number;
  emailOveragePerThousandCents: number;
  aiOveragePerThousandCents: number;
  /** Números de WhatsApp inclusos. */
  includedWhatsappNumbers: number;
  /** Implantação assistida, cobrança única. */
  setupCents: number;
  /** Add-ons que já vêm inclusos nesta edição. */
  includedAddons: AddonKey[];
  highlights: string[];
  /** O que esta edição **não** faz — a linha que o cliente precisa ler antes. */
  limits: string[];
}

export const PLANS: PlanDefinition[] = [
  {
    key: "essencial",
    name: "Essencial",
    tagline: "Um time, um canal, o básico bem feito",
    audience: "Operação de até 10 pessoas começando a centralizar o atendimento.",
    platformFeeCents: 14_900,
    seatPriceCents: 7_900,
    minSeats: 2,
    maxSeats: 10,
    includedContacts: 2_000,
    includedConversations: 1_000,
    includedEmails: 5_000,
    includedAiReplies: 500,
    contactTiers: [
      { upTo: 25_000, pricePerThousandCents: 3_400 },
      { upTo: 100_000, pricePerThousandCents: 2_200 },
      { upTo: null, pricePerThousandCents: 1_400 },
    ],
    conversationOverageCents: 12,
    emailOveragePerThousandCents: 1_200,
    aiOveragePerThousandCents: 8_900,
    includedWhatsappNumbers: 1,
    setupCents: 190_000,
    includedAddons: [],
    highlights: [
      "Inbox omnichannel com WhatsApp, e-mail e webchat",
      "CRM 360º com linha do tempo do contato",
      "Um funil de vendas e tarefas",
      "Copiloto de IA para o atendente",
    ],
    limits: ["Um número de WhatsApp", "Sem construtor de jornadas", "Sem agente de IA autônomo"],
  },
  {
    key: "profissional",
    name: "Profissional",
    tagline: "Automação, campanhas e o agente de IA no ar",
    audience: "Operação que já tem fila, meta de SLA e campanha recorrente.",
    platformFeeCents: 39_900,
    seatPriceCents: 12_900,
    minSeats: 3,
    maxSeats: 50,
    includedContacts: 10_000,
    includedConversations: 5_000,
    includedEmails: 25_000,
    includedAiReplies: 3_000,
    contactTiers: [
      { upTo: 25_000, pricePerThousandCents: 2_900 },
      { upTo: 100_000, pricePerThousandCents: 1_800 },
      { upTo: null, pricePerThousandCents: 1_100 },
    ],
    conversationOverageCents: 9,
    emailOveragePerThousandCents: 900,
    aiOveragePerThousandCents: 6_900,
    includedWhatsappNumbers: 2,
    setupCents: 490_000,
    includedAddons: [],
    highlights: [
      "Tudo do Essencial",
      "Chatbot Builder, automações e jornadas",
      "Campanhas com segmentação e limites de disparo",
      "Agente de IA com base de conhecimento e transferência",
      "Distribuição automática por fila, carga e habilidade",
    ],
    limits: ["Sem SSO corporativo", "Sem ambiente de homologação"],
  },
  {
    key: "performance",
    name: "Performance",
    tagline: "Volume alto, vários times, governança de verdade",
    audience: "Operação com mais de um time, vários números e auditoria exigida.",
    platformFeeCents: 89_900,
    seatPriceCents: 18_900,
    minSeats: 10,
    maxSeats: 200,
    includedContacts: 30_000,
    includedConversations: 20_000,
    includedEmails: 100_000,
    includedAiReplies: 12_000,
    contactTiers: [
      { upTo: 100_000, pricePerThousandCents: 1_400 },
      { upTo: 500_000, pricePerThousandCents: 900 },
      { upTo: null, pricePerThousandCents: 600 },
    ],
    conversationOverageCents: 6,
    emailOveragePerThousandCents: 600,
    aiOveragePerThousandCents: 4_900,
    includedWhatsappNumbers: 5,
    setupCents: 1_200_000,
    includedAddons: ["sandbox"],
    highlights: [
      "Tudo do Profissional",
      "Perfis customizados e matriz de permissão por módulo",
      "Ambiente de homologação incluído",
      "Analytics com dicionário de métricas e custo por atendimento",
      "Avaliação de qualidade do agente de IA",
    ],
    limits: ["Assentos até 200 — acima disso, Corporativo"],
  },
  {
    key: "corporativo",
    name: "Corporativo",
    tagline: "Colaboradores ilimitados e contrato sob medida",
    audience: "Operação grande, multiunidade, com exigência de segurança e SLA contratual.",
    platformFeeCents: 390_000,
    seatPriceCents: 0,
    minSeats: 50,
    maxSeats: null,
    includedContacts: 100_000,
    includedConversations: 60_000,
    includedEmails: 400_000,
    includedAiReplies: 40_000,
    contactTiers: [
      { upTo: 500_000, pricePerThousandCents: 700 },
      { upTo: 2_000_000, pricePerThousandCents: 450 },
      { upTo: null, pricePerThousandCents: 300 },
    ],
    conversationOverageCents: 4,
    emailOveragePerThousandCents: 400,
    aiOveragePerThousandCents: 3_900,
    includedWhatsappNumbers: 10,
    setupCents: 2_800_000,
    includedAddons: ["sandbox", "sso", "gestor_sucesso"],
    highlights: [
      "Tudo do Performance",
      "Colaboradores ilimitados, sem cobrança por assento",
      "SSO/SAML, política de acesso e trilha de auditoria completa",
      "Gestor de sucesso dedicado e SLA contratual",
      "Coexistência com Salesforce e migração assistida por domínio",
    ],
    limits: ["Contratação anual, com faturamento por nota"],
  },
];

export const PLAN_BY_KEY: Record<PlanKey, PlanDefinition> = Object.fromEntries(
  PLANS.map((plan) => [plan.key, plan]),
) as Record<PlanKey, PlanDefinition>;

export function isPlanKey(value: unknown): value is PlanKey {
  return typeof value === "string" && value in PLAN_BY_KEY;
}

/* Repasse da Meta ---------------------------------------------------------------- */

/**
 * Categorias de mensagem do WhatsApp, com o preço que a Meta cobra.
 *
 * `servico` é gratuito — é a resposta dentro da janela de 24 horas aberta pelo
 * cliente. Cobrar por ela seria cobrar por algo que não temos custo, e é
 * justamente a categoria de maior volume em atendimento. Deixá-la em zero na
 * tabela não é detalhe de simulação: é o que faz a conta bater com a fatura.
 *
 * Os valores são referência de agosto de 2026 para o Brasil e mudam por decisão
 * da Meta. É repasse: entra no orçamento sem margem, e sai da linha da
 * plataforma justamente para o cliente conseguir conferir contra a fatura dele.
 */
export type WhatsappCategory = "marketing" | "utilidade" | "autenticacao" | "servico";

export interface WhatsappPrice {
  category: WhatsappCategory;
  label: string;
  description: string;
  /** Preço por mensagem cobrado pela Meta, em centavos. */
  metaCostCents: number;
}

/**
 * Preço por categoria, tirado da **tabela vigente** em `meta-rates.ts`.
 *
 * Os valores deixaram de morar aqui quando a tabela ganhou vigência e histórico.
 * Mantê-los nos dois lugares criaria a divergência clássica: alguém atualiza a
 * tabela versionada, o simulador continua cotando pelo número antigo deste
 * arquivo, e nada acusa — os dois são plausíveis.
 *
 * O rótulo e a descrição continuam aqui porque são texto de produto, não dado
 * financeiro: mudam quando a explicação melhora, não quando a Meta reajusta.
 */
export const WHATSAPP_PRICES: WhatsappPrice[] = [
  {
    category: "marketing",
    label: "Marketing",
    description: "Promoção, oferta, recuperação de carrinho e reativação.",
    metaCostCents: CURRENT_META_RATES.ratesCents.marketing,
  },
  {
    category: "utilidade",
    label: "Utilidade",
    description: "Confirmação, rastreio, lembrete e aviso de cobrança.",
    metaCostCents: CURRENT_META_RATES.ratesCents.utilidade,
  },
  {
    category: "autenticacao",
    label: "Autenticação",
    description: "Código de verificação e login.",
    metaCostCents: CURRENT_META_RATES.ratesCents.autenticacao,
  },
  {
    category: "servico",
    label: "Serviço",
    description: "Resposta dentro da janela de 24 h aberta pelo cliente. Gratuita.",
    metaCostCents: CURRENT_META_RATES.ratesCents.servico,
  },
];

export const WHATSAPP_PRICE_BY_CATEGORY: Record<WhatsappCategory, WhatsappPrice> =
  Object.fromEntries(WHATSAPP_PRICES.map((item) => [item.category, item])) as Record<
    WhatsappCategory,
    WhatsappPrice
  >;

/* Add-ons ------------------------------------------------------------------------ */

export type AddonKey =
  | "numero_whatsapp"
  | "sandbox"
  | "sso"
  | "suporte_premium"
  | "gestor_sucesso"
  | "migracao_salesforce";

export interface AddonDefinition {
  key: AddonKey;
  name: string;
  description: string;
  /** Mensal recorrente, ou cobrança única quando `oneTime`. */
  priceCents: number;
  oneTime: boolean;
  /** Aceita mais de uma unidade — número extra de WhatsApp, por exemplo. */
  quantifiable: boolean;
  /** Edições em que o add-on não pode ser contratado. */
  unavailableFor?: PlanKey[];
}

export const ADDONS: AddonDefinition[] = [
  {
    key: "numero_whatsapp",
    name: "Número de WhatsApp adicional",
    description: "Cada número tem fila, escala e qualidade próprias.",
    priceCents: 12_900,
    oneTime: false,
    quantifiable: true,
  },
  {
    key: "sandbox",
    name: "Ambiente de homologação",
    description: "Cópia isolada para testar fluxo, jornada e template antes de publicar.",
    priceCents: 45_000,
    oneTime: false,
    quantifiable: false,
  },
  {
    key: "sso",
    name: "SSO / SAML e política de acesso",
    description: "Login pelo provedor da empresa, MFA obrigatória e faixas de IP.",
    priceCents: 59_000,
    oneTime: false,
    quantifiable: false,
    unavailableFor: ["essencial"],
  },
  {
    key: "suporte_premium",
    name: "Suporte premium 24×7",
    description: "Plantão fora do horário comercial com retorno em até 30 minutos.",
    priceCents: 120_000,
    oneTime: false,
    quantifiable: false,
    unavailableFor: ["essencial"],
  },
  {
    key: "gestor_sucesso",
    name: "Gestor de sucesso dedicado",
    description: "Ponto único, revisão trimestral de operação e plano de adoção.",
    priceCents: 240_000,
    oneTime: false,
    quantifiable: false,
    unavailableFor: ["essencial", "profissional"],
  },
  {
    key: "migracao_salesforce",
    name: "Migração assistida (Salesforce ou outro CRM)",
    description: "Inventário, matriz de propriedade de campos e migração por domínio.",
    priceCents: 1_200_000,
    oneTime: true,
    quantifiable: false,
  },
];

export const ADDON_BY_KEY: Record<AddonKey, AddonDefinition> = Object.fromEntries(
  ADDONS.map((addon) => [addon.key, addon]),
) as Record<AddonKey, AddonDefinition>;

export function isAddonKey(value: unknown): value is AddonKey {
  return typeof value === "string" && value in ADDON_BY_KEY;
}

/**
 * Desconto comercial máximo que a simulação aceita sem aprovação.
 *
 * Existe como constante, e não como campo livre, porque um simulador que aceita
 * 90% de desconto vira ferramenta de expectativa: o cliente sai da reunião com
 * um número que a diretoria vai recusar depois.
 */
export const MAX_SELF_SERVICE_DISCOUNT_PCT = 15;
