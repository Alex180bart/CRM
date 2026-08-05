/**
 * Base de demonstração — séries, indicadores e a fila de atenção.
 * Referência: Plano Completo, seção 30.
 *
 * A fila de atenção é **derivada** dos dados existentes (conversas, tarefas,
 * jornadas, campanhas) em vez de escrita à mão. É assim que ela se comporta no
 * produto real: nada aparece ali sem um evento por trás.
 */

import type {
  AttentionItem,
  AutomationHealth,
  ChannelVolume,
  MetricDefinition,
  OperationCost,
  TimePoint,
} from "../types/analytics";
import { conversations } from "./inbox";
import { contacts } from "./contacts";
import { deals, pipelines, tasks } from "./pipeline";
import { campaigns } from "./campaigns";
import { journeyEnrollments, journeys } from "./journeys";
import { channelAccounts, users } from "./organization";
import { formatCountdown, formatShortDate, minutesUntil, offsetIso } from "../utils/datetime";

/* Pulso do dia ------------------------------------------------------------ */

/**
 * Volume por hora. O formato segue a operação real de um escritório contábil:
 * abertura às 8h, pico às 10h e às 14h, queda no almoço, fechamento às 18h.
 */
const HOURLY_MESSAGES = [
  2, 1, 0, 0, 1, 3, 9, 24, 61, 88, 112, 96, 54, 71, 118, 104, 87, 63, 34, 18, 11, 7, 5, 3,
];

export const REFERENCE_HOUR = 14;

export const hourlyPulse: TimePoint[] = HOURLY_MESSAGES.map((value, hour) => ({
  label: `${String(hour).padStart(2, "0")}h`,
  value,
}));

/* Séries diárias ---------------------------------------------------------- */

function buildSeries(values: number[]): TimePoint[] {
  return values.map((value, index) => {
    const daysAgo = values.length - 1 - index;
    const at = offsetIso({ days: -daysAgo });
    return { label: formatShortDate(at), value, at };
  });
}

export const conversationsSeries = buildSeries([
  148, 162, 139, 71, 44, 171, 183, 176, 158, 149, 82, 51, 188, 194,
]);

export const firstResponseSeries = buildSeries([
  14, 12, 16, 9, 8, 18, 21, 17, 13, 11, 8, 7, 15, 12,
]);

export const dealsCreatedSeries = buildSeries([9, 12, 8, 3, 2, 14, 11, 13, 10, 9, 4, 2, 15, 12]);

export const revenueWonSeries = buildSeries([
  182000, 0, 96000, 0, 0, 348000, 0, 129000, 0, 78000, 0, 0, 156000, 249700,
]);

export const automationRunsSeries = buildSeries([
  412, 438, 401, 186, 122, 466, 489, 471, 452, 430, 208, 141, 498, 511,
]);

export const campaignDeliverySeries = buildSeries([0, 0, 0, 0, 0, 0, 0, 921, 0, 0, 0, 0, 0, 216]);

/* Volume por canal -------------------------------------------------------- */

export const channelVolumes: ChannelVolume[] = [
  { channel: "whatsapp", received: 1284, sent: 1616 },
  { channel: "email", received: 318, sent: 402 },
  { channel: "instagram", received: 196, sent: 174 },
  { channel: "webchat", received: 142, sent: 138 },
];

/* Saúde das automações ---------------------------------------------------- */

export const automationHealth: AutomationHealth[] = [
  {
    label: "Bot — Triagem fiscal",
    runs: 4218,
    success: 4106,
    errors: 42,
    retries: 70,
    avgLatencySeconds: 1.4,
    backlog: 0,
  },
  {
    label: "Bot — Qualificação comercial",
    runs: 1873,
    success: 1802,
    errors: 18,
    retries: 53,
    avgLatencySeconds: 2.1,
    backlog: 0,
  },
  {
    label: "Jornada — Nutrição de migração",
    runs: 1642,
    success: 1611,
    errors: 9,
    retries: 22,
    avgLatencySeconds: 0.8,
    backlog: 12,
  },
  {
    label: "Jornada — Onboarding do aluno",
    runs: 987,
    success: 954,
    errors: 21,
    retries: 12,
    avgLatencySeconds: 0.7,
    backlog: 4,
  },
  {
    label: "Fila — Envio de campanha",
    runs: 1137,
    success: 1110,
    errors: 27,
    retries: 41,
    avgLatencySeconds: 3.6,
    backlog: 122,
  },
];

