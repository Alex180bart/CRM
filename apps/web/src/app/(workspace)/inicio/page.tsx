import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CURRENT_USER_ID, repositories } from "@elora/core";

import { HomeDashboard } from "@/components/home/home-dashboard";

export const metadata: Metadata = { title: "Início" };

export default async function InicioPage() {
  const [
    users,
    attention,
    pulse,
    currentHour,
    conversationsSeries,
    firstResponseSeries,
    dealsSeries,
    revenueSeries,
    automationSeries,
    channelVolumes,
    conversations,
    pipelines,
  ] = await Promise.all([
    repositories.directory.listUsers(),
    repositories.insights.listAttention(),
    repositories.insights.hourlyPulse(),
    repositories.insights.currentHour(),
    repositories.insights.series("conversas"),
    repositories.insights.series("primeira_resposta"),
    repositories.insights.series("negocios_criados"),
    repositories.insights.series("receita_ganha"),
    repositories.insights.series("execucoes_automacao"),
    repositories.insights.channelVolumes(),
    repositories.conversations.list(),
    repositories.deals.listPipelines(),
  ]);

  const currentUser = users.find((user) => user.id === CURRENT_USER_ID);
  if (!currentUser) notFound();

  const dealLists = await Promise.all(
    pipelines.map((pipeline) => repositories.deals.listByPipeline(pipeline.id)),
  );
  const deals = dealLists.flat();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <HomeDashboard
        currentUser={currentUser}
        attention={attention}
        pulse={pulse}
        currentHour={currentHour}
        conversationsSeries={conversationsSeries}
        firstResponseSeries={firstResponseSeries}
        dealsSeries={dealsSeries}
        revenueSeries={revenueSeries}
        automationSeries={automationSeries}
        channelVolumes={channelVolumes}
        conversations={conversations}
        deals={deals}
        pipelines={pipelines}
      />
    </div>
  );
}
