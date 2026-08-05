/**
 * Campanhas, segmentos e templates.
 * Referência: Plano Completo, seções 13 (campanhas), 31.1 (controles de disparo).
 *
 * Regra que atravessa o módulo: **campanha em massa não é "enviar para todos"**.
 * Base sem consentimento é bloqueada, descadastro é respeitado, frequência é
 * controlada, template é validado e o envio é dividido em lotes.
 */

import type { BaseEntity, ChannelKind, Id, IsoDateTime } from "./common";

/* Segmentação ------------------------------------------------------------- */

export type SegmentOperator =
  | "igual_a"
  | "diferente_de"
  | "contem"
  | "comeca_com"
  | "maior_que"
  | "menor_que"
  | "nos_ultimos_dias"
  | "existe"
  | "nao_existe";

export const SEGMENT_OPERATOR_LABEL: Record<SegmentOperator, string> = {
  igual_a: "é igual a",
  diferente_de: "é diferente de",
  contem: "contém",
  comeca_com: "começa com",
  maior_que: "é maior que",
  menor_que: "é menor que",
  nos_ultimos_dias: "ocorreu nos últimos (dias)",
  existe: "existe",
  nao_existe: "não existe",
};

export interface SegmentRule {
  id: Id;
  field: string;
  fieldLabel: string;
  operator: SegmentOperator;
  value: string;
}

/** Grupo de regras. Grupos se combinam entre si pela regra do segmento. */
export interface SegmentGroup {
  id: Id;
  match: "todas" | "qualquer";
  rules: SegmentRule[];
}

export interface SegmentExclusion {
  reason: string;
  count: number;
}

export interface Segment extends BaseEntity {
  name: string;
  description: string;
  match: "todas" | "qualquer";
  groups: SegmentGroup[];
  /** Dinâmico é recalculado no momento do disparo (seção 13.2). */
  dynamic: boolean;
  estimatedSize: number;
  eligibleSize: number;
  exclusions: SegmentExclusion[];
  lastCalculatedAt: IsoDateTime;
}

/* Templates --------------------------------------------------------------- */

export type TemplateStatus = "aprovado" | "em_analise" | "rejeitado" | "pausado";

export const TEMPLATE_STATUS_LABEL: Record<TemplateStatus, string> = {
  aprovado: "Aprovado",
  em_analise: "Em análise",
  rejeitado: "Rejeitado",
  pausado: "Pausado",
};

export interface MessageTemplate extends BaseEntity {
  name: string;
  channel: ChannelKind;
  category: "marketing" | "utilidade" | "autenticacao";
  language: string;
  status: TemplateStatus;
  headerText?: string;
  body: string;
  footerText?: string;
  buttons?: string[];
  variables: string[];
  /** Qualidade reportada pelo provedor, quando houver. */
  quality?: "alta" | "media" | "baixa";
  rejectionReason?: string;
}

/* Campanhas --------------------------------------------------------------- */

export type CampaignStatus =
  "rascunho" | "em_aprovacao" | "agendada" | "enviando" | "pausada" | "concluida" | "cancelada";

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  rascunho: "Rascunho",
  em_aprovacao: "Em aprovação",
  agendada: "Agendada",
  enviando: "Enviando",
  pausada: "Pausada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export interface CampaignMetrics {
  eligible: number;
  excluded: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  converted: number;
  failed: number;
  optOuts: number;
  costCents: number;
}

export interface CampaignBatch {
  id: Id;
  index: number;
  size: number;
  status: "pendente" | "enviando" | "enviado" | "falhou" | "cancelado";
  scheduledAt: IsoDateTime;
  sentAt?: IsoDateTime;
  failed?: number;
}

/** Proteções obrigatórias antes de qualquer disparo (seções 13.3 e 31.1). */
export interface CampaignGuardrails {
  requireConsent: boolean;
  respectSuppressionList: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  frequencyCapDays: number;
  /** Cancela automaticamente acima desta taxa de erro, em porcentagem. */
  autoCancelErrorPct: number;
  autoCancelOptOutPct: number;
}

export interface CampaignThrottle {
  batchSize: number;
  intervalMinutes: number;
  maxPerHour: number;
}

export interface CampaignApproval {
  required: boolean;
  /** Acima deste tamanho de público, a aprovação passa a ser exigida. */
  thresholdAudience: number;
  requestedBy?: Id;
  requestedAt?: IsoDateTime;
  approvedBy?: Id;
  approvedAt?: IsoDateTime;
  note?: string;
}

export interface CampaignVariant {
  id: Id;
  label: string;
  templateId: Id;
  /** Participação do público, em porcentagem. */
  sharePct: number;
  metrics?: Pick<CampaignMetrics, "sent" | "delivered" | "read" | "replied" | "converted">;
}

export interface Campaign extends BaseEntity {
  name: string;
  objective: string;
  channel: ChannelKind;
  channelAccountId: Id;
  segmentId: Id;
  templateId: Id;
  status: CampaignStatus;
  ownerId: Id;
  scheduledAt?: IsoDateTime;
  startedAt?: IsoDateTime;
  finishedAt?: IsoDateTime;
  approval: CampaignApproval;
  throttle: CampaignThrottle;
  guardrails: CampaignGuardrails;
  utm: { source: string; medium: string; campaign: string };
  metrics: CampaignMetrics;
  batches: CampaignBatch[];
  variants?: CampaignVariant[];
  /** Série diária de entregas, para o gráfico de acompanhamento. */
  deliveryTimeline?: Array<{ label: string; value: number }>;
}
