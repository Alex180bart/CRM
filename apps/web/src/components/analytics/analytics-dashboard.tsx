"use client";

import { useState } from "react";
import type {
  AutomationHealth,
  Campaign,
  ChannelVolume,
  Conversation,
  Deal,
  MetricDefinition,
  OperationCost,
  Pipeline,
  Queue,
  TimePoint,
} from "@crm/core";
import {
  CHANNEL_LABEL,
  CONVERSATION_STATE_LABEL,
  formatCurrencyCents,
  formatDuration,
  formatNumber,
  formatPercent,
} from "@crm/core";
import {
  BarSeries,
  Badge,
  ChartFrame,
  ChartLegend,
  Eyebrow,
  FunnelBars,
  ProgressBar,
  Reveal,
  ShareBar,
  Sparkline,
  StatTile,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  cn,
  seriesColor,
} from "@crm/ui";
import { BookOpen, TrendingDown, TrendingUp } from "lucide-react";

const PERIODS = [
  { id: "7", label: "7 dias" },
  { id: "14", label: "14 dias" },
  { id: "30", label: "30 dias" },
] as const;

export interface AnalyticsData {
  conversationsSeries: TimePoint[];
  firstResponseSeries: TimePoint[];
  dealsSeries: TimePoint[];
  revenueSeries: TimePoint[];
  automationSeries: TimePoint[];
  channelVolumes: ChannelVolume[];
  automationHealth: AutomationHealth[];
  costs: OperationCost[];
  definitions: MetricDefinition[];
  conversations: Conversation[];
  queues: Queue[];
  deals: Deal[];
  pipelines: Pipeline[];
  campaigns: Campaign[];
}

function sum(series: TimePoint[]): number {
  return series.reduce((total, point) => total + point.value, 0);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2)
    : (sorted[middle] ?? 0);
}

