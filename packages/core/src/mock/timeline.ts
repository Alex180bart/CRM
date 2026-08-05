/**
 * Base de demonstração — linha do tempo do contato.
 *
 * A timeline é derivada dos eventos de domínio (seção 8 do plano): cadastro,
 * consentimento, mensagens, mudanças de etapa, campanhas e automações. Cada
 * entrada guarda o nome do evento de origem para permitir rastreabilidade.
 */

import type { TimelineEntry } from "../types/crm";
import { offsetIso } from "../utils/datetime";
import { contacts } from "./contacts";
import { conversations, messages } from "./inbox";
import { deals, pipelines } from "./pipeline";
import { ORG_ID, users } from "./organization";

const userNameById = new Map(users.map((user) => [user.id, user.name]));
const conversationById = new Map(
  conversations.map((conversation) => [conversation.id, conversation]),
);
const stageNameById = new Map(
  pipelines.flatMap((pipeline) => pipeline.stages.map((stage) => [stage.id, stage.name] as const)),
);

const entries: TimelineEntry[] = [];

/* Cadastro e consentimento ------------------------------------------------ */
for (const contact of contacts) {
  entries.push({
    id: `tl_${contact.id}_created`,
    organizationId: ORG_ID,
    contactId: contact.id,
    kind: "sistema",
    channel: contact.originChannel,
    title: "Contato criado",
    description: contact.originCampaign
      ? `Origem: ${contact.originCampaign}`
      : "Origem: contato direto pelo canal",
    occurredAt: contact.createdAt,
    domainEvent: "contact.created",
    correlationId: `corr_${contact.id}_001`,
  });

  for (const consent of contact.consents) {
    entries.push({
      id: `tl_${consent.id}`,
      organizationId: ORG_ID,
      contactId: contact.id,
      kind: "consentimento",
      channel: consent.channel,
      title:
        consent.status === "revogado"
          ? `Consentimento revogado — ${consent.purpose}`
          : `Consentimento registrado — ${consent.purpose}`,
      description: `Base legal: ${consent.legalBasis} · Fonte: ${consent.source} · Versão ${consent.version}`,
      occurredAt: consent.occurredAt,
      domainEvent: consent.status === "revogado" ? "consent.revoked" : "consent.granted",
    });
  }

  if (contact.duplicateOf) {
    entries.push({
      id: `tl_${contact.id}_dupe`,
      organizationId: ORG_ID,
      contactId: contact.id,
      kind: "sistema",
      title: "Possível duplicidade detectada",
      description:
        "O motor de identidade encontrou telefone idêntico em outro cadastro. Mesclagem pendente de revisão.",
      occurredAt: offsetIso({ days: -2 }),
      domainEvent: "contact.duplicate_suspected",
    });
  }
}

/* Mensagens --------------------------------------------------------------- */
for (const message of messages) {
  const conversation = conversationById.get(message.conversationId);
  if (!conversation) continue;

  entries.push({
    id: `tl_${message.id}`,
    organizationId: ORG_ID,
    contactId: conversation.contactId,
    kind: message.channel === "email" ? "email" : "mensagem",
    channel: message.channel,
    title:
      message.direction === "entrada"
        ? `Mensagem recebida — ${conversation.subject}`
        : `Mensagem enviada — ${conversation.subject}`,
    description: message.body,
    actorId: message.authorId,
    actorLabel: message.authorLabel,
    occurredAt: message.occurredAt,
    domainEvent: message.direction === "entrada" ? "message.received" : "message.sent",
    correlationId: `corr_${conversation.id}`,
  });
}

/* Negócios ---------------------------------------------------------------- */
for (const deal of deals) {
  entries.push({
    id: `tl_${deal.id}_created`,
    organizationId: ORG_ID,
    contactId: deal.contactId,
    kind: "sistema",
    title: `Negócio criado — ${deal.title}`,
    description: `Produto: ${deal.product}`,
    actorId: deal.ownerId,
    actorLabel: userNameById.get(deal.ownerId),
    occurredAt: deal.createdAt,
    domainEvent: "deal.created",
  });

  entries.push({
    id: `tl_${deal.id}_stage`,
    organizationId: ORG_ID,
    contactId: deal.contactId,
    kind: "mudanca_etapa",
    title: `Negócio movido para "${stageNameById.get(deal.stageId) ?? deal.stageId}"`,
    description: deal.lostReason
      ? `Motivo de perda: ${deal.lostReason}`
      : `Probabilidade: ${deal.probability}%`,
    actorId: deal.ownerId,
    actorLabel: userNameById.get(deal.ownerId),
    occurredAt: deal.stageEnteredAt,
    domainEvent: "deal.stage_changed",
  });
}

