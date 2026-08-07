/**
 * Armazém mutável da base de demonstração.
 *
 * Até aqui os repositórios devolviam os arranjos do `mock/` direto, e nada
 * escrevia. Este módulo os copia uma vez para um armazém que aceita escrita — é
 * o que permite a Administração editar e excluir de verdade sem que nenhuma tela
 * conheça a origem do dado.
 *
 * ## O que este armazenamento é, e o que não é
 *
 * Vive no processo do servidor. Sobrevive à navegação, ao recarregamento da
 * página e a outros usuários na mesma instância; **morre no reinício** e não é
 * compartilhado entre réplicas. É exatamente o mesmo compromisso das sessões do
 * webchat, e pelo mesmo motivo: é o que cabe honestamente sem back-end.
 *
 * Quando o Supabase entrar, o que muda é o corpo dos métodos do repositório. O
 * contrato em `repositories/types.ts` — que é o que a aplicação conhece —
 * continua valendo, e é por isso que a escrita nasce ali e não em estado de
 * componente.
 *
 * ## Por que preso ao `globalThis`
 *
 * O `next dev` recarrega módulos a cada edição de arquivo. Sem esta âncora, toda
 * alteração de código zeraria o que o administrador acabou de editar — e o
 * sintoma pareceria defeito do produto, não do ambiente.
 */

import type {
  AccessPolicy,
  AuditEntry,
  CustomRole,
  FeatureFlag,
  Invitation,
  PermissionRow,
  RetentionPolicy,
} from "../types/governance";
import type { ChannelAccount, Queue, QueueRotation, Team, User } from "../types/organization";
import type { BusinessSchedule } from "../types/scheduling";
import type { ClosingReason, CustomFieldDefinition, SkillDefinition } from "../types/catalog";
import type { Tag } from "../types/crm";
import type { CannedResponse } from "../types/inbox";
import { auditLog, featureFlags, permissionMatrix, retentionPolicies } from "../mock/governance";
import { accessPolicy, customRoles, invitations } from "../mock/access";
import { businessSchedules } from "../mock/scheduling";
import { closingReasons, customFields, skills } from "../mock/catalog";
import { channelAccounts, queues, tags, teams, users } from "../mock/organization";
import { cannedResponses } from "../mock/inbox";

export interface MutableStore {
  users: User[];
  teams: Team[];
  queues: Queue[];
  channelAccounts: ChannelAccount[];
  permissions: PermissionRow[];
  flags: FeatureFlag[];
  retention: RetentionPolicy[];
  audit: AuditEntry[];
  schedules: BusinessSchedule[];
  skills: SkillDefinition[];
  closingReasons: ClosingReason[];
  customFields: CustomFieldDefinition[];
  tags: Tag[];
  cannedResponses: CannedResponse[];
  customRoles: CustomRole[];
  accessPolicy: AccessPolicy;
  invitations: Invitation[];
  /**
   * Cursor da roleta por fila.
   *
   * Nasce vazio de propósito: semear um "último atendido" inventaria um
   * histórico de distribuição que nunca aconteceu, e a primeira roleta real
   * começaria do meio da lista sem explicação.
   */
  rotations: QueueRotation[];
}

const globalStore = globalThis as unknown as { __crmAdminStore?: Partial<MutableStore> };

/**
 * Cópia rasa por coleção, cópia profunda onde há objeto aninhado editável.
 *
 * `permissions` leva cópia do mapa de níveis porque editar permissão é editar
 * aquele objeto — sem a cópia, a alteração vazaria para o arranjo do `mock/`, e
 * o "estado inicial" deixaria de existir para quem reiniciar o processo.
 */
