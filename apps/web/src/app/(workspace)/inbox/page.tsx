import type { Metadata } from "next";
import { CURRENT_USER_ID, repositories } from "@elora/core";
import type { Deal, InternalNote, Message } from "@elora/core";
import { Badge, Button } from "@elora/ui";
import { BookOpen, Plus } from "lucide-react";

import { InboxWorkspace } from "@/components/inbox/inbox-workspace";
import { PageHeader } from "@/components/shell/page-header";
import { isCopilotConfigured } from "@/lib/ai/gateway";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage() {
  const [
    conversations,
    contacts,
    companies,
    users,
    queues,
    tags,
    cannedResponses,
    products,
    proposals,
  ] = await Promise.all([
    repositories.conversations.list(),
    repositories.contacts.list(),
    repositories.contacts.listCompanies(),
    repositories.directory.listUsers(),
    repositories.directory.listQueues(),
    repositories.directory.listTags(),
    repositories.directory.listCannedResponses(),
    repositories.commerce.listProducts(),
    repositories.commerce.listProposals(),
  ]);

  // O protótipo carrega o histórico completo de uma vez porque a base é local.
  // Com a API real, isto vira carregamento sob demanda por conversa.
  const threads = await Promise.all(
    conversations.map(async (conversation) => ({
      id: conversation.id,
      messages: await repositories.conversations.listMessages(conversation.id),
      notes: await repositories.conversations.listNotes(conversation.id),
    })),
  );

  const messagesByConversation: Record<string, Message[]> = {};
  const notesByConversation: Record<string, InternalNote[]> = {};
  for (const thread of threads) {
    messagesByConversation[thread.id] = thread.messages;
    notesByConversation[thread.id] = thread.notes;
  }

  const dealsByContact: Record<string, Deal[]> = {};
  await Promise.all(
    contacts.map(async (contact) => {
      const deals = await repositories.deals.listByContact(contact.id);
      if (deals.length > 0) dealsByContact[contact.id] = deals;
    }),
  );

  const openCount = conversations.filter(
    (conversation) => conversation.state !== "resolvida" && conversation.state !== "encerrada",
  ).length;

  return (
    <>
      <PageHeader
        compact
        title="Inbox omnichannel"
        description="Todas as conversas de WhatsApp, e-mail, Instagram e webchat em uma única fila de trabalho."
        meta={<Badge variant="primary">{openCount} abertas</Badge>}
        actions={
          <>
            <Button variant="ghost" size="sm">
              <BookOpen />
              Base de conhecimento
            </Button>
            <Button size="sm">
              <Plus />
              Nova conversa
            </Button>
          </>
        }
      />
      <InboxWorkspace
        conversations={conversations}
        messagesByConversation={messagesByConversation}
        notesByConversation={notesByConversation}
        contacts={contacts}
        companies={companies}
        users={users}
        queues={queues}
        tags={tags}
        cannedResponses={cannedResponses}
        products={products}
        proposals={proposals}
        dealsByContact={dealsByContact}
        currentUserId={CURRENT_USER_ID}
        /**
         * A credencial é lida no servidor e só o resultado desce.
         * Sem isto, a tela ofereceria "Analisar conversa" para depois falhar —
         * e o atendente concluiria que a IA não funciona, quando o que falta é
         * configuração de ambiente.
         */
        copilotAvailable={isCopilotConfigured()}
      />
    </>
  );
}