/* Campanhas e automações -------------------------------------------------- */
const CAMPAIGN_TOUCHES: Array<{
  contactId: string;
  title: string;
  description: string;
  daysAgo: number;
  channel: "whatsapp" | "email";
}> = [
  {
    contactId: "cnt_001",
    title: "Campanha recebida — Obrigações de agosto",
    description: "Entregue e lida. Sem resposta registrada.",
    daysAgo: 6,
    channel: "whatsapp",
  },
  {
    contactId: "cnt_003",
    title: "Campanha recebida — Webinar de planejamento tributário",
    description: "E-mail entregue, aberto 2 vezes, 1 clique no botão de inscrição.",
    daysAgo: 9,
    channel: "email",
  },
  {
    contactId: "cnt_007",
    title: "Campanha recebida — Turma avançada com desconto de aluno",
    description: "Entregue e respondida. Lead encaminhado ao funil de matrículas.",
    daysAgo: 4,
    channel: "whatsapp",
  },
  {
    contactId: "cnt_015",
    title: "Campanha recebida — Turma avançada com desconto de aluno",
    description: "Entregue e lida.",
    daysAgo: 4,
    channel: "whatsapp",
  },
  {
    contactId: "cnt_023",
    title: "Campanha recebida — Renovação com desconto",
    description: "Template renovacao_curso_v3 entregue.",
    daysAgo: 2,
    channel: "whatsapp",
  },
  {
    contactId: "cnt_016",
    title: "Campanha suprimida — Régua de inadimplência",
    description: "Contato excluído do envio: limite de frequência semanal atingido.",
    daysAgo: 3,
    channel: "whatsapp",
  },
];

for (const touch of CAMPAIGN_TOUCHES) {
  entries.push({
    id: `tl_camp_${touch.contactId}_${touch.daysAgo}`,
    organizationId: ORG_ID,
    contactId: touch.contactId,
    kind: "campanha",
    channel: touch.channel,
    title: touch.title,
    description: touch.description,
    occurredAt: offsetIso({ days: -touch.daysAgo }),
    domainEvent: "campaign.delivered",
  });
}

const AUTOMATION_TOUCHES: Array<{
  contactId: string;
  title: string;
  description: string;
  hoursAgo: number;
}> = [
  {
    contactId: "cnt_004",
    title: "Jornada iniciada — Nutrição de leads de migração",
    description: "Entrada por evento lead.qualified. Versão publicada v3.",
    hoursAgo: 26,
  },
  {
    contactId: "cnt_010",
    title: "Bot executado — Qualificação comercial",
    description: "8 passos executados, contato encaminhado para a fila comercial.",
    hoursAgo: 1,
  },
  {
    contactId: "cnt_013",
    title: "Jornada iniciada — Nutrição de leads de migração",
    description: "Entrada por evento lead.qualified. Versão publicada v3.",
    hoursAgo: 20,
  },
  {
    contactId: "cnt_020",
    title: "Tarefa criada por automação",
    description: "Regra: oportunidade acima de R$ 5.000 gera tarefa para o gestor comercial.",
    hoursAgo: 4,
  },
  {
    contactId: "cnt_022",
    title: "Bot executado — Triagem fiscal",
    description: 'Intenção classificada como "desenquadramento". Transferido para humano.',
    hoursAgo: 3,
  },
];

for (const touch of AUTOMATION_TOUCHES) {
  entries.push({
    id: `tl_auto_${touch.contactId}_${touch.hoursAgo}`,
    organizationId: ORG_ID,
    contactId: touch.contactId,
    kind: "automacao",
    title: touch.title,
    description: touch.description,
    occurredAt: offsetIso({ hours: -touch.hoursAgo }),
    domainEvent: "journey.enrolled",
  });
}

export const timeline: TimelineEntry[] = entries.sort(
  (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
);