function seed(): MutableStore {
  return {
    users: users.map((user) => ({ ...user, teamIds: [...user.teamIds] })),
    teams: [...teams],
    queues: queues.map((queue) => ({
      ...queue,
      channels: [...queue.channels],
      // A distribuição é objeto aninhado e editável — sem a cópia, mexer nela na
      // Administração alteraria o arranjo do `mock/` e o estado inicial sumiria.
      distribution: {
        ...queue.distribution,
        requiredSkills: [...queue.distribution.requiredSkills],
      },
    })),
    channelAccounts: [...channelAccounts],
    permissions: permissionMatrix.map((row) => ({ ...row, levels: { ...row.levels } })),
    flags: [...featureFlags],
    retention: [...retentionPolicies],
    audit: [...auditLog],
    schedules: businessSchedules.map((schedule) => ({
      ...schedule,
      days: schedule.days.map((day) => ({
        ...day,
        ranges: day.ranges.map((range) => ({ ...range })),
      })),
      exceptions: schedule.exceptions.map((item) => ({
        ...item,
        ranges: item.ranges.map((range) => ({ ...range })),
      })),
    })),
    skills: [...skills],
    closingReasons: [...closingReasons],
    customFields: customFields.map((field) => ({ ...field, options: [...field.options] })),
    tags: [...tags],
    cannedResponses: cannedResponses.map((item) => ({ ...item, channels: [...item.channels] })),
    customRoles: customRoles.map((role) => ({
      ...role,
      overrides: { ...role.overrides },
      queueIds: [...role.queueIds],
      teamIds: [...role.teamIds],
    })),
    accessPolicy: {
      ...accessPolicy,
      requireTwoFactorFor: [...accessPolicy.requireTwoFactorFor],
      allowedEmailDomains: [...accessPolicy.allowedEmailDomains],
      allowedIpRanges: [...accessPolicy.allowedIpRanges],
    },
    invitations: invitations.map((item) => ({ ...item, teamIds: [...item.teamIds] })),
    rotations: [],
  };
}

/**
 * Coleção nova entra no armazém que já existe, em vez de derrubá-lo.
 *
 * O `??=` sozinho tem um efeito colateral que só aparece em desenvolvimento e
 * assusta: o `next dev` preserva o `globalThis` entre recargas, então um
 * armazém criado **antes** de este arquivo ganhar uma coleção continua vivo sem
 * ela. A leitura seguinte encontra `undefined` onde esperava um arranjo, e a
 * Administração inteira responde 500 — com a agravante de que reiniciar o
 * servidor resolve, o que faz o defeito parecer intermitente.
 *
 * A mescla preenche só o que falta. O que a pessoa editou continua lá, e o
 * campo novo aparece com o valor inicial — que é exatamente o comportamento
 * esperado de quem acabou de puxar o código.
 */
export const store: MutableStore = (() => {
  const fresh = seed();
  const existing = globalStore.__crmAdminStore;

  if (!existing) {
    globalStore.__crmAdminStore = fresh;
    return fresh;
  }

  for (const key of Object.keys(fresh) as Array<keyof MutableStore>) {
    if (existing[key] === undefined) {
      (existing as Record<string, unknown>)[key] = fresh[key];
    }
  }

  /**
   * A mescla acima cobre **coleção** que falta. Não cobre **campo** que falta
   * dentro de um registro já existente — e é esse o caso que derrubou a
   * Administração inteira com `Cannot read properties of undefined (reading
   * 'model')`.
   *
   * Como acontece: alguém cria uma fila pela API, o código ganha um campo novo
   * e obrigatório em `QueueDistribution`, o `next dev` recarrega o módulo mas o
   * `globalThis` preserva a fila antiga — agora incompleta. Um registro
   * malformado, e a página inteira responde 500.
   *
   * O molde vem do primeiro registro semeado, e não de um literal escrito aqui:
   * quando a forma crescer de novo, o preenchimento acompanha sozinho. Um
   * literal exigiria que alguém lembrasse de atualizar dois lugares, e o lugar
   * esquecido seria este — que só é exercitado depois de a forma mudar.
   */
  const queueTemplate = fresh.queues[0];
  const userTemplate = fresh.users[0];

  if (queueTemplate) {
    for (const queue of existing.queues ?? []) {
      if (!queue.distribution) {
        queue.distribution = {
          ...queueTemplate.distribution,
          requiredSkills: [...queueTemplate.distribution.requiredSkills],
        };
      }
    }
  }

  if (userTemplate) {
    for (const user of existing.users ?? []) {
      if (!user.skills) user.skills = [];
      if (user.acceptingNew === undefined) user.acceptingNew = true;
    }
  }

  return existing as MutableStore;
})();
