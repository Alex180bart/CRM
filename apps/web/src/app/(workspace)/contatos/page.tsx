import type { Metadata } from "next";
import { repositories } from "@crm/core";
import { Button } from "@crm/ui";
import { Plus, Upload } from "lucide-react";

import { ContactsTable } from "@/components/contacts/contacts-table";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Contatos" };

export default async function ContatosPage() {
  const [contacts, companies, users, tags] = await Promise.all([
    repositories.contacts.list(),
    repositories.contacts.listCompanies(),
    repositories.directory.listUsers(),
    repositories.directory.listTags(),
  ]);

  return (
    <>
      <PageHeader
        compact
        title="Contatos"
        description="Visão única de pessoas, leads, clientes e alunos — independentemente do canal de origem."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Upload />
              Importar
            </Button>
            <Button size="sm">
              <Plus />
              Novo contato
            </Button>
          </>
        }
      />
      <ContactsTable contacts={contacts} companies={companies} users={users} tags={tags} />
    </>
  );
}
