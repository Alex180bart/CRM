/**
 * Construtores das verticais de demonstração.
 *
 * Os arquivos de `mock/` já usavam o padrão semente + construtor: um literal
 * curto descreve o caso, e uma função o expande para a entidade completa com
 * `organizationId`, carimbos e derivados. Aqui esse padrão vira função
 * compartilhada, porque agora existem quatro bases e não uma — copiar o
 * construtor para cada vertical faria a quinta nascer com o SLA calculado de um
 * jeito e as outras de outro.
 *
 * Nada aqui inventa conteúdo: cada construtor só preenche o que é mecânico
 * (identificador derivado, data ancorada, prévia da última mensagem, status de
 * SLA). O que é narrativa fica na vertical.
 */

import type { ChannelKind, Id } from "../types/common";
import type {
  Company,
  Consent,
  Contact,
  ContactIdentifier,
  CustomFieldValue,
  Deal,
  LifecycleStage,
  Pipeline,
  Task,
  TimelineEntry,
} from "../types/crm";
import type {
  Attachment,
  Conversation,
  ConversationState,
  InternalNote,
  Message,
  MessageAuthorKind,
  MessageDeliveryStatus,
} from "../types/inbox";
import type {
  Campaign,
  CampaignGuardrails,
  CampaignMetrics,
  CampaignThrottle,
} from "../types/marketing";
import type { ChannelAccount, Queue, QueueDistribution, User } from "../types/organization";
import type { ClosingReason, CustomFieldDefinition, SkillDefinition } from "../types/catalog";
import { DEFAULT_DISTRIBUTION } from "../types/organization";
import { initialsOf } from "../utils/format";
import { offsetIso } from "../utils/datetime";
import { resolveSlaStatus } from "../utils/sla";

/* Organização --------------------------------------------------------------- */

export interface UserSeed {
  id: Id;
  name: string;
  email: string;
  role: User["role"];
  teamIds: Id[];
  presence: User["presence"];
  capacity: number;
  hue: number;
  skills: string[];
  acceptingNew?: boolean;
  scheduleId?: Id;
}

export function buildUsers(orgId: Id, seeds: UserSeed[]): User[] {
  return seeds.map((seed) => ({
    id: seed.id,
    organizationId: orgId,
    name: seed.name,
    email: seed.email,
    initials: initialsOf(seed.name),
    role: seed.role,
    teamIds: seed.teamIds,
    presence: seed.presence,
    capacity: seed.capacity,
    accentHue: seed.hue,
    skills: seed.skills,
    acceptingNew: seed.acceptingNew ?? true,
    scheduleId: seed.scheduleId ?? "sched_comercial",
  }));
}

export interface QueueSeed {
  id: Id;
  name: string;
  description: string;
  channels: ChannelKind[];
  teamId: Id;
  firstResponseSlaMinutes: number;
  resolutionSlaMinutes: number;
  color: string;
  scheduleId?: Id;
  distribution?: Partial<QueueDistribution>;
}

export function buildQueues(orgId: Id, seeds: QueueSeed[]): Queue[] {
  return seeds.map((seed, index) => ({
    id: seed.id,
    organizationId: orgId,
    name: seed.name,
    description: seed.description,
    channels: seed.channels,
    teamId: seed.teamId,
    firstResponseSlaMinutes: seed.firstResponseSlaMinutes,
    resolutionSlaMinutes: seed.resolutionSlaMinutes,
    color: seed.color,
    scheduleId: seed.scheduleId ?? "sched_comercial",
    distribution: {
      ...DEFAULT_DISTRIBUTION,
      requiredSkills: [],
      ...seed.distribution,
    },
    createdAt: offsetIso({ days: -240 + index * 20 }),
    updatedAt: offsetIso({ days: -6 - index }),
  }));
}

export interface ChannelAccountSeed {
  id: Id;
  kind: ChannelKind;
  label: string;
  address: string;
  queueId: Id;
  status?: ChannelAccount["status"];
  qualityRating?: ChannelAccount["qualityRating"];
  dailyLimit?: number;
  sentToday?: number;
}

