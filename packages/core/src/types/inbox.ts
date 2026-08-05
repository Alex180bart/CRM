/**
 * Inbox omnichannel e atendimento.
 * Referência: Plano Completo, seção 10 (capacidades, estados, concorrência).
 */

import type { BaseEntity, ChannelKind, Id, IsoDateTime } from "./common";

/**
 * Estados canônicos da conversa (seção 10.1). Estados adicionais podem ser
 * criados pela operação, mas este conjunto é preservado para manter relatórios
 * comparáveis entre times e períodos.
 */
export type ConversationState =
  | "nova"
  | "em_triagem"
  | "em_atendimento"
  | "aguardando_cliente"
  | "aguardando_interno"
  | "resolvida"
  | "encerrada";

export const CONVERSATION_STATE_LABEL: Record<ConversationState, string> = {
  nova: "Nova",
  em_triagem: "Em triagem",
  em_atendimento: "Em atendimento",
  aguardando_cliente: "Aguardando cliente",
  aguardando_interno: "Aguardando área interna",
  resolvida: "Resolvida",
  encerrada: "Encerrada",
};

export const OPEN_CONVERSATION_STATES: ConversationState[] = [
  "nova",
  "em_triagem",
  "em_atendimento",
  "aguardando_cliente",
  "aguardando_interno",
];

export type SlaStatus = "dentro" | "atencao" | "estourado" | "pausado" | "cumprido";

export const SLA_STATUS_LABEL: Record<SlaStatus, string> = {
  dentro: "Dentro do SLA",
  atencao: "Em atenção",
  estourado: "SLA estourado",
  pausado: "SLA pausado",
  cumprido: "SLA cumprido",
};

export type MessageDirection = "entrada" | "saida";

export type MessageDeliveryStatus =
  "enfileirada" | "enviada" | "entregue" | "lida" | "falhou" | "expirada";

export const DELIVERY_STATUS_LABEL: Record<MessageDeliveryStatus, string> = {
  enfileirada: "Enfileirada",
  enviada: "Enviada",
  entregue: "Entregue",
  lida: "Lida",
  falhou: "Falhou",
  expirada: "Expirada",
};

export type AttachmentKind = "imagem" | "documento" | "audio" | "video";

export const ATTACHMENT_KIND_LABEL: Record<AttachmentKind, string> = {
  imagem: "Imagem",
  documento: "Documento",
  audio: "Áudio",
  video: "Vídeo",
};

/**
 * De onde o anexo veio.
 *
 * `arquivo` é byte que passou pelo nosso processamento — upload do atendente ou
 * download do que o cliente enviou. `link` é um endereço de terceiro que ainda
 * não foi buscado: existe como referência, e o envio real por WhatsApp exige que
 * o back-end baixe o conteúdo antes (seção 11, "download temporário").
 *
 * A distinção não é acadêmica. Um anexo `link` pode sumir sem aviso, mudar de
 * conteúdo sob o mesmo endereço e não passou por antivírus. A interface precisa
 * saber disso para não prometer o que não controla.
 */
export type AttachmentSource = "arquivo" | "link";

/**
 * Provedor de mídia com página própria.
 *
 * Vídeo do YouTube não é arquivo para baixar: é uma página cuja capa e título
 * conseguimos resolver. Acrescentar Vimeo ou Loom é acrescentar uma entrada
 * aqui e um caso em `parseYouTube`/`classifyUrl`.
 */
export type MediaProvider = "youtube";

/**
 * Anexo de mensagem.
 *
 * A seção 11 do plano trata mídia como fluxo próprio: download temporário,
 * antivírus, armazenamento, expiração, miniatura e controle de acesso. Por isso
 * `url` e `previewUrl` são opcionais — o registro do anexo existe desde o
 * recebimento, mas o link assinado só aparece depois do processamento. Enquanto
 * não há back-end, a interface trata a ausência como estado legítimo e mostra o
 * arquivo pelo nome, sem prometer visualização.
 */
