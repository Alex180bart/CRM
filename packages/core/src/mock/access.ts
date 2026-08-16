/**
 * Base de demonstração — perfis customizados, política de acesso e convites.
 *
 * Os dois perfis customizados aqui são os que um escritório contábil cria
 * primeiro, e cada um exercita uma metade do tipo:
 *
 * - **Analista fiscal sênior** mexe só em `overrides` — mesmo alcance de um
 *   atendente, mais poder em relatórios;
 * - **Parceiro externo** mexe só em `queueIds` — as permissões de um atendente,
 *   restritas a uma fila. É o caso que a matriz sozinha não expressa, e é ele
 *   que justifica o campo de alcance existir.
 */

import type { AccessPolicy, CustomRole, Invitation } from "../types/governance";
import { offsetIso } from "../utils/datetime";
import { ORG_ID } from "./organization";

export const customRoles: CustomRole[] = [
  {
    id: "role_fiscal_senior",
    organizationId: ORG_ID,
    key: "analista_fiscal_senior",
    label: "Analista fiscal sênior",
    description:
      "Atende como atendente, mas enxerga relatórios e publica respostas rápidas para o time.",
    basedOn: "atendente",
    overrides: {
      analytics: "ver",
      automacoes: "editar",
    },
    queueIds: [],
    teamIds: [],
    active: true,
    createdAt: offsetIso({ days: -95 }),
    updatedAt: offsetIso({ days: -22 }),
  },
  {
    id: "role_parceiro",
    organizationId: ORG_ID,
    key: "parceiro_externo",
    label: "Parceiro externo",
    description:
      "Contador parceiro que atende apenas a fila de regularização. Não vê contatos de outras filas.",
    basedOn: "atendente",
    overrides: {
      contatos: "ver",
      analytics: "nenhum",
      administracao: "nenhum",
    },
    queueIds: ["queue_regularizacao"],
    teamIds: ["team_atendimento"],
    active: true,
    createdAt: offsetIso({ days: -40 }),
    updatedAt: offsetIso({ days: -8 }),
  },
];

export const accessPolicy: AccessPolicy = {
  sessionIdleMinutes: 240,
  sessionMaxDays: 30,
  requireTwoFactorFor: ["superadmin", "admin_empresa", "auditor_dpo"],
  allowedEmailDomains: ["contabilaurora.com.br"],
  allowedIpRanges: [],
  maxFailedLogins: 5,
  lockoutMinutes: 15,
  requireExportJustification: true,
  updatedAt: offsetIso({ days: -30 }),
};

export const invitations: Invitation[] = [
  {
    id: "inv_paula",
    email: "paula.reis@contabilaurora.com.br",
    role: "atendente",
    teamIds: ["team_atendimento"],
    invitedByLabel: "Marina Duarte",
    createdAt: offsetIso({ days: -2 }),
    expiresAt: offsetIso({ days: 5 }),
    status: "pendente",
  },
  {
    id: "inv_tiago",
    email: "tiago.almeida@contabilaurora.com.br",
    role: "analista_fiscal_senior",
    teamIds: ["team_atendimento"],
    invitedByLabel: "André Fontes",
    createdAt: offsetIso({ days: -11 }),
    expiresAt: offsetIso({ days: -4 }),
    status: "expirado",
  },
  {
    id: "inv_helena",
    email: "helena.souza@contabilaurora.com.br",
    role: "marketing",
    teamIds: ["team_marketing"],
    invitedByLabel: "Marina Duarte",
    createdAt: offsetIso({ days: -20 }),
    expiresAt: offsetIso({ days: -13 }),
    status: "aceito",
  },
];
