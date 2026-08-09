"use client";

import Link from "next/link";
import { useState } from "react";
import type { Campaign, ChannelAccount, MessageTemplate, Segment, User } from "@elora/core";
import {
  formatCountdown,
  formatCurrencyCents,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelative,
  TEMPLATE_STATUS_LABEL,
} from "@elora/core";
import {
  Avatar,
  Badge,
  Button,
  Callout,
  ChartFrame,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Eyebrow,
  FunnelBars,
  KeyValue,
  ProgressBar,
  Reveal,
  RevealScope,
  Sparkline,
  StatusDot,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  cn,
} from "@elora/ui";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  Gauge,
  Pause,
  Play,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { ChannelIcon } from "@/lib/channel";
import { CampaignStatusBadge } from "./campaign-status";

const BATCH_TONE = {
  pendente: "neutral",
  enviando: "accent",
  enviado: "success",
  falhou: "danger",
  cancelado: "neutral",
} as const;

export function CampaignDetail({
  campaign: initialCampaign,
  segment,
  template,
  channelAccount,
  users,
}: {
  campaign: Campaign;
  segment: Segment | null;
  template: MessageTemplate | null;
  channelAccount: ChannelAccount | null;
  users: User[];
}) {
  const [campaign, setCampaign] = useState(initialCampaign);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalNote, setApprovalNote] = useState("");

  const owner = users.find((user) => user.id === campaign.ownerId);
  const requester = users.find((user) => user.id === campaign.approval.requestedBy);
  const approver = users.find((user) => user.id === campaign.approval.approvedBy);
  const { metrics, guardrails, throttle } = campaign;

  const processed = metrics.sent + metrics.failed;
  const progress = metrics.eligible > 0 ? (processed / metrics.eligible) * 100 : 0;
  const errorRate = metrics.sent > 0 ? (metrics.failed / metrics.sent) * 100 : 0;
  const optOutRate = metrics.delivered > 0 ? (metrics.optOuts / metrics.delivered) * 100 : 0;

  const errorBreach = errorRate > guardrails.autoCancelErrorPct;
  const optOutBreach = optOutRate > guardrails.autoCancelOptOutPct;

  const funnel = [
    { label: "Elegíveis", value: metrics.eligible },
    { label: "Enviadas", value: metrics.sent },
    { label: "Entregues", value: metrics.delivered },
    { label: "Lidas", value: metrics.read },
    { label: "Respondidas", value: metrics.replied },
  ].filter((stage) => stage.value > 0 || stage.label === "Elegíveis");

  function pause() {
    setCampaign((current) => ({ ...current, status: "pausada" }));
    toast.success("Envio pausado", {
      description: `${formatNumber(metrics.queued)} mensagens ainda não enviadas foram retiradas da fila.`,
    });
  }

  function resume() {
    setCampaign((current) => ({ ...current, status: "enviando" }));
    toast.success("Envio retomado", { description: "Os lotes pendentes voltaram para a fila." });
  }

  function cancel() {
    setCampaign((current) => ({ ...current, status: "cancelada" }));
    toast.success("Campanha cancelada", {
      description: "Lotes ainda não enviados foram descartados. O que já saiu não é revertido.",
    });
  }

  function approve() {
    setCampaign((current) => ({
      ...current,
      status: "agendada",
      approval: {
        ...current.approval,
        approvedBy: "usr_marina",
        approvedAt: new Date().toISOString(),
        note: approvalNote || current.approval.note,
      },
    }));
    setApprovalOpen(false);
    toast.success("Campanha aprovada", {
      description: "O disparo entra na janela agendada. A aprovação fica registrada na auditoria.",
    });
  }

  return (
    <RevealScope>
      <div className="mx-auto w-full max-w-[86rem] px-5 py-6">
        {/* Cabeçalho */}
        <Reveal index={0} as="header" className="mb-5">
          <Button asChild variant="ghost" size="xs" className="-ml-2 mb-2">
            <Link href="/campanhas">
              <ArrowLeft />
              Voltar para campanhas
            </Link>
          </Button>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ChannelIcon kind={campaign.channel} withBackground />
                <h1 className="font-display text-xl font-semibold tracking-tight">
                  {campaign.name}
                </h1>
                <CampaignStatusBadge status={campaign.status} />
              </div>
              <p className="text-muted-foreground mt-1 max-w-2xl text-sm">{campaign.objective}</p>
              <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                {owner ? (
                  <span className="flex items-center gap-1.5">
                    <Avatar initials={owner.initials} hue={owner.accentHue} size="xs" />
                    {owner.name}
                  </span>
                ) : null}
                <span>{channelAccount?.label}</span>
                <span>
                  UTM: {campaign.utm.source} / {campaign.utm.medium} / {campaign.utm.campaign}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {campaign.status === "em_aprovacao" ? (
                <Button size="sm" onClick={() => setApprovalOpen(true)}>
                  <ShieldCheck />
                  Revisar e aprovar
                </Button>
              ) : null}
              {campaign.status === "enviando" ? (
                <>
                  <Button variant="outline" size="sm" onClick={pause}>
                    <Pause />
                    Pausar
                  </Button>
                  <Button variant="danger" size="sm" onClick={cancel}>
                    <Ban />
                    Cancelar
                  </Button>
                </>
              ) : null}
              {campaign.status === "pausada" ? (
                <Button size="sm" onClick={resume}>
                  <Play />
                  Retomar
                </Button>
              ) : null}
              {campaign.status === "rascunho" ? (
                <Button
                  size="sm"
                  onClick={() =>
                    toast.info("Envio de teste primeiro", {
                      description:
                        "A política exige teste para a lista interna antes de liberar o disparo em produção.",
                    })
                  }
                >
                  <Send />
                  Enviar teste interno
                </Button>
              ) : null}
            </div>
          </div>
        </Reveal>

        {/* Alertas de guardrail */}
        {errorBreach || optOutBreach ? (
          <Reveal index={1} className="mb-4">
            <Callout variant="danger" icon={<AlertTriangle />} title="Limite de proteção atingido">
              {errorBreach
                ? `Taxa de erro em ${formatPercent(errorRate, 1)}, acima do limite de ${formatPercent(guardrails.autoCancelErrorPct)} configurado. `
                : ""}
              {optOutBreach
                ? `Taxa de descadastro em ${formatPercent(optOutRate, 1)}, acima do limite de ${formatPercent(guardrails.autoCancelOptOutPct)}. `
                : ""}
              O cancelamento automático dispara se a tendência continuar.
            </Callout>
          </Reveal>
        ) : null}

        {/* Progresso */}
        {campaign.status === "enviando" || campaign.status === "pausada" ? (
          <Reveal index={2} className="mb-4">
            <div className="bg-card shadow-card rounded-lg p-5">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="figure text-2xl font-semibold">{formatNumber(processed)}</span>
                  <span className="text-muted-foreground text-sm">
                    de {formatNumber(metrics.eligible)} processadas
                  </span>
                </div>
                <span className="text-muted-foreground text-xs">
                  {formatNumber(metrics.queued)} na fila · lotes de {throttle.batchSize} a cada{" "}
                  {throttle.intervalMinutes} min · teto de {formatNumber(throttle.maxPerHour)}/h
                </span>
              </div>
              <ProgressBar
                value={progress}
                tone={campaign.status === "pausada" ? "warning" : "accent"}
                label="Progresso do envio"
              />
            </div>
          </Reveal>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          {/* Coluna principal */}
          <div className="flex min-w-0 flex-col gap-4">
            <Reveal index={3}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <Tabs defaultValue="resultado">
                  <TabsList className="mb-4">
                    <TabsTrigger value="resultado">Resultado</TabsTrigger>
                    <TabsTrigger value="lotes">
                      Lotes
                      {campaign.batches.length > 0 ? (
                        <Badge variant="neutral">{campaign.batches.length}</Badge>
                      ) : null}
                    </TabsTrigger>
                    {campaign.variants?.length ? (
                      <TabsTrigger value="variantes">Teste A/B</TabsTrigger>
                    ) : null}
                  </TabsList>

                  <TabsContent value="resultado" className="m-0">
                    {metrics.sent === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-sm font-medium">Ainda não disparada</p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          Os números aparecem aqui assim que o primeiro lote sair.
                        </p>
                      </div>
                    ) : (
                      <>
                        <ChartFrame
                          title="Do público à resposta"
                          description="Cada etapa mostra a conversão contra a anterior"
                        >
                          <FunnelBars stages={funnel} formatValue={formatNumber} />
                        </ChartFrame>

                        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                          <div>
                            <dt className="text-muted-foreground text-[11px]">Falhas</dt>
                            <dd
                              className={cn(
                                "figure text-lg font-semibold",
                                errorBreach ? "text-destructive" : "text-foreground",
                              )}
                            >
                              {formatNumber(metrics.failed)}
                            </dd>
                            <dd className="text-muted-foreground text-[11px]">
                              {formatPercent(errorRate, 1)} do enviado
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground text-[11px]">Descadastros</dt>
                            <dd className="figure text-lg font-semibold">
                              {formatNumber(metrics.optOuts)}
                            </dd>
                            <dd className="text-muted-foreground text-[11px]">
                              {formatPercent(optOutRate, 1)} do entregue
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground text-[11px]">Conversões</dt>
                            <dd className="figure text-success text-lg font-semibold">
                              {formatNumber(metrics.converted)}
                            </dd>
                            <dd className="text-muted-foreground text-[11px]">negócios criados</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground text-[11px]">Custo</dt>
                            <dd className="figure text-lg font-semibold">
                              {formatCurrencyCents(metrics.costCents)}
                            </dd>
                            <dd className="text-muted-foreground text-[11px]">
                              {metrics.delivered > 0
                                ? `${formatCurrencyCents(Math.round(metrics.costCents / metrics.delivered), true)} por entrega`
                                : "—"}
                            </dd>
                          </div>
                        </dl>

                        {campaign.deliveryTimeline?.length ? (
                          <div className="mt-5">
                            <ChartFrame title="Entregas ao longo do envio">
                              <Sparkline
                                data={campaign.deliveryTimeline}
                                height={56}
                                colorIndex={0}
                                formatValue={(value) => `${formatNumber(value)} entregas`}
                              />
                            </ChartFrame>
                          </div>
                        ) : null}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="lotes" className="m-0">
                    {campaign.batches.length === 0 ? (
                      <p className="text-muted-foreground py-8 text-center text-xs">
                        Os lotes são criados quando o disparo começa. O tamanho vem da configuração
                        de velocidade.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {campaign.batches.map((batch) => (
                          <li
                            key={batch.id}
                            className="bg-muted/50 flex items-center gap-3 rounded-lg px-3 py-2.5"
                          >
                            <span className="figure text-muted-foreground w-8 shrink-0 text-xs font-semibold">
                              #{batch.index}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-medium">
                                {formatNumber(batch.size)} mensagens
                              </span>
                              <span className="text-muted-foreground block text-[11px]">
                                {batch.sentAt
                                  ? `enviado ${formatRelative(batch.sentAt)}`
                                  : `previsto ${formatCountdown(batch.scheduledAt)}`}
                                {batch.failed ? ` · ${batch.failed} falhas` : ""}
                              </span>
                            </span>
                            <Badge variant={BATCH_TONE[batch.status]}>
                              <StatusDot
                                tone={
                                  batch.status === "enviado"
                                    ? "success"
                                    : batch.status === "enviando"
                                      ? "accent"
                                      : batch.status === "falhou"
                                        ? "danger"
                                        : "neutral"
                                }
                                pulse={batch.status === "enviando"}
                              />
                              {batch.status}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TabsContent>

                  {campaign.variants?.length ? (
                    <TabsContent value="variantes" className="m-0">
                      <ul className="space-y-3">
                        {campaign.variants.map((variant, index) => {
                          const variantMetrics = variant.metrics;
                          const replyRate =
                            variantMetrics && variantMetrics.delivered > 0
                              ? (variantMetrics.replied / variantMetrics.delivered) * 100
                              : 0;
                          const best =
                            campaign.variants!.every(
                              (other) =>
                                !other.metrics ||
                                !variantMetrics ||
                                variantMetrics.replied / Math.max(variantMetrics.delivered, 1) >=
                                  other.metrics.replied / Math.max(other.metrics.delivered, 1),
                            ) && Boolean(variantMetrics);

                          return (
                            <li key={variant.id} className="bg-muted/50 rounded-lg p-4">
                              <div className="flex items-center gap-2">
                                <span
                                  className="size-2.5 shrink-0 rounded-[3px]"
                                  style={{ backgroundColor: `hsl(var(--chart-${index + 1}))` }}
                                  aria-hidden
                                />
                                <p className="text-xs font-semibold">{variant.label}</p>
                                <Badge variant="neutral">
                                  {formatPercent(variant.sharePct)} do público
                                </Badge>
                                {best ? (
                                  <Badge variant="success">
                                    <CheckCircle2 aria-hidden />
                                    melhor resposta
                                  </Badge>
                                ) : null}
                              </div>

                              {variantMetrics ? (
                                <dl className="mt-3 grid grid-cols-4 gap-3 text-center">
                                  <div>
                                    <dt className="text-muted-foreground text-[10px] uppercase">
                                      Enviadas
                                    </dt>
                                    <dd className="figure text-sm font-semibold">
                                      {formatNumber(variantMetrics.sent)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-foreground text-[10px] uppercase">
                                      Lidas
                                    </dt>
                                    <dd className="figure text-sm font-semibold">
                                      {formatNumber(variantMetrics.read)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-foreground text-[10px] uppercase">
                                      Respostas
                                    </dt>
                                    <dd className="figure text-sm font-semibold">
                                      {formatNumber(variantMetrics.replied)}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-foreground text-[10px] uppercase">
                                      Taxa
                                    </dt>
                                    <dd className="figure text-sm font-semibold">
                                      {formatPercent(replyRate, 1)}
                                    </dd>
                                  </div>
                                </dl>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </TabsContent>
                  ) : null}
                </Tabs>
              </div>
            </Reveal>

            {/* Público */}
            <Reveal index={4}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <div className="flex items-start gap-2">
                  <Users className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-sm font-semibold tracking-tight">
                      {segment?.name ?? "Sem segmento"}
                    </h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">{segment?.description}</p>
                  </div>
                  {segment ? (
                    <Badge variant={segment.dynamic ? "info" : "neutral"}>
                      {segment.dynamic ? "recalculado no disparo" : "lista estática"}
                    </Badge>
                  ) : null}
                </div>

                {segment ? (
                  <>
                    <div className="mt-4 grid grid-cols-3 gap-4">
                      <div>
                        <p className="figure text-xl font-semibold leading-none">
                          {formatNumber(segment.estimatedSize)}
                        </p>
                        <p className="text-muted-foreground mt-1 text-[11px]">no segmento</p>
                      </div>
                      <div>
                        <p className="figure text-success text-xl font-semibold leading-none">
                          {formatNumber(segment.eligibleSize)}
                        </p>
                        <p className="text-muted-foreground mt-1 text-[11px]">elegíveis</p>
                      </div>
                      <div>
                        <p className="figure text-warning text-xl font-semibold leading-none">
                          {formatNumber(segment.estimatedSize - segment.eligibleSize)}
                        </p>
                        <p className="text-muted-foreground mt-1 text-[11px]">excluídos</p>
                      </div>
                    </div>

                    {segment.exclusions.length > 0 ? (
                      <>
                        <Eyebrow className="mb-2 mt-5">Por que foram excluídos</Eyebrow>
                        <ul className="space-y-1">
                          {segment.exclusions.map((exclusion) => (
                            <li
                              key={exclusion.reason}
                              className="flex items-center justify-between gap-3 text-xs"
                            >
                              <span className="text-muted-foreground truncate">
                                {exclusion.reason}
                              </span>
                              <span className="shrink-0 font-medium tabular-nums">
                                {formatNumber(exclusion.count)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
                          A prévia de elegíveis e excluídos é obrigatória antes de liberar qualquer
                          disparo.
                        </p>
                      </>
                    ) : null}

                    <Eyebrow className="mb-2 mt-5">Regras</Eyebrow>
                    <div className="space-y-2">
                      {segment.groups.map((group, groupIndex) => (
                        <div key={group.id} className="bg-muted/50 rounded-lg p-3">
                          <p className="text-muted-foreground mb-1.5 text-[11px] font-medium">
                            {groupIndex > 0 ? `E também · ` : ""}
                            {group.match === "todas" ? "Todas as condições" : "Qualquer condição"}
                          </p>
                          <ul className="space-y-1">
                            {group.rules.map((rule) => (
                              <li key={rule.id} className="text-xs">
                                <span className="font-medium">{rule.fieldLabel}</span>{" "}
                                <span className="text-muted-foreground">
                                  {rule.operator.replace(/_/g, " ")}
                                </span>{" "}
                                <span className="font-medium">{rule.value}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </Reveal>
          </div>

          {/* Coluna lateral */}
          <div className="flex min-w-0 flex-col gap-4">
            {/* Aprovação */}
            <Reveal index={5}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <h2 className="font-display mb-3 text-sm font-semibold tracking-tight">
                  Aprovação
                </h2>
                {campaign.approval.required ? (
                  <dl>
                    <KeyValue
                      label="Exigida acima de"
                      value={`${formatNumber(campaign.approval.thresholdAudience)} contatos`}
                    />
                    {requester ? <KeyValue label="Solicitada por" value={requester.name} /> : null}
                    {campaign.approval.requestedAt ? (
                      <KeyValue label="Em" value={formatDateTime(campaign.approval.requestedAt)} />
                    ) : null}
                    {approver ? (
                      <KeyValue
                        label="Aprovada por"
                        value={
                          <span className="inline-flex items-center gap-1.5">
                            <CheckCircle2 className="text-success size-3" aria-hidden />
                            {approver.name}
                          </span>
                        }
                      />
                    ) : (
                      <KeyValue
                        label="Situação"
                        value={<span className="text-warning">aguardando revisão</span>}
                      />
                    )}
                    {campaign.approval.note ? (
                      <p className="bg-muted/60 text-muted-foreground mt-2 rounded-md px-2.5 py-2 text-[11px] leading-relaxed">
                        {campaign.approval.note}
                      </p>
                    ) : null}
                  </dl>
                ) : (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Público abaixo do limite de aprovação. O disparo pode ser liberado pelo próprio
                    responsável.
                  </p>
                )}
              </div>
            </Reveal>

            {/* Proteções */}
            <Reveal index={6}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="text-success size-4" aria-hidden />
                  <h2 className="font-display text-sm font-semibold tracking-tight">Proteções</h2>
                </div>

                <ul className="space-y-2.5">
                  {[
                    {
                      label: "Exigir consentimento de marketing",
                      on: guardrails.requireConsent,
                      hint: "Contatos sem consentimento são excluídos antes da fila.",
                    },
                    {
                      label: "Respeitar lista de supressão",
                      on: guardrails.respectSuppressionList,
                      hint: "Descadastros e bloqueios nunca entram no público.",
                    },
                  ].map((item) => (
                    <li key={item.label} className="flex items-start gap-3">
                      <Switch
                        checked={item.on}
                        disabled
                        className="mt-0.5"
                        aria-label={item.label}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium">{item.label}</span>
                        <span className="text-muted-foreground block text-[11px] leading-relaxed">
                          {item.hint}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-4">
                  <KeyValue
                    label="Janela de envio"
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="text-muted-foreground size-3" aria-hidden />
                        {guardrails.quietHoursStart}h às {guardrails.quietHoursEnd}h
                      </span>
                    }
                  />
                  <KeyValue
                    label="Frequência máxima"
                    value={`1 a cada ${guardrails.frequencyCapDays} dias`}
                  />
                  <KeyValue
                    label="Cancelar se erro passar de"
                    value={formatPercent(guardrails.autoCancelErrorPct)}
                  />
                  <KeyValue
                    label="Cancelar se opt-out passar de"
                    value={formatPercent(guardrails.autoCancelOptOutPct)}
                  />
                </dl>
              </div>
            </Reveal>

            {/* Velocidade */}
            <Reveal index={7}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Gauge className="text-muted-foreground size-4" aria-hidden />
                  <h2 className="font-display text-sm font-semibold tracking-tight">Velocidade</h2>
                </div>
                <dl>
                  <KeyValue label="Tamanho do lote" value={`${throttle.batchSize} mensagens`} />
                  <KeyValue
                    label="Intervalo entre lotes"
                    value={`${throttle.intervalMinutes} minutos`}
                  />
                  <KeyValue label="Teto por hora" value={formatNumber(throttle.maxPerHour)} />
                  {channelAccount ? (
                    <KeyValue
                      label="Número"
                      value={
                        <Tooltip
                          content={`Qualidade ${channelAccount.qualityRating ?? "não informada"}`}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <StatusDot
                              tone={channelAccount.status === "conectado" ? "success" : "warning"}
                            />
                            {channelAccount.label}
                          </span>
                        </Tooltip>
                      }
                    />
                  ) : null}
                </dl>
                <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
                  Velocidade alta derruba a qualidade do número. A reputação é um ativo do negócio,
                  não um parâmetro técnico.
                </p>
              </div>
            </Reveal>

            {/* Template */}
            {template ? (
              <Reveal index={8}>
                <div className="bg-card shadow-card rounded-lg p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <h2 className="min-w-0 flex-1 truncate font-mono text-xs font-semibold">
                      {template.name}
                    </h2>
                    <Badge
                      variant={
                        template.status === "aprovado"
                          ? "success"
                          : template.status === "rejeitado"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {TEMPLATE_STATUS_LABEL[template.status]}
                    </Badge>
                  </div>

                  <div className="bg-muted/60 rounded-lg p-3">
                    {template.headerText ? (
                      <p className="mb-1.5 text-xs font-semibold">{template.headerText}</p>
                    ) : null}
                    <p className="whitespace-pre-wrap text-xs leading-relaxed">{template.body}</p>
                    {template.footerText ? (
                      <p className="text-muted-foreground mt-2 text-[10px]">
                        {template.footerText}
                      </p>
                    ) : null}
                    {template.buttons?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {template.buttons.map((button) => (
                          <span
                            key={button}
                            className="bg-card text-primary shadow-card rounded-md px-2 py-1 text-[11px] font-medium"
                          >
                            {button}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {template.rejectionReason ? (
                    <p className="bg-destructive-soft text-destructive mt-3 rounded-md px-2.5 py-2 text-[11px] leading-relaxed">
                      {template.rejectionReason}
                    </p>
                  ) : null}
                </div>
              </Reveal>
            ) : null}
          </div>
        </div>

        {/* Aprovação */}
        <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aprovar &ldquo;{campaign.name}&rdquo;</DialogTitle>
              <DialogDescription>
                A aprovação libera o disparo para {formatNumber(metrics.eligible)} contatos
                elegíveis e fica registrada na auditoria com autor e horário.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 p-5">
              <dl>
                <KeyValue label="Público elegível" value={formatNumber(metrics.eligible)} />
                <KeyValue label="Excluídos" value={formatNumber(metrics.excluded)} />
                <KeyValue label="Template" value={template?.name ?? "—"} />
                <KeyValue
                  label="Janela"
                  value={`${guardrails.quietHoursStart}h às ${guardrails.quietHoursEnd}h`}
                />
                <KeyValue
                  label="Custo estimado"
                  value={formatCurrencyCents(metrics.eligible * 74)}
                />
              </dl>

              <div className="space-y-1.5">
                <label
                  htmlFor="approval-note"
                  className="text-muted-foreground text-xs font-medium"
                >
                  Observação da aprovação
                </label>
                <Textarea
                  id="approval-note"
                  value={approvalNote}
                  onChange={(event) => setApprovalNote(event.target.value)}
                  placeholder="Condições, restrições de horário ou o que precisa ser observado no disparo."
                  className="min-h-20 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setApprovalOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={approve}>
                <ShieldCheck />
                Aprovar disparo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RevealScope>
  );
}
