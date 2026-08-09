"use client";

import { memo, useEffect, useRef, type CSSProperties } from "react";
import type { Contact, Conversation, Queue, Tag, User } from "@elora/core";
import { CONVERSATION_STATE_LABEL, formatRelative, truncate } from "@elora/core";
import { Avatar, Badge, EmptyState, TagChip, Tooltip, cn } from "@elora/ui";
import { CheckCircle2, Inbox as InboxIcon, UserPlus } from "lucide-react";

import { ChannelIcon } from "@/lib/channel";
import { SlaPill } from "./sla-pill";

const STATE_TONE: Record<string, "neutral" | "info" | "warning" | "success" | "accent"> = {
  nova: "accent",
  em_triagem: "info",
  em_atendimento: "info",
  aguardando_cliente: "warning",
  aguardando_interno: "warning",
  resolvida: "success",
  encerrada: "neutral",
};

/**
 * Lista de conversas.
 *
 * A seleção usa superfície elevada com filete azul, não o laranja: o acento
 * carrega **uma** coisa por tela, e nesta é a contagem de não lidas somada ao
 * botão de enviar. Marcar também a seleção de laranja faria o olho perder o que
 * pede ação — que é o único propósito daquela cor.
 *
 * ## Por que a linha é um componente memorizado
 *
 * Trocar de conversa altera `selectedId` **e** zera o contador de não lidas, o
 * que reconstrói a lista derivada. Sem memorização, as dezesseis linhas
 * renderizavam de novo a cada troca — e cada linha carrega avatar, selo de
 * estado, pílula de SLA, marcadores e quatro tooltips do Radix. Medido, isso
 * respondia pela maior parte dos ~64 ms de cada clique.
 *
 * Com `memo`, só duas linhas mudam: a que perdeu e a que ganhou a seleção. Para
 * isso funcionar, os callbacks precisam de identidade estável — é por isso que o
 * `InboxWorkspace` os envolve em `useCallback`.
 */
export function ConversationList({
  conversations,
  contactById,
  queueById,
  userById,
  tagById,
  selectedId,
  currentUserId,
  /** Verdadeiro quando a seleção veio do teclado e pode exigir rolagem. */
  scrollOnSelect,
  onSelect,
  onAssignToMe,
  onResolve,
}: {
  conversations: Conversation[];
  contactById: Map<string, Contact>;
  queueById: Map<string, Queue>;
  userById: Map<string, User>;
  tagById: Map<string, Tag>;
  selectedId: string | null;
  currentUserId: string;
  scrollOnSelect: boolean;
  onSelect: (id: string) => void;
  onAssignToMe: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  /**
   * Mantém o item selecionado visível quando a navegação vem do teclado.
   *
   * A guarda é `scrollOnSelect`, e ela existe por custo medido: `scrollIntoView`
   * força um passe síncrono de estilo e layout, e aparecia com 48 ms de tempo
   * próprio num perfil de sete trocas de conversa. Num **clique** esse gasto é
   * inteiramente desperdiçado — o item estava sob o ponteiro, portanto visível.
   * Só a navegação por teclado pode mover a seleção para fora da vista.
   *
   * Não há checagem de visibilidade além disso de propósito. A primeira tentativa
   * comparava o retângulo do item com o do `<ul>` — que cresce com o conteúdo, e
   * por isso contém todos os itens sempre. A guarda parecia funcionar e nunca
   * rolava. `block: "nearest"` já não faz nada quando o item está visível.
   */
  useEffect(() => {
    if (!selectedId || !scrollOnSelect || !listRef.current) return;

    const element = listRef.current.querySelector<HTMLElement>(
      `[data-conversation-id="${selectedId}"]`,
    );
    element?.scrollIntoView({ block: "nearest" });
  }, [selectedId, scrollOnSelect]);

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={<InboxIcon />}
        title="Nenhuma conversa com esses filtros"
        description="Ajuste a fila, o estado ou o canal para ver outras conversas da operação."
      />
    );
  }

  return (
    <ul ref={listRef} className="p-1.5" role="listbox" aria-label="Conversas">
      {conversations.map((conversation, index) => (
        <ConversationRow
          key={conversation.id}
          conversation={conversation}
          index={index}
          contact={contactById.get(conversation.contactId)}
          queue={queueById.get(conversation.queueId)}
          assignee={conversation.assigneeId ? userById.get(conversation.assigneeId) : undefined}
          tagById={tagById}
          selected={conversation.id === selectedId}
          mine={conversation.assigneeId === currentUserId}
          onSelect={onSelect}
          onAssignToMe={onAssignToMe}
          onResolve={onResolve}
        />
      ))}
    </ul>
  );
}