/* Custos ------------------------------------------------------------------ */

export const operationCosts: OperationCost[] = [
  { label: "Mensagens WhatsApp", amountCents: 184300, changePct: 12.4, unit: "no mês" },
  { label: "E-mail transacional", amountCents: 21800, changePct: -3.1, unit: "no mês" },
  { label: "Tokens de IA", amountCents: 43600, changePct: 28.9, unit: "no mês" },
  { label: "Armazenamento de mídia", amountCents: 9700, changePct: 4.2, unit: "no mês" },
];

/* Dicionário de métricas -------------------------------------------------- */

export const metricDefinitions: MetricDefinition[] = [
  {
    key: "tempo_primeira_resposta",
    label: "Tempo de primeira resposta",
    definition:
      "Mediana dos minutos entre a primeira mensagem do contato e a primeira resposta de um agente humano, por conversa aberta no período.",
    source: "eventos message.received e message.sent",
    owner: "Gestor de atendimento",
    unit: "minutos",
  },
  {
    key: "sla_cumprido",
    label: "SLA cumprido",
    definition:
      "Conversas resolvidas dentro do prazo da fila, dividido pelo total resolvido. Conversas aguardando o cliente têm o relógio pausado.",
    source: "sla_events",
    owner: "Gestor de atendimento",
    unit: "percentual",
  },
  {
    key: "resolucao_bot",
    label: "Resolução pelo bot",
    definition:
      "Sessões de chatbot encerradas sem transbordo para humano, dividido pelo total de sessões iniciadas.",
    source: "bot_sessions",
    owner: "Criador de automações",
    unit: "percentual",
  },
  {
    key: "conversao_funil",
    label: "Conversão do funil",
    definition: "Negócios ganhos divididos pela soma de ganhos e perdidos no período.",
    source: "deals",
    owner: "Gestor comercial",
    unit: "percentual",
  },
  {
    key: "entrega_campanha",
    label: "Taxa de entrega",
    definition:
      "Mensagens com status entregue dividido por mensagens enviadas. Falhas permanentes não contam como enviadas.",
    source: "campaign_deliveries",
    owner: "Marketing",
    unit: "percentual",
  },
  {
    key: "custo_por_mensagem",
    label: "Custo por mensagem",
    definition: "Custo total do provedor no período dividido pelo número de mensagens entregues.",
    source: "campaign_deliveries e faturas do provedor",
    owner: "Analista de dados",
    unit: "reais",
  },
];

/* Fila de atenção --------------------------------------------------------- */

const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
const userById = new Map(users.map((user) => [user.id, user]));
const stageNameById = new Map(
  pipelines.flatMap((pipeline) => pipeline.stages.map((stage) => [stage.id, stage.name] as const)),
);

function severityFor(minutes: number): AttentionItem["severity"] {
  if (minutes < 0) return "critico";
  if (minutes <= 15) return "alto";
  return "medio";
}

const slaItems: AttentionItem[] = conversations
  .filter(
    (conversation) =>
      conversation.slaStatus === "estourado" || conversation.slaStatus === "atencao",
  )
  .map((conversation) => {
    const deadline = conversation.firstRespondedAt
      ? conversation.resolutionDueAt
      : conversation.firstResponseDueAt;
    const minutes = deadline ? minutesUntil(deadline) : 0;
    const contact = contactById.get(conversation.contactId);

    return {
      id: `att_sla_${conversation.id}`,
      kind: "sla" as const,
      title: contact?.fullName ?? "Conversa sem contato",
      detail: conversation.subject,
      dueAt: deadline,
      severity: severityFor(minutes),
      href: "/inbox",
      actionLabel: "Responder",
      contactId: conversation.contactId,
      channel: conversation.channel,
    };
  });