export interface Attachment {
  id: Id;
  fileName: string;
  mimeType: string;
  /**
   * Ausente quando o tamanho é desconhecido — o caso de um anexo por link cujo
   * servidor não informa `Content-Length`. Zero seria mentira, e a interface
   * omite o dado em vez de exibir "0 B".
   */
  sizeBytes?: number;
  kind: AttachmentKind;
  /** Ausente equivale a `arquivo`, que é a origem da esmagadora maioria. */
  source?: AttachmentSource;
  /** Link de acesso ao arquivo original, assinado e temporário. */
  url?: string;
  /** Miniatura para imagem e vídeo, ou capa gerada no processamento. */
  previewUrl?: string;
  /** Duração de áudio e vídeo, em segundos. */
  durationSeconds?: number;
  width?: number;
  height?: number;
  /** Transcrição de áudio, quando a organização habilita o recurso. */
  transcript?: string;
  /** Preenchido quando o link é de um provedor conhecido de vídeo. */
  provider?: MediaProvider;
  /**
   * Título resolvido do recurso remoto — o nome do vídeo, por exemplo.
   * Vale mais que o nome do arquivo: "Aula 3 — Fechamento contábil" diz o que
   * `watch?v=dQw4w9WgXcQ` esconde.
   */
  title?: string;
  /** Página de origem do link, quando ela não é o próprio arquivo. */
  externalUrl?: string;
}

/** Trecho da mensagem citada, materializado para a bolha não depender de busca. */
export interface MessageQuote {
  messageId: Id;
  authorLabel: string;
  /** Prévia curta do corpo citado; a mensagem original pode ter sido apagada. */
  preview: string;
  attachmentLabel?: string;
}

export type MessageAuthorKind = "contato" | "agente" | "bot" | "sistema";

export interface Message {
  id: Id;
  organizationId: Id;
  conversationId: Id;
  direction: MessageDirection;
  authorKind: MessageAuthorKind;
  authorId?: Id;
  authorLabel: string;
  channel: ChannelKind;
  body: string;
  attachments?: Attachment[];
  /** Mensagem respondida, quando o atendente ou o contato citou outra. */
  quote?: MessageQuote;
  /** Nome do template aprovado, quando a mensagem sai fora da janela de 24h. */
  templateName?: string;
  deliveryStatus?: MessageDeliveryStatus;
  /** Código e motivo do provedor são preservados para diagnóstico (seção 11). */
  failureCode?: string;
  failureReason?: string;
  occurredAt: IsoDateTime;
}

export interface InternalNote {
  id: Id;
  conversationId: Id;
  authorId: Id;
  authorLabel: string;
  body: string;
  mentionedUserIds: Id[];
  occurredAt: IsoDateTime;
}

export interface Conversation extends BaseEntity {
  contactId: Id;
  channel: ChannelKind;
  channelAccountId: Id;
  queueId: Id;
  /** Apenas um agente é o responsável principal; outros observam (seção 10.2). */
  assigneeId?: Id;
  observerIds: Id[];
  state: ConversationState;
  subject: string;
  priority: "baixa" | "normal" | "alta" | "urgente";
  unreadCount: number;
  lastMessagePreview: string;
  lastMessageAt: IsoDateTime;
  firstResponseDueAt?: IsoDateTime;
  firstRespondedAt?: IsoDateTime;
  resolutionDueAt?: IsoDateTime;
  slaStatus: SlaStatus;
  tagIds: Id[];
  /** Preenchido quando um bot transferiu a conversa, com o resumo do handoff. */
  handoffSummary?: string;
  botSessionId?: Id;
  satisfactionScore?: number;
}

export interface CannedResponse {
  id: Id;
  organizationId: Id;
  shortcut: string;
  title: string;
  body: string;
  channels: ChannelKind[];
}
