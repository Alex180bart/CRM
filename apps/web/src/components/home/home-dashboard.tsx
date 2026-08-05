"use client";

import Link from "next/link";
import type {
  AttentionItem,
  ChannelVolume,
  Conversation,
  Deal,
  Pipeline,
  TimePoint,
  User,
} from "@crm/core";
import {
  CHANNEL_LABEL,
  formatCurrencyCents,
  formatDuration,
  formatNumber,
  formatPercent,
} from "@crm/core";
import {
  AnimatedNumber,
  Badge,
  Button,
  ChartFrame,
  FunnelBars,
  Reveal,
  ShareBar,
  Sparkline,
  Tooltip,
  cn,
} from "@crm/ui";
import {
  ArrowUpRight,
  Bot,
  Briefcase,
  Megaphone,
  MessageSquare,
  Sparkles,
  Timer,
} from "lucide-react";

import { AttentionQueue } from "./attention-queue";
import { DayPulse } from "./day-pulse";

export interface HomeData {
  currentUser: User;
  attention: AttentionItem[];
  pulse: TimePoint[];
  currentHour: number;
  conversationsSeries: TimePoint[];
  firstResponseSeries: TimePoint[];
  dealsSeries: TimePoint[];
  revenueSeries: TimePoint[];
  automationSeries: TimePoint[];
  channelVolumes: ChannelVolume[];
  conversations: Conversation[];
  deals: Deal[];
  pipelines: Pipeline[];
}

/** Cartão de domínio: um número grande, a série do período e um caminho. */
function DomainCard({
  index,
  title,
  href,
  icon,
  value,
  hint,
  change,
  changeGood,
  children,
}: {
  index: number;
  title: string;
  href: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  hint: string;
  change?: string;
  changeGood?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Reveal index={index} className="min-w-0">
      <Link
        href={href}
        className="lift press bg-card shadow-card focus-visible:ring-accent group flex h-full flex-col rounded-lg p-5 focus-visible:outline-none focus-visible:ring-2"
      >
        <div className="flex items-center gap-2">
          <span className="bg-primary-soft text-primary flex size-7 items-center justify-center rounded-lg [&_svg]:size-4">
            {icon}
          </span>
          <h3 className="font-display text-sm font-semibold tracking-tight">{title}</h3>
          <ArrowUpRight className="text-muted-foreground ml-auto size-4 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        <p className="figure mt-3 text-3xl font-semibold leading-none">{value}</p>

        <div className="mt-1.5 flex items-baseline gap-2">
          {change ? (
            <span
              className={cn(
                "text-[11px] font-medium tabular-nums",
                changeGood ? "text-success" : "text-destructive",
              )}
            >
              {change}
            </span>
          ) : null}
          <span className="text-muted-foreground truncate text-[11px]">{hint}</span>
        </div>

        {children ? <div className="mt-4">{children}</div> : null}
      </Link>
    </Reveal>
  );
}