export function buildChannelAccounts(orgId: Id, seeds: ChannelAccountSeed[]): ChannelAccount[] {
  return seeds.map((seed, index) => ({
    id: seed.id,
    organizationId: orgId,
    kind: seed.kind,
    label: seed.label,
    address: seed.address,
    queueId: seed.queueId,
    status: seed.status ?? "conectado",
    qualityRating: seed.qualityRating,
    dailyLimit: seed.dailyLimit,
    sentToday: seed.sentToday,
    lastSyncAt: offsetIso({ minutes: -(index + 1) * 2 }),
    createdAt: offsetIso({ days: -300 + index * 30 }),
    updatedAt: offsetIso({ minutes: -(index + 1) * 2 }),
  }));
}

/* Catálogo ------------------------------------------------------------------- */

export interface SkillSeed {
  key: string;
  label: string;
  description: string;
  hue: number;
}

export function buildSkills(orgId: Id, seeds: SkillSeed[]): SkillDefinition[] {
  return seeds.map((seed, index) => ({
    id: `skl_${seed.key}`,
    organizationId: orgId,
    key: seed.key,
    label: seed.label,
    description: seed.description,
    hue: seed.hue,
    active: true,
    createdAt: offsetIso({ days: -200 + index }),
    updatedAt: offsetIso({ days: -30 }),
  }));
}

export interface ClosingReasonSeed {
  key: string;
  label: string;
  description: string;
  resolved: boolean;
  requiresNote?: boolean;
}

export function buildClosingReasons(orgId: Id, seeds: ClosingReasonSeed[]): ClosingReason[] {
  return seeds.map((seed, index) => ({
    id: `cls_${seed.key}`,
    organizationId: orgId,
    key: seed.key,
    label: seed.label,
    description: seed.description,
    resolved: seed.resolved,
    requiresNote: seed.requiresNote ?? false,
    active: true,
    order: index + 1,
    createdAt: offsetIso({ days: -200 + index }),
    updatedAt: offsetIso({ days: -20 }),
  }));
}

export interface CustomFieldSeed {
  key: string;
  label: string;
  description: string;
  entity: CustomFieldDefinition["entity"];
  type: CustomFieldDefinition["type"];
  options?: string[];
  required?: boolean;
  derived?: boolean;
  sensitive?: boolean;
}

export function buildCustomFields(orgId: Id, seeds: CustomFieldSeed[]): CustomFieldDefinition[] {
  return seeds.map((seed, index) => ({
    id: `cf_${seed.key}`,
    organizationId: orgId,
    key: seed.key,
    label: seed.label,
    description: seed.description,
    entity: seed.entity,
    type: seed.type,
    options: seed.options ?? [],
    required: seed.required ?? false,
    derived: seed.derived ?? false,
    sensitive: seed.sensitive ?? false,
    active: true,
    createdAt: offsetIso({ days: -180 + index }),
    updatedAt: offsetIso({ days: -15 }),
  }));
}

/* Empresas e contatos --------------------------------------------------------- */

export interface CompanySeed {
  id: Id;
  name: string;
  document?: string;
  segment?: string;
  city?: string;
  state?: string;
  contactsCount: number;
  createdDays: number;
  updatedDays: number;
}

export function buildCompanies(orgId: Id, seeds: CompanySeed[]): Company[] {
  return seeds.map((seed) => ({
    id: seed.id,
    organizationId: orgId,
    name: seed.name,
    document: seed.document,
    segment: seed.segment,
    city: seed.city,
    state: seed.state,
    contactsCount: seed.contactsCount,
    createdAt: offsetIso({ days: -seed.createdDays }),
    updatedAt: offsetIso({ days: -seed.updatedDays }),
  }));
}

export interface ContactSeed {
  id: Id;
  name: string;
  email: string;
  phone: string;
  jobTitle?: string;
  companyId?: Id;
  ownerId: Id;
  stage: LifecycleStage;
  score: number;
  origin: ChannelKind;
  campaign?: string;
  city: string;
  state: string;
  tags: Id[];
  hue: number;
  lastDays: number;
  createdDays: number;
  duplicateOf?: Id;
  /** Campos personalizados próprios da vertical, além dos derivados. */
  fields?: CustomFieldValue[];
}

