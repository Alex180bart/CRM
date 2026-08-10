/**
 * Implementação em memória dos repositórios.
 *
 * Serve à primeira onda do front, antes do Supabase existir. Toda leitura é
 * assíncrona de propósito: quando a implementação real entrar, a assinatura não
 * muda e nenhuma tela precisa ser reescrita.
 *
 * ## Por que quase tudo passa por `dataset()`
 *
 * As coleções que descrevem **o negócio** — contato, conversa, negócio,
 * campanha — vêm da vertical de demonstração ativa, não de um `import` de
 * módulo. A diferença aparece na troca de vertical: um `import` é resolvido uma
 * vez e congela o arranjo daquele instante, então o Inbox continuaria mostrando
 * a base anterior depois da troca. `dataset()` é lido a cada chamada, e a
 * chamada acontece dentro do método assíncrono — que é exatamente onde a
 * implementação real fará a consulta.
 *
 * O que descreve **a plataforma** (fluxos, jornadas, regras, e-mail, analytics,
 * agentes) continua vindo do `mock/`: não muda com o segmento do cliente.
 */

import type { Id } from "../types/common";
import { CURRENT_USER_ID } from "../mock/organization";
import { botFlows } from "../mock/bots";
import { journeyEnrollments, journeys } from "../mock/journeys";
import { automationRules, ruleRuns } from "../mock/rules";
import { dataset } from "../demo/active";
import { webchatWidgets } from "../mock/webchat";
import { deriveWebchatChannel } from "../utils/channels";
import { aiAgents, agentKnowledgeSources } from "../mock/agents";
import { adminMemoryRepository } from "./admin-memory";
import { commerceMemoryRepository } from "./commerce-memory";
import { store } from "./store";
import {
  brandKits,
  emailDeliveryStats,
  emailDomains,
  emailModules,
  emailTemplates,
  suppressionEntries,
} from "../mock/email";
import {
  attentionQueue,
  automationHealth,
  automationRunsSeries,
  campaignDeliverySeries,
  channelVolumes,
  conversationsSeries,
  dealsCreatedSeries,
  firstResponseSeries,
  hourlyPulse,
  metricDefinitions,
  operationCosts,
  REFERENCE_HOUR,
  revenueWonSeries,
} from "../mock/analytics";
import type {
  AutomationRepository,
  CampaignRepository,
  ContactFilter,
  ContactRepository,
  ConversationFilter,
  ConversationRepository,
  DealRepository,
  DirectoryRepository,
  EmailStudioRepository,
  RuleRepository,
  WebchatRepository,
  AgentRepository,
  GovernanceRepository,
  InsightsRepository,
  Repositories,
  SeriesKey,
} from "./types";

/** Remove acentos e caixa para busca tolerante. U+0300–U+036F é o bloco de diacríticos. */
const DIACRITICS = /[\u0300-\u036f]/g;

