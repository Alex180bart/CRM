/**
 * Construtores visuais: Chatbot Builder e Journey Builder.
 * Referência: Plano Completo, seções 12 (chatbot) e 15 (jornadas).
 *
 * Regra estruturante: o editor produz um **documento versionado**; quem executa
 * é o runtime. Publicar congela a versão — editar cria uma nova e não altera
 * execuções já iniciadas (seções 12 e 15.3).
 */

import type { BaseEntity, ChannelKind, Id, IsoDateTime } from "./common";

export interface FlowPosition {
  x: number;
  y: number;
}

/** Saída nomeada de um nó. Um nó de condição tem várias; um de mensagem, uma. */
export interface FlowPort {
  id: string;
  label: string;
  /** Caminho de exceção (falha, timeout, não elegível) — desenhado em tom de alerta. */
  fallback?: boolean;
}

export interface FlowNode<K extends string = string> {
  id: Id;
  kind: K;
  label: string;
  summary: string;
  position: FlowPosition;
  config: Record<string, string | number | boolean | string[]>;
  outputs: FlowPort[];
}

export interface FlowEdge {
  id: Id;
  source: Id;
  sourcePort: string;
  target: Id;
  label?: string;
}

export type FlowStatus = "rascunho" | "em_revisao" | "aprovado" | "publicado" | "arquivado";

export const FLOW_STATUS_LABEL: Record<FlowStatus, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  aprovado: "Aprovado",
  publicado: "Publicado",
  arquivado: "Arquivado",
};

/** Regras de validação executadas antes de publicar (seção 12.2). */
export type FlowValidationRule =
  | "caminho_sem_saida"
  | "no_orfao"
  | "variavel_inexistente"
  | "credencial_ausente"
  | "laco_sem_limite"
  | "sem_transbordo";

export const FLOW_VALIDATION_LABEL: Record<FlowValidationRule, string> = {
  caminho_sem_saida: "Caminho sem saída",
  no_orfao: "Nó inalcançável",
  variavel_inexistente: "Variável inexistente",
  credencial_ausente: "Credencial ausente",
  laco_sem_limite: "Laço sem limite",
  sem_transbordo: "Sem transbordo para humano",
};

export interface FlowValidationIssue {
  id: string;
  rule: FlowValidationRule;
  severity: "erro" | "alerta";
  nodeId?: Id;
  message: string;
}

/* ------------------------------------------------------------------ */
/* Chatbot                                                             */
/* ------------------------------------------------------------------ */

/** Blocos do MVP, conforme a tabela da seção 12.1. */
export type BotNodeKind =
  | "inicio"
  | "mensagem"
  | "pergunta"
  | "condicao"
  | "variavel"
  | "crm"
  | "http"
  | "ia"
  | "transferir"
  | "aguardar"
  | "subfluxo"
  | "finalizar";

export const BOT_NODE_LABEL: Record<BotNodeKind, string> = {
  inicio: "Início / Gatilho",
  mensagem: "Enviar mensagem",
  pergunta: "Perguntar e capturar",
  condicao: "Condição",
  variavel: "Definir variável",
  crm: "Atualizar CRM",
  http: "Requisição HTTP",
  ia: "IA",
  transferir: "Transferir para humano",
  aguardar: "Aguardar",
  subfluxo: "Subfluxo",
  finalizar: "Finalizar",
};

export type BotNode = FlowNode<BotNodeKind>;

export interface BotFlowVersion {
  id: Id;
  flowId: Id;
  version: number;
  status: FlowStatus;
  nodes: BotNode[];
  edges: FlowEdge[];
  publishedAt?: IsoDateTime;
  publishedBy?: Id;
  changeNote?: string;
}

export interface BotFlow extends BaseEntity {
  name: string;
  description: string;
  channels: ChannelKind[];
  /** Limites de segurança da execução (seção 12.2). */
  limits: {
    maxSteps: number;
    maxDurationMinutes: number;
    maxHttpCalls: number;
    maxAiCostCents: number;
  };
  activeVersionId?: Id;
  draftVersionId: Id;
  versions: BotFlowVersion[];
  stats: {
    sessions30d: number;
    resolvedByBotPct: number;
    handoffPct: number;
    avgStepsPerSession: number;
  };
}

