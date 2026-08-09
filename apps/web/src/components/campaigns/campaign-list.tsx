"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  Campaign,
  CampaignStatus,
  MessageTemplate,
  Segment,
  TemplateStatus,
  User,
} from "@elora/core";
import {
  CAMPAIGN_STATUS_LABEL,
  formatCountdown,
  formatCurrencyCents,
  formatNumber,
  formatPercent,
  formatRelative,
  SEGMENT_OPERATOR_LABEL,
  TEMPLATE_STATUS_LABEL,
} from "@elora/core";
import {
  Avatar,
  Badge,
  Button,
  ChartLegend,
  EmptyState,
  Eyebrow,
  ProgressBar,
  Reveal,
  RevealScope,
  SearchInput,
  StatTile,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  cn,
  seriesColor,
} from "@elora/ui";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Coins,
  Eye,
  Filter,
  Megaphone,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";

import { ChannelIcon } from "@/lib/channel";
import { IncomingBubble } from "@/components/shared/phone-frame";
import { CampaignStatusBadge } from "./campaign-status";

const STATUS_FILTERS: Array<CampaignStatus | "todas"> = [
  "todas",
  "enviando",
  "em_aprovacao",
  "agendada",
  "concluida",
  "rascunho",
];

const TEMPLATE_STATUS_FILTERS: Array<TemplateStatus | "todos"> = [
  "todos",
  "aprovado",
  "em_analise",
  "rejeitado",
  "pausado",
];

/**
 * Filtro em pílulas.
 *
 * Um `select` esconde quantos itens caem em cada opção; a pílula mostra a
 * contagem junto do rótulo, então dá para decidir antes de clicar. É o mesmo
 * controle nas três abas, o que dispensa reaprender a filtrar a cada troca.
 */