const ConversationRow = memo(function ConversationRow({
  conversation,
  index,
  contact,
  queue,
  assignee,
  tagById,
  selected,
  mine,
  onSelect,
  onAssignToMe,
  onResolve,
}: {
  conversation: Conversation;
  index: number;
  contact?: Contact;
  queue?: Queue;
  assignee?: User;
  tagById: Map<string, Tag>;
  selected: boolean;
  mine: boolean;
  onSelect: (id: string) => void;
  onAssignToMe: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  const unread = conversation.unreadCount > 0;
  const resolved = conversation.state === "resolvida" || conversation.state === "encerrada";

  return (
    <li className="group/item relative">
      {/* Separador laranja: divide as conversas sem virar mais uma linha cheia. */}
      {index > 0 ? (
        <span
          className="conversation-divider mx-2 mb-1.5 block"
          style={{ "--divider-index": index } as CSSProperties}
          aria-hidden
        />
      ) : null}
      <button
        type="button"
        data-conversation-id={conversation.id}
        role="option"
        aria-selected={selected}
        onClick={() => onSelect(conversation.id)}
        className={cn(
          "relative w-full overflow-hidden rounded-lg px-2.5 py-2 text-left transition-[background-color,box-shadow]",
          selected ? "bg-surface-raised shadow-card" : "hover:bg-muted/60",
        )}
      >
        {selected ? (
          <span
            className="bg-primary absolute inset-y-1.5 left-0 w-[3px] rounded-r-full"
            aria-hidden
          />
        ) : null}

        <div className="flex items-start gap-2.5">
          <div className="relative shrink-0">
            <Avatar
              initials={contact?.avatarInitials ?? "??"}
              hue={contact?.accentHue ?? 218}
              size="sm"
            />
            <span className="absolute -bottom-1 -right-1">
              <ChannelIcon kind={conversation.channel} withBackground />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
                {contact?.fullName ?? "Contato desconhecido"}
              </span>
              <span
                className={cn(
                  "shrink-0 text-[11px] tabular-nums",
                  unread ? "text-accent-ink font-medium" : "text-muted-foreground",
                )}
              >
                {formatRelative(conversation.lastMessageAt)}
              </span>
            </div>

            <p className="text-muted-foreground truncate text-xs">{conversation.subject}</p>

            <p
              className={cn(
                "mt-0.5 truncate text-xs",
                unread ? "text-foreground" : "text-muted-foreground/80",
              )}
            >
              {truncate(conversation.lastMessagePreview, 78)}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <Badge variant={STATE_TONE[conversation.state] ?? "neutral"}>
                {CONVERSATION_STATE_LABEL[conversation.state]}
              </Badge>
              <SlaPill conversation={conversation} showCountdown={false} />
              {queue ? (
                <span className="text-muted-foreground truncate text-[10px]">{queue.name}</span>
              ) : null}
              {conversation.tagIds.slice(0, 2).map((tagId) => {
                const tag = tagById.get(tagId);
                return tag ? <TagChip key={tag.id} name={tag.name} hue={tag.hue} /> : null;
              })}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {unread ? (
              <span className="bg-accent text-accent-foreground flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums">
                {conversation.unreadCount}
              </span>
            ) : null}
            {assignee ? (
              <Tooltip content={`Responsável: ${assignee.name}`}>
                <span>
                  <Avatar initials={assignee.initials} hue={assignee.accentHue} size="xs" />
                </span>
              </Tooltip>
            ) : (
              <Tooltip content="Sem responsável">
                <span
                  className="border-muted-foreground/40 size-6 rounded-full border border-dashed"
                  aria-label="Sem responsável"
                />
              </Tooltip>
            )}
          </div>
        </div>
      </button>

      {/**
       * Ações no hover.
       *
       * "Assumir" e "Resolver" são as duas decisões que o atendente toma
       * sem precisar abrir a conversa — tirá-las do caminho da lista poupa
       * dois cliques por item numa fila de trinta. Ficam fora do botão
       * principal para não aninhar botão dentro de botão.
       */}
      <div className="pointer-events-none absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/item:opacity-100">
        {!mine && !resolved ? (
          <Tooltip content="Assumir para mim">
            <button
              type="button"
              onClick={() => onAssignToMe(conversation.id)}
              aria-label={`Assumir a conversa de ${contact?.fullName ?? "contato"}`}
              className="bg-surface text-muted-foreground shadow-card hover:text-primary pointer-events-auto rounded-md p-1 transition-colors"
            >
              <UserPlus className="size-3.5" aria-hidden />
            </button>
          </Tooltip>
        ) : null}
        {resolved ? null : (
          <Tooltip content="Marcar como resolvida">
            <button
              type="button"
              onClick={() => onResolve(conversation.id)}
              aria-label={`Resolver a conversa de ${contact?.fullName ?? "contato"}`}
              className="bg-surface text-muted-foreground shadow-card hover:text-success pointer-events-auto rounded-md p-1 transition-colors"
            >
              <CheckCircle2 className="size-3.5" aria-hidden />
            </button>
          </Tooltip>
        )}
      </div>
    </li>
  );
});
