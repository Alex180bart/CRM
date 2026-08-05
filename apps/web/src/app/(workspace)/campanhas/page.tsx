import type { Metadata } from "next";
import Link from "next/link";
import { repositories } from "@crm/core";
import { Button } from "@crm/ui";
import { Plus } from "lucide-react";

import { CampaignList } from "@/components/campaigns/campaign-list";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Campanhas" };

export default async function CampanhasPage() {
  const [campaigns, segments, templates, users] = await Promise.all([
    repositories.campaigns.list(),
    repositories.campaigns.listSegments(),
    repositories.campaigns.listTemplates(),
    repositories.directory.listUsers(),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        compact
        title="Campanhas"
        description="Envio em massa com consentimento verificado, lotes controlados e cancelamento por anomalia."
        actions={
          <Button asChild size="sm">
            <Link href="/campanhas/nova">
              <Plus />
              Nova campanha
            </Link>
          </Button>
        }
      />
      <CampaignList campaigns={campaigns} segments={segments} templates={templates} users={users} />
    </div>
  );
}
