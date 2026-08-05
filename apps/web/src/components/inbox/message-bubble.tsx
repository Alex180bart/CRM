"use client";

import { useState } from "react";
import type { InternalNote, Message } from "@crm/core";
import { DELIVERY_STATUS_LABEL, formatTime } from "@crm/core";
import { Avatar, Badge, Tooltip, cn } from "@crm/ui";
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCheck,
  Clock,
  Copy,
  CornerUpLeft,
  StickyNote,
} from "lucide-react";

import { MessageAttachments } from "./message-attachments";
import type { ComposerQuote } from "./composer";

/**
 * Bolha de mensagem.
 *
 * O modelo é o do WhatsApp, porque é o que o cliente do outro lado está vendo —
 * e porque ele resolve bem três coisas: o rabicho ancora a bolha em quem falou,
 * a hora dentro da bolha economiza uma linha por mensagem, e o agrupamento de
 * mensagens seguidas do mesmo autor tira o ruído de repetir nome e avatar.
 *
 * O que **não** vem do WhatsApp: as cores (identidade Arena CF, via token) e o
 * selo de template aprovado, que é exigência de canal oficial e precisa ser
 * visível para o atendente entender por que a mensagem saiu daquele jeito.
 */

function DeliveryIndicator({ message }: { message: Message }) {
  if (!message.deliveryStatus) return null;

  const map = {
    enfileirada: { icon: Clock, className: "text-chat-out-ink" },
    enviada: { icon: Check, className: "text-chat-out-ink" },
    entregue: { icon: CheckCheck, className: "text-chat-out-ink" },
    // Só "lida" ganha cor própria: é a única informação que muda o que o
    // atendente faz a seguir.
    lida: { icon: CheckCheck, className: "text-info" },
    falhou: { icon: AlertTriangle, className: "text-destructive" },
    expirada: { icon: AlertTriangle, className: "text-warning" },
  } as const;

  const entry = map[message.deliveryStatus];
  const Icon = entry.icon;

  return (
    <Tooltip
      content={
        message.failureReason
          ? `${DELIVERY_STATUS_LABEL[message.deliveryStatus]} · ${message.failureCode}: ${message.failureReason}`
          : DELIVERY_STATUS_LABEL[message.deliveryStatus]
      }
    >
      <span className={cn("inline-flex", entry.className)}>
        <Icon className="size-3.5" aria-label={DELIVERY_STATUS_LABEL[message.deliveryStatus]} />
      </span>
    </Tooltip>
  );
}

/**
 * Mensagem só de emoji vem grande, sem bolha.
 *
 * É o comportamento do WhatsApp e não é enfeite: um "👍" dentro de uma bolha,
 * com o mesmo corpo de texto de uma frase inteira, parece erro de renderização.
 *
 * A verificação é por subtração em vez de casamento direto: um emoji moderno é
 * uma sequência de pictograma, modificador de tom de pele, seletor de variação e
 * junção de largura zero, e escrever esse padrão à mão erra em algum deles. Aqui
 * removemos todas essas classes — se não sobra nada, a mensagem é só emoji.
 */
const EMOJI_PARTS =
  /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Emoji_Modifier_Base}\u{FE0F}\u{200D}\s]/gu;

function isEmojiOnly(body: string): boolean {
  const trimmed = body.trim();
  // O teto evita tratar uma parede de emojis como carinha solta.
  if (!trimmed || trimmed.length > 24) return false;
  if (!/\p{Extended_Pictographic}/u.test(trimmed)) return false;
  return trimmed.replace(EMOJI_PARTS, "").length === 0;
}