function buildIdentifiers(seed: ContactSeed): ContactIdentifier[] {
  const identifiers: ContactIdentifier[] = [
    {
      id: `${seed.id}_id_phone`,
      kind: "telefone",
      value: seed.phone,
      verified: true,
      primary: true,
    },
    {
      id: `${seed.id}_id_email`,
      kind: "email",
      value: seed.email,
      verified: seed.stage !== "lead",
      primary: true,
    },
  ];

  if (seed.origin === "whatsapp" || seed.stage === "cliente") {
    identifiers.push({
      id: `${seed.id}_id_wa`,
      kind: "whatsapp",
      value: seed.phone,
      verified: true,
      primary: false,
    });
  }

  if (seed.origin === "instagram") {
    identifiers.push({
      id: `${seed.id}_id_ig`,
      kind: "instagram",
      value: `@${seed.name.toLowerCase().split(" ")[0]}.${seed.id.slice(-3)}`,
      verified: false,
      primary: false,
    });
  }

  return identifiers;
}

function buildConsents(seed: ContactSeed, brand: string): Consent[] {
  return [
    {
      id: `${seed.id}_cs_atendimento`,
      purpose: "atendimento",
      channel: seed.origin === "email" ? "email" : "whatsapp",
      status: "concedido",
      source: seed.origin === "form" ? "Formulário do site" : "Primeiro contato pelo canal",
      legalBasis: "Execução de contrato",
      version: "v1.2",
      occurredAt: offsetIso({ days: -seed.createdDays }),
    },
    {
      id: `${seed.id}_cs_marketing`,
      purpose: "marketing",
      channel: "email",
      status: seed.stage === "inativo" ? "revogado" : "concedido",
      source: seed.campaign ?? "Site — aceite de comunicações",
      legalBasis: "Consentimento",
      acceptedText: `Aceito receber comunicações da ${brand}.`,
      version: "v1.2",
      occurredAt: offsetIso({ days: -seed.createdDays + 1 }),
    },
  ];
}

export function buildContacts(orgId: Id, brand: string, seeds: ContactSeed[]): Contact[] {
  return seeds.map((seed) => ({
    id: seed.id,
    organizationId: orgId,
    fullName: seed.name,
    avatarInitials: initialsOf(seed.name),
    accentHue: seed.hue,
    email: seed.email,
    phone: seed.phone,
    jobTitle: seed.jobTitle,
    companyId: seed.companyId,
    ownerId: seed.ownerId,
    lifecycleStage: seed.stage,
    score: seed.score,
    originChannel: seed.origin,
    originCampaign: seed.campaign,
    city: seed.city,
    state: seed.state,
    identifiers: buildIdentifiers(seed),
    tagIds: seed.tags,
    consents: buildConsents(seed, brand),
    customFields: [
      ...(seed.fields ?? []),
      {
        key: "origem_detalhada",
        label: "Origem detalhada",
        value: seed.campaign ?? "Contato direto",
      },
      {
        key: "score_calculado",
        label: "Score de engajamento",
        value: String(seed.score),
        derived: true,
      },
    ],
    lastInteractionAt: offsetIso({ days: -seed.lastDays, hours: -2 }),
    duplicateOf: seed.duplicateOf,
    createdAt: offsetIso({ days: -seed.createdDays }),
    updatedAt: offsetIso({ days: -seed.lastDays }),
    source: seed.origin,
  }));
}

/* Conversas ------------------------------------------------------------------- */

export interface MessageSeed {
  from: MessageAuthorKind;
  authorId?: Id;
  authorLabel: string;
  body: string;
  minutesAgo: number;
  status?: MessageDeliveryStatus;
  templateName?: string;
  attachments?: Attachment[];
  failureCode?: string;
  failureReason?: string;
}

export interface NoteSeed {
  authorId: Id;
  authorLabel: string;
  body: string;
  minutesAgo: number;
  mentions?: Id[];
}

export interface ConversationSeed {
  id: Id;
  contactId: Id;
  channel: ChannelKind;
  channelAccountId: Id;
  queueId: Id;
  assigneeId?: Id;
  observerIds?: Id[];
  state: ConversationState;
  subject: string;
  priority: Conversation["priority"];
  tagIds: Id[];
  unreadCount: number;
  openedMinutesAgo: number;
  firstRespondedMinutesAgo?: number;
  handoffSummary?: string;
  botSessionId?: Id;
  satisfactionScore?: number;
  messages: MessageSeed[];
  notes?: NoteSeed[];
}

const ATTACHMENT_PREVIEW = {
  imagem: "Imagem",
  documento: "Documento",
  audio: "Mensagem de voz",
  video: "Vídeo",
} as const;

