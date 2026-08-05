import type { Metadata } from "next";
import { repositories } from "@crm/core";

import { RuleComposer } from "@/components/automations/rule-composer";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Nova automação" };

export default async function NovaAutomacaoPage() {
  const [messageTemplates, emailTemplates, tags, journeys, pipelines, users, teams] =
    await Promise.all([
      repositories.campaigns.listTemplates(),
      repositories.emailStudio.listTemplates(),
      repositories.directory.listTags(),
      repositories.automations.listJourneys(),
      repositories.deals.listPipelines(),
      repositories.directory.listUsers(),
      repositories.directory.listTeams(),
    ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        compact
        title="Nova automação"
        description="Quando algo acontecer, confira as condições e execute as ações — nesta ordem."
      />
      <RuleComposer
        messageTemplates={messageTemplates}
        emailTemplates={emailTemplates}
        tags={tags}
        journeys={journeys}
        pipelines={pipelines}
        users={users}
        teams={teams}
      />
    </div>
  );
}