export function MessageBubble({
  message,
  /** Mensagem anterior é do mesmo autor e recente: esconde cabeçalho e rabicho. */
  grouped = false,
  onQuote,
  isNew = false,
}: {
  message: Message;
  grouped?: boolean;
  onQuote?: (quote: ComposerQuote) => void;
  isNew?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const inbound = message.direction === "entrada";
  const fromBot = message.authorKind === "bot";
  const emojiOnly = isEmojiOnly(message.body) && !message.attachments?.length;

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(message.body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Sem permissão de área de transferência não há o que fazer, e falhar em
      // silêncio é melhor que um alerta para uma ação secundária.
    }
  }

  function quote() {
    onQuote?.({
      messageId: message.id,
      authorLabel: message.authorLabel,
      preview: message.body.slice(0, 160),
      attachmentLabel: message.attachments?.[0]?.fileName,
    });
  }

  return (
    <div
      className={cn(
        "group/msg flex items-end gap-1.5",
        inbound ? "justify-start" : "justify-end",
        grouped ? "mt-0.5" : "mt-2",
        isNew && "animate-message-in",
      )}
    >
      {/* Ações à esquerda nas mensagens de saída, para não cobrir a bolha. */}
      {inbound ? null : (
        <HoverActions
          onQuote={onQuote ? quote : undefined}
          onCopy={message.body ? copyBody : undefined}
          copied={copied}
        />
      )}

      <div
        className={cn(
          "flex max-w-[min(34rem,80%)] flex-col",
          inbound ? "items-start" : "items-end",
        )}
      >
        {emojiOnly ? (
          <div className="px-1 py-0.5">
            <p className="text-4xl leading-tight">{message.body}</p>
            <div
              className={cn(
                "mt-0.5 flex items-center gap-1",
                inbound ? "justify-start" : "justify-end",
              )}
            >
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {formatTime(message.occurredAt)}
              </span>
              <DeliveryIndicator message={message} />
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "shadow-card relative min-w-24 rounded-xl px-2.5 pb-1.5 pt-1.5",
              inbound
                ? "bg-chat-in text-chat-in-foreground"
                : "bg-chat-out text-chat-out-foreground",
              // O rabicho aparece só na primeira de uma sequência, e o canto
              // onde ele encosta perde o arredondamento.
              !grouped && "chat-tail",
              !grouped &&
                (inbound ? "chat-tail-in rounded-tl-none" : "chat-tail-out rounded-tr-none"),
              /**
               * Resposta automática ganha filete, não fundo próprio.
               *
               * Bot e atendente saem os dois pelo mesmo canal, então a bolha é a
               * mesma — mas quem revisa um transbordo precisa distinguir num
               * relance o que a máquina disse do que uma pessoa disse. O filete é
               * o recurso que o design system reserva para marcar classe de item,
               * e a sombra interna o desenha respeitando o arredondamento.
               */
              fromBot && "shadow-[inset_2px_0_0_0_hsl(var(--info))]",
            )}
          >
            {/* Autor: só na primeira da sequência, e nunca em mensagem de entrada
                de conversa individual — o nome já está no cabeçalho. */}
            {!grouped && (fromBot || !inbound) ? (
              <p
                className={cn(
                  "mb-0.5 flex items-center gap-1 text-[11px] font-semibold",
                  inbound ? "text-chat-quote" : "text-chat-out-ink",
                )}
              >
                {fromBot ? <Bot className="size-3" aria-hidden /> : null}
                {message.authorLabel}
              </p>
            ) : null}

            {message.quote ? (
              <div className="bg-chat-quote/10 mb-1 overflow-hidden rounded-md">
                <div className="border-chat-quote border-l-[3px] px-2 py-1">
                  <p className="text-chat-quote text-[11px] font-semibold">
                    {message.quote.authorLabel}
                  </p>
                  <p className="line-clamp-2 text-[11px] opacity-80">
                    {message.quote.preview || message.quote.attachmentLabel}
                  </p>
                </div>
              </div>
            ) : null}

            {message.attachments?.length ? (
              <MessageAttachments attachments={message.attachments} outbound={!inbound} />
            ) : null}

            {message.body ? (
              // O espaço reservado à direita da última linha impede que a hora
              // se sobreponha ao texto — é como o WhatsApp resolve.
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {message.body}
                <span className="inline-block w-16" aria-hidden />
              </p>
            ) : null}

            <div
              className={cn("flex items-center justify-end gap-1", message.body ? "-mt-4" : "mt-1")}
            >
              {message.templateName ? (
                <Tooltip content={`Enviada com o template aprovado ${message.templateName}`}>
                  <Badge variant="info" className="mr-auto h-4 px-1 text-[10px]">
                    template
                  </Badge>
                </Tooltip>
              ) : null}
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  inbound ? "text-muted-foreground" : "text-chat-out-ink",
                )}
              >
                {formatTime(message.occurredAt)}
              </span>
              <DeliveryIndicator message={message} />
            </div>
          </div>
        )}

        {message.deliveryStatus === "falhou" && message.failureReason ? (
          <p className="bg-destructive-soft text-destructive shadow-inset-hairline mt-1 max-w-full rounded-md px-2 py-1 text-[11px]">
            Falha {message.failureCode}: {message.failureReason}
          </p>
        ) : null}
      </div>

      {inbound ? (
        <HoverActions
          onQuote={onQuote ? quote : undefined}
          onCopy={message.body ? copyBody : undefined}
          copied={copied}
        />
      ) : null}
    </div>
  );
}