/**
 * Estado mínimo persistido pelo runtime após cada bloco (seção 12.3).
 * Uma queda do worker não pode perder o ponto do fluxo.
 */
export interface BotSessionState {
  id: Id;
  flowVersionId: Id;
  currentNodeId: Id;
  variables: Record<string, string | number | boolean>;
  contactId: Id;
  conversationId?: Id;
  lastEventId?: Id;
  nextRunAt?: IsoDateTime;
  attemptCount: number;
  status: "ativa" | "aguardando" | "encerrada" | "erro";
}

/** Passo registrado pelo simulador, com inspeção de variáveis (seção 12.2). */
export interface SimulationStep {
  id: string;
  nodeId: Id;
  nodeKind: BotNodeKind;
  label: string;
  detail: string;
  outcome: "ok" | "aguardando_usuario" | "erro" | "transferido" | "fim";
  variables: Record<string, string | number | boolean>;
  elapsedMs: number;
}

/* ------------------------------------------------------------------ */
/* Jornadas                                                            */
/* ------------------------------------------------------------------ */

/** Categorias de elemento da jornada, conforme a tabela da seção 15. */
export type JourneyNodeKind =
  | "gatilho"
  | "condicao"
  | "espera"
  | "enviar_whatsapp"
  | "enviar_email"
  | "atualizar_crm"
  | "criar_tarefa"
  | "webhook"
  | "adicionar_tag"
  | "mover_etapa"
  | "notificar_equipe"
  | "meta"
  | "saida";

export const JOURNEY_NODE_LABEL: Record<JourneyNodeKind, string> = {
  gatilho: "Gatilho",
  condicao: "Condição",
  espera: "Aguardar",
  enviar_whatsapp: "Enviar WhatsApp",
  enviar_email: "Enviar e-mail",
  atualizar_crm: "Atualizar CRM",
  criar_tarefa: "Criar tarefa",
  webhook: "Chamar webhook",
  adicionar_tag: "Adicionar tag",
  mover_etapa: "Mover etapa",
  notificar_equipe: "Notificar equipe",
  meta: "Meta",
  saida: "Saída",
};

export type JourneyNode = FlowNode<JourneyNodeKind>;

/** Política de reentrada do contato na jornada (seção 15.2). */
export type ReentryPolicy = "unica" | "multipla" | "apos_periodo";

export const REENTRY_LABEL: Record<ReentryPolicy, string> = {
  unica: "Entrada única",
  multipla: "Múltiplas entradas",
  apos_periodo: "Reentrada após período",
};

export interface JourneyVersion {
  id: Id;
  journeyId: Id;
  version: number;
  status: FlowStatus;
  nodes: JourneyNode[];
  edges: FlowEdge[];
  publishedAt?: IsoDateTime;
  publishedBy?: Id;
  changeNote?: string;
}

/**
 * Cada participante é um registro independente com status, versão, nó atual e
 * próxima execução (seção 15.1). A espera grava `nextRunAt` — não mantém
 * processo em memória.
 */
export interface JourneyEnrollment {
  id: Id;
  journeyId: Id;
  journeyVersionId: Id;
  contactId: Id;
  currentNodeId: Id;
  status: "ativo" | "aguardando" | "concluido" | "saiu" | "erro";
  enrolledAt: IsoDateTime;
  nextRunAt?: IsoDateTime;
  goalReachedAt?: IsoDateTime;
}

export interface Journey extends BaseEntity {
  name: string;
  description: string;
  goal: string;
  reentryPolicy: ReentryPolicy;
  reentryAfterDays?: number;
  priority: number;
  /** Janela de envio local respeitada por todas as ações de mensagem. */
  sendWindow: { startHour: number; endHour: number };
  activeVersionId?: Id;
  draftVersionId: Id;
  versions: JourneyVersion[];
  stats: {
    active: number;
    completed: number;
    goalReached: number;
    exited: number;
    conversionPct: number;
  };
}
