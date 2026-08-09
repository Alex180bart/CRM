/**
 * Tradução do corpo do webhook da Meta para a forma canônica.
 *
 * Função pura, em `@elora/core`, pelo mesmo motivo da classificação de URL e da
 * extração de texto: quem recebe (a rota) e quem testa precisam concordar sobre
 * o que aquele JSON significa. E ela é a **única** peça que conhece o formato da
 * Meta — trocar a versão da API, ou trocar a Cloud API por um BSP, mexe aqui e
 * em mais nada.
 *
 * ## Nada aqui pode lançar
 *
 * Um leitor que estoura no campo inesperado derruba o webhook; a Meta reentrega,
 * falha de novo, e depois de algumas rodadas **rebaixa a qualidade do número** —
 * o ativo que a seção 11 manda tratar como do negócio. Então tudo que não é
 * reconhecido vira `ignored`, e a rota responde 200 assim mesmo.
 */

import type {
  WhatsappDeliveryStatus,
  WhatsappInboundMessage,
  WhatsappMessageKind,
  WhatsappStatusUpdate,
  WhatsappWebhookEvents,
} from "../types/whatsapp";

/** A Meta manda segundos em texto; o produto inteiro fala ISO com fuso. */
function fromUnix(value: unknown): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return new Date(0).toISOString();
  return new Date(seconds * 1000).toISOString();
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Tipos da Meta que mapeiam direto. O que não estiver aqui vira `desconhecido`
 * em vez de erro — a Meta acrescenta tipo sem aviso.
 */
const KIND_MAP: Record<string, WhatsappMessageKind> = {
  text: "texto",
  image: "imagem",
  document: "documento",
  audio: "audio",
  video: "video",
  sticker: "sticker",
  location: "localizacao",
  contacts: "contato",
  button: "botao",
  reaction: "reacao",
};

const STATUS_MAP: Record<string, WhatsappDeliveryStatus> = {
  sent: "enviada",
  delivered: "entregue",
  read: "lida",
  failed: "falhou",
  deleted: "bloqueada",
};

/**
 * Onde o texto mora, por tipo.
 *
 * Mídia traz `caption`, que é legenda e não corpo — mas é o que o atendente
 * precisa ler na lista de conversas. Botão e lista trazem o rótulo escolhido, e
 * é ele que o fluxo compara. Perder isso transformaria toda resposta de menu em
 * mensagem vazia.
 */
function readText(type: string, message: Record<string, unknown>): string | undefined {
  const node = message[type];
  if (typeof node !== "object" || node === null) return undefined;
  const record = node as Record<string, unknown>;

  if (type === "text") return asString(record.body);
  if (type === "button") return asString(record.text);
  if (type === "reaction") return asString(record.emoji);

  if (type === "interactive") {
    const reply =
      (record.button_reply as Record<string, unknown> | undefined) ??
      (record.list_reply as Record<string, unknown> | undefined);
    return reply ? asString(reply.title) : undefined;
  }

  if (type === "location") {
    const name = asString(record.name);
    const address = asString(record.address);
    return name || address || `${record.latitude}, ${record.longitude}`;
  }

  return asString(record.caption);
}

function readMessage(
  raw: unknown,
  phoneNumberId: string,
  contacts: Map<string, string>,
): WhatsappInboundMessage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const message = raw as Record<string, unknown>;

  const waMessageId = asString(message.id);
  const from = asString(message.from);
  const type = asString(message.type) ?? "";

  // Sem identificador não há idempotência possível: a reentrega viraria duplicata.
  if (!waMessageId || !from) return null;

  /**
   * `interactive` cobre botão e lista, e a distinção está um nível abaixo.
   * Tratá-los como um tipo só perderia a diferença que o fluxo usa para saber
   * se veio de menu ou de resposta rápida.
   */
  let kind: WhatsappMessageKind = KIND_MAP[type] ?? "desconhecido";
  if (type === "interactive") {
    const node = message.interactive as Record<string, unknown> | undefined;
    kind = node?.list_reply ? "lista" : "botao";
  }

  const media = (message[type] as Record<string, unknown> | undefined) ?? {};
  const context = message.context as Record<string, unknown> | undefined;

  return {
    waMessageId,
    from,
    phoneNumberId,
    profileName: contacts.get(from),
    kind,
    text: readText(type, message),
    mediaId: asString(media.id),
    mimeType: asString(media.mime_type),
    fileName: asString(media.filename),
    repliedToId: context ? asString(context.id) : undefined,
    occurredAt: fromUnix(message.timestamp),
  };
}