function normalize(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

const directory: DirectoryRepository = {
  async getOrganization() {
    return dataset().organization;
  },
  async listUsers() {
    return store.users;
  },
  async listTeams() {
    return store.teams;
  },
  async listQueues() {
    return store.queues;
  },
  /**
   * Canal de webchat é **derivado**, não cadastrado.
   *
   * Criar um widget cria o canal; excluir o widget o remove. Antes, a conta era
   * cadastrada à mão na Administração e o widget apontava para ela — e a
   * primeira coisa que se esquecia era criar a conta, produzindo um widget
   * publicado que abre conversa sem destino.
   *
   * Derivar elimina o estado a dessincronizar: não há como o nome do canal
   * divergir do nome do widget, nem como sobrar canal órfão.
   */
  async listChannelAccounts() {
    return [
      ...store.channelAccounts.filter((account) => account.kind !== "webchat"),
      ...webchatWidgets.map(deriveWebchatChannel),
    ];
  },
  /**
   * Catálogo sai do armazém, não do `mock/`.
   *
   * Tag e resposta rápida ganharam tela de edição na Administração — servi-las
   * do arranjo imutável faria a Contatos continuar mostrando a lista antiga
   * depois de alguém criar uma tag, e o sintoma seria "salvei e não apareceu".
   */
  async listTags() {
    return store.tags;
  },
  async listCannedResponses() {
    return store.cannedResponses;
  },
  async listSchedules() {
    return store.schedules;
  },
  async listSkills() {
    return store.skills;
  },
  async listClosingReasons() {
    return store.closingReasons;
  },
  async listCustomFields() {
    return store.customFields;
  },
  async listCustomRoles() {
    return store.customRoles;
  },
  async getAccessPolicy() {
    return store.accessPolicy;
  },
  async listInvitations() {
    return store.invitations;
  },
  async getAppearance() {
    return store.appearance;
  },
  async getRotation(queueId: Id) {
    return store.rotations.find((item) => item.queueId === queueId)?.lastUserId;
  },
};

const contactRepository: ContactRepository = {
  async list(filter: ContactFilter = {}) {
    const search = filter.search ? normalize(filter.search) : undefined;

    return dataset().contacts.filter((contact) => {
      if (filter.onlyDuplicates && !contact.duplicateOf) return false;
      if (
        filter.lifecycleStages?.length &&
        !filter.lifecycleStages.includes(contact.lifecycleStage)
      ) {
        return false;
      }
      if (
        filter.ownerIds?.length &&
        (!contact.ownerId || !filter.ownerIds.includes(contact.ownerId))
      ) {
        return false;
      }
      if (filter.tagIds?.length && !filter.tagIds.some((tagId) => contact.tagIds.includes(tagId))) {
        return false;
      }
      if (search) {
        const haystack = normalize(
          [contact.fullName, contact.email ?? "", contact.phone ?? "", contact.city ?? ""].join(
            " ",
          ),
        );
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  },
  async getById(id: Id) {
    return dataset().contacts.find((contact) => contact.id === id) ?? null;
  },
  async listCompanies() {
    return dataset().companies;
  },
  async getCompanyById(id: Id) {
    return dataset().companies.find((company) => company.id === id) ?? null;
  },
  async listTimeline(contactId: Id) {
    return dataset().timeline.filter((entry) => entry.contactId === contactId);
  },
  async listTasks(contactId: Id) {
    return dataset().tasks.filter((task) => task.contactId === contactId);
  },
};

const conversationRepository: ConversationRepository = {
  async list(filter: ConversationFilter = {}) {
    const search = filter.search ? normalize(filter.search) : undefined;
    const { contacts, conversations } = dataset();
    const contactNameById = new Map(contacts.map((contact) => [contact.id, contact.fullName]));

    return conversations
      .filter((conversation) => {
        if (filter.queueIds?.length && !filter.queueIds.includes(conversation.queueId))
          return false;
        if (filter.states?.length && !filter.states.includes(conversation.state)) return false;
        if (filter.channels?.length && !filter.channels.includes(conversation.channel))
          return false;
        if (
          filter.tagIds?.length &&
          !filter.tagIds.some((tagId) => conversation.tagIds.includes(tagId))
        ) {
          return false;
        }
        if (
          filter.slaAtRisk &&
          conversation.slaStatus !== "estourado" &&
          conversation.slaStatus !== "atencao"
        ) {
          return false;
        }
        if (filter.assigneeId === "nao_atribuidas" && conversation.assigneeId) return false;
        if (filter.assigneeId === "minhas" && conversation.assigneeId !== CURRENT_USER_ID)
          return false;
        if (
          filter.assigneeId &&
          filter.assigneeId !== "minhas" &&
          filter.assigneeId !== "nao_atribuidas" &&
          conversation.assigneeId !== filter.assigneeId
        ) {
          return false;
        }
        if (search) {
          const haystack = normalize(
            [
              conversation.subject,
              conversation.lastMessagePreview,
              contactNameById.get(conversation.contactId) ?? "",
            ].join(" "),
          );
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
  },
  async getById(id: Id) {
    return dataset().conversations.find((conversation) => conversation.id === id) ?? null;
  },
  async listMessages(conversationId: Id) {
    return dataset()
      .messages.filter((message) => message.conversationId === conversationId)
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  },
  async listNotes(conversationId: Id) {
    return dataset()
      .internalNotes.filter((note) => note.conversationId === conversationId)
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  },
  async listByContact(contactId: Id) {
    return dataset()
      .conversations.filter((conversation) => conversation.contactId === contactId)
      .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
  },
};

const dealRepository: DealRepository = {
  async listPipelines() {
    return dataset().pipelines;
  },
  async getPipelineById(id: Id) {
    return dataset().pipelines.find((pipeline) => pipeline.id === id) ?? null;
  },
  async listByPipeline(pipelineId: Id) {
    return dataset().deals.filter((deal) => deal.pipelineId === pipelineId);
  },
  async listByContact(contactId: Id) {
    return dataset().deals.filter((deal) => deal.contactId === contactId);
  },
  async listTasks() {
    return dataset().tasks;
  },
};

const campaignRepository: CampaignRepository = {
  async list() {
    return dataset().campaigns;
  },
  async getById(id: Id) {
    return dataset().campaigns.find((campaign) => campaign.id === id) ?? null;
  },
  async listSegments() {
    return dataset().segments;
  },
  async getSegmentById(id: Id) {
    return dataset().segments.find((segment) => segment.id === id) ?? null;
  },
  async listTemplates() {
    return dataset().messageTemplates;
  },
  async getTemplateById(id: Id) {
    return dataset().messageTemplates.find((template) => template.id === id) ?? null;
  },
};

const ruleRepository: RuleRepository = {
  async list() {
    return automationRules;
  },
  async getById(id: Id) {
    return automationRules.find((rule) => rule.id === id) ?? null;
  },
  async listRuns() {
    return [...ruleRuns].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  },
};

const webchatRepository: WebchatRepository = {
  async list() {
    return webchatWidgets;
  },
  async getById(id: Id) {
    return webchatWidgets.find((widget) => widget.id === id) ?? null;
  },
};

const agentRepository: AgentRepository = {
  async list() {
    return aiAgents;
  },
  async getById(id: Id) {
    return aiAgents.find((agent) => agent.id === id) ?? null;
  },
  async listKnowledge() {
    return agentKnowledgeSources;
  },
};

const emailStudioRepository: EmailStudioRepository = {
  async listTemplates() {
    return emailTemplates;
  },
  async getTemplateById(id: Id) {
    return emailTemplates.find((template) => template.id === id) ?? null;
  },
  async listModules() {
    return emailModules;
  },
  async listBrandKits() {
    return brandKits;
  },
  async getBrandKitById(id: Id) {
    return brandKits.find((kit) => kit.id === id) ?? null;
  },
  async listDomains() {
    return emailDomains;
  },
  async listSuppressions() {
    return [...suppressionEntries].sort(
      (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt),
    );
  },
  async deliveryStats() {
    return emailDeliveryStats;
  },
};

const SERIES_BY_KEY: Record<SeriesKey, typeof conversationsSeries> = {
  conversas: conversationsSeries,
  primeira_resposta: firstResponseSeries,
  negocios_criados: dealsCreatedSeries,
  receita_ganha: revenueWonSeries,
  execucoes_automacao: automationRunsSeries,
  entregas_campanha: campaignDeliverySeries,
};

const insightsRepository: InsightsRepository = {
  async listAttention() {
    return attentionQueue;
  },
  async hourlyPulse() {
    return hourlyPulse;
  },
  async currentHour() {
    return REFERENCE_HOUR;
  },
  async series(key: SeriesKey) {
    return SERIES_BY_KEY[key];
  },
  async channelVolumes() {
    return channelVolumes;
  },
  async automationHealth() {
    return automationHealth;
  },
  async costs() {
    return operationCosts;
  },
  async metricDefinitions() {
    return metricDefinitions;
  },
};

const automationRepository: AutomationRepository = {
  async listBotFlows() {
    return botFlows;
  },
  async getBotFlowById(id: Id) {
    return botFlows.find((flow) => flow.id === id) ?? null;
  },
  async listJourneys() {
    return journeys;
  },
  async getJourneyById(id: Id) {
    return journeys.find((journey) => journey.id === id) ?? null;
  },
  async listEnrollments(journeyId: Id) {
    return journeyEnrollments.filter((enrollment) => enrollment.journeyId === journeyId);
  },
};

const governanceRepository: GovernanceRepository = {
  async listAudit() {
    return store.audit;
  },
  async listPermissions() {
    return store.permissions;
  },
  async listFeatureFlags() {
    return store.flags;
  },
  async listRetentionPolicies() {
    return store.retention;
  },
};

/**
 * Tudo o que tem versão em memória. `ai` fica de fora de propósito: uma resposta
 * fixa de modelo não ensina nada sobre latência, custo ou qualidade do prompt,
 * então o AI Gateway é montado em `./index.ts` apontando para o serviço real.
 */
export const memoryRepositories: Omit<Repositories, "ai" | "site"> = {
  directory,
  contacts: contactRepository,
  conversations: conversationRepository,
  deals: dealRepository,
  automations: automationRepository,
  campaigns: campaignRepository,
  rules: ruleRepository,
  emailStudio: emailStudioRepository,
  webchat: webchatRepository,
  agents: agentRepository,
  insights: insightsRepository,
  governance: governanceRepository,
  admin: adminMemoryRepository,
  commerce: commerceMemoryRepository,
};
