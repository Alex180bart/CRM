/**
 * Implementação em memória dos repositórios.
 *
 * Serve à primeira onda do front, antes do Supabase existir. Toda leitura é
 * assíncrona de propósito: quando a implementação real entrar, a assinatura não
 * muda e nenhuma tela precisa ser reescrita.
 */

import type { Id } from "../types/common";
import { CURRENT_USER_ID } from "../mock/organization";
import { botFlows } from "../mock/bots";
import { cannedResponses, conversations, internalNotes, messages } from "../mock/inbox";
import { companies, contacts } from "../mock/contacts";
import { deals, pipelines, tasks } from "../mock/pipeline";
import { journeyEnrollments, journeys } from "../mock/journeys";
import { campaigns, messageTemplates, segments } from "../mock/campaigns";
import { automationRules, ruleRuns } from "../mock/rules";
import { webchatWidgets } from "../mock/webchat";
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
import { channelAccounts, organization, queues, tags, teams, users } from "../mock/organization";
import { auditLog, featureFlags, permissionMatrix, retentionPolicies } from "../mock/governance";
import { timeline } from "../mock/timeline";
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
    return organization;
  },
  async listUsers() {
    return users;
  },
  async listTeams() {
    return teams;
  },
  async listQueues() {
    return queues;
  },
  async listChannelAccounts() {
    return channelAccounts;
  },
  async listTags() {
    return tags;
  },
  async listCannedResponses() {
    return cannedResponses;
  },
};

const contactRepository: ContactRepository = {
  async list(filter: ContactFilter = {}) {
    const search = filter.search ? normalize(filter.search) : undefined;

    return contacts.filter((contact) => {
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
    return contacts.find((contact) => contact.id === id) ?? null;
  },
  async listCompanies() {
    return companies;
  },
  async getCompanyById(id: Id) {
    return companies.find((company) => company.id === id) ?? null;
  },
  async listTimeline(contactId: Id) {
    return timeline.filter((entry) => entry.contactId === contactId);
  },
  async listTasks(contactId: Id) {
    return tasks.filter((task) => task.contactId === contactId);
  },
};

const conversationRepository: ConversationRepository = {
  async list(filter: ConversationFilter = {}) {
    const search = filter.search ? normalize(filter.search) : undefined;
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
    return conversations.find((conversation) => conversation.id === id) ?? null;
  },
  async listMessages(conversationId: Id) {
    return messages
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  },
  async listNotes(conversationId: Id) {
    return internalNotes
      .filter((note) => note.conversationId === conversationId)
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  },
  async listByContact(contactId: Id) {
    return conversations
      .filter((conversation) => conversation.contactId === contactId)
      .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
  },
};

const dealRepository: DealRepository = {
  async listPipelines() {
    return pipelines;
  },
  async getPipelineById(id: Id) {
    return pipelines.find((pipeline) => pipeline.id === id) ?? null;
  },
  async listByPipeline(pipelineId: Id) {
    return deals.filter((deal) => deal.pipelineId === pipelineId);
  },
  async listByContact(contactId: Id) {
    return deals.filter((deal) => deal.contactId === contactId);
  },
  async listTasks() {
    return tasks;
  },
};

const campaignRepository: CampaignRepository = {
  async list() {
    return campaigns;
  },
  async getById(id: Id) {
    return campaigns.find((campaign) => campaign.id === id) ?? null;
  },
  async listSegments() {
    return segments;
  },
  async getSegmentById(id: Id) {
    return segments.find((segment) => segment.id === id) ?? null;
  },
  async listTemplates() {
    return messageTemplates;
  },
  async getTemplateById(id: Id) {
    return messageTemplates.find((template) => template.id === id) ?? null;
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
    return auditLog;
  },
  async listPermissions() {
    return permissionMatrix;
  },
  async listFeatureFlags() {
    return featureFlags;
  },
  async listRetentionPolicies() {
    return retentionPolicies;
  },
};

/**
 * Tudo o que tem versão em memória. `ai` fica de fora de propósito: uma resposta
 * fixa de modelo não ensina nada sobre latência, custo ou qualidade do prompt,
 * então o AI Gateway é montado em `./index.ts` apontando para o serviço real.
 */
export const memoryRepositories: Omit<Repositories, "ai"> = {
  directory,
  contacts: contactRepository,
  conversations: conversationRepository,
  deals: dealRepository,
  automations: automationRepository,
  campaigns: campaignRepository,
  rules: ruleRepository,
  emailStudio: emailStudioRepository,
  webchat: webchatRepository,
  insights: insightsRepository,
  governance: governanceRepository,
};