/**
 * Ações da mensagem.
 *
 * Aparecem no hover e ficam fora da bolha. Dentro dela, disputariam espaço com
 * o texto numa mensagem curta; e um menu de três pontinhos exigiria dois cliques
 * para a ação mais comum, que é citar.
 */
function HoverActions({
  onQuote,
  onCopy,
  copied,
}: {
  onQuote?: () => void;
  onCopy?: () => void;
  copied: boolean;
}) {
  if (!onQuote && !onCopy) return <span className="w-7 shrink-0" aria-hidden />;

  return (
    <div className="flex shrink-0 flex-col gap-0.5 pb-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/msg:opacity-100">
      {onQuote ? (
        <Tooltip content="Responder a esta mensagem">
          <button
            type="button"
            onClick={onQuote}
            aria-label="Responder a esta mensagem"
            className="bg-surface/90 text-muted-foreground shadow-card hover:text-foreground rounded-md p-1 transition-colors"
          >
            <CornerUpLeft className="size-3.5" aria-hidden />
          </button>
        </Tooltip>
      ) : null}
      {onCopy ? (
        <Tooltip content={copied ? "Copiado" : "Copiar texto"}>
          <button
            type="button"
            onClick={onCopy}
            aria-label="Copiar texto da mensagem"
            className="bg-surface/90 text-muted-foreground shadow-card hover:text-foreground rounded-md p-1 transition-colors"
          >
            {copied ? (
              <Check className="text-success size-3.5" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}

/**
 * Nota interna.
 *
 * Centralizada e em papel amarelo justamente para **não** parecer mensagem: quem
 * bate o olho na conversa precisa distinguir em um instante o que o cliente vê
 * do que só o time vê. Confundir os dois é o erro caro deste produto.
 */
export function InternalNoteBubble({
  note,
  authorInitials,
  authorHue,
  isNew = false,
}: {
  note: InternalNote;
  authorInitials: string;
  authorHue: number;
  isNew?: boolean;
}) {
  return (
    <div className={cn("my-2 flex justify-center", isNew && "animate-message-in")}>
      <div className="bg-warning-soft shadow-card w-full max-w-[min(40rem,88%)] rounded-lg px-3 py-2">
        <div className="mb-1 flex items-center gap-1.5">
          <StickyNote className="text-warning size-3" aria-hidden />
          <span className="text-foreground text-[11px] font-semibold">Nota interna</span>
          <span className="text-muted-foreground text-[11px]">· não visível ao contato</span>
          <span className="text-muted-foreground ml-auto text-[11px] tabular-nums">
            {formatTime(note.occurredAt)}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Avatar initials={authorInitials} hue={authorHue} size="xs" />
          <p className="text-foreground min-w-0 flex-1 whitespace-pre-wrap text-xs leading-relaxed">
            {note.body}
          </p>
        </div>
      </div>
    </div>
  );
}