function readStatus(raw: unknown, phoneNumberId: string): WhatsappStatusUpdate | null {
  if (typeof raw !== "object" || raw === null) return null;
  const status = raw as Record<string, unknown>;

  const waMessageId = asString(status.id);
  const recipient = asString(status.recipient_id);
  const mapped = STATUS_MAP[asString(status.status) ?? ""];

  if (!waMessageId || !recipient || !mapped) return null;

  /**
   * O erro é preservado como veio, com código e título.
   *
   * A seção 11 pede exatamente isso, e o motivo é prático: "falhou" sozinho não
   * distingue número inexistente de template não aprovado de janela vencida — e
   * as três exigem ações opostas de quem opera.
   */
  const errors = Array.isArray(status.errors) ? status.errors : [];
  const first = (errors[0] ?? {}) as Record<string, unknown>;
  const code = Number(first.code);

  return {
    waMessageId,
    recipient,
    phoneNumberId,
    status: mapped,
    errorCode: Number.isFinite(code) ? code : undefined,
    errorTitle: asString(first.title) ?? asString(first.message),
    occurredAt: fromUnix(status.timestamp),
  };
}

/**
 * Percorre `entry[].changes[].value` e devolve o que reconhecemos.
 *
 * Um corpo pode trazer mensagens **e** status ao mesmo tempo, de mais de um
 * número, e a Meta agrupa por conta. Por isso o `phoneNumberId` é lido dentro do
 * laço e não fora: assumir um número só funciona até a segunda conta entrar.
 */
export function parseWhatsappWebhook(payload: unknown): WhatsappWebhookEvents {
  const events: WhatsappWebhookEvents = { messages: [], statuses: [], ignored: 0 };

  if (typeof payload !== "object" || payload === null) return events;
  const body = payload as Record<string, unknown>;

  const entries = Array.isArray(body.entry) ? body.entry : [];

  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    const changes = (entry as Record<string, unknown>).changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      if (typeof change !== "object" || change === null) continue;
      const value = (change as Record<string, unknown>).value;
      if (typeof value !== "object" || value === null) continue;

      const record = value as Record<string, unknown>;
      const metadata = (record.metadata ?? {}) as Record<string, unknown>;
      const phoneNumberId = asString(metadata.phone_number_id) ?? "";

      /**
       * O nome do perfil vem numa lista à parte, casada por `wa_id`.
       * Sem este cruzamento, toda conversa nova entra como número cru — e a
       * lista do Inbox vira uma coluna de telefones.
       */
      const contacts = new Map<string, string>();
      if (Array.isArray(record.contacts)) {
        for (const contact of record.contacts) {
          if (typeof contact !== "object" || contact === null) continue;
          const item = contact as Record<string, unknown>;
          const waId = asString(item.wa_id);
          const profile = item.profile as Record<string, unknown> | undefined;
          const name = profile ? asString(profile.name) : undefined;
          if (waId && name) contacts.set(waId, name);
        }
      }

      const messages = Array.isArray(record.messages) ? record.messages : [];
      for (const message of messages) {
        const parsed = readMessage(message, phoneNumberId, contacts);
        if (parsed) events.messages.push(parsed);
        else events.ignored += 1;
      }

      const statuses = Array.isArray(record.statuses) ? record.statuses : [];
      for (const status of statuses) {
        const parsed = readStatus(status, phoneNumberId);
        if (parsed) events.statuses.push(parsed);
        else events.ignored += 1;
      }
    }
  }

  return events;
}

/* Janela de 24 horas --------------------------------------------------------- */

export const WHATSAPP_WINDOW_HOURS = 24;

/**
 * Ainda dá para mandar texto livre?
 *
 * Fora da janela de 24 horas desde a **última mensagem do cliente**, a Meta só
 * aceita template aprovado. Escrever texto livre ali não dá erro no editor: dá
 * erro no envio, depois que o atendente já achou que respondeu.
 *
 * Função pura porque três lugares precisam da mesma resposta — o compositor do
 * Inbox, o agente de IA antes de redigir, e o worker antes de despachar.
 */
export function isWithinServiceWindow(lastInboundAt: string | undefined, nowMs: number): boolean {
  if (!lastInboundAt) return false;
  const last = Date.parse(lastInboundAt);
  if (Number.isNaN(last)) return false;
  return nowMs - last < WHATSAPP_WINDOW_HOURS * 60 * 60 * 1000;
}

/** Quanto falta da janela, em minutos. Negativo quando já venceu. */
export function serviceWindowMinutesLeft(lastInboundAt: string | undefined, nowMs: number): number {
  if (!lastInboundAt) return -1;
  const last = Date.parse(lastInboundAt);
  if (Number.isNaN(last)) return -1;
  return Math.round((last + WHATSAPP_WINDOW_HOURS * 60 * 60 * 1000 - nowMs) / 60_000);
}
