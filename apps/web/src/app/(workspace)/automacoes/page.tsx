import type { Metadata } from "next";
import Link from "next/link";
import { repositories } from "@elora/core";
import { Button } from "@elora/ui";
import { Plus } from "lucide-react";

import { RuleConsole } from "@/components/automations/rule-console";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Automações" };

export default async function AutomacoesPage() {
  const [rules, runs, users, contacts] = await Promise.all([
    repositories.rules.list(),
    repositories.rules.listRuns(),
    repositories.directory.listUsers(),
    repositories.contacts.list(),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        compact
        title="Automações"
        description="Regras que reagem a uma interação: clicou no botão, abriu o e-mail, ficou sem responder."
        actions={
          <Button asChild size="sm">
            <Link href="/automacoes/nova">
              <Plus />
              Nova automação
            </Link>
          </Button>
        }
      />
      <RuleConsole rules={rules} runs={runs} users={users} contacts={contacts} />
    </div>
  );
}
