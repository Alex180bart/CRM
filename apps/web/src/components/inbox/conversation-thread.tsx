"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type {
  AiToneAdjustment,
  CannedResponse,
  Contact,
  Conversation,
  ConversationState,
  InternalNote,
  Message,
  Queue,
  User,
} from "@crm/core";
import {
  CONVERSATION_STATE_LABEL,
  differenceInCalendarDays,
  formatDayHeading,
  OPEN_CONVERSATION_STATES,
} from "@crm/core";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PresenceDot,
  Tooltip,
} from "@crm/ui";
import {
  ArrowRightLeft,
  ArrowDown,
  Bot,
  CheckCircle2,
  ChevronDown,
  Paperclip,
  Star,
  UserPlus,
  Users,
} from "lucide-react";

import { ChannelIcon, channelStyle } from "@/lib/channel";
import {
  Composer,
  type ComposerHandle,
  type ComposerQuote,
  type ComposerSubmission,
} from "./composer";
import { InternalNoteBubble, MessageBubble } from "./message-bubble";
import { SlaPill } from "./sla-pill";

type ThreadItem =
  | { kind: "message"; at: string; message: Message }
  | { kind: "note"; at: string; note: InternalNote };

/** Janela em que duas mensagens do mesmo autor viram um bloco só. */
const GROUPING_WINDOW_MINUTES = 5;