export function HomeDashboard(data: HomeData) {
  const firstName = data.currentUser.name.split(" ")[0] ?? data.currentUser.name;

  const openConversations = data.conversations.filter(
    (conversation) => conversation.state !== "resolvida" && conversation.state !== "encerrada",
  );
  const atRisk = data.conversations.filter(
    (conversation) =>
      conversation.slaStatus === "estourado" || conversation.slaStatus === "atencao",
  );

  const pulseTotal = data.pulse.reduce((sum, point) => sum + point.value, 0);

  const lastFirstResponse =
    data.firstResponseSeries[data.firstResponseSeries.length - 1]?.value ?? 0;
  const previousFirstResponse =
    data.firstResponseSeries[data.firstResponseSeries.length - 2]?.value ?? 0;
  const responseChange = previousFirstResponse
    ? ((lastFirstResponse - previousFirstResponse) / previousFirstResponse) * 100
    : 0;

  const salesPipeline =
    data.pipelines.find((pipeline) => pipeline.id === "pipe_vendas") ?? data.pipelines[0];
  const stageById = new Map((salesPipeline?.stages ?? []).map((stage) => [stage.id, stage]));
  const salesDeals = data.deals.filter((deal) => deal.pipelineId === salesPipeline?.id);

  const openDeals = salesDeals.filter((deal) => stageById.get(deal.stageId)?.kind === "aberta");
  const openValue = openDeals.reduce((sum, deal) => sum + deal.amountCents, 0);

  const funnelStages = (salesPipeline?.stages ?? [])
    .filter((stage) => stage.kind === "aberta")
    .map((stage) => ({
      label: stage.name,
      value: salesDeals.filter((deal) => deal.stageId === stage.id).length,
      hint: `${stage.probability}% de probabilidade`,
    }));

  const automationTotal = data.automationSeries[data.automationSeries.length - 1]?.value ?? 0;

  const channelSegments = data.channelVolumes.map((volume, index) => ({
    label: CHANNEL_LABEL[volume.channel],
    value: volume.received + volume.sent,
    colorIndex: index,
  }));

  return (
    <div className="mx-auto w-full max-w-[86rem] px-5 py-6">
      {/* Saudação */}
      <Reveal index={0} as="section" className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              Segunda-feira, 3 de agosto
            </p>
            <h1 className="font-display text-foreground mt-1 text-2xl font-semibold tracking-tight">
              Bom dia, {firstName}.
            </h1>
            <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">
              {atRisk.length > 0 ? (
                <>
                  Há{" "}
                  <strong className="text-foreground font-semibold">
                    {atRisk.length} conversas
                  </strong>{" "}
                  com SLA em risco e {openConversations.length} abertas nas quatro filas.
                </>
              ) : (
                <>
                  Nenhuma conversa com SLA em risco. {openConversations.length} abertas nas quatro
                  filas.
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/analytics">Ver analytics</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/inbox">
                Abrir o inbox
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </div>
      </Reveal>

      {/* Fila de atenção + pulso */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Reveal index={1} className="min-w-0">
          <AttentionQueue items={data.attention} />
        </Reveal>

        <div className="flex min-w-0 flex-col gap-4">
          <Reveal index={2}>
            <DayPulse data={data.pulse} currentHour={data.currentHour} total={pulseTotal} />
          </Reveal>

          <Reveal index={3}>
            <div className="bg-card shadow-card rounded-lg p-5">
              <ChartFrame
                title="De onde vêm as conversas"
                description="Recebidas e enviadas nos últimos 30 dias"
              >
                <ShareBar segments={channelSegments} />
              </ChartFrame>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Cartões de domínio */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DomainCard
          index={4}
          title="Atendimento"
          href="/inbox"
          icon={<MessageSquare />}
          value={<AnimatedNumber value={openConversations.length} />}
          hint="conversas abertas"
          change={`${atRisk.length} em risco`}
          changeGood={atRisk.length === 0}
        >
          <ChartFrame>
            <Sparkline
              data={data.conversationsSeries}
              height={48}
              colorIndex={0}
              formatValue={(value) => `${value} conversas`}
            />
          </ChartFrame>
        </DomainCard>

        <DomainCard
          index={5}
          title="Tempo de resposta"
          href="/analytics"
          icon={<Timer />}
          value={<AnimatedNumber value={lastFirstResponse} format={(v) => formatDuration(v)} />}
          hint="mediana da primeira resposta"
          change={`${responseChange > 0 ? "↑" : "↓"} ${Math.abs(responseChange).toFixed(0)}% vs ontem`}
          changeGood={responseChange <= 0}
        >
          <ChartFrame>
            <Sparkline
              data={data.firstResponseSeries}
              height={48}
              colorIndex={2}
              formatValue={(value) => formatDuration(value)}
            />
          </ChartFrame>
        </DomainCard>

        <DomainCard
          index={6}
          title="Funil comercial"
          href="/pipeline"
          icon={<Briefcase />}
          value={
            <AnimatedNumber value={openValue} format={(value) => formatCurrencyCents(value)} />
          }
          hint={`${openDeals.length} negócios em aberto`}
        >
          <FunnelBars stages={funnelStages} formatValue={(value) => `${value}`} />
        </DomainCard>

        <DomainCard
          index={7}
          title="Automação"
          href="/jornadas"
          icon={<Bot />}
          value={<AnimatedNumber value={automationTotal} format={formatNumber} />}
          hint="execuções ontem"
          change="98,2% de sucesso"
          changeGood
        >
          <ChartFrame>
            <Sparkline
              data={data.automationSeries}
              height={48}
              colorIndex={3}
              formatValue={(value) => `${formatNumber(value)} execuções`}
            />
          </ChartFrame>
        </DomainCard>
      </div>

      {/* Atalhos */}
      <Reveal index={8} as="section" className="mt-6">
        <div className="bg-card shadow-card flex flex-wrap items-center gap-2 rounded-lg p-4">
          <span className="text-muted-foreground mr-1 flex items-center gap-1.5 text-xs font-medium">
            <Sparkles className="text-accent size-3.5" aria-hidden />
            Começar algo
          </span>

          {[
            { href: "/campanhas", label: "Nova campanha", icon: Megaphone },
            { href: "/chatbots", label: "Editar chatbot", icon: Bot },
            { href: "/contatos", label: "Buscar contato", icon: MessageSquare },
            { href: "/pipeline", label: "Registrar negócio", icon: Briefcase },
          ].map((shortcut) => {
            const Icon = shortcut.icon;
            return (
              <Button key={shortcut.href} asChild variant="subtle" size="sm">
                <Link href={shortcut.href}>
                  <Icon />
                  {shortcut.label}
                </Link>
              </Button>
            );
          })}

          <Tooltip content="Os módulos restantes entram nas fases 5 e 6 do roadmap.">
            <Badge variant="neutral" className="ml-auto">
              {formatPercent(70)} do MVP construído
            </Badge>
          </Tooltip>
        </div>
      </Reveal>
    </div>
  );
}