export function AnalyticsDashboard(data: AnalyticsData) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("14");

  const days = Number(period);
  const slice = <T,>(series: T[]) => series.slice(Math.max(0, series.length - days));

  const conversations = slice(data.conversationsSeries);
  const firstResponse = slice(data.firstResponseSeries);
  const dealsCreated = slice(data.dealsSeries);
  const revenue = slice(data.revenueSeries);
  const automation = slice(data.automationSeries);

  /* Atendimento ----------------------------------------------------------- */
  const slaCompliant = data.conversations.filter(
    (conversation) => conversation.slaStatus === "cumprido" || conversation.slaStatus === "dentro",
  ).length;
  const slaRate = (slaCompliant / Math.max(data.conversations.length, 1)) * 100;

  const stateDistribution = Object.entries(
    data.conversations.reduce<Record<string, number>>((acc, conversation) => {
      acc[conversation.state] = (acc[conversation.state] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([state, count]) => ({
    label: CONVERSATION_STATE_LABEL[state as keyof typeof CONVERSATION_STATE_LABEL] ?? state,
    value: count,
  }));

  const queueLoad = data.queues.map((queue) => ({
    queue,
    open: data.conversations.filter(
      (conversation) =>
        conversation.queueId === queue.id &&
        conversation.state !== "resolvida" &&
        conversation.state !== "encerrada",
    ).length,
    atRisk: data.conversations.filter(
      (conversation) =>
        conversation.queueId === queue.id &&
        (conversation.slaStatus === "estourado" || conversation.slaStatus === "atencao"),
    ).length,
  }));

  /* Comercial ------------------------------------------------------------- */
  const salesPipeline =
    data.pipelines.find((pipeline) => pipeline.id === "pipe_vendas") ?? data.pipelines[0];
  const stageById = new Map((salesPipeline?.stages ?? []).map((stage) => [stage.id, stage]));
  const salesDeals = data.deals.filter((deal) => deal.pipelineId === salesPipeline?.id);
  const won = salesDeals.filter((deal) => stageById.get(deal.stageId)?.kind === "ganha");
  const lost = salesDeals.filter((deal) => stageById.get(deal.stageId)?.kind === "perdida");
  const conversion =
    won.length + lost.length > 0 ? (won.length / (won.length + lost.length)) * 100 : 0;

  const funnelStages = (salesPipeline?.stages ?? [])
    .filter((stage) => stage.kind === "aberta")
    .map((stage) => ({
      label: stage.name,
      value: salesDeals.filter((deal) => deal.stageId === stage.id).length,
    }));

  /* Campanhas ------------------------------------------------------------- */
  const sentCampaigns = data.campaigns.filter((campaign) => campaign.metrics.sent > 0);
  const campaignTotals = sentCampaigns.reduce(
    (acc, campaign) => ({
      sent: acc.sent + campaign.metrics.sent,
      delivered: acc.delivered + campaign.metrics.delivered,
      read: acc.read + campaign.metrics.read,
      replied: acc.replied + campaign.metrics.replied,
      failed: acc.failed + campaign.metrics.failed,
      optOuts: acc.optOuts + campaign.metrics.optOuts,
      cost: acc.cost + campaign.metrics.costCents,
    }),
    { sent: 0, delivered: 0, read: 0, replied: 0, failed: 0, optOuts: 0, cost: 0 },
  );

  /* Automação ------------------------------------------------------------- */
  const automationTotals = data.automationHealth.reduce(
    (acc, item) => ({
      runs: acc.runs + item.runs,
      success: acc.success + item.success,
      errors: acc.errors + item.errors,
      backlog: acc.backlog + item.backlog,
    }),
    { runs: 0, success: 0, errors: 0, backlog: 0 },
  );
  const successRate = (automationTotals.success / Math.max(automationTotals.runs, 1)) * 100;

  return (
    <div className="mx-auto w-full max-w-[86rem] px-5 py-6">
      {/* Período */}
      <Reveal index={0} className="mb-5 flex flex-wrap items-center gap-2">
        <Eyebrow>Período</Eyebrow>
        <div className="flex items-center gap-1">
          {PERIODS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPeriod(option.id)}
              aria-pressed={period === option.id}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-medium transition-colors",
                period === option.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground ml-auto text-[11px]">
          Todo número desta página tem definição escrita na aba Dicionário.
        </p>
      </Reveal>

      <Tabs defaultValue="atendimento">
        <TabsList className="mb-5">
          <TabsTrigger value="atendimento">Atendimento</TabsTrigger>
          <TabsTrigger value="comercial">Comercial</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="automacao">Automação</TabsTrigger>
          <TabsTrigger value="dicionario">
            <BookOpen className="size-3" />
            Dicionário
          </TabsTrigger>
        </TabsList>

        {/* Atendimento ------------------------------------------------- */}
        <TabsContent value="atendimento" className="m-0 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Reveal index={1}>
              <StatTile
                label="Conversas no período"
                value={formatNumber(sum(conversations))}
                hint={`média de ${formatNumber(Math.round(sum(conversations) / days))} por dia`}
                chart={
                  <Sparkline
                    data={conversations}
                    height={40}
                    colorIndex={0}
                    formatValue={(value) => `${value} conversas`}
                  />
                }
              />
            </Reveal>
            <Reveal index={2}>
              <StatTile
                label="Primeira resposta"
                value={formatDuration(median(firstResponse.map((point) => point.value)))}
                hint="mediana no período"
                trend={{ direction: "down", label: "meta 15 min", good: true }}
                chart={
                  <Sparkline
                    data={firstResponse}
                    height={40}
                    colorIndex={2}
                    formatValue={(value) => formatDuration(value)}
                  />
                }
              />
            </Reveal>
            <Reveal index={3}>
              <StatTile
                label="SLA cumprido"
                value={formatPercent(slaRate)}
                hint={`${slaCompliant} de ${data.conversations.length} conversas`}
                trend={{
                  direction: slaRate >= 80 ? "up" : "down",
                  label: "meta 80%",
                  good: slaRate >= 80,
                }}
              />
            </Reveal>
            <Reveal index={4}>
              <StatTile
                label="Aguardando resposta"
                value={formatNumber(
                  data.conversations.filter((conversation) => conversation.state === "nova").length,
                )}
                hint="nenhum agente assumiu ainda"
              />
            </Reveal>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Reveal index={5}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <ChartFrame
                  title="Estado das conversas"
                  description="Distribuição atual em todas as filas"
                >
                  <BarSeries
                    data={stateDistribution}
                    height={140}
                    colorIndex={0}
                    showAxis={false}
                    formatValue={(value) => `${value} conversas`}
                  />
                  <ChartLegend
                    items={stateDistribution.map((item) => ({
                      label: item.label,
                      color: seriesColor(0),
                      value: String(item.value),
                    }))}
                  />
                </ChartFrame>
              </div>
            </Reveal>

            <Reveal index={6}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <ChartFrame
                  title="Carga por fila"
                  description="Abertas e quantas delas estão com SLA em risco"
                >
                  <ul className="space-y-3">
                    {queueLoad.map((item) => {
                      const riskShare = item.open > 0 ? (item.atRisk / item.open) * 100 : 0;
                      return (
                        <li key={item.queue.id}>
                          <div className="mb-1 flex items-baseline justify-between gap-2">
                            <span className="truncate text-xs">{item.queue.name}</span>
                            <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                              {item.open} abertas ·{" "}
                              <span className={item.atRisk > 0 ? "text-destructive" : ""}>
                                {item.atRisk} em risco
                              </span>
                            </span>
                          </div>
                          <ProgressBar
                            value={riskShare}
                            tone={
                              riskShare > 50 ? "danger" : riskShare > 20 ? "warning" : "success"
                            }
                            label={`Risco na fila ${item.queue.name}`}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </ChartFrame>
              </div>
            </Reveal>
          </div>

          <Reveal index={7}>
            <div className="bg-card shadow-card rounded-lg p-5">
              <ChartFrame
                title="Volume por canal"
                description="Mensagens recebidas e enviadas nos últimos 30 dias"
              >
                <ShareBar
                  segments={data.channelVolumes.map((volume, index) => ({
                    label: CHANNEL_LABEL[volume.channel],
                    value: volume.received + volume.sent,
                    colorIndex: index,
                  }))}
                />
                <table className="mt-4 w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground text-left text-[11px]">
                      <th className="pb-1.5 font-medium">Canal</th>
                      <th className="pb-1.5 text-right font-medium">Recebidas</th>
                      <th className="pb-1.5 text-right font-medium">Enviadas</th>
                      <th className="pb-1.5 text-right font-medium">Proporção</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.channelVolumes.map((volume, index) => (
                      <tr key={volume.channel} className="shadow-inset-hairline">
                        <td className="py-1.5">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="size-2 rounded-[3px]"
                              style={{ backgroundColor: seriesColor(index) }}
                              aria-hidden
                            />
                            {CHANNEL_LABEL[volume.channel]}
                          </span>
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {formatNumber(volume.received)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {formatNumber(volume.sent)}
                        </td>
                        <td className="text-muted-foreground py-1.5 text-right tabular-nums">
                          {formatPercent(
                            ((volume.received + volume.sent) /
                              data.channelVolumes.reduce(
                                (total, item) => total + item.received + item.sent,
                                0,
                              )) *
                              100,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ChartFrame>
            </div>
          </Reveal>
        </TabsContent>

        {/* Comercial --------------------------------------------------- */}
        <TabsContent value="comercial" className="m-0 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Reveal index={1}>
              <StatTile
                label="Negócios criados"
                value={formatNumber(sum(dealsCreated))}
                hint={`no período de ${days} dias`}
                chart={
                  <Sparkline
                    data={dealsCreated}
                    height={40}
                    colorIndex={0}
                    formatValue={(value) => `${value} negócios`}
                  />
                }
              />
            </Reveal>
            <Reveal index={2}>
              <StatTile
                label="Receita ganha"
                value={formatCurrencyCents(sum(revenue))}
                hint={`${won.length} negócios fechados`}
                chart={
                  <Sparkline
                    data={revenue}
                    height={40}
                    colorIndex={5}
                    formatValue={(value) => formatCurrencyCents(value)}
                  />
                }
              />
            </Reveal>
            <Reveal index={3}>
              <StatTile
                label="Conversão"
                value={formatPercent(conversion)}
                hint={`${won.length} ganhos · ${lost.length} perdidos`}
                trend={{
                  direction: conversion >= 50 ? "up" : "down",
                  label: "meta 50%",
                  good: conversion >= 50,
                }}
              />
            </Reveal>
            <Reveal index={4}>
              <StatTile
                label="Em aberto"
                value={formatCurrencyCents(
                  salesDeals
                    .filter((deal) => stageById.get(deal.stageId)?.kind === "aberta")
                    .reduce((total, deal) => total + deal.amountCents, 0),
                )}
                hint="valor no funil"
              />
            </Reveal>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Reveal index={5}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <ChartFrame
                  title="Funil de vendas"
                  description="Negócios por etapa e conversão contra a etapa anterior"
                >
                  <FunnelBars stages={funnelStages} formatValue={formatNumber} />
                </ChartFrame>
              </div>
            </Reveal>

            <Reveal index={6}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <ChartFrame title="Motivos de perda" description="Negócios marcados como perdidos">
                  {lost.length === 0 ? (
                    <p className="text-muted-foreground py-6 text-center text-xs">
                      Nenhum negócio perdido no funil atual.
                    </p>
                  ) : (
                    <ul className="space-y-2.5">
                      {lost.map((deal) => (
                        <li key={deal.id} className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium">{deal.title}</span>
                            <span className="text-muted-foreground block text-[11px]">
                              {deal.lostReason ?? "sem motivo registrado"}
                            </span>
                          </span>
                          <span className="text-muted-foreground shrink-0 text-xs font-medium tabular-nums">
                            {formatCurrencyCents(deal.amountCents)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </ChartFrame>
              </div>
            </Reveal>
          </div>
        </TabsContent>

        {/* Campanhas --------------------------------------------------- */}
        <TabsContent value="campanhas" className="m-0 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Reveal index={1}>
              <StatTile
                label="Mensagens enviadas"
                value={formatNumber(campaignTotals.sent)}
                hint={`${sentCampaigns.length} campanhas disparadas`}
              />
            </Reveal>
            <Reveal index={2}>
              <StatTile
                label="Taxa de entrega"
                value={formatPercent(
                  (campaignTotals.delivered / Math.max(campaignTotals.sent, 1)) * 100,
                  1,
                )}
                hint={`${formatNumber(campaignTotals.failed)} falhas`}
                trend={{ direction: "up", label: "meta 95%", good: true }}
              />
            </Reveal>
            <Reveal index={3}>
              <StatTile
                label="Descadastros"
                value={formatNumber(campaignTotals.optOuts)}
                hint={`${formatPercent((campaignTotals.optOuts / Math.max(campaignTotals.delivered, 1)) * 100, 2)} do entregue`}
                trend={{ direction: "flat", label: "dentro do limite", good: true }}
              />
            </Reveal>
            <Reveal index={4}>
              <StatTile
                label="Custo total"
                value={formatCurrencyCents(campaignTotals.cost)}
                hint={
                  campaignTotals.delivered > 0
                    ? `${formatCurrencyCents(Math.round(campaignTotals.cost / campaignTotals.delivered), true)} por entrega`
                    : "—"
                }
              />
            </Reveal>
          </div>

          <Reveal index={5}>
            <div className="bg-card shadow-card rounded-lg p-5">
              <ChartFrame
                title="Do envio à resposta"
                description="Soma de todas as campanhas disparadas"
              >
                <FunnelBars
                  stages={[
                    { label: "Enviadas", value: campaignTotals.sent },
                    { label: "Entregues", value: campaignTotals.delivered },
                    { label: "Lidas", value: campaignTotals.read },
                    { label: "Respondidas", value: campaignTotals.replied },
                  ]}
                  formatValue={formatNumber}
                />
              </ChartFrame>
            </div>
          </Reveal>

          <Reveal index={6}>
            <div className="bg-card shadow-card rounded-lg p-5">
              <ChartFrame title="Desempenho por campanha">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground text-left text-[11px]">
                      <th className="pb-1.5 font-medium">Campanha</th>
                      <th className="pb-1.5 text-right font-medium">Enviadas</th>
                      <th className="pb-1.5 text-right font-medium">Entrega</th>
                      <th className="pb-1.5 text-right font-medium">Leitura</th>
                      <th className="pb-1.5 text-right font-medium">Resposta</th>
                      <th className="pb-1.5 text-right font-medium">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentCampaigns.map((campaign) => {
                      const { metrics } = campaign;
                      return (
                        <tr key={campaign.id} className="shadow-inset-hairline">
                          <td className="max-w-64 truncate py-2 font-medium">{campaign.name}</td>
                          <td className="py-2 text-right tabular-nums">
                            {formatNumber(metrics.sent)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatPercent((metrics.delivered / Math.max(metrics.sent, 1)) * 100)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatPercent((metrics.read / Math.max(metrics.delivered, 1)) * 100)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatPercent(
                              (metrics.replied / Math.max(metrics.delivered, 1)) * 100,
                            )}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatCurrencyCents(metrics.costCents)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ChartFrame>
            </div>
          </Reveal>
        </TabsContent>

        {/* Automação --------------------------------------------------- */}
        <TabsContent value="automacao" className="m-0 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Reveal index={1}>
              <StatTile
                label="Execuções"
                value={formatNumber(sum(automation))}
                hint={`no período de ${days} dias`}
                chart={
                  <Sparkline
                    data={automation}
                    height={40}
                    colorIndex={3}
                    formatValue={(value) => `${formatNumber(value)} execuções`}
                  />
                }
              />
            </Reveal>
            <Reveal index={2}>
              <StatTile
                label="Taxa de sucesso"
                value={formatPercent(successRate, 1)}
                hint={`${formatNumber(automationTotals.errors)} erros`}
                trend={{
                  direction: successRate >= 98 ? "up" : "down",
                  label: "SLO 98%",
                  good: successRate >= 98,
                }}
              />
            </Reveal>
            <Reveal index={3}>
              <StatTile
                label="Backlog de fila"
                value={formatNumber(automationTotals.backlog)}
                hint="itens aguardando processamento"
                trend={{
                  direction: automationTotals.backlog > 100 ? "up" : "flat",
                  label: automationTotals.backlog > 100 ? "acima do normal" : "estável",
                  good: automationTotals.backlog <= 100,
                }}
              />
            </Reveal>
            <Reveal index={4}>
              <StatTile
                label="Custo de operação"
                value={formatCurrencyCents(
                  data.costs.reduce((total, cost) => total + cost.amountCents, 0),
                )}
                hint="no mês, todos os provedores"
              />
            </Reveal>
          </div>

          <Reveal index={5}>
            <div className="bg-card shadow-card rounded-lg p-5">
              <ChartFrame
                title="Saúde das automações"
                description="Execuções, erros, retentativas e backlog por motor"
              >
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground text-left text-[11px]">
                      <th className="pb-1.5 font-medium">Automação</th>
                      <th className="pb-1.5 text-right font-medium">Execuções</th>
                      <th className="pb-1.5 text-right font-medium">Sucesso</th>
                      <th className="pb-1.5 text-right font-medium">Erros</th>
                      <th className="pb-1.5 text-right font-medium">Retentativas</th>
                      <th className="pb-1.5 text-right font-medium">Latência</th>
                      <th className="pb-1.5 text-right font-medium">Backlog</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.automationHealth.map((item) => {
                      const rate = (item.success / Math.max(item.runs, 1)) * 100;
                      return (
                        <tr key={item.label} className="shadow-inset-hairline">
                          <td className="max-w-64 truncate py-2 font-medium">{item.label}</td>
                          <td className="py-2 text-right tabular-nums">
                            {formatNumber(item.runs)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            <span className={rate >= 98 ? "text-success" : "text-warning"}>
                              {formatPercent(rate, 1)}
                            </span>
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatNumber(item.errors)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatNumber(item.retries)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {item.avgLatencySeconds}s
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {item.backlog > 0 ? (
                              <Badge variant={item.backlog > 100 ? "warning" : "neutral"}>
                                {formatNumber(item.backlog)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ChartFrame>
            </div>
          </Reveal>

          <Reveal index={6}>
            <div className="bg-card shadow-card rounded-lg p-5">
              <ChartFrame title="Custo por provedor" description="Comparado ao mês anterior">
                <ul className="space-y-3">
                  {data.costs.map((cost) => (
                    <li key={cost.label} className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{cost.label}</span>
                        <span className="text-muted-foreground block text-[11px]">{cost.unit}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[11px] font-medium tabular-nums",
                            cost.changePct > 15
                              ? "text-destructive"
                              : cost.changePct > 0
                                ? "text-warning"
                                : "text-success",
                          )}
                        >
                          {cost.changePct > 0 ? (
                            <TrendingUp className="size-3" aria-hidden />
                          ) : (
                            <TrendingDown className="size-3" aria-hidden />
                          )}
                          {cost.changePct > 0 ? "+" : ""}
                          {cost.changePct.toFixed(1).replace(".", ",")}%
                        </span>
                        <span className="figure w-24 text-right text-sm font-semibold">
                          {formatCurrencyCents(cost.amountCents)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </ChartFrame>
            </div>
          </Reveal>
        </TabsContent>

        {/* Dicionário -------------------------------------------------- */}
        <TabsContent value="dicionario" className="m-0">
          <Reveal index={1}>
            <div className="bg-card shadow-card rounded-lg p-5">
              <ChartFrame
                title="Dicionário de métricas"
                description="Nenhum número aparece em tela sem definição, fonte e dono. É isso que permite rastrear um valor até o evento de origem."
              >
                <ul className="mt-2 space-y-4">
                  {data.definitions.map((definition) => (
                    <li
                      key={definition.key}
                      className="shadow-inset-hairline pb-4 last:shadow-none"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-sm font-semibold tracking-tight">
                          {definition.label}
                        </h3>
                        <Badge variant="neutral">{definition.unit}</Badge>
                        <Tooltip content="Chave usada no catálogo de eventos e nas exportações.">
                          <code className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]">
                            {definition.key}
                          </code>
                        </Tooltip>
                      </div>
                      <p className="text-muted-foreground mt-1 max-w-3xl text-xs leading-relaxed">
                        {definition.definition}
                      </p>
                      <p className="text-muted-foreground mt-1.5 text-[11px]">
                        Fonte: <span className="font-mono">{definition.source}</span> · Dono:{" "}
                        {definition.owner}
                      </p>
                    </li>
                  ))}
                </ul>
              </ChartFrame>
            </div>
          </Reveal>
        </TabsContent>
      </Tabs>
    </div>
  );
}
