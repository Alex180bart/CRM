/**
 * Camada de inteligência artificial.
 * Referência: Plano Completo, seção 16 (AI Gateway, casos de uso, avaliação).
 *
 * Estes tipos descrevem o **contrato** com o AI Gateway, não com um provedor.
 * A seção 16.1 é explícita: a aplicação não fala com Claude ou Gemini em
 * dezenas de pontos do código. Ela envia uma tarefa e recebe uma saída
 * estruturada e validada. Trocar Gemini por Claude não deve tocar nenhuma tela.
 */

import type { Id, IsoDateTime } from "./common";

/** Tarefas do copiloto do atendente hoje suportadas (seção 16.1). */
export type AiTask =
  "analisar_conversa" | "sugerir_resposta" | "reescrever" | "perguntar" | "redigir_email";

/**
 * Registro de execução — é o que torna a IA auditável e mensurável.
 * A seção 16.4 exige precisão, custo e latência por caso de uso; sem estes
 * campos chegando à interface, não há como o time perceber que um prompt
 * ficou caro ou lento.
 */
export interface AiRunMeta {
  runId: Id;
  task: AiTask;
  provider: string;
  model: string;
  /** Versão do prompt aplicado, para comparar qualidade entre revisões. */
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  /**
   * Custo estimado em **centavos de dólar**, com quatro casas decimais.
   * A unidade é a do provedor de propósito: converter para real exigiria fixar
   * uma taxa de câmbio no código, e uma taxa desatualizada é pior que nenhuma.
   */
  costUsdCents: number;
  /** Verdadeiro quando a primeira resposta não passou no schema e houve reparo. */
  repaired: boolean;
  occurredAt: IsoDateTime;
}

export type AiSentiment = "positivo" | "neutro" | "impaciente" | "irritado";

export const AI_SENTIMENT_LABEL: Record<AiSentiment, string> = {
  positivo: "Positivo",
  neutro: "Neutro",
  impaciente: "Impaciente",
  irritado: "Irritado",
};

export type AiUrgency = "baixa" | "normal" | "alta" | "critica";

export const AI_URGENCY_LABEL: Record<AiUrgency, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  critica: "Crítica",
};

/** Dado que o modelo localizou na conversa e o atendente pode aproveitar. */
export interface AiExtractedField {
  label: string;
  value: string;
  /** Trecho da conversa que sustenta o valor — o atendente confere sem reler tudo. */
  evidence?: string;
}

export interface AiChecklistItem {
  label: string;
  /** O modelo marca o que a própria conversa já mostra ter sido feito. */
  done: boolean;
}

/**
 * Leitura completa da conversa (seção 16.1, linha "Copiloto do atendente":
 * resumo, intenção, sentimento, dados importantes, resposta sugerida, próximo
 * passo e checklist).
 */
export interface AiConversationAnalysis {
  summary: string;
  intent: string;
  sentiment: AiSentiment;
  urgency: AiUrgency;
  extracted: AiExtractedField[];
  nextStep: string;
  checklist: AiChecklistItem[];
  suggestedReply: string;
  /** Assuntos sugeridos como tag — proposta, nunca aplicação automática. */
  suggestedTags: string[];
  /** O que o modelo não conseguiu resolver sozinho e precisa de gente. */
  openQuestions: string[];
  /**
   * Tabulação: o que a conversa revelou e o cadastro ainda não sabe.
   * Proposta, nunca escrita — a aplicação valida e o atendente aplica.
   */
  proposals: AiProposal[];
  meta: AiRunMeta;
}

export type AiToneAdjustment =
  "formal" | "cordial" | "direto" | "empatico" | "resumir" | "detalhar" | "revisar";

export const AI_TONE_LABEL: Record<AiToneAdjustment, string> = {
  formal: "Mais formal",
  cordial: "Mais cordial",
  direto: "Mais direto",
  empatico: "Mais empático",
  resumir: "Encurtar",
  detalhar: "Detalhar",
  revisar: "Revisar português",
};

export interface AiText {
  text: string;
  meta: AiRunMeta;
}