export function ConversationThread({
  conversation,
  contact,
  queue,
  queues,
  assignee,
  users,
  currentUser,
  messages,
  notes,
  cannedResponses,
  copilotAvailable,
  composerRef,
  onSuggest,
  onRewrite,
  onAssign,
  onChangeState,
  onTransferQueue,
  onSend,
}: {
  conversation: Conversation;
  contact?: Contact;
  queue?: Queue;
  queues: Queue[];
  assignee?: User;
  users: User[];
  currentUser: User;
  messages: Message[];
  notes: InternalNote[];
  cannedResponses: CannedResponse[];
  copilotAvailable: boolean;
  /** Vem de cima: o painel do copiloto também precisa alcançar o compositor. */
  composerRef: RefObject<ComposerHandle | null>;
  onSuggest: (draft: string) => Promise<string | null>;
  onRewrite: (draft: string, tone: AiToneAdjustment) => Promise<string | null>;
  onAssign: (userId: string | undefined) => void;
  onChangeState: (state: ConversationState) => void;
  onTransferQueue: (queueId: string) => void;
  onSend: (input: ComposerSubmission) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousCount = useRef(0);
  const [atBottom, setAtBottom] = useState(true);
  const [quote, setQuote] = useState<ComposerQuote | undefined>();
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const items: ThreadItem[] = useMemo(() => {
    const merged: ThreadItem[] = [
      ...messages.map((message) => ({ kind: "message" as const, at: message.occurredAt, message })),
      ...notes.map((note) => ({ kind: "note" as const, at: note.occurredAt, note })),
    ];
    return merged.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  }, [messages, notes]);

  const lastInbound = useMemo(
    () => [...messages].reverse().find((message) => message.direction === "entrada"),
    [messages],
  );

  /**
   * Rolagem.
   *
   * Ao trocar de conversa vai direto ao fim, sem animação — animar uma posição
   * que o atendente nunca viu é movimento gratuito. Mensagem nova rola suave,
   * **mas só se ele já estava no fim**: arrastar a vista de quem está lendo
   * histórico é o pior comportamento possível numa tela de atendimento.
   */
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    previousCount.current = items.length;
    setAtBottom(true);
    setQuote(undefined);
  }, [conversation.id]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (items.length === previousCount.current) return;

    const grew = items.length > previousCount.current;
    previousCount.current = items.length;
    if (grew && atBottom) {
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    }
  }, [items.length, atBottom]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    setAtBottom(distance < 80);
  }, []);

  function scrollToBottom() {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }

  function handleQuote(next: ComposerQuote) {
    setQuote(next);
    composerRef.current?.focus();
  }

  const closed = conversation.state === "encerrada";
  const style = channelStyle(conversation.channel);

  /**
   * Índice a partir do qual a mensagem é nova — só ela ganha a animação de
   * entrada.
   *
   * A marca é reposta **durante a renderização** na troca de conversa, não em
   * efeito: efeito roda depois da pintura, e nesse intervalo o histórico da
   * conversa recém-aberta apareceria animando, como se tivesse acabado de
   * chegar. Depois da pintura, o efeito reposiciona a marca no fim da lista
   * para que a próxima mensagem — e só ela — anime.
   */
  const animateFrom = useRef<number>(Number.POSITIVE_INFINITY);
  const renderedConversation = useRef(conversation.id);

  if (renderedConversation.current !== conversation.id) {
    renderedConversation.current = conversation.id;
    animateFrom.current = Number.POSITIVE_INFINITY;
  }

  useEffect(() => {
    animateFrom.current = items.length;
  }, [items.length]);

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      {/* Cabeçalho ------------------------------------------------------- */}
      <header className="glass shadow-inset-hairline z-20 flex shrink-0 flex-col gap-2 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Avatar
            initials={contact?.avatarInitials ?? "??"}
            hue={contact?.accentHue ?? 218}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-sm font-semibold">{contact?.fullName ?? "Contato"}</h2>
              <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <ChannelIcon kind={conversation.channel} className="size-3" />
                {style.label}
              </span>
            </div>
            <p className="text-muted-foreground truncate text-xs">{conversation.subject}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <SlaPill conversation={conversation} />

            {conversation.satisfactionScore ? (
              <Tooltip content={`Avaliação do cliente: ${conversation.satisfactionScore} de 5`}>
                <Badge variant="accent">
                  <Star aria-hidden />
                  {conversation.satisfactionScore}
                </Badge>
              </Tooltip>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Responsável */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="xs">
                {assignee ? (
                  <>
                    <Avatar initials={assignee.initials} hue={assignee.accentHue} size="xs" />
                    {assignee.name}
                  </>
                ) : (
                  <>
                    <UserPlus />
                    Sem responsável
                  </>
                )}
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <DropdownMenuLabel>Atribuir conversa</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onAssign(currentUser.id)}>
                <UserPlus /> Assumir para mim
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {users.map((user) => (
                <DropdownMenuItem key={user.id} onSelect={() => onAssign(user.id)}>
                  <Avatar initials={user.initials} hue={user.accentHue} size="xs" />
                  <span className="flex-1 truncate">{user.name}</span>
                  <PresenceDot presence={user.presence} />
                </DropdownMenuItem>
              ))}
              {assignee ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={() => onAssign(undefined)}>
                    Remover responsável
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Estado */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="xs">
                {CONVERSATION_STATE_LABEL[conversation.state]}
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DropdownMenuLabel>Estado da conversa</DropdownMenuLabel>
              {OPEN_CONVERSATION_STATES.map((state) => (
                <DropdownMenuItem key={state} onSelect={() => onChangeState(state)}>
                  {CONVERSATION_STATE_LABEL[state]}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onChangeState("resolvida")}>
                <CheckCircle2 /> Resolvida
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onChangeState("encerrada")}>
                Encerrada
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Fila */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs">
                <ArrowRightLeft />
                {queue?.name ?? "Sem fila"}
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <DropdownMenuLabel>Transferir para a fila</DropdownMenuLabel>
              {queues.map((item) => (
                <DropdownMenuItem key={item.id} onSelect={() => onTransferQueue(item.id)}>
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-muted-foreground text-[11px] tabular-nums">
                    {item.firstResponseSlaMinutes} min
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {conversation.observerIds.length > 0 ? (
            <Tooltip
              content={`Observando: ${conversation.observerIds
                .map((id) => userById.get(id)?.name ?? id)
                .join(", ")}`}
            >
              <Badge variant="neutral">
                <Users aria-hidden />
                {conversation.observerIds.length} observando
              </Badge>
            </Tooltip>
          ) : null}

          {conversation.priority === "urgente" || conversation.priority === "alta" ? (
            <Badge variant={conversation.priority === "urgente" ? "danger" : "warning"}>
              prioridade {conversation.priority}
            </Badge>
          ) : null}
        </div>
      </header>

      {/**
       * Plano da conversa.
       *
       * A textura vive no `::before` deste invólucro, que não rola — o padrão
       * fica parado enquanto as mensagens passam, como no WhatsApp. O rolador é
       * o filho posicionado logo abaixo.
       *
       * O arraste é capturado aqui, e não só no compositor: quem traz um arquivo
       * mira a conversa, não a caixa de texto.
       */}
      <div
        className="chat-canvas relative flex min-h-0 flex-1 flex-col"
        onDragEnter={(event) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) event.preventDefault();
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          composerRef.current?.addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative min-h-0 flex-1 overflow-y-auto px-4 py-3"
          aria-live="polite"
          aria-relevant="additions"
        >
          {conversation.handoffSummary ? (
            <Callout variant="info" icon={<Bot />} title="Transbordo do bot" className="mb-3">
              {conversation.handoffSummary}
            </Callout>
          ) : null}

          {items.map((item, index) => {
            const previous = items[index - 1];
            const newDay = !previous || differenceInCalendarDays(item.at, previous.at) !== 0;
            const isNew = index >= animateFrom.current;

            /**
             * Agrupamento: mesma origem, mesmo autor, dentro da janela e sem
             * quebra de dia. Só então a mensagem perde cabeçalho e rabicho.
             */
            const grouped =
              !newDay &&
              item.kind === "message" &&
              previous?.kind === "message" &&
              previous.message.authorKind === item.message.authorKind &&
              previous.message.authorLabel === item.message.authorLabel &&
              previous.message.direction === item.message.direction &&
              Date.parse(item.at) - Date.parse(previous.at) < GROUPING_WINDOW_MINUTES * 60_000;

            return (
              <div key={item.kind === "message" ? item.message.id : item.note.id}>
                {newDay ? (
                  <div className="sticky top-0 z-10 flex justify-center py-2">
                    <span className="bg-surface/90 text-muted-foreground shadow-card rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide backdrop-blur">
                      {formatDayHeading(item.at)}
                    </span>
                  </div>
                ) : null}

                {item.kind === "message" ? (
                  <MessageBubble
                    message={item.message}
                    grouped={grouped}
                    onQuote={closed ? undefined : handleQuote}
                    isNew={isNew}
                  />
                ) : (
                  <InternalNoteBubble
                    note={item.note}
                    authorInitials={userById.get(item.note.authorId)?.initials ?? "??"}
                    authorHue={userById.get(item.note.authorId)?.accentHue ?? 218}
                    isNew={isNew}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Volta ao fim: só aparece quando há para onde voltar. */}
        {atBottom ? null : (
          <button
            type="button"
            onClick={scrollToBottom}
            className="press animate-scale-in bg-surface text-foreground shadow-raised absolute bottom-4 right-4 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-transform hover:-translate-y-0.5"
            aria-label="Ir para a mensagem mais recente"
          >
            <ArrowDown className="size-3.5" aria-hidden />
            Mais recentes
          </button>
        )}

        {dragging ? (
          <div className="border-accent bg-chat-canvas/85 pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-xl border-2 border-dashed">
            <p className="bg-surface text-accent-ink shadow-raised flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold">
              <Paperclip className="size-4" aria-hidden />
              Solte os arquivos para anexar à resposta
            </p>
          </div>
        ) : null}
      </div>

      <Composer
        ref={composerRef}
        conversationId={conversation.id}
        channel={conversation.channel}
        cannedResponses={cannedResponses}
        lastInboundAt={lastInbound?.occurredAt}
        disabled={closed}
        disabledReason="Conversa encerrada. Altere o estado para voltar a responder."
        quote={quote}
        onClearQuote={() => setQuote(undefined)}
        copilot={{ available: copilotAvailable, suggest: onSuggest, rewrite: onRewrite }}
        onSend={onSend}
      />
    </section>
  );
}
