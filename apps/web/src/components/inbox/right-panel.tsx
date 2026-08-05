"use client";

import type { AiConversationContext, Company, Contact, Deal, Tag, User } from "@crm/core";
import { Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@crm/ui";
import { Sparkles, UserRound } from "lucide-react";

import { ContactContextPanel } from "./contact-context-panel";
import { CopilotPanel, type TabulationBinding } from "./copilot-panel";
import type { CopilotController } from "./use-copilot";

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
  className?: string;
}) {
  return (
    <aside
      className={cn(
        // A coluna só aparece a partir de 1280 px. Abaixo disso o atendente usa
        // o botão "Abrir contato 360º" e o copiloto pelo compositor.
        "border-border bg-surface hidden w-[21rem] shrink-0 flex-col border-l xl:flex",
        className,
      )}
    >
      <Tabs defaultValue="copiloto" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="shrink-0 px-2">
          <TabsTrigger value="copiloto" className="flex-1 gap-1.5 py-2 text-xs">
            <Sparkles className="size-3.5" aria-hidden />
            Copiloto
          </TabsTrigger>
          <TabsTrigger value="contato" className="flex-1 gap-1.5 py-2 text-xs">
            <UserRound className="size-3.5" aria-hidden />
            Contato
          </TabsTrigger>
        </TabsList>

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
