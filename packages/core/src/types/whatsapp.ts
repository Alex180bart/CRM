/**
 * Canal WhatsApp — forma canônica.
 *
 * Referência: seção 11 do plano ("Integração dos números de WhatsApp").
 *
 * Estes tipos descrevem o que **nós** entendemos por mensagem e status de
 * WhatsApp, não o que a Meta envia. A distinção é o ponto: o corpo do webhook da
 * Meta é aninhado em `entry[].changes[].value.messages[]`, muda entre versões da
 * API e traz campo que não nos interessa. Traduzir na fronteira significa que
 * trocar de versão — ou trocar a Cloud API por um BSP — mexe no leitor e em mais
 * nada.
 *
 * É a mesma disciplina do widget de webchat: fronteira HTTP estável, corpo
 * trocável.
 */

import type { IsoDateTime } from "./common";

/* Recebimento ---------------------------------------------------------------- */

/**
 * Tipos que a seção 11 exige receber.
 *
 * `desconhecido` existe de propósito. A Meta acrescenta tipo novo sem aviso, e
 * um leitor que estoura no que não conhece derruba o webhook inteiro — o que faz
 * a Meta reentregar, falhar de novo, e derrubar a qualidade do número. Melhor
 * receber, marcar como desconhecido e seguir.
 */
export type WhatsappMessageKind =
  | "texto"
  | "imagem"
  | "documento"
  | "audio"
  | "video"
  | "sticker"
  | "localizacao"
  | "contato"
  | "botao"
  | "lista"
  | "reacao"
  | "desconhecido";

export const WHATSAPP_MESSAGE_KIND_LABEL: Record<WhatsappMessageKind, string> = {
  texto: "Texto",
  imagem: "Imagem",
  documento: "Documento",
  audio: "Áudio",
  video: "Vídeo",
  sticker: "Figurinha",
  localizacao: "Localização",
  contato: "Contato",
  botao: "Resposta de botão",
  lista: "Resposta de lista",
  reacao: "Reação",
  desconhecido: "Tipo não reconhecido",
};

export interface WhatsappInboundMessage {
  /** Identificador da mensagem na Meta — é a chave de idempotência. */
  waMessageId: string;
  /** Número do remetente em E.164, sem o "+". */
  from: string;
  /** Identificador do nosso número que recebeu, para saber qual conta atender. */
  phoneNumberId: string;
  /** Nome do perfil do WhatsApp, quando a Meta envia. */
  profileName?: string;
  kind: WhatsappMessageKind;
  /** Texto, legenda da mídia ou rótulo do botão. */
  text?: string;
  /**
   * Identificador da mídia na Meta.
   *
   * Não é URL: baixar exige uma segunda chamada autenticada, e o conteúdo expira.
   * É o caminho de mídia da seção 11 — download, antivírus, armazenamento —, que
   * é back-end.
   */
  mediaId?: string;
  mimeType?: string;
  fileName?: string;
  /** Mensagem citada, quando é resposta a outra. */
  repliedToId?: string;
  occurredAt: IsoDateTime;
}

/* Status --------------------------------------------------------------------- */

/**
 * Estados que a seção 11 manda preservar, "com código e motivo do provedor".
 *
 * `enfileirada` não vem da Meta: é nosso, o instante entre aceitar o envio e o
 * provedor confirmar. Sem ele não há como distinguir "ainda não saiu" de
 * "sumiu".
 */
export type WhatsappDeliveryStatus =
  "enfileirada" | "enviada" | "entregue" | "lida" | "falhou" | "expirada" | "bloqueada";

export const WHATSAPP_STATUS_LABEL: Record<WhatsappDeliveryStatus, string> = {
  enfileirada: "Enfileirada",
  enviada: "Enviada",
  entregue: "Entregue",
  lida: "Lida",
  falhou: "Falhou",
  expirada: "Expirada",
  bloqueada: "Bloqueada",
};

export interface WhatsappStatusUpdate {
  waMessageId: string;
  recipient: string;
  phoneNumberId: string;
  status: WhatsappDeliveryStatus;
  /** Código do provedor, preservado como veio — é por ele que se depura. */
  errorCode?: number;
  errorTitle?: string;
  occurredAt: IsoDateTime;
}

/** O que um corpo de webhook produz depois de traduzido. */
export interface WhatsappWebhookEvents {
  messages: WhatsappInboundMessage[];
  statuses: WhatsappStatusUpdate[];
  /** Quantos itens vieram e não foram reconhecidos — sinal de versão nova. */
  ignored: number;
}

/* Configuração e diagnóstico ------------------------------------------------- */

/**
 * Etapas da conexão de um número.
 *
 * A ordem não é decorativa: cada uma depende da anterior na plataforma da Meta,
 * e tentar fora de ordem gera erro que não explica a causa. Quem já tentou
 * cadastrar número antes de verificar o negócio conhece a mensagem inútil que
 * volta.
 */
export type WhatsappSetupStepId =
  "negocio" | "waba" | "numero" | "credencial" | "webhook" | "templates";

/**
 * De quem é a etapa.
 *
 * `meta` é formulário e espera, do lado de lá. `nosso` é código e infraestrutura
 * do lado de cá. Separar os dois é o que permite tocar as duas frentes em
 * paralelo — a verificação de negócio leva dias e não depende de nada aqui.
 */
export type WhatsappStepOwner = "meta" | "nosso";

export type WhatsappStepState = "pendente" | "em_andamento" | "concluida" | "bloqueada";

/**
 * O que o servidor sabe sobre a própria configuração.
 *
 * **Nunca carrega valor de segredo**, só presença — a mesma regra de
 * `providerStatus()` no AI Gateway. Esta resposta atravessa a rede até o
 * navegador de quem administra, e "o token está lá" é tudo que a tela precisa
 * para decidir o que mostrar.
 */
export interface WhatsappDiagnostics {
  /** Endereço público que a Meta deve chamar. */
  webhookUrl: string;
  verifyTokenConfigured: boolean;
  appSecretConfigured: boolean;
  accessTokenConfigured: boolean;
  phoneNumberIdConfigured: boolean;
  /**
   * Verdadeiro quando o endereço é alcançável pela internet.
   *
   * `localhost` não é: a Meta chama de fora, e é este o motivo número um de a
   * verificação do webhook falhar em desenvolvimento.
   */
  publiclyReachable: boolean;
  /** Últimos eventos recebidos, para provar que o webhook está chegando. */
  recentEvents: WhatsappWebhookLog[];
}

export interface WhatsappWebhookLog {
  at: IsoDateTime;
  kind: "verificacao" | "mensagem" | "status" | "recusado";
  detail: string;
}