/**
 * Mensagem enviada ao Gateway como contexto.
 *
 * Deliberadamente pobre: quem fala, o que disse e quando. Nada de identificador
 * interno, anexo binário ou campo de auditoria — o modelo não precisa, e o que
 * não é enviado não vaza (seção 16.4).
 */
export interface AiContextMessage {
  role: "contato" | "agente" | "bot" | "nota_interna";
  author: string;
  body: string;
  at: IsoDateTime;
  /** Só o nome do arquivo, para o modelo saber que houve troca de documento. */
  attachments?: string[];
}

/**
 * Estado de um campo do cadastro, **sem o conteúdo**.
 *
 * É o que torna a tabulação possível sem quebrar a minimização de dado da seção
 * 16.4: para propor "o CPF dito na conversa não está no cadastro", o modelo
 * precisa saber que o campo está vazio — não precisa ver o CPF que já existiria
 * ali. Então viaja a lacuna, nunca o valor.
 *
 * A exceção é `sample`, usado só onde o próprio valor é o rótulo (cidade,
 * cargo): sem ele o modelo proporia trocar "São Paulo" por "SP" sem saber que
 * são a mesma coisa. Documento, telefone e e-mail nunca levam amostra.
 */
export interface AiFieldState {
  /** Caminho do catálogo — `contato.documento`, `campo.regime_tributario`. */
  field: string;
  label: string;
  filled: boolean;
  /** Valor atual, só para campos onde ele não é dado pessoal sensível. */
  sample?: string;
}

export interface AiConversationContext {
  conversationId: Id;
  channel: string;
  subject: string;
  queue: string;
  state: string;
  contactName: string;
  /** Empresa, regime, etapa de ciclo — o que muda a resposta correta. */
  contactFacts?: string[];
  /** Lacunas do cadastro que a conversa pode preencher (tabulação). */
  fieldStates?: AiFieldState[];
  agentName: string;
  messages: AiContextMessage[];
}

export interface AiAnalyzeInput {
  context: AiConversationContext;
}

export interface AiSuggestInput {
  context: AiConversationContext;
  /** Rascunho já digitado pelo atendente, quando existe. */
  draft?: string;
  instruction?: string;
}

export interface AiRewriteInput {
  context: AiConversationContext;
  draft: string;
  tone: AiToneAdjustment;
}

export interface AiAskInput {
  context: AiConversationContext;
  question: string;
  /** Perguntas anteriores, para a conversa com o copiloto ter memória. */
  history?: Array<{ role: "atendente" | "copiloto"; body: string }>;
}

/* Tabulação — o que o copiloto propõe gravar --------------------------------- */

/**
 * Ação que o modelo propõe sobre o CRM.
 *
 * Seção 16.3: "o modelo apenas propõe a ferramenta e os parâmetros; a aplicação
 * valida permissão, executa a ação". Por isso a proposta é **dado**, não efeito:
 * ela atravessa o Gateway como JSON, é conferida contra o cadastro e contra o
 * dígito verificador, e só vira escrita quando alguém clica.
 */
export type AiProposalKind =
  "preencher_campo" | "vincular_empresa" | "criar_tarefa" | "mover_etapa";

export const AI_PROPOSAL_KIND_LABEL: Record<AiProposalKind, string> = {
  preencher_campo: "Preencher cadastro",
  vincular_empresa: "Vincular empresa",
  criar_tarefa: "Criar tarefa",
  mover_etapa: "Mover etapa do funil",
};

/**
 * Campos que o copiloto pode propor preencher.
 *
 * Catálogo fechado de propósito. Se o modelo pudesse nomear qualquer caminho, a
 * aplicação teria de decidir em tempo de execução o que fazer com
 * `contato.saldo_devedor` — e a resposta certa seria recusar. Campo novo entra
 * aqui e no prompt, nos dois lugares, conscientemente.
 *
 * `campo.<chave>` é a exceção controlada: aponta para um `customFields` que a
 * organização já definiu, e a chave é validada contra os campos do contato.
 */
