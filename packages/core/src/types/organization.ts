/**
 * Identidade e organização.
 * Referência: Plano Completo, seções 6 (perfis) e 17 (domínio de identidade).
 */

import type { BaseEntity, ChannelKind, Id, IsoDateTime } from "./common";

export type RoleKey =
  | "superadmin"
  | "admin_empresa"
  | "gestor_atendimento"
  | "atendente"
  | "gestor_comercial"
  | "marketing"
  | "criador_automacoes"
  | "analista_dados"
  | "auditor_dpo";

export const ROLE_LABEL: Record<RoleKey, string> = {
  superadmin: "Superadministrador",
  admin_empresa: "Administrador da empresa",
  gestor_atendimento: "Gestor de atendimento",
  atendente: "Atendente",
  gestor_comercial: "Gestor comercial",
  marketing: "Marketing",
  criador_automacoes: "Criador de automações",
  analista_dados: "Analista de dados",
  auditor_dpo: "Auditor / DPO",
};

export interface Organization {
  id: Id;
  name: string;
  slug: string;
  brandColor?: string;
  timezone: string;
}

export type UserPresence = "disponivel" | "ausente" | "ocupado" | "offline";

export const PRESENCE_LABEL: Record<UserPresence, string> = {
  disponivel: "Disponível",
  ausente: "Ausente",
  ocupado: "Ocupado",
  offline: "Offline",
};

export interface User {
  id: Id;
  organizationId: Id;
  name: string;
  email: string;
  initials: string;
  role: RoleKey;
  teamIds: Id[];
  presence: UserPresence;
  /** Conversas simultâneas que o roteamento pode atribuir (seção 10). */
  capacity: number;
  accentHue: number;
}

export interface Team {
  id: Id;
  organizationId: Id;
  name: string;
}

/** Fila de atendimento: separação por produto, canal, assunto, unidade ou prioridade. */
export interface Queue extends BaseEntity {
  name: string;
  description: string;
  channels: ChannelKind[];
  teamId: Id;
  /** Minutos para a primeira resposta, conforme a política de SLA da fila. */
  firstResponseSlaMinutes: number;
  resolutionSlaMinutes: number;
  color: string;
}

export interface ChannelAccount extends BaseEntity {
  kind: ChannelKind;
  label: string;
  /** Número em E.164 para WhatsApp/telefone; endereço para e-mail. */
  address: string;
  queueId: Id;
  status: "conectado" | "degradado" | "desconectado";
  qualityRating?: "alta" | "media" | "baixa";
  dailyLimit?: number;
  sentToday?: number;
  lastSyncAt?: IsoDateTime;
}