function previewOf(message: MessageSeed | undefined): string {
  if (!message) return "";
  if (message.body.trim()) return message.body;

  const attachment = message.attachments?.[0];
  if (!attachment) return "";

  const label = ATTACHMENT_PREVIEW[attachment.kind];
  return attachment.kind === "documento" ? `${label}: ${attachment.fileName}` : label;
}

export interface ConversationBundle {
  conversations: Conversation[];
  messages: Message[];
  internalNotes: InternalNote[];
}

/**
 * O SLA sai da política da fila, não da semente.
 *
 * Escrever "esta conversa está com SLA estourado" na semente produziria a base
 * que contradiz a configuração: bastaria alguém afrouxar o prazo da fila na
 * Administração para a lista continuar vermelha. Aqui o prazo é calculado a
 * partir de `firstResponseSlaMinutes` e o status é derivado, exatamente como
 * será quando houver back-end.
 */
export function buildConversations(
  orgId: Id,
  queues: Queue[],
  seeds: ConversationSeed[],
): ConversationBundle {
  const queueById = new Map(queues.map((queue) => [queue.id, queue]));

  const conversations = seeds.map((seed) => {
    const queue = queueById.get(seed.queueId);
    const firstResponseSla = queue?.firstResponseSlaMinutes ?? 30;
    const resolutionSla = queue?.resolutionSlaMinutes ?? 480;
    const lastMessage = seed.messages[seed.messages.length - 1];

    const base: Conversation = {
      id: seed.id,
      organizationId: orgId,
      contactId: seed.contactId,
      channel: seed.channel,
      channelAccountId: seed.channelAccountId,
      queueId: seed.queueId,
      assigneeId: seed.assigneeId,
      observerIds: seed.observerIds ?? [],
      state: seed.state,
      subject: seed.subject,
      priority: seed.priority,
      unreadCount: seed.unreadCount,
      lastMessagePreview: previewOf(lastMessage),
      lastMessageAt: offsetIso({ minutes: -(lastMessage?.minutesAgo ?? seed.openedMinutesAgo) }),
      firstResponseDueAt: offsetIso({ minutes: -seed.openedMinutesAgo + firstResponseSla }),
      firstRespondedAt:
        seed.firstRespondedMinutesAgo === undefined
          ? undefined
          : offsetIso({ minutes: -seed.firstRespondedMinutesAgo }),
      resolutionDueAt: offsetIso({ minutes: -seed.openedMinutesAgo + resolutionSla }),
      slaStatus: "dentro",
      tagIds: seed.tagIds,
      handoffSummary: seed.handoffSummary,
      botSessionId: seed.botSessionId,
      satisfactionScore: seed.satisfactionScore,
      createdAt: offsetIso({ minutes: -seed.openedMinutesAgo }),
      updatedAt: offsetIso({ minutes: -(lastMessage?.minutesAgo ?? seed.openedMinutesAgo) }),
    };

    return { ...base, slaStatus: resolveSlaStatus(base) };
  });

  const messages = seeds.flatMap((seed) =>
    seed.messages.map((message, index) => ({
      id: `${seed.id}_msg_${String(index + 1).padStart(2, "0")}`,
      organizationId: orgId,
      conversationId: seed.id,
      direction: message.from === "contato" ? ("entrada" as const) : ("saida" as const),
      authorKind: message.from,
      authorId: message.authorId,
      authorLabel: message.authorLabel,
      channel: seed.channel,
      body: message.body,
      attachments: message.attachments,
      templateName: message.templateName,
      deliveryStatus: message.from === "contato" ? undefined : (message.status ?? "entregue"),
      failureCode: message.failureCode,
      failureReason: message.failureReason,
      occurredAt: offsetIso({ minutes: -message.minutesAgo }),
    })),
  );

  const internalNotes = seeds.flatMap((seed) =>
    (seed.notes ?? []).map((note, index) => ({
      id: `${seed.id}_note_${index + 1}`,
      conversationId: seed.id,
      authorId: note.authorId,
      authorLabel: note.authorLabel,
      body: note.body,
      mentionedUserIds: note.mentions ?? [],
      occurredAt: offsetIso({ minutes: -note.minutesAgo }),
    })),
  );

  return { conversations, messages, internalNotes };
}

/* Funil ----------------------------------------------------------------------- */

