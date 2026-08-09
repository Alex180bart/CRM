import type { Metadata } from "next";
import { repositories } from "@elora/core";
import { Button } from "@elora/ui";
import { Download } from "lucide-react";

import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const [
    conversationsSeries,
    firstResponseSeries,
    dealsSeries,
    revenueSeries,
    automationSeries,
    channelVolumes,
    automationHealth,
    costs,
    definitions,
    conversations,
    queues,
    pipelines,
    campaigns,
  ] = await Promise.all([
    repositories.insights.series("conversas"),
    repositories.insights.series("primeira_resposta"),
    repositories.insights.series("negocios_criados"),
    repositories.insights.series("receita_ganha"),
    repositories.insights.series("execucoes_automacao"),
    repositories.insights.channelVolumes(),
    repositories.insights.automationHealth(),
    repositories.insights.costs(),
    repositories.insights.metricDefinitions(),
    repositories.conversations.list(),
    repositories.directory.listQueues(),
    repositories.deals.listPipelines(),
    repositories.campaigns.list(),
  ]);

  const dealLists = await Promise.all(
    pipelines.map((pipeline) => repositories.deals.listByPipeline(pipeline.id)),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        compact
        title="Analytics"
        description="Atendimento, comercial, campanhas e automação — com rastreabilidade até o evento de origem."
        actions={
          <Button variant="outline" size="sm">
            <Download />
            Exportar
          </Button>
        }
      />
      <AnalyticsDashboard
        conversationsSeries={conversationsSeries}
        firstResponseSeries={firstResponseSeries}
        dealsSeries={dealsSeries}
        revenueSeries={revenueSeries}
        automationSeries={automationSeries}
        channelVolumes={channelVolumes}
        automationHealth={automationHealth}
        costs={costs}
        definitions={definitions}
        conversations={conversations}
        queues={queues}
        deals={dealLists.flat()}
        pipelines={pipelines}
        campaigns={campaigns}
      />
    </div>
  );
}