const taskItems: AttentionItem[] = tasks
  .filter((task) => task.status === "aberta" && minutesUntil(task.dueAt) < 120)
  .map((task) => {
    const contact = task.contactId ? contactById.get(task.contactId) : undefined;
    const deal = task.dealId ? deals.find((item) => item.id === task.dealId) : undefined;

    return {
      id: `att_task_${task.id}`,
      kind: "tarefa" as const,
      title: task.title,
      detail:
        [contact?.fullName, deal ? stageNameById.get(deal.stageId) : undefined]
          .filter(Boolean)
          .join(" · ") ||
        (userById.get(task.assigneeId)?.name ?? ""),
      dueAt: task.dueAt,
      severity: severityFor(minutesUntil(task.dueAt)),
      href: task.contactId ? `/contatos/${task.contactId}` : "/pipeline",
      actionLabel: "Abrir",
      contactId: task.contactId,
    };
  });

const approvalItems: AttentionItem[] = campaigns
  .filter((campaign) => campaign.status === "em_aprovacao")
  .map((campaign) => ({
    id: `att_aprov_${campaign.id}`,
    kind: "aprovacao" as const,
    title: `Aprovar campanha "${campaign.name}"`,
    detail: `${campaign.metrics.eligible.toLocaleString("pt-BR")} contatos elegíveis · solicitada por ${
      userById.get(campaign.approval.requestedBy ?? "")?.name ?? "equipe"
    }`,
    dueAt: campaign.scheduledAt,
    severity: "alto" as const,
    href: `/campanhas/${campaign.id}`,
    actionLabel: "Revisar",
  }));

const automationItems: AttentionItem[] = journeyEnrollments
  .filter((enrollment) => enrollment.status === "erro")
  .map((enrollment) => {
    const journey = journeys.find((item) => item.id === enrollment.journeyId);
    const contact = contactById.get(enrollment.contactId);
    return {
      id: `att_auto_${enrollment.id}`,
      kind: "automacao" as const,
      title: `Execução com erro em "${journey?.name ?? "jornada"}"`,
      detail: `${contact?.fullName ?? enrollment.contactId} parou no nó ${enrollment.currentNodeId}. Reprocessamento pendente.`,
      dueAt: enrollment.nextRunAt,
      severity: "alto" as const,
      href: `/jornadas/${enrollment.journeyId}`,
      actionLabel: "Investigar",
      contactId: enrollment.contactId,
    };
  });

const channelItems: AttentionItem[] = channelAccounts
  .filter((account) => account.status !== "conectado")
  .map((account) => ({
    id: `att_canal_${account.id}`,
    kind: "canal" as const,
    title: `Canal "${account.label}" degradado`,
    detail:
      account.qualityRating === "media"
        ? `Qualidade média no provedor · ${account.sentToday?.toLocaleString("pt-BR")} envios hoje. Reduza a frequência antes que a reputação caia.`
        : "O provedor sinalizou instabilidade neste canal.",
    severity: "alto" as const,
    href: "/administracao",
    actionLabel: "Ver canal",
    channel: account.kind,
  }));

const dataItems: AttentionItem[] = contacts
  .filter((contact) => contact.duplicateOf)
  .map((contact) => ({
    id: `att_dupe_${contact.id}`,
    kind: "dados" as const,
    title: `Possível duplicidade: ${contact.fullName}`,
    detail:
      "Telefone idêntico em outro cadastro. Mesclagem aguardando revisão de um administrador.",
    severity: "medio" as const,
    href: `/contatos/${contact.id}`,
    actionLabel: "Revisar",
    contactId: contact.id,
  }));

const SEVERITY_ORDER: Record<AttentionItem["severity"], number> = {
  critico: 0,
  alto: 1,
  medio: 2,
};

/**
 * Ordem da fila: gravidade primeiro, prazo depois. Um item vencido sempre
 * aparece acima de um item que ainda tem folga.
 */
export const attentionQueue: AttentionItem[] = [
  ...slaItems,
  ...taskItems,
  ...approvalItems,
  ...automationItems,
  ...channelItems,
  ...dataItems,
].sort((a, b) => {
  const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  if (bySeverity !== 0) return bySeverity;
  const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER;
  const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER;
  return aDue - bDue;
});

/** Rótulo de prazo já formatado, para a fila não recalcular na renderização. */
export function attentionDueLabel(item: AttentionItem): string | undefined {
  return item.dueAt ? formatCountdown(item.dueAt) : undefined;
}
