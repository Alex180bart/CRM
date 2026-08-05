/**
 * Contratos de acesso a dados.
 *
 * A aplicação depende **apenas** destas interfaces. A implementação atual é em
 * memória; a próxima será Supabase/API. Nenhuma tela conhece a origem do dado —
 * é isso que permite trocar a camada sem reescrever o front.
 */

import type { ChannelKind, Id } from "../types/common";
import type { WebchatWidget } from "../types/webchat";
import type {
  Company,
  Contact,
  Deal,
  LifecycleStage,
  Pipeline,
  Tag,
  Task,
  TimelineEntry,
} from "../types/crm";
import type {
  CannedResponse,
  Conversation,
  ConversationState,
  InternalNote,
  Message,
} from "../types/inbox";
import type { BotFlow, Journey, JourneyEnrollment } from "../types/automation";
import type { Campaign, MessageTemplate, Segment } from "../types/marketing";
import type { AutomationRule, RuleRun } from "../types/rules";
import type {
  BrandKit,
  EmailDeliveryStats,
  EmailDesignTemplate,
  EmailDomain,
  EmailModule,
  SuppressionEntry,
} from "../types/email";
import type {
  AttentionItem,
  AutomationHealth,
  ChannelVolume,
  MetricDefinition,
  OperationCost,
  TimePoint,
} from "../types/analytics";
import type { ChannelAccount, Organization, Queue, Team, User } from "../types/organization";
import type { AuditEntry, FeatureFlag, PermissionRow, RetentionPolicy } from "../types/governance";
import type {
  AiAnalyzeInput,
  AiAskInput,
  AiConversationAnalysis,
  AiRewriteInput,
  AiSuggestInput,
  AiText,
} from "../types/ai";

export interface ConversationFilter {
  queueIds?: Id[];
  assigneeId?: Id | "nao_atribuidas" | "minhas";
  states?: ConversationState[];
  channels?: ChannelKind[];
  tagIds?: Id[];
  search?: string;
  /** Apenas conversas com SLA estourado ou em atenção. */
  slaAtRisk?: boolean;
}

export interface ContactFilter {
  search?: string;
  lifecycleStages?: LifecycleStage[];
  ownerIds?: Id[];
  tagIds?: Id[];
  onlyDuplicates?: boolean;
}

export interface DirectoryRepository {
  getOrganization(): Promise<Organization>;
  listUsers(): Promise<User[]>;
  listTeams(): Promise<Team[]>;
  listQueues(): Promise<Queue[]>;
  listChannelAccounts(): Promise<ChannelAccount[]>;
  listTags(): Promise<Tag[]>;
  listCannedResponses(): Promise<CannedResponse[]>;
}

export interface ContactRepository {
  list(filter?: ContactFilter): Promise<Contact[]>;
  getById(id: Id): Promise<Contact | null>;
  listCompanies(): Promise<Company[]>;
  getCompanyById(id: Id): Promise<Company | null>;
  listTimeline(contactId: Id): Promise<TimelineEntry[]>;
  listTasks(contactId: Id): Promise<Task[]>;
}

export interface ConversationRepository {
  list(filter?: ConversationFilter): Promise<Conversation[]>;
  getById(id: Id): Promise<Conversation | null>;
  listMessages(conversationId: Id): Promise<Message[]>;
  listNotes(conversationId: Id): Promise<InternalNote[]>;
  listByContact(contactId: Id): Promise<Conversation[]>;
}

export interface DealRepository {
  listPipelines(): Promise<Pipeline[]>;
  getPipelineById(id: Id): Promise<Pipeline | null>;
  listByPipeline(pipelineId: Id): Promise<Deal[]>;
  listByContact(contactId: Id): Promise<Deal[]>;
  listTasks(): Promise<Task[]>;
}

export interface AutomationRepository {
  listBotFlows(): Promise<BotFlow[]>;
  getBotFlowById(id: Id): Promise<BotFlow | null>;
  listJourneys(): Promise<Journey[]>;
  getJourneyById(id: Id): Promise<Journey | null>;
  listEnrollments(journeyId: Id): Promise<JourneyEnrollment[]>;
}