function PillFilter<T extends string>({
  options,
  value,
  onChange,
  countOf,
  labelOf,
  hideEmpty,
}: {
  options: T[];
  value: T;
  onChange: (next: T) => void;
  countOf: (option: T) => number;
  labelOf: (option: T) => string;
  hideEmpty?: T[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {options.map((option) => {
        const count = countOf(option);
        if (hideEmpty?.includes(option) && count === 0) return null;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={cn(
              "h-8 rounded-md px-2.5 text-xs font-medium transition-colors",
              value === option
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {labelOf(option)}
            <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CampaignList({
  campaigns,
  segments,
  templates,
  users,
}: {
  campaigns: Campaign[];
  segments: Segment[];
  templates: MessageTemplate[];
  users: User[];
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CampaignStatus | "todas">("todas");
  const [segmentSearch, setSegmentSearch] = useState("");
  const [templateStatus, setTemplateStatus] = useState<TemplateStatus | "todos">("todos");
  const [templateSearch, setTemplateSearch] = useState("");

  const segmentById = useMemo(() => new Map(segments.map((item) => [item.id, item])), [segments]);
  const templateById = useMemo(
    () => new Map(templates.map((item) => [item.id, item])),
    [templates],
  );
  const userById = useMemo(() => new Map(users.map((item) => [item.id, item])), [users]);

  const filtered = campaigns.filter((campaign) => {
    if (status !== "todas" && campaign.status !== status) return false;
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      const haystack = [
        campaign.name,
        campaign.objective,
        segmentById.get(campaign.segmentId)?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const campaign of campaigns) map.set(campaign.status, (map.get(campaign.status) ?? 0) + 1);
    return map;
  }, [campaigns]);

  const awaitingApproval = campaigns.filter((campaign) => campaign.status === "em_aprovacao");

  /**
   * Somatório das campanhas que já saíram. Rascunho e agendada ficam de fora:
   * misturar o que ainda não foi enviado com o que foi enviado torna a taxa de
   * entrega ilegível.
   */
  const totals = useMemo(() => {
    const dispatched = campaigns.filter((campaign) => campaign.metrics.sent > 0);
    return dispatched.reduce(
      (acc, campaign) => ({
        sent: acc.sent + campaign.metrics.sent,
        delivered: acc.delivered + campaign.metrics.delivered,
        read: acc.read + campaign.metrics.read,
        cost: acc.cost + campaign.metrics.costCents,
        excluded: acc.excluded + campaign.metrics.excluded,
      }),
      { sent: 0, delivered: 0, read: 0, cost: 0, excluded: 0 },
    );
  }, [campaigns]);

  const filteredSegments = segments.filter((segment) =>
    segmentSearch.trim()
      ? `${segment.name} ${segment.description}`
          .toLowerCase()
          .includes(segmentSearch.trim().toLowerCase())
      : true,
  );

  const templateCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const template of templates) {
      map.set(template.status, (map.get(template.status) ?? 0) + 1);
    }
    return map;
  }, [templates]);

  const filteredTemplates = templates.filter((template) => {
    if (templateStatus !== "todos" && template.status !== templateStatus) return false;
    if (templateSearch.trim()) {
      const term = templateSearch.trim().toLowerCase();
      if (!`${template.name} ${template.body}`.toLowerCase().includes(term)) return false;
    }
    return true;
  });

  return (
    <RevealScope>
      <div className="mx-auto w-full max-w-[86rem] px-5 py-6">
        <Tabs defaultValue="campanhas">
          <TabsList className="mb-5">
            <TabsTrigger value="campanhas">
              Campanhas
              <Badge variant="neutral">{campaigns.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="segmentos">
              Segmentos
              <Badge variant="neutral">{segments.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="templates">
              Templates
              <Badge variant="neutral">{templates.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Campanhas ---------------------------------------------------- */}
          <TabsContent value="campanhas" className="m-0">
            {totals.sent > 0 ? (
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Reveal index={0}>
                  <StatTile
                    label="Mensagens enviadas"
                    value={formatNumber(totals.sent)}
                    hint={`${formatNumber(totals.excluded)} contatos excluídos por consentimento`}
                    icon={<Send />}
                  />
                </Reveal>
                <Reveal index={1}>
                  <StatTile
                    label="Entrega"
                    value={formatPercent((totals.delivered / totals.sent) * 100, 1)}
                    trend={{
                      direction: totals.delivered / totals.sent > 0.95 ? "up" : "down",
                      label: `${formatNumber(totals.sent - totals.delivered)} não entregues`,
                      good: totals.delivered / totals.sent > 0.95,
                    }}
                  />
                </Reveal>
                <Reveal index={2}>
                  <StatTile
                    label="Leitura"
                    value={formatPercent((totals.read / Math.max(totals.delivered, 1)) * 100, 1)}
                    hint="sobre o que foi entregue"
                    icon={<Eye />}
                  />
                </Reveal>
                <Reveal index={3}>
                  <StatTile
                    label="Custo acumulado"
                    value={formatCurrencyCents(totals.cost)}
                    hint={`${formatCurrencyCents(Math.round(totals.cost / totals.sent), true)} por mensagem`}
                    icon={<Coins />}
                  />
                </Reveal>
              </div>
            ) : null}

            {awaitingApproval.length > 0 ? (
              <Reveal index={0} className="mb-4">
                <div className="bg-warning-soft flex flex-wrap items-center gap-3 rounded-lg p-4">
                  <ShieldCheck className="text-warning size-4 shrink-0" aria-hidden />
                  <p className="text-foreground min-w-0 flex-1 text-xs leading-relaxed">
                    <strong className="font-semibold">
                      {awaitingApproval.length}{" "}
                      {awaitingApproval.length === 1 ? "campanha aguarda" : "campanhas aguardam"}{" "}
                      aprovação.
                    </strong>{" "}
                    Acima de {formatNumber(awaitingApproval[0]?.approval.thresholdAudience ?? 0)}{" "}
                    contatos, a política da empresa exige revisão antes do disparo.
                  </p>
                  <Button asChild size="xs">
                    <Link href={`/campanhas/${awaitingApproval[0]?.id}`}>Revisar agora</Link>
                  </Button>
                </div>
              </Reveal>
            ) : null}

            <Reveal index={1} className="mb-4 flex flex-wrap items-center gap-2">
              <SearchInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onClear={() => setSearch("")}
                placeholder="Buscar campanha, objetivo ou segmento"
                className="w-72"
                aria-label="Buscar campanhas"
              />
              <PillFilter
                options={STATUS_FILTERS}
                value={status}
                onChange={setStatus}
                hideEmpty={STATUS_FILTERS.filter((option) => option !== "todas")}
                countOf={(option) =>
                  option === "todas" ? campaigns.length : (counts.get(option) ?? 0)
                }
                labelOf={(option) =>
                  option === "todas" ? "Todas" : CAMPAIGN_STATUS_LABEL[option as CampaignStatus]
                }
              />
            </Reveal>

            {filtered.length === 0 ? (
              <EmptyState
                icon={<Megaphone />}
                title="Nenhuma campanha neste recorte"
                description="Ajuste a busca ou o status. Uma campanha nasce de um segmento, um template aprovado e uma janela de envio."
              />
            ) : (
              <ul className="space-y-3">
                {filtered.map((campaign, index) => {
                  const segment = segmentById.get(campaign.segmentId);
                  const template = templateById.get(campaign.templateId);
                  const owner = userById.get(campaign.ownerId);
                  const { metrics } = campaign;

                  const deliveryRate =
                    metrics.sent > 0 ? (metrics.delivered / metrics.sent) * 100 : 0;
                  const readRate =
                    metrics.delivered > 0 ? (metrics.read / metrics.delivered) * 100 : 0;
                  const progress =
                    metrics.eligible > 0
                      ? ((metrics.sent + metrics.failed) / metrics.eligible) * 100
                      : 0;

                  return (
                    <Reveal key={campaign.id} index={Math.min(index + 2, 8)} as="li">
                      <Link
                        href={`/campanhas/${campaign.id}`}
                        className="lift press bg-card shadow-card focus-visible:ring-accent group block rounded-lg p-5 focus-visible:outline-none focus-visible:ring-2"
                      >
                        <div className="flex flex-wrap items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <ChannelIcon kind={campaign.channel} withBackground />
                              <h3 className="font-display truncate text-sm font-semibold tracking-tight">
                                {campaign.name}
                              </h3>
                              <CampaignStatusBadge status={campaign.status} />
                              {template?.status === "rejeitado" ? (
                                <Tooltip content={template.rejectionReason ?? "Template reprovado"}>
                                  <Badge variant="danger">
                                    <AlertTriangle aria-hidden />
                                    template reprovado
                                  </Badge>
                                </Tooltip>
                              ) : null}
                            </div>

                            <p className="text-muted-foreground mt-1 truncate text-xs">
                              {campaign.objective}
                            </p>

                            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                              <span className="flex items-center gap-1">
                                <Users className="size-3" aria-hidden />
                                {segment?.name ?? "sem segmento"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Filter className="size-3" aria-hidden />
                                {formatNumber(metrics.eligible)} elegíveis
                                {metrics.excluded > 0
                                  ? ` · ${formatNumber(metrics.excluded)} excluídos`
                                  : ""}
                              </span>
                              {owner ? (
                                <span className="flex items-center gap-1.5">
                                  <Avatar
                                    initials={owner.initials}
                                    hue={owner.accentHue}
                                    size="xs"
                                  />
                                  {owner.name}
                                </span>
                              ) : null}
                              {campaign.scheduledAt ? (
                                <span>agendada {formatCountdown(campaign.scheduledAt)}</span>
                              ) : campaign.startedAt ? (
                                <span>iniciada {formatRelative(campaign.startedAt)}</span>
                              ) : null}
                            </div>
                          </div>

                          {/* Números do envio */}
                          {metrics.sent > 0 ? (
                            <dl className="grid shrink-0 grid-cols-4 gap-4 text-right">
                              <div>
                                <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                                  Enviadas
                                </dt>
                                <dd className="figure text-base font-semibold">
                                  {formatNumber(metrics.sent)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                                  Entrega
                                </dt>
                                <dd className="figure text-base font-semibold">
                                  {formatPercent(deliveryRate)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                                  Leitura
                                </dt>
                                <dd className="figure text-base font-semibold">
                                  {formatPercent(readRate)}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                                  Custo
                                </dt>
                                <dd className="figure text-base font-semibold">
                                  {formatCurrencyCents(metrics.costCents)}
                                </dd>
                              </div>
                            </dl>
                          ) : (
                            <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
                              ainda não disparada
                              <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                            </span>
                          )}
                        </div>

                        {campaign.status === "enviando" ? (
                          <div className="mt-4">
                            <div className="text-muted-foreground mb-1 flex items-center justify-between text-[11px]">
                              <span>
                                {formatNumber(metrics.sent + metrics.failed)} de{" "}
                                {formatNumber(metrics.eligible)} processadas ·{" "}
                                {formatNumber(metrics.queued)} na fila
                              </span>
                              <span className="tabular-nums">{formatPercent(progress)}</span>
                            </div>
                            <ProgressBar
                              value={progress}
                              tone="accent"
                              label="Progresso do envio"
                            />
                          </div>
                        ) : null}
                      </Link>
                    </Reveal>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          {/* Segmentos ---------------------------------------------------- */}
          <TabsContent value="segmentos" className="m-0">
            <Reveal index={0} className="mb-4">
              <SearchInput
                value={segmentSearch}
                onChange={(event) => setSegmentSearch(event.target.value)}
                onClear={() => setSegmentSearch("")}
                placeholder="Buscar segmento"
                className="w-72"
                aria-label="Buscar segmentos"
              />
            </Reveal>

            <ul className="grid gap-3 lg:grid-cols-2">
              {filteredSegments.map((segment, index) => {
                const excludedTotal = segment.exclusions.reduce((sum, item) => sum + item.count, 0);
                const eligibleShare =
                  segment.estimatedSize > 0
                    ? (segment.eligibleSize / segment.estimatedSize) * 100
                    : 0;

                return (
                  <Reveal key={segment.id} index={Math.min(index + 1, 6)} as="li">
                    <div className="bg-card shadow-card h-full rounded-lg p-5">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display truncate text-sm font-semibold tracking-tight">
                            {segment.name}
                          </h3>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {segment.description}
                          </p>
                        </div>
                        <Badge variant={segment.dynamic ? "info" : "neutral"}>
                          {segment.dynamic ? "dinâmico" : "estático"}
                        </Badge>
                      </div>

                      <div className="mt-4 flex items-baseline gap-4">
                        <div>
                          <p className="figure text-2xl font-semibold leading-none">
                            {formatNumber(segment.eligibleSize)}
                          </p>
                          <p className="text-muted-foreground mt-1 text-[11px]">elegíveis</p>
                        </div>
                        <div>
                          <p className="figure text-muted-foreground text-base font-semibold leading-none">
                            {formatNumber(segment.estimatedSize)}
                          </p>
                          <p className="text-muted-foreground mt-1 text-[11px]">no segmento</p>
                        </div>
                        {excludedTotal > 0 ? (
                          <div>
                            <p className="figure text-warning text-base font-semibold leading-none">
                              −{formatNumber(excludedTotal)}
                            </p>
                            <p className="text-muted-foreground mt-1 text-[11px]">excluídos</p>
                          </div>
                        ) : null}
                      </div>

                      {/* A barra responde antes dos números: quanto do segmento sobrevive à checagem de consentimento. */}
                      <div className="mt-3">
                        <ProgressBar
                          value={eligibleShare}
                          tone={eligibleShare > 85 ? "success" : "warning"}
                          label={`${formatPercent(eligibleShare)} do segmento está elegível`}
                        />
                        <p className="text-muted-foreground mt-1 text-[11px]">
                          {formatPercent(eligibleShare)} do segmento pode receber mensagem hoje
                        </p>
                      </div>

                      {/* Critérios: sem isto, "3 grupos de regras" não diz o que o segmento é. */}
                      <div className="mt-4">
                        <Eyebrow className="mb-1.5">Critérios</Eyebrow>
                        <div className="flex flex-wrap gap-1.5">
                          {segment.groups.flatMap((group) =>
                            group.rules.map((rule) => (
                              <span
                                key={rule.id}
                                className="bg-muted/70 rounded-md px-2 py-1 text-[11px]"
                              >
                                <span className="font-medium">{rule.fieldLabel}</span>{" "}
                                <span className="text-muted-foreground">
                                  {SEGMENT_OPERATOR_LABEL[rule.operator]}
                                </span>{" "}
                                <span className="font-medium">{rule.value}</span>
                              </span>
                            )),
                          )}
                        </div>
                        {segment.groups.length > 1 ? (
                          <p className="text-muted-foreground mt-1.5 text-[11px]">
                            {segment.groups.length} grupos combinados por{" "}
                            <span className="font-medium">{segment.match}</span>
                          </p>
                        ) : null}
                      </div>

                      {segment.exclusions.length > 0 ? (
                        <div className="mt-4">
                          <Eyebrow className="mb-1.5">Motivos de exclusão</Eyebrow>
                          <ChartLegend
                            items={segment.exclusions.map((exclusion, exclusionIndex) => ({
                              label: exclusion.reason,
                              color: seriesColor(exclusionIndex + 1),
                              value: formatNumber(exclusion.count),
                            }))}
                          />
                        </div>
                      ) : (
                        <p className="text-success mt-4 flex items-center gap-1.5 text-[11px]">
                          <CheckCircle2 className="size-3.5" aria-hidden />
                          Nenhuma exclusão: toda a base está elegível.
                        </p>
                      )}

                      <p className="text-muted-foreground mt-4 text-[11px]">
                        Recalculado {formatRelative(segment.lastCalculatedAt)}
                        {segment.dynamic ? " · recalcula de novo no disparo" : ""}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </ul>
          </TabsContent>

          {/* Templates ---------------------------------------------------- */}
          <TabsContent value="templates" className="m-0">
            <Reveal index={0} className="mb-4 flex flex-wrap items-center gap-2">
              <SearchInput
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
                onClear={() => setTemplateSearch("")}
                placeholder="Buscar por nome ou texto"
                className="w-72"
                aria-label="Buscar templates"
              />
              <PillFilter
                options={TEMPLATE_STATUS_FILTERS}
                value={templateStatus}
                onChange={setTemplateStatus}
                hideEmpty={TEMPLATE_STATUS_FILTERS.filter((option) => option !== "todos")}
                countOf={(option) =>
                  option === "todos" ? templates.length : (templateCounts.get(option) ?? 0)
                }
                labelOf={(option) =>
                  option === "todos" ? "Todos" : TEMPLATE_STATUS_LABEL[option as TemplateStatus]
                }
              />
            </Reveal>

            {filteredTemplates.length === 0 ? (
              <EmptyState
                icon={<Megaphone />}
                title="Nenhum template neste recorte"
                description="Templates de marketing passam por análise do provedor antes de poderem ser disparados."
              />
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {filteredTemplates.map((template, index) => (
                  <Reveal key={template.id} index={Math.min(index + 1, 6)} as="li">
                    <div className="bg-card shadow-card flex h-full flex-col rounded-lg p-5">
                      <div className="flex items-start gap-2">
                        <ChannelIcon kind={template.channel} withBackground />
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-mono text-xs font-semibold">
                            {template.name}
                          </h3>
                          <p className="text-muted-foreground mt-0.5 text-[11px] capitalize">
                            {template.category} · {template.language}
                            {template.quality ? ` · qualidade ${template.quality}` : ""}
                          </p>
                        </div>
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

                      {/* Prévia na casca real: o que decide a aprovação é como a mensagem chega, não o texto cru. */}
                      <div className="chat-canvas mt-3 overflow-hidden rounded-lg p-3">
                        <IncomingBubble
                          header={template.headerText}
                          body={template.body}
                          footer={template.footerText}
                          buttons={template.buttons}
                        />
                      </div>

                      {template.rejectionReason ? (
                        <p className="bg-destructive-soft text-destructive mt-3 rounded-md px-2.5 py-2 text-[11px] leading-relaxed">
                          {template.rejectionReason}
                        </p>
                      ) : null}

                      {template.variables.length > 0 ? (
                        <div className="mt-auto pt-3">
                          <Eyebrow className="mb-1">Variáveis</Eyebrow>
                          <div className="flex flex-wrap gap-1">
                            {template.variables.map((variable) => (
                              <code
                                key={variable}
                                className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px]"
                              >
                                {variable}
                              </code>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </Reveal>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </RevealScope>
  );
}
