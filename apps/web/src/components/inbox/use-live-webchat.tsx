"use client";

import { useCallback, useEffect, useState } from "react";
import type { Contact, Conversation, InternalNote, Message } from "@crm/core";
import { ORG_ID, offsetIso } from "@crm/core";

import type { LiveConversation } from "@/app/api/webchat/live/route";

/**
 * Conversas de webchat ao vivo dentro do Inbox.
 *
 * O widget no site do cliente cria sessões no servidor; este hook as traz para a
 * lista do atendente no mesmo formato das conversas da base de demonstração.
 * Sem isto o canal estaria pela metade: o visitante escreveria e ninguém veria.
 *
 * A leitura é por intervalo porque não há WebSocket. Quando o back-end entrar,
 * o que troca é a origem do dado — a conversão para `Conversation` e `Message`
 * continua valendo, porque é ela que faz o webchat parecer com os outros canais
 * em vez de virar uma tela à parte.
 */

const POLL_MS = 5_000;

/** Identificador previsível: a mesma sessão vira sempre a mesma conversa. */
export function liveConversationId(sessionId: string): string {
  return `cnv_live_${sessionId}`;
}

export interface LiveWebchatData {
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  notesByConversation: Record<string, InternalNote[]>;
  /**
   * Contatos provisórios do visitante.
   *
   * Sem eles a lista mostra "Contato desconhecido" e o nome que o visitante
   * acabou de digitar no formulário se perde — logo no canal cuja promessa é
   * justamente capturar quem chegou. Não são gravados no CRM: existem enquanto a
   * sessão existe, e viram cadastro quando alguém decidir vinculá-los.
   */
  contacts: Contact[];
  /** Sessão de origem, para o envio do atendente saber para onde escrever. */
  sessionByConversation: Record<string, string>;
}

const EMPTY: LiveWebchatData = {
  conversations: [],
  messagesByConversation: {},
  notesByConversation: {},
  contacts: [],
  sessionByConversation: {},
};

/** Iniciais a partir do nome informado; "?" quando o widget não perguntou. */
function initialsOfName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

function toContact(live: LiveConversation): Contact {
  const phone = live.prechat["contato.telefone"];
  const email = live.prechat["contato.email"];

  return {
    id: `visitante_${live.sessionId}`,
    organizationId: ORG_ID,
    fullName: live.visitorName,
    avatarInitials: initialsOfName(live.visitorName),
    // Matiz fixa: visitante do site é sempre o mesmo tipo de origem, e variar a
    // cor por sessão faria a lista piscar a cada leitura.
    accentHue: 190,
    email,
    phone,
    lifecycleStage: "visitante",
    score: 0,
    originChannel: "webchat",
    originCampaign: live.origin,
    identifiers: [],
    tagIds: [],
    consents: [],
    customFields: [],
    lastInteractionAt: live.lastActivityAt,
    createdAt: live.startedAt,
    updatedAt: live.lastActivityAt,
  };
}

function toConversation(live: LiveConversation): Conversation {
  const id = liveConversationId(live.sessionId);
  const last = live.messages[live.messages.length - 1];

  return {
    id,
    organizationId: ORG_ID,
    // O contato ainda não existe no CRM: a sessão é anônima até alguém a
    // vincular. Apontar para um contato inventado sujaria a base.
    contactId: `visitante_${live.sessionId}`,
    channel: "webchat",
    channelAccountId: "chan_webchat_site",
    queueId: live.queueId,
    observerIds: [],
    state: live.handedOff ? "nova" : "em_triagem",
    subject: live.prechat["campo.origem_detalhada"] ?? "Conversa pelo site",
    priority: "normal",
    tagIds: [],
    unreadCount: live.messages.filter((message) => message.role === "visitante").length,
    lastMessagePreview: last?.body ?? "",
    lastMessageAt: live.lastActivityAt,
    // O prazo de primeira resposta conta a partir da abertura; o cálculo de SLA
    // é do próprio Inbox, que recalcula com `resolveSlaStatus`.
    firstResponseDueAt: live.startedAt,
    slaStatus: "dentro",
    createdAt: live.startedAt,
    updatedAt: live.lastActivityAt,
  };
}