export type AiProposalField =
  | "contato.email"
  | "contato.telefone"
  | "contato.documento"
  | "contato.cargo"
  | "contato.cidade"
  | "contato.estado"
  | `campo.${string}`;

export interface AiProposal {
  /** Estável dentro de uma análise, para a interface acompanhar o que já foi aplicado. */
  id: string;
  kind: AiProposalKind;
  /** Campo do catálogo em `preencher_campo`; vazio nas demais ações. */
  field?: AiProposalField;
  /** Rótulo humano — "CPF", "Telefone", "Regime tributário". */
  label: string;
  /** Valor cru, como o cliente escreveu. A normalização é da aplicação. */
  value: string;
  /** Trecho da conversa que sustenta a proposta. Sem ele não há como conferir. */
  evidence: string;
  /** 0 a 100. Abaixo do piso a proposta não é oferecida. */
  confidence: number;
  /** Vencimento da tarefa, quando a proposta é `criar_tarefa`. */
  dueAt?: IsoDateTime;
}

/**
 * O que a aplicação concluiu ao confrontar a proposta com o cadastro.
 *
 * `novo` preenche lacuna e é o caso barato. `divergente` é o caro: o cadastro já
 * tem outro valor, e trocar pode estar certo (cliente mudou de telefone) ou
 * errado (ditou o número do sócio). Por isso os dois nunca compartilham botão.
 */
export type AiProposalStatus = "novo" | "divergente" | "igual" | "invalido";

export interface AiResolvedProposal {
  proposal: AiProposal;
  status: AiProposalStatus;
  /** Valor normalizado que seria gravado — E.164, minúsculas, máscara padrão. */
  normalized: string;
  /** O que o cadastro tem hoje, quando tem. */
  current?: string;
  /** Motivo da recusa em `invalido` — dígito verificador, formato, chave desconhecida. */
  reason?: string;
}

/* Redação de e-mail --------------------------------------------------------- */

export type AiEmailObjective =
  | "apresentar_servico"
  | "reengajar"
  | "avisar_prazo"
  | "convidar_evento"
  | "anunciar_novidade"
  | "pedir_documento";

export const AI_EMAIL_OBJECTIVE_LABEL: Record<AiEmailObjective, string> = {
  apresentar_servico: "Apresentar um serviço",
  reengajar: "Reengajar quem sumiu",
  avisar_prazo: "Avisar sobre um prazo",
  convidar_evento: "Convidar para um evento",
  anunciar_novidade: "Anunciar uma novidade",
  pedir_documento: "Pedir documento ou dado",
};

export type AiEmailTone = "profissional" | "proximo" | "urgente" | "didatico";

export const AI_EMAIL_TONE_LABEL: Record<AiEmailTone, string> = {
  profissional: "Profissional",
  proximo: "Próximo",
  urgente: "Urgente",
  didatico: "Didático",
};

export interface AiEmailDraftInput {
  /** O que o e-mail precisa dizer, nas palavras de quem pediu. */
  brief: string;
  objective: AiEmailObjective;
  tone: AiEmailTone;
  /** Para quem o e-mail vai — muda o vocabulário e o que pode ser assumido. */
  audience: string;
}

/**
 * Rascunho devolvido pelo modelo.
 *
 * Deliberadamente **não** é `EmailBlock[]`: o modelo escreve texto, e a conversão
 * para o documento de blocos acontece no editor, onde a marca e as travas já são
 * conhecidas. Assim o contrato com o provedor não muda toda vez que um tipo de
 * bloco novo entra no produto.
 */
export interface AiEmailDraft {
  subject: string;
  preheader: string;
  headline: string;
  paragraphs: string[];
  ctaLabel: string;
  ctaHref: string;
  closing: string;
  meta: AiRunMeta;
}

/** Erro do Gateway já traduzido para a interface — nunca o corpo do provedor. */
export class AiGatewayError extends Error {
  readonly code:
    "sem_credencial" | "limite_excedido" | "invalido" | "indisponivel" | "cancelado" | "falha";

  constructor(code: AiGatewayError["code"], message: string) {
    super(message);
    this.name = "AiGatewayError";
    this.code = code;
  }
}
