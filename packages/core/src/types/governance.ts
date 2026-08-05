/**
 * Governança: auditoria, permissões e feature flags.
 * Referência: Plano Completo, seções 6 (perfis), 18 e 31 (controles).
 */

import type { Id, IsoDateTime } from "./common";
import type { RoleKey } from "./organization";

/** Nível de acesso a um recurso. A escala é cumulativa. */
export type PermissionLevel = "nenhum" | "ver" | "editar" | "publicar" | "administrar";

export const PERMISSION_LABEL: Record<PermissionLevel, string> = {
  nenhum: "Sem acesso",
  ver: "Ver",
  editar: "Editar",
  publicar: "Publicar",
  administrar: "Administrar",
};

export interface PermissionRow {
  resource: string;
  label: string;
  description: string;
  levels: Partial<Record<RoleKey, PermissionLevel>>;
}

/**
 * Entrada de auditoria. Login, exportação, alteração de permissão, publicação,
 * disparo, acesso a dado sensível e ação de IA são registrados (seção 18).
 */
export interface AuditEntry {
  id: Id;
  occurredAt: IsoDateTime;
  actorId?: Id;
  actorLabel: string;
  action: string;
  category: "acesso" | "dados" | "configuracao" | "disparo" | "automacao" | "ia" | "seguranca";
  target: string;
  detail: string;
  ip?: string;
  correlationId?: string;
  severity: "informativo" | "atencao" | "critico";
}

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  /** Percentual de exposição quando o lançamento é gradual. */
  rolloutPct: number;
  owner: string;
  updatedAt: IsoDateTime;
}

export interface RetentionPolicy {
  category: string;
  description: string;
  retentionDays: number;
  action: "anonimizar" | "excluir" | "arquivar";
  legalHold: boolean;
}
