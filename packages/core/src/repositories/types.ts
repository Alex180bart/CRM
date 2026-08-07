/**
 * Contratos de acesso a dados.
 *
 * A aplicação depende **apenas** destas interfaces. A implementação atual é em
 * memória; a próxima será Supabase/API. Nenhuma tela conhece a origem do dado —
 * é isso que permite trocar a camada sem reescrever o front.
 */

import type { ChannelKind, Id } from "../types/common";
import type { WebchatWidget } from "../types/webchat";
import type { AgentKnowledgeSource, AiAgent } from "../types/agents";
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
import type {
  ChannelAccount,
  ChannelConnection,
  Organization,
  Queue,
  RoleKey,
  Team,
  User,
} from "../types/organization";
import type {
  AccessPolicy,
  AuditEntry,
  CustomRole,
  FeatureFlag,
  Invitation,
  PermissionLevel,
  PermissionRow,
  RetentionPolicy,
} from "../types/governance";
import type { BusinessSchedule } from "../types/scheduling";
import type { ClosingReason, CustomFieldDefinition, SkillDefinition } from "../types/catalog";
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
  listSchedules(): Promise<BusinessSchedule[]>;
  listSkills(): Promise<SkillDefinition[]>;
  listClosingReasons(): Promise<ClosingReason[]>;
  listCustomFields(): Promise<CustomFieldDefinition[]>;
  listCustomRoles(): Promise<CustomRole[]>;
  getAccessPolicy(): Promise<AccessPolicy>;
  listInvitations(): Promise<Invitation[]>;
  /**
   * Cursor da roleta por fila.
   *
   * Leitura separada porque é estado de execução, não configuração — e porque a
   * única tela que precisa dele é o simulador de distribuição, que não deveria
   * obrigar todas as outras a carregá-lo.
   */
  getRotation(queueId: Id): Promise<Id | undefined>;
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

/**
 * Agentes de IA de atendimento.
 *
 * As fontes de conhecimento ficam aqui e não num repositório próprio porque hoje
 * só o agente as consome. Quando o RAG da seção 16.2 entrar — com indexação,
 * permissão e versionamento por documento — a base de conhecimento vira domínio
 * próprio e esta chamada migra junto.
 */
export interface AgentRepository {
  list(): Promise<AiAgent[]>;
  getById(id: Id): Promise<AiAgent | null>;
  listKnowledge(): Promise<AgentKnowledgeSource[]>;
}

/**
 * Escrita administrativa.
 *
 * A primeira interface deste repositório que **altera** dado. Nasce aqui, e não
 * em estado de componente, pela regra que vale para todo o resto: a aplicação
 * conhece o contrato, nunca a origem. Quando o Supabase entrar, o corpo destes
 * métodos muda e nenhuma tela sabe.
 *
 * Dois compromissos que a assinatura já declara:
 *
 * 1. **Toda escrita devolve `AdminWriteResult`**, não lança. Recusa de regra de
 *    negócio — "é o último administrador" — não é exceção: é resposta, e precisa
 *    chegar à tela com o motivo escrito para quem lê saber o que fazer.
 * 2. **Toda escrita registra auditoria.** A seção 18 exige que alteração de
 *    permissão e de configuração fique registrada com autor e horário. Fazer
 *    isso dentro do repositório, e não em cada chamador, é o que garante que não
 *    exista caminho de escrita sem rastro.
 */
export interface AdminWriteResult<T = unknown> {
  ok: boolean;
  /** Motivo da recusa, escrito para quem administra. Ausente em sucesso. */
  reason?: string;
  data?: T;
}

/** Quem está alterando — vai para a auditoria. */
export interface AdminActor {
  id: Id;
  label: string;
}

export interface AdminRepository {
  createUser(
    actor: AdminActor,
    data: Omit<User, "id" | "organizationId">,
  ): Promise<AdminWriteResult<User>>;
  updateUser(actor: AdminActor, id: Id, patch: Partial<User>): Promise<AdminWriteResult<User>>;
  deleteUser(actor: AdminActor, id: Id): Promise<AdminWriteResult>;

  createTeam(actor: AdminActor, name: string): Promise<AdminWriteResult<Team>>;
  updateTeam(actor: AdminActor, id: Id, name: string): Promise<AdminWriteResult<Team>>;
  deleteTeam(actor: AdminActor, id: Id): Promise<AdminWriteResult>;

  createQueue(
    actor: AdminActor,
    data: Omit<Queue, "id" | "organizationId" | "createdAt" | "updatedAt">,
  ): Promise<AdminWriteResult<Queue>>;
  updateQueue(actor: AdminActor, id: Id, patch: Partial<Queue>): Promise<AdminWriteResult<Queue>>;
  deleteQueue(actor: AdminActor, id: Id): Promise<AdminWriteResult>;

