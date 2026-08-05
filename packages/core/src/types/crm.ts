/**
 * Domínio CRM 360º.
 * Referência: Plano Completo, seção 9 (entidades, visão única, dedupe, pipelines).
 */

import type { BaseEntity, ChannelKind, Id, IsoDateTime } from "./common";

/**
 * Identificador de canal do contato. A resolução de identidade não depende
 * apenas do e-mail (seção 9.3): telefone normalizado, e-mail normalizado, IDs
 * externos e identificadores dos canais participam do grafo de identidade.
 */
export interface ContactIdentifier {
  id: Id;
  kind: "telefone" | "email" | "whatsapp" | "instagram" | "cpf" | "externo";
  value: string;
  verified: boolean;
  primary: boolean;
}

export type ConsentStatus = "concedido" | "negado" | "revogado" | "pendente";

/** Prova de consentimento por finalidade e canal (seções 18 e 31). */
export interface Consent {
  id: Id;
  purpose: "marketing" | "atendimento" | "cobranca" | "academico";
  channel: ChannelKind;
  status: ConsentStatus;
  source: string;
  legalBasis: string;
  acceptedText?: string;
  version: string;
  occurredAt: IsoDateTime;
}

export type LifecycleStage =
  "visitante" | "lead" | "lead_qualificado" | "oportunidade" | "cliente" | "aluno" | "inativo";

export const LIFECYCLE_LABEL: Record<LifecycleStage, string> = {
  visitante: "Visitante",
  lead: "Lead",
  lead_qualificado: "Lead qualificado",
  oportunidade: "Oportunidade",
  cliente: "Cliente",
  aluno: "Aluno",
  inativo: "Inativo",
};

export interface Tag {
  id: Id;
  name: string;
  /** Matiz HSL do chip, para manter a paleta coerente sem cor solta. */
  hue: number;
}

export interface CustomFieldValue {
  key: string;
  label: string;
  value: string;
  /** Campo derivado não é editável manualmente (seção 27.2). */
  derived?: boolean;
}

export interface Company extends BaseEntity {
  name: string;
  document?: string;
  segment?: string;
  city?: string;
  state?: string;
  contactsCount: number;
}

export interface Contact extends BaseEntity {
  fullName: string;
  preferredName?: string;
  avatarInitials: string;
  accentHue: number;
  email?: string;
  phone?: string;
  jobTitle?: string;
  companyId?: Id;
  ownerId?: Id;
  lifecycleStage: LifecycleStage;
  score: number;
  originChannel: ChannelKind;
  originCampaign?: string;
  city?: string;
  state?: string;
  identifiers: ContactIdentifier[];
  tagIds: Id[];
  consents: Consent[];
  customFields: CustomFieldValue[];
  lastInteractionAt?: IsoDateTime;
  /** Marcado quando o motor de identidade suspeita de duplicidade (seção 9.3). */
  duplicateOf?: Id;
}

export interface PipelineStage {
  id: Id;
  name: string;
  order: number;
  /** Probabilidade padrão de fechamento da etapa, em porcentagem. */
  probability: number;
  /** Dias além dos quais o negócio é considerado parado nesta etapa. */
  stalledAfterDays: number;
  kind: "aberta" | "ganha" | "perdida";
}

export interface Pipeline extends BaseEntity {
  name: string;
  description: string;
  stages: PipelineStage[];
}

export interface Deal extends BaseEntity {
  title: string;
  pipelineId: Id;
  stageId: Id;
  contactId: Id;
  companyId?: Id;
  ownerId: Id;
  /** Valor em centavos, para evitar aritmética de ponto flutuante. */
  amountCents: number;
  currency: "BRL";
  probability: number;
  expectedCloseDate: IsoDateTime;
  product: string;
  lostReason?: string;
  stageEnteredAt: IsoDateTime;
  tagIds: Id[];
}

export type ActivityKind =
  | "nota"
  | "tarefa"
  | "ligacao"
  | "reuniao"
  | "mensagem"
  | "email"
  | "mudanca_etapa"
  | "campanha"
  | "consentimento"
  | "automacao"
  | "sistema";

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  nota: "Nota",
  tarefa: "Tarefa",
  ligacao: "Ligação",
  reuniao: "Reunião",
  mensagem: "Mensagem",
  email: "E-mail",
  mudanca_etapa: "Mudança de etapa",
  campanha: "Campanha",
  consentimento: "Consentimento",
  automacao: "Automação",
  sistema: "Sistema",
};

/**
 * Item da linha do tempo do contato. A timeline aceita filtro por tipo de
 * evento, canal e período (seção 9.2).
 */
export interface TimelineEntry {
  id: Id;
  organizationId: Id;
  contactId: Id;
  kind: ActivityKind;
  channel?: ChannelKind;
  title: string;
  description?: string;
  actorId?: Id;
  actorLabel?: string;
  occurredAt: IsoDateTime;
  /** Evento de domínio que originou o registro, para rastreabilidade. */
  domainEvent?: string;
  correlationId?: string;
}

export type TaskStatus = "aberta" | "concluida" | "cancelada";

export interface Task {
  id: Id;
  organizationId: Id;
  contactId?: Id;
  dealId?: Id;
  title: string;
  dueAt: IsoDateTime;
  assigneeId: Id;
  status: TaskStatus;
  kind: "ligacao" | "email" | "reuniao" | "documento" | "followup";
}
