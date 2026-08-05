import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { repositories } from "@crm/core";

import { ContactDetail } from "@/components/contacts/contact-detail";

interface PageProps {
  params: Promise<{ contactId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { contactId } = await params;
  const contact = await repositories.contacts.getById(contactId);
  return { title: contact?.fullName ?? "Contato" };
}

export default async function ContactDetailPage({ params }: PageProps) {
  const { contactId } = await params;
  const contact = await repositories.contacts.getById(contactId);
  if (!contact) notFound();

  const [
    company,
    users,
    timeline,
    conversations,
    deals,
    tasks,
    pipelines,
    tags,
    duplicateOfContact,
  ] = await Promise.all([
    contact.companyId ? repositories.contacts.getCompanyById(contact.companyId) : null,
    repositories.directory.listUsers(),
    repositories.contacts.listTimeline(contact.id),
    repositories.conversations.listByContact(contact.id),
    repositories.deals.listByContact(contact.id),
    repositories.contacts.listTasks(contact.id),
    repositories.deals.listPipelines(),
    repositories.directory.listTags(),
    contact.duplicateOf ? repositories.contacts.getById(contact.duplicateOf) : null,
  ]);

  return (
    <ContactDetail
      contact={contact}
      company={company}
      owner={users.find((user) => user.id === contact.ownerId)}
      timeline={timeline}
      conversations={conversations}
      deals={deals}
      tasks={tasks}
      pipelines={pipelines}
      tags={tags}
      duplicateOfContact={duplicateOfContact}
    />
  );
}