  createChannel(
    actor: AdminActor,
    data: Pick<ChannelAccount, "kind" | "label" | "address" | "queueId"> & {
      connection?: ChannelConnection;
    },
  ): Promise<AdminWriteResult<ChannelAccount>>;
  /** Grava a configuração de conexão. O segredo NÃO passa por aqui — vai ao cofre. */
  setChannelConnection(
    actor: AdminActor,
    id: Id,
    connection: ChannelConnection,
  ): Promise<AdminWriteResult<ChannelAccount>>;
  updateChannel(
    actor: AdminActor,
    id: Id,
    patch: Partial<ChannelAccount>,
  ): Promise<AdminWriteResult<ChannelAccount>>;
  deleteChannel(actor: AdminActor, id: Id): Promise<AdminWriteResult>;

  setPermission(
    actor: AdminActor,
    resource: string,
    role: RoleKey,
    level: PermissionLevel,
  ): Promise<AdminWriteResult>;

  updateFlag(
    actor: AdminActor,
    key: string,
    patch: Partial<FeatureFlag>,
  ): Promise<AdminWriteResult>;

  updateRetention(
    actor: AdminActor,
    category: string,
    patch: Partial<RetentionPolicy>,
  ): Promise<AdminWriteResult>;

  /* Escalas ------------------------------------------------------------------ */

  createSchedule(
    actor: AdminActor,
    data: Omit<BusinessSchedule, "id" | "organizationId" | "createdAt" | "updatedAt">,
  ): Promise<AdminWriteResult<BusinessSchedule>>;
  updateSchedule(
    actor: AdminActor,
    id: Id,
    patch: Partial<BusinessSchedule>,
  ): Promise<AdminWriteResult<BusinessSchedule>>;
  deleteSchedule(actor: AdminActor, id: Id): Promise<AdminWriteResult>;

  /* Catálogo ----------------------------------------------------------------- */

  createSkill(
    actor: AdminActor,
    data: Omit<SkillDefinition, "id" | "organizationId" | "createdAt" | "updatedAt">,
  ): Promise<AdminWriteResult<SkillDefinition>>;
  updateSkill(
    actor: AdminActor,
    id: Id,
    patch: Partial<SkillDefinition>,
  ): Promise<AdminWriteResult<SkillDefinition>>;
  deleteSkill(actor: AdminActor, id: Id): Promise<AdminWriteResult>;

  createClosingReason(
    actor: AdminActor,
    data: Omit<ClosingReason, "id" | "organizationId" | "createdAt" | "updatedAt">,
  ): Promise<AdminWriteResult<ClosingReason>>;
  updateClosingReason(
    actor: AdminActor,
    id: Id,
    patch: Partial<ClosingReason>,
  ): Promise<AdminWriteResult<ClosingReason>>;
  deleteClosingReason(actor: AdminActor, id: Id): Promise<AdminWriteResult>;

  createCustomField(
    actor: AdminActor,
    data: Omit<CustomFieldDefinition, "id" | "organizationId" | "createdAt" | "updatedAt">,
  ): Promise<AdminWriteResult<CustomFieldDefinition>>;
  updateCustomField(
    actor: AdminActor,
    id: Id,
    patch: Partial<CustomFieldDefinition>,
  ): Promise<AdminWriteResult<CustomFieldDefinition>>;
  deleteCustomField(actor: AdminActor, id: Id): Promise<AdminWriteResult>;

  createTag(actor: AdminActor, name: string, hue: number): Promise<AdminWriteResult<Tag>>;
  updateTag(actor: AdminActor, id: Id, patch: Partial<Tag>): Promise<AdminWriteResult<Tag>>;
  deleteTag(actor: AdminActor, id: Id): Promise<AdminWriteResult>;

  createCannedResponse(
    actor: AdminActor,
    data: Omit<CannedResponse, "id" | "organizationId">,
  ): Promise<AdminWriteResult<CannedResponse>>;
  updateCannedResponse(
    actor: AdminActor,
    id: Id,
    patch: Partial<CannedResponse>,
  ): Promise<AdminWriteResult<CannedResponse>>;
  deleteCannedResponse(actor: AdminActor, id: Id): Promise<AdminWriteResult>;

  /* Perfis e acesso ---------------------------------------------------------- */

  createCustomRole(
    actor: AdminActor,
    data: Omit<CustomRole, "id" | "organizationId" | "createdAt" | "updatedAt">,
  ): Promise<AdminWriteResult<CustomRole>>;
  updateCustomRole(
    actor: AdminActor,
    id: Id,
    patch: Partial<CustomRole>,
  ): Promise<AdminWriteResult<CustomRole>>;
  deleteCustomRole(actor: AdminActor, id: Id): Promise<AdminWriteResult>;

  updateAccessPolicy(
    actor: AdminActor,
    patch: Partial<AccessPolicy>,
  ): Promise<AdminWriteResult<AccessPolicy>>;

  createInvitation(
    actor: AdminActor,
    data: { email: string; role: string; teamIds: Id[] },
  ): Promise<AdminWriteResult<Invitation>>;
  revokeInvitation(actor: AdminActor, id: Id): Promise<AdminWriteResult>;
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
  agents: AgentRepository;
  insights: InsightsRepository;
  governance: GovernanceRepository;
  admin: AdminRepository;
  ai: AiRepository;
}
