/**
 * Governança: auditoria, permissões e feature flags.
 * Referência: Plano Completo, seções 6 (perfis), 18 e 31 (controles).
 */

import type { BaseEntity, Id, IsoDateTime } from "./common";
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

/* Perfis customizados -------------------------------------------------------- */

/**
 * Perfil criado pela organização, derivado de um embutido.
 *
 * ## Por que deriva em vez de nascer vazio
 *
 * Um perfil em branco tem 100% de chance de esquecer alguma linha da matriz, e o
 * que se esquece nunca é a linha perigosa — é a linha necessária. O resultado é
 * a pessoa contratada na segunda que não consegue abrir o Inbox na terça, e
 * ninguém relaciona uma coisa à outra. Partindo de um embutido, o perfil já
 * chega coerente e a organização mexe só no que quer diferente.
 *
 * `overrides` guarda **apenas a diferença**. Copiar a matriz inteira faria o
 * perfil customizado congelar no dia em que foi criado: um recurso novo no
 * produto não apareceria nele, e o sintoma seria "o perfil Analista Fiscal não
 * enxerga o módulo que lançamos ontem".
 *
 * ## O alcance é a outra metade
 *
 * `queueIds` e `teamIds` respondem uma pergunta que a matriz não responde:
 * *sobre quais dados*. "Editar conversa" sem recorte significa editar a conversa
 * de qualquer fila — inclusive a jurídica. Vazio é "todas", porque é o
 * comportamento dos perfis embutidos e mudar o padrão trancaria quem migrasse.
 */
export interface CustomRole extends BaseEntity {
  key: string;
  label: string;
  description: string;
  basedOn: RoleKey;
  /** Só o que difere do perfil de origem. Recurso ausente herda. */
  overrides: Record<string, PermissionLevel>;
  /** Filas alcançadas. Vazio significa todas. */
  queueIds: Id[];
  /** Times cujos dados são alcançados. Vazio significa todos. */
  teamIds: Id[];
  active: boolean;
}

/* Acesso --------------------------------------------------------------------- */

/**
 * Política de acesso da organização.
 *
 * **Quase nada aqui é aplicado hoje**, e a tela diz isso em voz alta. Sessão,
 * segundo fator e bloqueio por tentativa são decisões do servidor de
 * autenticação, que ainda não existe — guardar o número agora vale porque é o
 * que a operação precisa decidir antes de o back-end entrar, e porque um valor
 * gravado é melhor do que uma planilha paralela. O que **não** vale é a tela
 * sugerir que já protege: um cadeado desenhado é pior que cadeado nenhum.
 *
 * A exceção é `allowedEmailDomains`, que a validação de convite já usa — é o
 * único controle desta lista que não depende de sessão para funcionar.
 */
export interface AccessPolicy {
  /** Minutos de inatividade até encerrar a sessão. */
  sessionIdleMinutes: number;
  /** Dias até pedir autenticação de novo, mesmo com uso contínuo. */
  sessionMaxDays: number;
  /** Perfis obrigados a segundo fator. */
  requireTwoFactorFor: RoleKey[];
  /** Domínios aceitos no convite. Vazio aceita qualquer um. */
  allowedEmailDomains: string[];
  /** Faixas de origem autorizadas, em CIDR. Vazio aceita qualquer origem. */
  allowedIpRanges: string[];
  maxFailedLogins: number;
  lockoutMinutes: number;
  /** Exige justificativa escrita ao exportar dado pessoal (seção 18). */
  requireExportJustification: boolean;
  updatedAt: IsoDateTime;
}

export type InvitationStatus = "pendente" | "expirado" | "aceito" | "revogado";

export const INVITATION_STATUS_LABEL: Record<InvitationStatus, string> = {
  pendente: "Pendente",
  expirado: "Expirado",
  aceito: "Aceito",
  revogado: "Revogado",
};

/**
 * Convite pendente.
 *
 * Existe separado de `User` porque quem foi convidado **ainda não é usuário**:
 * criar a pessoa na hora do convite encheria a lista de gente que nunca entrou,
 * e a contagem de administradores — que decide se a exclusão do último é
 * recusada — passaria a contar quem não tem acesso nenhum.
 */
export interface Invitation {
  id: Id;
  email: string;
  role: string;
  teamIds: Id[];
  invitedByLabel: string;
  createdAt: IsoDateTime;
  expiresAt: IsoDateTime;
  status: InvitationStatus;
}
