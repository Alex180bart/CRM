import type { Metadata } from "next";
import { repositories } from "@crm/core";
import { Badge } from "@crm/ui";

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
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        compact
        title="Administração"
        description="Pessoas, filas, canais, permissões e as políticas que protegem a base."
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
      />
    </div>
  );
}
