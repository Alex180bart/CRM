import type { Metadata } from "next";
import { repositories } from "@elora/core";
import { Badge } from "@elora/ui";

import { AdminConsole } from "@/components/admin/admin-console";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Administração" };

export default async function AdministracaoPage() {
  const [
    organization,
    users,
    teams,
    queues,
    channelAccounts,
    permissions,
    audit,
    flags,
    retention,
    schedules,
    skills,
    closingReasons,
    customFields,
    tags,
    cannedResponses,
    customRoles,
    accessPolicy,
    invitations,
  ] = await Promise.all([
    repositories.directory.getOrganization(),
    repositories.directory.listUsers(),
    repositories.directory.listTeams(),
    repositories.directory.listQueues(),
    repositories.directory.listChannelAccounts(),
    repositories.governance.listPermissions(),
    repositories.governance.listAudit(),
    repositories.governance.listFeatureFlags(),
    repositories.governance.listRetentionPolicies(),
    repositories.directory.listSchedules(),
    repositories.directory.listSkills(),
    repositories.directory.listClosingReasons(),
    repositories.directory.listCustomFields(),
    repositories.directory.listTags(),
    repositories.directory.listCannedResponses(),
    repositories.directory.listCustomRoles(),
    repositories.directory.getAccessPolicy(),
    repositories.directory.listInvitations(),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        compact
        title="Administração"
        description="Pessoas, filas e distribuição, escalas, canais, catálogo, perfis e as políticas que protegem a base."
        meta={<Badge variant="neutral">{organization.name}</Badge>}
      />
      <AdminConsole
        organization={organization}
        users={users}
        teams={teams}
        queues={queues}
        channelAccounts={channelAccounts}
        permissions={permissions}
        audit={audit}
        flags={flags}
        retention={retention}
        schedules={schedules}
        skills={skills}
        closingReasons={closingReasons}
        customFields={customFields}
        tags={tags}
        cannedResponses={cannedResponses}
        customRoles={customRoles}
        accessPolicy={accessPolicy}
        invitations={invitations}
      />
    </div>
  );
}
