/**
 * Tipos transversais do CRM.
 *
 * Referência: Plano Completo, seção 17.1 (campos transversais) e seção 8
 * (modelo orientado a eventos).
 */

export type Id = string;
export type IsoDateTime = string;

/**
 * Campos que toda entidade de negócio carrega. `organizationId` é obrigatório
 * porque a plataforma é multiempresa e a política RLS valida a associação do
 * usuário à organização (seção 7.3).
 */
export interface BaseEntity {
  id: Id;
  organizationId: Id;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  createdBy?: Id;
  updatedBy?: Id;
  metadata?: Record<string, unknown>;
  source?: string;
  externalId?: string;
  deletedAt?: IsoDateTime | null;
}

/** Canais suportados. Cada canal é um adaptador, não uma regra de negócio (seção 3.2). */
export type ChannelKind =
  "whatsapp" | "email" | "instagram" | "messenger" | "webchat" | "form" | "phone" | "internal";

export const CHANNEL_LABEL: Record<ChannelKind, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  instagram: "Instagram",
  messenger: "Messenger",
  webchat: "Webchat",
  form: "Formulário",
  phone: "Telefone",
  internal: "Interno",
};

/** Resultado paginado — listas grandes nunca vêm inteiras (seção 19). */
export interface Page<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface Actor {
  id: Id;
  name: string;
  avatarUrl?: string;
}