function toMessages(live: LiveConversation): Message[] {
  const conversationId = liveConversationId(live.sessionId);

  return live.messages
    .filter((message) => message.role !== "sistema")
    .map((message) => ({
      id: message.id,
      organizationId: ORG_ID,
      conversationId,
      direction: message.role === "visitante" ? ("entrada" as const) : ("saida" as const),
      authorKind:
        message.role === "visitante"
          ? ("contato" as const)
          : message.role === "bot"
            ? ("bot" as const)
            : ("agente" as const),
      authorLabel:
        message.role === "visitante"
          ? live.visitorName
          : message.role === "bot"
            ? "Chatbot"
            : "Atendimento",
      channel: "webchat" as const,
      body: message.body,
      // Webchat não tem confirmação de leitura do provedor: a mensagem existe na
      // sessão ou não existe. Inventar "entregue" seria inventar um estado.
      occurredAt: message.occurredAt,
    }));
}

/**
 * Nota de abertura com o que o formulário capturou.
 *
 * O dado do formulário anterior à conversa não pode ficar só no servidor: é ele
 * que diz ao atendente com quem está falando antes da primeira resposta.
 */
function toNotes(live: LiveConversation): InternalNote[] {
  const entries = Object.entries(live.prechat);
  if (entries.length === 0) return [];

  return [
    {
      id: `note_live_${live.sessionId}`,
      conversationId: liveConversationId(live.sessionId),
      authorId: "sistema",
      authorLabel: "Webchat",
      body: `Aberta em ${live.origin}. ${entries
        .map(([key, value]) => `${key.replace(/^(contato|campo)\./, "")}: ${value}`)
        .join(" · ")}`,
      mentionedUserIds: [],
      occurredAt: live.startedAt,
    },
  ];
}

export function useLiveWebchat(): LiveWebchatData & {
  reply: (conversationId: string, body: string, author: string) => Promise<boolean>;
  refresh: () => void;
} {
  const [data, setData] = useState<LiveWebchatData>(EMPTY);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/webchat/live", { cache: "no-store" });
      if (!response.ok) return;

      const payload = (await response.json()) as { conversations: LiveConversation[] };
      const next: LiveWebchatData = {
        conversations: [],
        messagesByConversation: {},
        notesByConversation: {},
        contacts: [],
        sessionByConversation: {},
      };

      for (const live of payload.conversations) {
        const conversation = toConversation(live);
        next.conversations.push(conversation);
        next.contacts.push(toContact(live));
        next.messagesByConversation[conversation.id] = toMessages(live);
        next.notesByConversation[conversation.id] = toNotes(live);
        next.sessionByConversation[conversation.id] = live.sessionId;
      }

      setData(next);
    } catch {
      // Falha momentânea não apaga o que já está na tela: a próxima leitura
      // corrige, e esvaziar a lista faria conversas piscarem.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load, tick]);

  const reply = useCallback(
    async (conversationId: string, body: string, author: string): Promise<boolean> => {
      const sessionId = data.sessionByConversation[conversationId];
      if (!sessionId) return false;

      try {
        const response = await fetch("/api/webchat/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, body, author }),
        });
        if (!response.ok) return false;

        // Otimista: a mensagem aparece na hora, e a leitura seguinte confirma.
        setData((current) => ({
          ...current,
          messagesByConversation: {
            ...current.messagesByConversation,
            [conversationId]: [
              ...(current.messagesByConversation[conversationId] ?? []),
              {
                id: `msg_local_${current.messagesByConversation[conversationId]?.length ?? 0}_${conversationId}`,
                organizationId: ORG_ID,
                conversationId,
                direction: "saida",
                authorKind: "agente",
                authorLabel: author,
                channel: "webchat",
                body,
                occurredAt: offsetIso({}),
              },
            ],
          },
        }));
        return true;
      } catch {
        return false;
      }
    },
    [data.sessionByConversation],
  );

  return { ...data, reply, refresh: () => setTick((value) => value + 1) };
}
