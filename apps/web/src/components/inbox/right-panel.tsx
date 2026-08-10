"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AiConversationContext,
  Company,
  Contact,
  Deal,
  Product,
  Proposal,
  Tag,
  User,
} from "@elora/core";
import { Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@elora/ui";
import { Bot, ReceiptText, Sparkles, UserRound } from "lucide-react";

import { AgentActivityPanel } from "./agent-activity-panel";
import { ContactContextPanel } from "./contact-context-panel";
import { ProposalPanel } from "./proposal-panel";
import { CopilotPanel, type TabulationBinding } from "./copilot-panel";
import type { CopilotController } from "./use-copilot";
import type { LiveAgentActivity, LiveSurvey } from "./use-live-webchat";

/**
 * Coluna da direita.
 *
 * Copiloto e contato dividem a mesma coluna em abas em vez de ocuparem duas.
 * A tela já tem filtros, lista e conversa; uma quinta coluna estreitaria
 * justamente a conversa, que é onde o atendente passa o dia. E as duas
 * informações raramente são consultadas ao mesmo tempo: o contexto do contato
 * se lê ao assumir o caso, o copiloto ao responder.
 *
 * O copiloto abre primeiro por ser o que muda a próxima ação.
 */
export function InboxRightPanel({
  contact,
  company,
  owner,
  deals,
  tagById,
  conversationCount,
  copilotConversationId,
  copilotSignature,
  buildCopilotContext,
  copilot,
  copilotAvailable,
  onUseReply,
  tabulation,
  agentActivity,
  survey,
  products,
  proposals,
  conversationContext,
  onSendProposalMessage,
  conversationId,
  currentUserId,
  className,
}: {
  contact?: Contact;
  company?: Company;
  owner?: User;
  deals: Deal[];
  tagById: Map<string, Tag>;
  conversationCount: number;
  copilotConversationId: string | null;
  copilotSignature: string;
  buildCopilotContext: () => AiConversationContext | null;
  copilot: CopilotController;
  copilotAvailable: boolean;
  onUseReply: (text: string) => void;
  tabulation?: TabulationBinding;
  /** Só existe quando um agente de IA conduziu esta conversa. */
  agentActivity?: LiveAgentActivity;
  /** Avaliação do atendimento, quando a pesquisa foi oferecida. */
  survey?: LiveSurvey;
  /** Catálogo comercial, para montar proposta na conversa (seção 26.1). */
  products: Product[];
  proposals: Proposal[];
  /** Assunto, tags e últimas mensagens — a busca do catálogo sugere a partir daí. */
  conversationContext?: string;
  /** Publica a mensagem do orçamento na conversa. */
  onSendProposalMessage?: (body: string) => void;
  conversationId: string | null;
  currentUserId: string;
  className?: string;
}) {
  /**
   * Quando um agente de IA conduziu a conversa, a aba dele abre primeiro: quem
   * assume precisa saber o que a IA já disse **antes** de pedir sugestão ao
   * copiloto sobre o que dizer. Na ordem inversa, o atendente escreve por cima
   * do que a máquina acabou de prometer.
   *
   * Não dá para fazer isso com `defaultValue`. O painel monta antes da leitura
   * periódica do webchat trazer a atividade, e `defaultValue` é congelado na
   * montagem — a aba nascia em "Copiloto" e nunca mudava. Daí o controle
   * explícito, com um registro de qual conversa já teve a escolha aplicada:
   * assim a chegada do dado abre a aba uma vez, e a troca manual depois disso
   * não é desfeita pela leitura seguinte.
   */
  /**
   * O selo conta só as propostas **vivas** da conversa.
   *
   * Incluir paga, recusada e cancelada faria o número crescer para sempre e
   * parar de significar "tem algo esperando você" — que é a única razão de um
   * selo existir numa aba.
   */
  const proposalCount = proposals.filter(
    (proposal) =>
      proposal.conversationId === conversationId &&
      ["rascunho", "aguardando_aprovacao", "enviada", "aceita"].includes(proposal.status),
  ).length;

  const [tab, setTab] = useState("copiloto");
  const settledFor = useRef<string | null>(null);

  useEffect(() => {
    if (!copilotConversationId) return;
    if (settledFor.current === copilotConversationId) return;

    if (agentActivity) {
      setTab("ia");
      settledFor.current = copilotConversationId;
      return;
    }

    // Sem atividade ainda: fica no copiloto, mas sem marcar como decidido — se
    // a leitura seguinte trouxer o rastro, a aba ainda abre.
    setTab("copiloto");
  }, [copilotConversationId, agentActivity]);

  return (
    <aside
      className={cn(
        // A coluna só aparece a partir de 1280 px. Abaixo disso o atendente usa
        // o botão "Abrir contato 360º" e o copiloto pelo compositor.
        "border-border bg-surface hidden w-[21rem] shrink-0 flex-col border-l xl:flex",
        className,
      )}
    >
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0 px-2">
          {agentActivity ? (
            <TabsTrigger value="ia" className="flex-1 gap-1.5 py-2 text-xs">
              <Bot className="size-3.5" aria-hidden />
              IA
              {agentActivity.pending.length > 0 ? (
                <span className="bg-warning size-1.5 rounded-full" aria-hidden />
              ) : null}
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="copiloto" className="flex-1 gap-1.5 py-2 text-xs">
            <Sparkles className="size-3.5" aria-hidden />
            Copiloto
          </TabsTrigger>
          <TabsTrigger value="proposta" className="flex-1 gap-1.5 py-2 text-xs">
            <ReceiptText className="size-3.5" />
            Proposta
            {proposalCount > 0 ? (
              <span className="bg-accent text-accent-foreground rounded-full px-1.5 text-[10px] font-semibold">
                {proposalCount}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="contato" className="flex-1 gap-1.5 py-2 text-xs">
            <UserRound className="size-3.5" aria-hidden />
            Contato
          </TabsTrigger>
        </TabsList>

        {agentActivity ? (
          <TabsContent
            value="ia"
            className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
          >
            <AgentActivityPanel activity={agentActivity} survey={survey} />
          </TabsContent>
        ) : null}

        <TabsContent
          value="copiloto"
          className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <CopilotPanel
            conversationId={copilotConversationId}
            signature={copilotSignature}
            buildContext={buildCopilotContext}
            controller={copilot}
            available={copilotAvailable}
            onUseReply={onUseReply}
            tabulation={tabulation}
          />
        </TabsContent>

        <TabsContent
          value="proposta"
          className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          {conversationId && contact ? (
            <ProposalPanel
              conversationId={conversationId}
              contactId={contact.id}
              contactName={contact.fullName}
              products={products}
              proposals={proposals}
              currentUserId={currentUserId}
              conversationContext={conversationContext}
              onSendMessage={onSendProposalMessage}
            />
          ) : (
            <p className="text-muted-foreground p-4 text-center text-xs">
              Selecione uma conversa para montar uma proposta.
            </p>
          )}
        </TabsContent>

        <TabsContent
          value="contato"
          className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          {contact ? (
            <ContactContextPanel
              contact={contact}
              company={company}
              owner={owner}
              deals={deals}
              tagById={tagById}
              conversationCount={conversationCount}
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </aside>
  );
}
