import type { Metadata } from "next";
import { repositories } from "@crm/core";

import { CampaignWizard } from "@/components/campaigns/campaign-wizard";

export const metadata: Metadata = { title: "Nova campanha" };

export default async function NovaCampanhaPage() {
  const [segments, messageTemplates, emailTemplates, brandKits, channelAccounts] =
    await Promise.all([
      repositories.campaigns.listSegments(),
      repositories.campaigns.listTemplates(),
      repositories.emailStudio.listTemplates(),
      repositories.emailStudio.listBrandKits(),
      repositories.directory.listChannelAccounts(),
    ]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <CampaignWizard
        segments={segments}
        messageTemplates={messageTemplates}
        emailTemplates={emailTemplates}
        brandKits={brandKits}
        channelAccounts={channelAccounts}
      />
    </div>
  );
}
