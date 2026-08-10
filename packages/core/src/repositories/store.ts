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
import { DEFAULT_APPEARANCE, type OrganizationAppearance } from "../types/appearance";
import type { Product, Proposal } from "../types/commerce";
import type { QuoteRequest, SiteAccount } from "../types/site";
import { auditLog, featureFlags, permissionMatrix, retentionPolicies } from "../mock/governance";
import { accessPolicy, customRoles, invitations } from "../mock/access";
import { businessSchedules } from "../mock/scheduling";
import { dataset } from "../demo/active";

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
  /** Paleta da organização e os padrões de modo e densidade. */
  appearance: OrganizationAppearance;
  /** Catálogo de produtos e serviços (seção 26.1). */
  products: Product[];
  /**
   * Propostas.
   *
   * Nasce **vazio**, ao contrário das demais coleções. Semear proposta enviada
   * inventaria um histórico comercial que nunca aconteceu — e, pior, inventaria
   * um aceite de cliente, que é o registro que sustenta cobrança depois.
   */
  proposals: Proposal[];
  /**
   * Contas do site público e pedidos de orçamento.
   *
   * Nascem vazias e **não são recarregadas na troca de vertical**: quem se
   * cadastrou não deixa de existir porque alguém abriu a demonstração de
   * e-commerce. Ver `reseedStore`.
   */
  siteAccounts: SiteAccount[];
  quoteRequests: QuoteRequest[];
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
  const demo = dataset();
  const {
    users,
    teams,
    queues,
    channelAccounts,
    tags,
    skills,
    closingReasons,
    customFields,
    cannedResponses,
  } = demo;

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
    appearance: { ...DEFAULT_APPEARANCE },
    products: demo.products.map((product) => ({
      ...product,
      includes: [...product.includes],
      checkout: { ...product.checkout },
    })),
    /**
     * As propostas vêm da vertical, e não vazias como antes.
     *
     * A decisão anterior — nascer vazio para não inventar aceite de cliente —
     * continua certa para dado de produção e estava errada para demonstração:
     * sem proposta semeada não há como conferir a tela de nenhum estado sem
     * montar o caso à mão, cinco vezes, em cada vertical. São fictícias e a
     * interface diz isso.
     */
    proposals: demo.proposals.map((proposal) => ({
      ...proposal,
      items: proposal.items.map((item) => ({ ...item })),
    })),
    siteAccounts: [],
    quoteRequests: [],
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

/**
 * Recarrega o armazém a partir da vertical ativa.
 *
 * Muta o objeto **no lugar**, e isso não é preferência de estilo: `store` é um
 * `const` exportado, e dezenas de módulos já guardaram essa referência. Trocá-la
 * por um objeto novo deixaria metade da aplicação lendo o armazém antigo — o
 * Inbox mostrando e-commerce e a Administração mostrando contabilidade, sem
 * erro nenhum no console.
 *
 * O que sobrevive à troca: nada. É recarga de base de demonstração, e manter a
 * fila que alguém criou na vertical anterior produziria a mistura que a mescla
 * de `registry.ts` existe para impedir. O que é editado depois da troca vale
 * até a próxima.
 */
/**
 * O que **não** é recarregado, e por quê.
 *
 * Conta do site e pedido de orçamento não pertencem à base de demonstração: são
 * gente de fora que se cadastrou. Zerá-los ao abrir a demonstração de
 * e-commerce faria o interessado perder o acesso no meio da própria avaliação —
 * e o defeito apareceria como "criei conta e o login não funciona".
 */
const PRESERVED_ON_RESEED = ["siteAccounts", "quoteRequests"] as const satisfies ReadonlyArray<
  keyof MutableStore
>;

export function reseedStore(): void {
  const fresh = seed();
  const preserved = new Set<string>(PRESERVED_ON_RESEED);

  for (const key of Object.keys(fresh) as Array<keyof MutableStore>) {
    if (preserved.has(key)) continue;
    (store as unknown as Record<string, unknown>)[key] = fresh[key];
  }
}
