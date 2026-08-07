"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AiConversationContext,
  AiResolvedProposal,
  AiToneAdjustment,
  CannedResponse,
  ChannelKind,
  Company,
  Contact,
  Conversation,
  ConversationState,
  Deal,
  InternalNote,
  Message,
  Queue,
  Tag,
  User,
} from "@crm/core";
import { CONVERSATION_STATE_LABEL, formatDateTime, offsetIso, resolveSlaStatus } from "@crm/core";
import { Button, EmptyState, SearchInput, Tooltip, cn } from "@crm/ui";
import { MessagesSquare, PanelRightClose, PanelRightOpen, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { buildConversationContext } from "@/lib/ai/context";
import { ConversationList } from "./conversation-list";
import { ConversationThread } from "./conversation-thread";
import { InboxRightPanel } from "./right-panel";
import { Metric, MetricStrip } from "@/components/shell/metric-strip";
import { InboxFilters, type QuickFilter } from "./inbox-filters";
import type { ComposerHandle, ComposerSubmission } from "./composer";
import { useCopilot } from "./use-copilot";
import { useLiveWebchat } from "./use-live-webchat";

export interface InboxData {
  conversations: Conversation[];
  messagesByConversation: Record<string, Message[]>;
  notesByConversation: Record<string, InternalNote[]>;
  contacts: Contact[];
  companies: Company[];
  users: User[];
  queues: Queue[];
  tags: Tag[];
  cannedResponses: CannedResponse[];
  dealsByContact: Record<string, Deal[]>;
  currentUserId: string;
  /** O servidor informa se há credencial de IA: a tela não oferece o que vai falhar. */
  copilotAvailable: boolean;
}

export function InboxWorkspace(data: InboxData) {
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todas");
  const [selectedQueueIds, setSelectedQueueIds] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<ConversationState[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<ChannelKind[]>([]);
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [showContext, setShowContext] = useState(true);

  const [overrides, setOverrides] = useState<Record<string, Partial<Conversation>>>({});
  /**
   * Alterações de cadastro aceitas na tabulação, por contato.
   *
   * Ficam separadas de `data.contacts` porque a base de demonstração é imutável
   * e a camada de escrita não existe. Sobrepor aqui mantém uma verdade só na
   * tela: todo lugar que lê contato lê o resultado da mesclagem.
   */
  const [contactPatches, setContactPatches] = useState<Record<string, Partial<Contact>>>({});
  /** Propostas já aplicadas e ignoradas, por conversa. */
  const [appliedProposals, setAppliedProposals] = useState<Record<string, Record<string, string>>>(
    {},
  );
  const [dismissedProposals, setDismissedProposals] = useState<Record<string, string[]>>({});
  const [extraMessages, setExtraMessages] = useState<Record<string, Message[]>>({});
  const [extraNotes, setExtraNotes] = useState<Record<string, InternalNote[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(data.conversations[0]?.id ?? null);

  const sequenceRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const composerRef = useRef<ComposerHandle>(null);

  const copilot = useCopilot();
  /** Conversas abertas pelo widget no site do cliente, buscadas por intervalo. */
  const liveWebchat = useLiveWebchat();

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  /**
   * Contatos com a tabulação já aplicada por cima.
   *
   * Uma verdade só: quem lê contato aqui — painel de contexto, cabeçalho da
   * conversa, contexto do copiloto — lê o cadastro atualizado. Sem a mesclagem,
   * o atendente preencheria o CPF e o painel ao lado continuaria dizendo que
   * falta CPF.
   */
  const contactById = useMemo(
    () =>
      new Map(
        // Os visitantes do webchat entram junto: eles ainda não são cadastro,
        // mas a lista, o cabeçalho e o painel de contexto leem daqui, e sem eles
        // a conversa viva apareceria como "Contato desconhecido".
        [...data.contacts, ...liveWebchat.contacts].map((contact) => {
          const patch = contactPatches[contact.id];
          return [contact.id, patch ? { ...contact, ...patch } : contact];
        }),
      ),
    [data.contacts, liveWebchat.contacts, contactPatches],
  );
  const companyById = useMemo(
    () => new Map(data.companies.map((company) => [company.id, company])),
    [data.companies],
  );
  const queueById = useMemo(
    () => new Map(data.queues.map((queue) => [queue.id, queue])),
    [data.queues],
  );
  const userById = useMemo(() => new Map(data.users.map((user) => [user.id, user])), [data.users]);
  const tagById = useMemo(() => new Map(data.tags.map((tag) => [tag.id, tag])), [data.tags]);

  const currentUser = userById.get(data.currentUserId) ?? data.users[0];

  /** Conversas com as alterações locais aplicadas e o SLA recalculado. */
  const conversations = useMemo(
    () =>
      [...liveWebchat.conversations, ...data.conversations].map((conversation) => {
        const override = overrides[conversation.id];
        if (!override) return conversation;
        const merged = { ...conversation, ...override };
        return { ...merged, slaStatus: resolveSlaStatus(merged) };
      }),
    [data.conversations, liveWebchat.conversations, overrides],
  );

  const counts = useMemo(() => {
    const quick: Record<QuickFilter, number> = {
      todas: conversations.length,
      minhas: 0,
      nao_atribuidas: 0,
      sla_risco: 0,
    };
    const queue: Record<string, number> = {};
    const state: Record<string, number> = {};
    const channel: Record<string, number> = {};

    for (const conversation of conversations) {
      if (conversation.assigneeId === currentUser?.id) quick.minhas += 1;
      if (!conversation.assigneeId) quick.nao_atribuidas += 1;
      if (conversation.slaStatus === "estourado" || conversation.slaStatus === "atencao") {
        quick.sla_risco += 1;
      }
      queue[conversation.queueId] = (queue[conversation.queueId] ?? 0) + 1;
      state[conversation.state] = (state[conversation.state] ?? 0) + 1;
      channel[conversation.channel] = (channel[conversation.channel] ?? 0) + 1;
    }

    return { quick, queue, state, channel };
  }, [conversations, currentUser?.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return conversations
      .filter((conversation) => {
        if (quickFilter === "minhas" && conversation.assigneeId !== currentUser?.id) return false;
        if (quickFilter === "nao_atribuidas" && conversation.assigneeId) return false;
        if (
          quickFilter === "sla_risco" &&
          conversation.slaStatus !== "estourado" &&
          conversation.slaStatus !== "atencao"
        ) {
          return false;
        }
        if (selectedQueueIds.length > 0 && !selectedQueueIds.includes(conversation.queueId)) {
          return false;
        }
        if (selectedStates.length > 0 && !selectedStates.includes(conversation.state)) return false;
        if (selectedChannels.length > 0 && !selectedChannels.includes(conversation.channel)) {
          return false;
        }

        if (term) {
          const contact = contactById.get(conversation.contactId);
          const haystack = [
            conversation.subject,
            conversation.lastMessagePreview,
            contact?.fullName ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        return true;
      })
      .sort((a, b) => Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt));
  }, [
    conversations,
    quickFilter,
    selectedQueueIds,
    selectedStates,
    selectedChannels,
    search,
    contactById,
    currentUser?.id,
  ]);

  // Se a conversa selecionada sair do filtro, seleciona a primeira disponível.
  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((conversation) => conversation.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const patch = useCallback((conversationId: string, changes: Partial<Conversation>) => {
    setOverrides((current) => ({
      ...current,
      [conversationId]: { ...current[conversationId], ...changes },
    }));
  }, []);

  /**
   * De onde veio a seleção.
   *
   * Só a navegação por teclado pode precisar rolar a lista — num clique o item
   * já estava sob o ponteiro. A lista usa isto para não chamar `scrollIntoView`,
   * que força um passe síncrono de estilo e layout a cada troca.
   */
  const [selectionFromKeyboard, setSelectionFromKeyboard] = useState(false);

  const handleSelect = useCallback(
    (conversationId: string, fromKeyboard = false) => {
      setSelectedId(conversationId);
      setSelectionFromKeyboard(fromKeyboard);
      const conversation = conversations.find((item) => item.id === conversationId);
      if (conversation && conversation.unreadCount > 0) {
        patch(conversationId, { unreadCount: 0 });
      }
    },
    [conversations, patch],
  );

  // Navegação por teclado na lista: J/K ou setas, quando o foco não está num campo.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (target?.isContentEditable) return;

      const isNext = event.key === "ArrowDown" || event.key === "j";
      const isPrevious = event.key === "ArrowUp" || event.key === "k";
      if (!isNext && !isPrevious) return;

      event.preventDefault();
      const index = filtered.findIndex((conversation) => conversation.id === selectedId);
      const nextIndex = Math.min(
        Math.max(index + (isNext ? 1 : -1), 0),
        Math.max(filtered.length - 1, 0),
      );
      const next = filtered[nextIndex];
      // Navegacao por teclado: a lista pode precisar rolar para mostrar o item.
      if (next) handleSelect(next.id, true);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filtered, selectedId, handleSelect]);

  const selectedContact = selected ? contactById.get(selected.contactId) : undefined;
  const selectedCompany = selectedContact?.companyId
    ? companyById.get(selectedContact.companyId)
    : undefined;

  const selectedMessages = useMemo(
    () =>
      selected
        ? [
            // Conversa de webchat traz as mensagens do servidor; as demais, da
            // base de demonstração. Concatenar os dois é seguro: uma conversa
            // pertence a exatamente uma origem.
            ...(liveWebchat.messagesByConversation[selected.id] ?? []),
            ...(data.messagesByConversation[selected.id] ?? []),
            ...(extraMessages[selected.id] ?? []),
          ]
        : [],
    [selected, liveWebchat.messagesByConversation, data.messagesByConversation, extraMessages],
  );

  const selectedNotes = useMemo(
    () =>
      selected
        ? [
            ...(liveWebchat.notesByConversation[selected.id] ?? []),
            ...(data.notesByConversation[selected.id] ?? []),
            ...(extraNotes[selected.id] ?? []),
          ]
        : [],
    [selected, liveWebchat.notesByConversation, data.notesByConversation, extraNotes],
  );

  /**
   * Contexto do copiloto — montado **sob demanda**.
   *
   * Continua sendo decidido num único lugar (é aqui que se define o que a IA vê),
   * mas deixou de ser um `useMemo`. Montá-lo custa mapear e ordenar todo o
   * histórico da conversa e derivar os fatos do contato: medido em ~25 ms dos
   * ~64 ms de cada troca de conversa, gastos em algo que só a chamada ao provedor
   * consome. Agora é uma função, invocada no clique.
   *
   * O que o painel precisa a cada troca é apenas a **assinatura** — barata — para
   * saber se a análise em cache continua válida.
   */
  const buildCopilotContext = useCallback((): AiConversationContext | null => {
    if (!selected || !currentUser) return null;

    const deals = selectedContact ? (data.dealsByContact[selectedContact.id] ?? []) : [];
    const openDealsCents = deals
      .filter((deal) => deal.probability > 0 && deal.probability < 100)
      .reduce((total, deal) => total + deal.amountCents, 0);

    return buildConversationContext({
      conversation: selected,
      contact: selectedContact,
      company: selectedCompany,
      queue: queueById.get(selected.queueId),
      currentUser,
      messages: selectedMessages,
      notes: selectedNotes,
      tagById,
      openDealsCents,
    });
  }, [
    selected,
    selectedContact,
    selectedCompany,
    currentUser,
    selectedMessages,
    selectedNotes,
    queueById,
    tagById,
    data.dealsByContact,
  ]);

  /**
   * Assinatura do estado da conversa.
   *
   * Três valores concatenados, sem percorrer o histórico. Muda quando entra
   * mensagem ou nota, que é exatamente quando a análise em cache envelhece.
   */
  const copilotSignature = useMemo(() => {
    if (!selected) return "";
    const lastMessage = selectedMessages[selectedMessages.length - 1];
    const lastNote = selectedNotes[selectedNotes.length - 1];
    const total = selectedMessages.length + selectedNotes.length;
    const latest =
      [lastMessage?.occurredAt, lastNote?.occurredAt].filter(Boolean).sort().pop() ?? "";
    return `${selected.id}:${total}:${latest}`;
  }, [selected, selectedMessages, selectedNotes]);

  const handleSuggest = useCallback(
    async (draft: string) => {
      const context = buildCopilotContext();
      if (!context) return null;
      return copilot.suggest(context, draft || undefined);
    },
    [copilot, buildCopilotContext],
  );

  const handleRewrite = useCallback(
    async (draft: string, tone: AiToneAdjustment) => {
      const context = buildCopilotContext();
      if (!context) return null;
      return copilot.rewrite(context, draft, tone);
    },
    [copilot, buildCopilotContext],
  );

  function handleSend(input: ComposerSubmission) {
    if (!selected || !currentUser) return;
    sequenceRef.current += 1;
    const suffix = `${selected.id}_local_${sequenceRef.current}`;

    if (input.mode === "nota") {
      const note: InternalNote = {
        id: `note_${suffix}`,
        conversationId: selected.id,
        authorId: currentUser.id,
        authorLabel: currentUser.name,
        body: input.body,
        mentionedUserIds: [],
        occurredAt: offsetIso({}),
      };
      setExtraNotes((current) => ({
        ...current,
        [selected.id]: [...(current[selected.id] ?? []), note],
      }));
      toast.success("Nota interna registrada", {
        description: "Visível apenas para o time. O contato não recebe notificação.",
      });
      return;
    }

    /**
     * Conversa de webchat ao vivo sai por outro caminho.
     *
     * Ela não vive no estado local: vive na sessão do servidor, e é de lá que o
     * visitante lê. Empurrá-la para `extraMessages` mostraria a resposta ao
     * atendente e a nada mais — o pior resultado possível, porque parece enviado.
     */
    if (liveWebchat.sessionByConversation[selected.id]) {
      void liveWebchat.reply(selected.id, input.body, currentUser.name).then((delivered) => {
        if (delivered) {
          toast.success("Resposta enviada ao visitante", {
            description: "Ela aparece no chat do site em poucos segundos.",
          });
        } else {
          toast.error("O visitante não está mais conectado", {
            description: "A sessão do webchat expirou ou foi encerrada.",
          });
        }
      });
      return;
    }

    const messageId = `msg_${suffix}`;
    const message: Message = {
      id: messageId,
      organizationId: selected.organizationId,
      conversationId: selected.id,
      direction: "saida",
      authorKind: "agente",
      authorId: currentUser.id,
      authorLabel: currentUser.name,
      channel: selected.channel,
      body: input.body,
      attachments: input.attachments.length > 0 ? input.attachments : undefined,
      quote: input.quote,
      templateName: input.asTemplate ? "resposta_fora_janela_v1" : undefined,
      deliveryStatus: "enfileirada",
      occurredAt: offsetIso({}),
    };

    setExtraMessages((current) => ({
      ...current,
      [selected.id]: [...(current[selected.id] ?? []), message],
    }));

    const preview =
      input.body ||
      (input.attachments.length === 1
        ? (input.attachments[0]?.fileName ?? "Arquivo")
        : `${input.attachments.length} arquivos`);

    patch(selected.id, {
      lastMessagePreview: preview,
      lastMessageAt: message.occurredAt,
      unreadCount: 0,
      assigneeId: selected.assigneeId ?? currentUser.id,
      firstRespondedAt: selected.firstRespondedAt ?? message.occurredAt,
      state:
        selected.state === "nova" || selected.state === "em_triagem"
          ? "em_atendimento"
          : selected.state,
    });

    // Simula o ciclo real do provedor: enfileirada → enviada → entregue.
    const conversationId = selected.id;
    const advance = (status: Message["deliveryStatus"], delay: number) => {
      const timer = setTimeout(() => {
        setExtraMessages((current) => ({
          ...current,
          [conversationId]: (current[conversationId] ?? []).map((item) =>
            item.id === messageId ? { ...item, deliveryStatus: status } : item,
          ),
        }));
      }, delay);
      timersRef.current.push(timer);
    };
    advance("enviada", 500);
    advance("entregue", 1400);

    /**
     * O aviso depende da origem do anexo.
     *
     * Arquivo local e link têm pendências diferentes, e um aviso genérico
     * mentiria numa das duas: o arquivo do computador de fato não saiu do
     * navegador, enquanto o link já é um endereço público e válido — o que falta
     * nele é o back-end baixar o conteúdo antes de despachar pelo canal.
     */
    if (input.attachments.length > 0) {
      const files = input.attachments.filter((item) => item.source !== "link").length;
      const links = input.attachments.length - files;

      if (files > 0) {
        toast.info(
          files === 1 ? "Anexo pronto no rascunho local" : `${files} anexos locais prontos`,
          {
            description:
              "O arquivo ainda não sai do navegador: o envio real depende do armazenamento de mídia (seção 11 do plano).",
          },
        );
      }

      if (links > 0) {
        toast.info(links === 1 ? "Link anexado" : `${links} links anexados`, {
          description:
            "O endereço é externo e pode mudar ou sair do ar. No envio real, o conteúdo é baixado e verificado antes de seguir pelo canal (seção 11).",
        });
      }
    }

    if (input.asTemplate) {
      toast.info("Enviado como template aprovado", {
        description: "A conversa estava fora da janela de 24 horas do WhatsApp.",
      });
    }
  }

  function handleAssign(userId: string | undefined) {
    if (!selected) return;
    patch(selected.id, { assigneeId: userId });
    const user = userId ? userById.get(userId) : undefined;
    toast.success(user ? `Conversa atribuída a ${user.name}` : "Responsável removido", {
      description: "A alteração é registrada na auditoria com autor e horário.",
    });
  }

  function handleChangeState(state: ConversationState) {
    if (!selected) return;
    patch(selected.id, { state });
    toast.success(`Estado alterado para "${CONVERSATION_STATE_LABEL[state]}"`, {
      description:
        state === "aguardando_cliente"
          ? "O relógio de SLA fica pausado enquanto aguarda o cliente."
          : "O evento conversation.state_changed foi emitido.",
    });
  }

  function handleTransferQueue(queueId: string) {
    if (!selected) return;
    const queue = queueById.get(queueId);
    patch(selected.id, { queueId, assigneeId: undefined });
    toast.success(`Transferida para "${queue?.name ?? queueId}"`, {
      description: "O responsável foi liberado e o SLA da nova fila passa a valer.",
    });
  }

  /**
   * Ações rápidas da lista: agem na conversa apontada, não na selecionada.
   *
   * Envolvidas em `useCallback` porque descem para linhas memorizadas: uma função
   * recriada a cada renderização invalidaria o `memo` de todas as dezesseis
   * linhas e anularia o ganho.
   *
   * `contactById` fica de fora das dependências de propósito — ele é derivado de
   * `data.contacts`, que não muda em toda a vida da tela; incluí-lo não mudaria
   * nada além de tornar a lista de dependências mais difícil de ler.
   */
  const handleAssignToMe = useCallback(
    (conversationId: string) => {
      if (!currentUser) return;
      patch(conversationId, { assigneeId: currentUser.id });
      const contact = contactById.get(
        data.conversations.find((item) => item.id === conversationId)?.contactId ?? "",
      );
      toast.success(`Você assumiu a conversa${contact ? ` de ${contact.fullName}` : ""}`);
    },
    [currentUser, patch, contactById, data.conversations],
  );

  const handleResolveFromList = useCallback(
    (conversationId: string) => {
      patch(conversationId, { state: "resolvida" });
      toast.success("Conversa marcada como resolvida", {
        description: "Se o cliente responder, ela reabre automaticamente.",
      });
    },
    [patch],
  );

  /**
   * Tabulação: aplicar uma proposta do copiloto.
   *
   * A escrita é local porque a camada de escrita ainda não existe — mas o efeito
   * é real na tela: o contato muda, o painel de contexto reflete, e a proposta
   * vira confirmação em vez de sumir. Quando o back-end entrar, o que troca é o
   * corpo desta função; a assinatura e a interface continuam valendo.
   *
   * Cada aplicação também vira nota interna. Não é enfeite de auditoria: sem o
   * registro, ninguém consegue responder depois "de onde veio esse CPF" — e a
   * resposta certa é "o cliente escreveu na conversa, e fulano aceitou às 14h".
   */
  const handleApplyProposal = useCallback(
    (resolved: AiResolvedProposal) => {
      if (!selected || !currentUser) return;
      const contact = contactById.get(selected.contactId);
      if (!contact) return;

      const { proposal, normalized, status } = resolved;

      setContactPatches((current) => {
        const patchForContact = { ...(current[contact.id] ?? {}) };

        if (proposal.kind === "preencher_campo" && proposal.field) {
          switch (proposal.field) {
            case "contato.email":
              patchForContact.email = normalized;
              break;
            case "contato.telefone":
              patchForContact.phone = normalized;
              break;
            case "contato.cargo":
              patchForContact.jobTitle = normalized;
              break;
            case "contato.cidade":
              patchForContact.city = normalized;
              break;
            case "contato.estado":
              patchForContact.state = normalized;
              break;
            case "contato.documento":
              patchForContact.identifiers = [
                ...(patchForContact.identifiers ?? contact.identifiers).filter(
                  (item) => item.kind !== "cpf",
                ),
                {
                  id: `idf_${proposal.id}`,
                  kind: "cpf" as const,
                  value: normalized,
                  // Dito em conversa não é documento verificado; a verificação é
                  // outro processo, e marcar como verificado aqui seria mentir.
                  verified: false,
                  primary: false,
                },
              ];
              break;
            default: {
              const key = proposal.field.slice("campo.".length);
              patchForContact.customFields = (
                patchForContact.customFields ?? contact.customFields
              ).map((field) => (field.key === key ? { ...field, value: normalized } : field));
            }
          }
        }

        return { ...current, [contact.id]: patchForContact };
      });

      setAppliedProposals((current) => ({
        ...current,
        [selected.id]: { ...(current[selected.id] ?? {}), [proposal.id]: normalized },
      }));

      const note: InternalNote = {
        id: `note_tab_${selected.id}_${proposal.id}`,
        conversationId: selected.id,
        authorId: currentUser.id,
        authorLabel: currentUser.name,
        body:
          proposal.kind === "criar_tarefa"
            ? `Tarefa criada a partir da conversa: “${normalized}”${
                proposal.dueAt ? ` · vence ${formatDateTime(proposal.dueAt)}` : ""
              }.`
            : `${proposal.label} ${status === "divergente" ? "substituído" : "preenchido"} pela tabulação do copiloto: ${normalized}. Origem: “${proposal.evidence}”.`,
        occurredAt: offsetIso({}),
        mentionedUserIds: [],
      };

      setExtraNotes((current) => ({
        ...current,
        [selected.id]: [...(current[selected.id] ?? []), note],
      }));

      toast.success(
        proposal.kind === "criar_tarefa"
          ? "Tarefa registrada"
          : `${proposal.label} ${status === "divergente" ? "substituído" : "gravado"} no cadastro`,
        {
          description:
            proposal.kind === "criar_tarefa"
              ? proposal.dueAt
                ? // Sem camada de escrita, a tarefa vive nesta sessão e na nota da
                  // conversa. Prometer a fila de atenção do Início seria mentir:
                  // aquela tela lê do repositório, que ainda é imutável.
                  `Vence ${formatDateTime(proposal.dueAt)}. Registrada na conversa; a fila de atenção do Início só reflete isso quando o back-end entrar.`
                : "O modelo não devolveu um prazo confiável. Defina a data ao abrir a tarefa."
              : "Registrado em nota interna com o trecho de origem.",
        },
      );
    },
    [selected, currentUser, contactById],
  );

  const handleDismissProposal = useCallback(
    (proposalId: string) => {
      if (!selected) return;
      setDismissedProposals((current) => ({
        ...current,
        [selected.id]: [...(current[selected.id] ?? []), proposalId],
      }));
    },
    [selected],
  );

  const hasActiveFilters =
    quickFilter !== "todas" ||
    selectedQueueIds.length > 0 ||
    selectedStates.length > 0 ||
    selectedChannels.length > 0 ||
    search.length > 0;

  function resetFilters() {
    setQuickFilter("todas");
    setSelectedQueueIds([]);
    setSelectedStates([]);
    setSelectedChannels([]);
    setSearch("");
  }

  function toggle<T>(list: T[], value: T, setter: (next: T[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Indicadores da operação — faixa fina: a altura da tela pertence à conversa. */}
      <MetricStrip
        trailing={
          <span className="text-muted-foreground hidden text-[11px] lg:inline">
            {currentUser?.name} · capacidade {currentUser?.capacity} conversas simultâneas
          </span>
        }
      >
        <Metric
          label="Abertas"
          value={
            conversations.filter(
              (conversation) =>
                conversation.state !== "resolvida" && conversation.state !== "encerrada",
            ).length
          }
        />
        <Metric label="Sem responsável" value={counts.quick.nao_atribuidas} tone="warning" />
        <Metric
          label="SLA em risco"
          value={counts.quick.sla_risco}
          tone={counts.quick.sla_risco > 2 ? "danger" : "success"}
        />
        <Metric label="Minhas" value={counts.quick.minhas} />
      </MetricStrip>

      <div className="flex min-h-0 flex-1">
        {showFilters ? (
          <InboxFilters
            queues={data.queues}
            quickFilter={quickFilter}
            onQuickFilterChange={setQuickFilter}
            selectedQueueIds={selectedQueueIds}
            onToggleQueue={(id) => toggle(selectedQueueIds, id, setSelectedQueueIds)}
            selectedStates={selectedStates}
            onToggleState={(state) => toggle(selectedStates, state, setSelectedStates)}
            selectedChannels={selectedChannels}
            onToggleChannel={(channel) => toggle(selectedChannels, channel, setSelectedChannels)}
            counts={counts}
            onReset={resetFilters}
            hasActiveFilters={hasActiveFilters}
          />
        ) : null}

        {/* Lista */}
        <div className="border-border bg-surface flex w-80 shrink-0 flex-col border-r xl:w-[21rem]">
          <div className="border-border flex items-center gap-1.5 border-b p-2">
            <Tooltip content={showFilters ? "Ocultar filtros" : "Mostrar filtros"}>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowFilters((value) => !value)}
                aria-label={showFilters ? "Ocultar filtros" : "Mostrar filtros"}
                className={cn("hidden xl:inline-flex", showFilters && "text-accent")}
              >
                <SlidersHorizontal />
              </Button>
            </Tooltip>
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
              placeholder="Buscar por contato, assunto ou mensagem"
              className="flex-1"
              aria-label="Buscar conversas"
            />
          </div>

          <div className="border-border flex items-center justify-between border-b px-3 py-1.5">
            <span className="text-muted-foreground text-[11px] tabular-nums">
              {filtered.length} {filtered.length === 1 ? "conversa" : "conversas"}
            </span>
            <span className="text-muted-foreground text-[11px]">↑ ↓ para navegar</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConversationList
              conversations={filtered}
              contactById={contactById}
              queueById={queueById}
              userById={userById}
              tagById={tagById}
              selectedId={selectedId}
              currentUserId={data.currentUserId}
              scrollOnSelect={selectionFromKeyboard}
              onSelect={handleSelect}
              onAssignToMe={handleAssignToMe}
              onResolve={handleResolveFromList}
            />
          </div>
        </div>

        {/* Conversa */}
        {selected && currentUser ? (
          /**
           * Sem "key" de propósito.
           *
           * Com uma chave por conversa, cada troca desmontava e remontava a
           * subárvore inteira: todas as bolhas, o compositor e as seis raízes de
           * Radix que ele carrega (respostas rápidas, link, emoji, tom, gravador).
           * O perfil apontou o preço disso em estilo e layout, não em JavaScript —
           * cerca de 800 ms de recálculo de estilo e layout em sete trocas, contra
           * ~300 ms de execução de script no mesmo intervalo.
           *
           * O que a chave garantia continua garantido por efeitos presos ao
           * identificador da conversa, dentro do componente: a rolagem volta ao
           * fim, a citação é limpa e o rascunho é descartado.
           */
          <ConversationThread
            conversation={selected}
            contact={selectedContact}
            queue={queueById.get(selected.queueId)}
            queues={data.queues}
            assignee={selected.assigneeId ? userById.get(selected.assigneeId) : undefined}
            users={data.users}
            currentUser={currentUser}
            messages={selectedMessages}
            notes={selectedNotes}
            cannedResponses={data.cannedResponses}
            copilotAvailable={data.copilotAvailable}
            composerRef={composerRef}
            onSuggest={handleSuggest}
            onRewrite={handleRewrite}
            onAssign={handleAssign}
            onChangeState={handleChangeState}
            onTransferQueue={handleTransferQueue}
            onSend={handleSend}
          />
        ) : (
          <div className="chat-canvas flex flex-1 items-center justify-center">
            <div className="relative">
              <EmptyState
                icon={<MessagesSquare />}
                title="Selecione uma conversa"
                description="Escolha um item da lista à esquerda para ver o histórico completo, responder e registrar notas internas."
              />
            </div>
          </div>
        )}

        {/* Copiloto e contexto do contato */}
        {selected && showContext ? (
          <InboxRightPanel
            contact={selectedContact}
            company={selectedCompany}
            owner={selectedContact?.ownerId ? userById.get(selectedContact.ownerId) : undefined}
            deals={selectedContact ? (data.dealsByContact[selectedContact.id] ?? []) : []}
            tagById={tagById}
            conversationCount={
              selectedContact
                ? conversations.filter(
                    (conversation) => conversation.contactId === selectedContact.id,
                  ).length
                : 0
            }
            copilotConversationId={selected.id}
            copilotSignature={copilotSignature}
            buildCopilotContext={buildCopilotContext}
            copilot={copilot}
            copilotAvailable={data.copilotAvailable}
            // A sugestão do painel entra no compositor como rascunho, com o
            // cursor no fim: continua sendo o atendente quem lê e envia.
            onUseReply={(text) => composerRef.current?.setBody(text)}
            tabulation={{
              contact: selectedContact,
              applied: appliedProposals[selected.id] ?? {},
              dismissed: dismissedProposals[selected.id] ?? [],
              onApply: handleApplyProposal,
              onDismiss: handleDismissProposal,
            }}
            agentActivity={liveWebchat.agentByConversation[selected.id]}
            survey={liveWebchat.surveyByConversation[selected.id]}
          />
        ) : null}
      </div>

      {/* Alternador do painel da direita */}
      {selected ? (
        <button
          type="button"
          onClick={() => setShowContext((value) => !value)}
          className="bg-surface text-muted-foreground shadow-card hover:text-foreground absolute right-4 top-14 z-30 hidden rounded-md p-1.5 transition-colors xl:inline-flex"
          aria-label={showContext ? "Ocultar painel da direita" : "Mostrar painel da direita"}
        >
          {showContext ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
        </button>
      ) : null}
    </div>
  );
}
