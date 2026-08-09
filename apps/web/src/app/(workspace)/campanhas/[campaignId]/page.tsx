import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { repositories } from "@elora/core";

import { CampaignDetail } from "@/components/campaigns/campaign-detail";

interface PageProps {
  params: Promise<{ campaignId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { campaignId } = await params;
  const campaign = await repositories.campaigns.getById(campaignId);
  return { title: campaign?.name ?? "Campanha" };
}

export default async function CampaignPage({ params }: PageProps) {
  const { campaignId } = await params;
  const campaign = await repositories.campaigns.getById(campaignId);
  if (!campaign) notFound();

  const [segment, template, channelAccounts, users] = await Promise.all([
    repositories.campaigns.getSegmentById(campaign.segmentId),
    repositories.campaigns.getTemplateById(campaign.templateId),
    repositories.directory.listChannelAccounts(),
    repositories.directory.listUsers(),
  ]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <CampaignDetail
        campaign={campaign}
        segment={segment}
        template={template}
        channelAccount={
          channelAccounts.find((account) => account.id === campaign.channelAccountId) ?? null
        }
        users={users}
      />
    </div>
  );
}