export interface DealSeed {
  id: Id;
  title: string;
  pipelineId: Id;
  stageId: Id;
  contactId: Id;
  companyId?: Id;
  ownerId: Id;
  amountCents: number;
  probability: number;
  expectedCloseDays: number;
  product: string;
  lostReason?: string;
  stageEnteredDays: number;
  createdDays: number;
  tagIds?: Id[];
}

export function buildDeals(orgId: Id, seeds: DealSeed[]): Deal[] {
  return seeds.map((seed) => ({
    id: seed.id,
    organizationId: orgId,
    title: seed.title,
    pipelineId: seed.pipelineId,
    stageId: seed.stageId,
    contactId: seed.contactId,
    companyId: seed.companyId,
    ownerId: seed.ownerId,
    amountCents: seed.amountCents,
    currency: "BRL" as const,
    probability: seed.probability,
    expectedCloseDate: offsetIso({ days: seed.expectedCloseDays }),
    product: seed.product,
    lostReason: seed.lostReason,
    stageEnteredAt: offsetIso({ days: -seed.stageEnteredDays }),
    tagIds: seed.tagIds ?? [],
    createdAt: offsetIso({ days: -seed.createdDays }),
    updatedAt: offsetIso({ days: -seed.stageEnteredDays }),
  }));
}

export interface TaskSeed {
  id: Id;
  title: string;
  contactId?: Id;
  dealId?: Id;
  dueHours: number;
  assigneeId: Id;
  status?: Task["status"];
  kind: Task["kind"];
}

export function buildTasks(orgId: Id, seeds: TaskSeed[]): Task[] {
  return seeds.map((seed) => ({
    id: seed.id,
    organizationId: orgId,
    contactId: seed.contactId,
    dealId: seed.dealId,
    title: seed.title,
    dueAt: offsetIso({ hours: seed.dueHours }),
    assigneeId: seed.assigneeId,
    status: seed.status ?? "aberta",
    kind: seed.kind,
  }));
}

/* Linha do tempo --------------------------------------------------------------- */

export interface TimelineTouch {
  contactId: Id;
  kind: TimelineEntry["kind"];
  title: string;
  description: string;
  hoursAgo: number;
  channel?: ChannelKind;
  domainEvent?: string;
}

/**
 * A linha do tempo é derivada, não escrita.
 *
 * Ela nasce do que já existe — cadastro, consentimento, mensagem, negócio — e
 * só aceita acréscimo para o que não tem entidade própria na base, como o toque
 * de campanha. Escrever a timeline à mão produziria a contradição clássica da
 * demonstração: um evento "mensagem recebida" sem mensagem correspondente no
 * Inbox, e a pergunta "cadê essa conversa?" no meio da apresentação.
 */