export interface CampaignRepository {
  list(): Promise<Campaign[]>;
  getById(id: Id): Promise<Campaign | null>;
  listSegments(): Promise<Segment[]>;
  getSegmentById(id: Id): Promise<Segment | null>;
  listTemplates(): Promise<MessageTemplate[]>;
  getTemplateById(id: Id): Promise<MessageTemplate | null>;
}

export interface RuleRepository {
  list(): Promise<AutomationRule[]>;
  getById(id: Id): Promise<AutomationRule | null>;
  listRuns(): Promise<RuleRun[]>;
}

export interface EmailStudioRepository {
  listTemplates(): Promise<EmailDesignTemplate[]>;
  getTemplateById(id: Id): Promise<EmailDesignTemplate | null>;
  listModules(): Promise<EmailModule[]>;
  listBrandKits(): Promise<BrandKit[]>;
  getBrandKitById(id: Id): Promise<BrandKit | null>;
  listDomains(): Promise<EmailDomain[]>;
  listSuppressions(): Promise<SuppressionEntry[]>;
  deliveryStats(): Promise<EmailDeliveryStats>;
}

/**
 * Widgets de webchat.
 *
 * listVersionsById não existe: a versão vive dentro do widget, como em fluxo e
 * e-mail. Separá-la em outra chamada obrigaria a tela a montar o par a cada
 * leitura, e a versão sem o widget não significa nada.
 */
export interface WebchatRepository {
  list(): Promise<WebchatWidget[]>;
  getById(id: Id): Promise<WebchatWidget | null>;
}

export interface InsightsRepository {
  /** Fila "precisa de você agora", já ordenada por gravidade e prazo. */
  listAttention(): Promise<AttentionItem[]>;
  hourlyPulse(): Promise<TimePoint[]>;
  /** Hora de referência destacada no pulso do dia. */
  currentHour(): Promise<number>;
  series(key: SeriesKey): Promise<TimePoint[]>;
  channelVolumes(): Promise<ChannelVolume[]>;
  automationHealth(): Promise<AutomationHealth[]>;
  costs(): Promise<OperationCost[]>;
  metricDefinitions(): Promise<MetricDefinition[]>;
}

export type SeriesKey =
  | "conversas"
  | "primeira_resposta"
  | "negocios_criados"
  | "receita_ganha"
  | "execucoes_automacao"
  | "entregas_campanha";

export interface GovernanceRepository {
  listAudit(): Promise<AuditEntry[]>;
  listPermissions(): Promise<PermissionRow[]>;
  listFeatureFlags(): Promise<FeatureFlag[]>;
  listRetentionPolicies(): Promise<RetentionPolicy[]>;
}

/**
 * Copiloto do atendente (seção 16.1).
 *
 * Mesma disciplina dos outros repositórios: a tela chama um método, não um
 * provedor. Por trás está o AI Gateway, que escolhe modelo, aplica política,
 * valida a saída contra schema e mede custo. Se amanhã a organização trocar
 * Gemini por Claude, ou passar a rotear por caso de uso, nada aqui muda.
 */
export interface AiRepository {
  /** Leitura completa: resumo, intenção, sentimento, dados, passo e checklist. */
  analyzeConversation(input: AiAnalyzeInput): Promise<AiConversationAnalysis>;
  suggestReply(input: AiSuggestInput): Promise<AiText>;
  /** Ajusta tom, tamanho ou português de um rascunho já escrito. */
  rewrite(input: AiRewriteInput): Promise<AiText>;
  /**
   * Pergunta livre sobre a conversa. Emite o texto em partes conforme o modelo
   * gera — numa resposta longa, esperar o fim em silêncio parece travamento.
   */
  ask(input: AiAskInput, onChunk?: (text: string) => void): Promise<AiText>;
}

export interface Repositories {
  directory: DirectoryRepository;
  contacts: ContactRepository;
  conversations: ConversationRepository;
  deals: DealRepository;
  automations: AutomationRepository;
  campaigns: CampaignRepository;
  rules: RuleRepository;
  emailStudio: EmailStudioRepository;
  webchat: WebchatRepository;
  insights: InsightsRepository;
  governance: GovernanceRepository;
  ai: AiRepository;
}