export function buildTimeline(input: {
  orgId: Id;
  contacts: Contact[];
  conversations: Conversation[];
  messages: Message[];
  deals: Deal[];
  pipelines: Pipeline[];
  users: User[];
  touches?: TimelineTouch[];
}): TimelineEntry[] {
  const { orgId } = input;
  const userNameById = new Map(input.users.map((user) => [user.id, user.name]));
  const conversationById = new Map(input.conversations.map((item) => [item.id, item]));
  const stageNameById = new Map(
    input.pipelines.flatMap((pipeline) =>
      pipeline.stages.map((stage) => [stage.id, stage.name] as const),
    ),
  );

  const entries: TimelineEntry[] = [];

  for (const contact of input.contacts) {
    entries.push({
      id: `tl_${contact.id}_created`,
      organizationId: orgId,
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
        organizationId: orgId,
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
        organizationId: orgId,
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

  for (const message of input.messages) {
    const conversation = conversationById.get(message.conversationId);
    if (!conversation) continue;

    entries.push({
      id: `tl_${message.id}`,
      organizationId: orgId,
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

  for (const deal of input.deals) {
    entries.push({
      id: `tl_${deal.id}_created`,
      organizationId: orgId,
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
      organizationId: orgId,
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

  for (const touch of input.touches ?? []) {
    entries.push({
      id: `tl_touch_${touch.contactId}_${touch.hoursAgo}_${touch.kind}`,
      organizationId: orgId,
      contactId: touch.contactId,
      kind: touch.kind,
      channel: touch.channel,
      title: touch.title,
      description: touch.description,
      occurredAt: offsetIso({ hours: -touch.hoursAgo }),
      domainEvent: touch.domainEvent,
    });
  }

  return entries.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

/* Campanhas -------------------------------------------------------------------- */

export const DEFAULT_GUARDRAILS: CampaignGuardrails = {
  requireConsent: true,
  respectSuppressionList: true,
  quietHoursStart: 21,
  quietHoursEnd: 8,
  frequencyCapDays: 7,
  autoCancelErrorPct: 8,
  autoCancelOptOutPct: 2,
};

export const DEFAULT_THROTTLE: CampaignThrottle = {
  batchSize: 250,
  intervalMinutes: 10,
  maxPerHour: 1500,
};

export interface CampaignSeed {
  id: Id;
  name: string;
  objective: string;
  channel: ChannelKind;
  channelAccountId: Id;
  segmentId: Id;
  templateId: Id;
  status: Campaign["status"];
  ownerId: Id;
  scheduledInHours?: number;
  startedHoursAgo?: number;
  finishedHoursAgo?: number;
  utm: { source: string; medium: string; campaign: string };
  metrics: CampaignMetrics;
  throttle?: Partial<CampaignThrottle>;
  guardrails?: Partial<CampaignGuardrails>;
  deliveryTimeline?: Array<{ label: string; value: number }>;
}

/**
 * Os lotes são derivados do público e da vazão configurada.
 *
 * Escrevê-los na semente permitiria a incoerência que confunde quem olha de
 * perto: seis lotes de 250 para um público de 900. Aqui a conta é a mesma que o
 * despachante fará.
 */
export function buildCampaigns(orgId: Id, seeds: CampaignSeed[]): Campaign[] {
  return seeds.map((seed) => {
    const throttle = { ...DEFAULT_THROTTLE, ...seed.throttle };
    const total = seed.metrics.eligible;
    const batchCount = Math.max(1, Math.ceil(total / throttle.batchSize));
    const sent = seed.metrics.sent;

    const batches = Array.from({ length: batchCount }, (_, index) => {
      const size = Math.min(throttle.batchSize, total - index * throttle.batchSize);
      const cumulative = (index + 1) * throttle.batchSize;
      const done = sent >= cumulative;
      const running = !done && sent > index * throttle.batchSize;

      return {
        id: `${seed.id}_lote_${index + 1}`,
        index: index + 1,
        size,
        status: done
          ? ("enviado" as const)
          : running
            ? ("enviando" as const)
            : ("pendente" as const),
        scheduledAt: offsetIso({
          hours: -(seed.startedHoursAgo ?? 0),
          minutes: index * throttle.intervalMinutes,
        }),
        sentAt: done
          ? offsetIso({
              hours: -(seed.startedHoursAgo ?? 0),
              minutes: index * throttle.intervalMinutes + 2,
            })
          : undefined,
      };
    });

    return {
      id: seed.id,
      organizationId: orgId,
      name: seed.name,
      objective: seed.objective,
      channel: seed.channel,
      channelAccountId: seed.channelAccountId,
      segmentId: seed.segmentId,
      templateId: seed.templateId,
      status: seed.status,
      ownerId: seed.ownerId,
      scheduledAt:
        seed.scheduledInHours === undefined
          ? undefined
          : offsetIso({ hours: seed.scheduledInHours }),
      startedAt:
        seed.startedHoursAgo === undefined
          ? undefined
          : offsetIso({ hours: -seed.startedHoursAgo }),
      finishedAt:
        seed.finishedHoursAgo === undefined
          ? undefined
          : offsetIso({ hours: -seed.finishedHoursAgo }),
      approval: {
        required: true,
        thresholdAudience: 500,
        requestedBy: seed.ownerId,
        requestedAt: offsetIso({ hours: -(seed.startedHoursAgo ?? 6) - 4 }),
        approvedBy: "usr_alex",
        approvedAt: offsetIso({ hours: -(seed.startedHoursAgo ?? 6) - 2 }),
      },
      throttle,
      guardrails: { ...DEFAULT_GUARDRAILS, ...seed.guardrails },
      utm: seed.utm,
      metrics: seed.metrics,
      batches,
      deliveryTimeline: seed.deliveryTimeline,
      createdAt: offsetIso({ days: -20 }),
      updatedAt: offsetIso({ hours: -(seed.startedHoursAgo ?? 2) }),
    };
  });
}
