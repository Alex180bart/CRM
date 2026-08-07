"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  BrandKit,
  EmailDeliveryStats,
  EmailDesignTemplate,
  EmailDomain,
  EmailModule,
  SuppressionEntry,
  User,
} from "@crm/core";
import {
  FLOW_STATUS_LABEL,
  formatDate,
  formatNumber,
  formatPercent,
  formatRelative,
  SUPPRESSION_REASON_LABEL,
} from "@crm/core";
import {
  Avatar,
  Badge,
  Button,
  ChartFrame,
  Eyebrow,
  FunnelBars,
  KeyValue,
  ProgressBar,
  Reveal,
  RevealScope,
  SearchInput,
  StatusDot,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  cn,
} from "@crm/ui";
import {
  ArrowUpRight,
  Blocks,
  Check,
  CircleAlert,
  Copy,
  Mail,
  Palette,
  ShieldCheck,
  ShieldOff,
  Thermometer,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_TONE = {
  rascunho: "neutral",
  em_revisao: "warning",
  aprovado: "info",
  publicado: "success",
  arquivado: "neutral",
} as const;

const CATEGORY_LABEL = {
  campanha: "Campanha",
  jornada: "Jornada",
  transacional: "Transacional",
  institucional: "Institucional",
} as const;

const DNS_TONE = {
  verificado: "success",
  pendente: "warning",
  falhou: "danger",
} as const;

function DnsBadge({
  label,
  status,
}: {
  label: string;
  status: "verificado" | "pendente" | "falhou";
}) {
  return (
    <Badge variant={DNS_TONE[status]}>
      {status === "verificado" ? (
        <Check aria-hidden />
      ) : status === "pendente" ? (
        <TriangleAlert aria-hidden />
      ) : (
        <CircleAlert aria-hidden />
      )}
      {label}
    </Badge>
  );
}

export function EmailStudioConsole({
  templates,
  modules,
  brandKits,
  domains,
  suppressions,
  stats,
  users,
}: {
  templates: EmailDesignTemplate[];
  modules: EmailModule[];
  brandKits: BrandKit[];
  domains: EmailDomain[];
  suppressions: SuppressionEntry[];
  stats: EmailDeliveryStats;
  users: User[];
}) {
  const [suppressionSearch, setSuppressionSearch] = useState("");
  const userById = new Map(users.map((user) => [user.id, user]));

  const filteredSuppressions = suppressions.filter((entry) =>
    suppressionSearch.trim()
      ? `${entry.address} ${entry.source} ${entry.detail ?? ""}`
          .toLowerCase()
          .includes(suppressionSearch.trim().toLowerCase())
      : true,
  );

  const reasonCounts = suppressions.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.reason] = (acc[entry.reason] ?? 0) + 1;
    return acc;
  }, {});

  const bounceRate = (stats.bounced / Math.max(stats.sent, 1)) * 100;
  const complaintRate = (stats.complained / Math.max(stats.delivered, 1)) * 100;

  return (
    <RevealScope>
      <div className="mx-auto w-full max-w-[86rem] px-5 py-6">
        <Tabs defaultValue="templates">
          <TabsList className="mb-5">
            <TabsTrigger value="templates">
              <Mail className="size-3" />
              Templates
              <Badge variant="neutral">{templates.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="modulos">
              <Blocks className="size-3" />
              Módulos
              <Badge variant="neutral">{modules.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="marca">
              <Palette className="size-3" />
              Marca
            </TabsTrigger>
            <TabsTrigger value="entrega">
              <ShieldCheck className="size-3" />
              Entregabilidade
            </TabsTrigger>
          </TabsList>

          {/* Templates ---------------------------------------------------- */}
          <TabsContent value="templates" className="m-0">
            <ul className="grid gap-3 lg:grid-cols-2">
              {templates.map((template, index) => {
                const active = template.versions.find((v) => v.id === template.activeVersionId);
                const draft = template.versions.find((v) => v.id === template.draftVersionId);
                const brand = brandKits.find((kit) => kit.id === template.brandKitId);
                const owner = userById.get(template.ownerId);

                return (
                  <Reveal key={template.id} index={Math.min(index, 6)} as="li">
                    <Link
                      href={`/email-studio/${template.id}`}
                      className="lift press bg-card shadow-card focus-visible:ring-accent group flex h-full flex-col rounded-lg p-5 focus-visible:outline-none focus-visible:ring-2"
                    >
                      <div className="flex items-start gap-3">
                        {/* Miniatura com as cores da marca do template */}
                        <span
                          className="flex size-11 shrink-0 flex-col gap-1 rounded-lg p-2"
                          style={{ backgroundColor: brand?.backgroundColor ?? "#F4F6FA" }}
                          aria-hidden
                        >
                          <span
                            className="h-1.5 w-full rounded-full"
                            style={{ backgroundColor: brand?.primaryColor ?? "#102850" }}
                          />
                          <span className="h-1 w-3/4 rounded-full bg-black/10" />
                          <span
                            className="mt-auto h-2 w-2/3 rounded-full"
                            style={{ backgroundColor: brand?.accentColor ?? "#FF9933" }}
                          />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="font-display truncate text-sm font-semibold tracking-tight">
                              {template.name}
                            </h3>
                            <Badge variant="neutral">{CATEGORY_LABEL[template.category]}</Badge>
                            {active ? (
                              <Badge variant="success">v{active.version} publicada</Badge>
                            ) : (
                              <Badge variant="warning">sem versão publicada</Badge>
                            )}
                            {draft && draft.id !== template.activeVersionId ? (
                              <Badge variant={STATUS_TONE[draft.status]}>
                                v{draft.version} {FLOW_STATUS_LABEL[draft.status]}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                            {template.description}
                          </p>
                        </div>

                        <ArrowUpRight className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>

                      {template.stats.sends30d > 0 ? (
                        <dl className="mt-4 grid grid-cols-4 gap-3">
                          <div>
                            <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                              Envios 30 d
                            </dt>
                            <dd className="figure text-sm font-semibold">
                              {formatNumber(template.stats.sends30d)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                              Abertura
                            </dt>
                            <dd className="figure text-success text-sm font-semibold">
                              {formatPercent(template.stats.openPct, 1)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                              Clique
                            </dt>
                            <dd className="figure text-sm font-semibold">
                              {formatPercent(template.stats.clickPct, 1)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                              Bounce
                            </dt>
                            <dd
                              className={cn(
                                "figure text-sm font-semibold",
                                template.stats.bouncePct > 2 ? "text-warning" : "",
                              )}
                            >
                              {formatPercent(template.stats.bouncePct, 1)}
                            </dd>
                          </div>
                        </dl>
                      ) : (
                        <p className="text-muted-foreground mt-4 text-xs">Ainda não enviado.</p>
                      )}

                      <p className="text-muted-foreground mt-auto pt-3 text-[11px]">
                        {owner ? (
                          <span className="mr-2 inline-flex items-center gap-1.5 align-middle">
                            <Avatar initials={owner.initials} hue={owner.accentHue} size="xs" />
                            {owner.name}
                          </span>
                        ) : null}
                        {active?.publishedAt
                          ? `publicada em ${formatDate(active.publishedAt)}`
                          : `atualizada ${formatRelative(template.updatedAt)}`}
                      </p>
                    </Link>
                  </Reveal>
                );
              })}
            </ul>
          </TabsContent>

          {/* Módulos ------------------------------------------------------ */}
          <TabsContent value="modulos" className="m-0">
            <Reveal index={0} className="mb-4">
              <p className="text-muted-foreground max-w-3xl text-xs leading-relaxed">
                Módulo é um grupo de blocos reutilizável. Os travados carregam a marca — cabeçalho,
                base legal e descadastro — e não podem ser alterados dentro do e-mail que os usa. É
                o que mantém o rodapé legal igual em toda a comunicação.
              </p>
            </Reveal>

            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((module, index) => (
                <Reveal key={module.id} index={Math.min(index, 6)} as="li">
                  <div className="bg-card shadow-card flex h-full flex-col rounded-lg p-5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display truncate text-sm font-semibold tracking-tight">
                          {module.name}
                        </h3>
                        <p className="text-muted-foreground mt-0.5 text-[11px] capitalize">
                          {module.category}
                        </p>
                      </div>
                      {module.locked ? <Badge variant="neutral">marca</Badge> : null}
                    </div>

                    <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                      {module.description}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {module.blocks.map((block) => (
                        <span
                          key={block.id}
                          className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]"
                        >
                          {block.kind}
                        </span>
                      ))}
                    </div>

                    <p className="text-muted-foreground mt-auto pt-3 text-[11px]">
                      Usado em {module.usageCount} e-mails · atualizado{" "}
                      {formatRelative(module.updatedAt)}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ul>
          </TabsContent>

          {/* Marca -------------------------------------------------------- */}
          <TabsContent value="marca" className="m-0">
            <ul className="grid gap-3 lg:grid-cols-2">
              {brandKits.map((kit, index) => (
                <Reveal key={kit.id} index={Math.min(index, 4)} as="li">
                  <div className="bg-card shadow-card rounded-lg p-5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display truncate text-sm font-semibold tracking-tight">
                            {kit.name}
                          </h3>
                          {kit.isDefault ? <Badge variant="primary">padrão</Badge> : null}
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-xs">{kit.description}</p>
                      </div>
                    </div>

                    {/* Amostra */}
                    <div
                      className="mt-4 overflow-hidden rounded-lg"
                      style={{ backgroundColor: kit.backgroundColor }}
                    >
                      <div className="p-4">
                        <p
                          className="text-sm font-bold"
                          style={{ color: kit.primaryColor, fontFamily: kit.fontStack }}
                        >
                          {kit.logoText}
                        </p>
                        <p
                          className="mt-1.5 text-xs leading-relaxed"
                          style={{ color: kit.textColor, fontFamily: kit.fontStack }}
                        >
                          Assim o corpo do e-mail aparece com esta identidade.
                        </p>
                        <span
                          className="mt-3 inline-block rounded-md px-3 py-1.5 text-[11px] font-bold"
                          style={{ backgroundColor: kit.accentColor, color: "#12233D" }}
                        >
                          Botão principal
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {[
                        { label: "Primária", value: kit.primaryColor },
                        { label: "Acento", value: kit.accentColor },
                        { label: "Texto", value: kit.textColor },
                        { label: "Fundo", value: kit.backgroundColor },
                      ].map((color) => (
                        <button
                          key={color.label}
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(color.value);
                            toast.success(`${color.value} copiado`);
                          }}
                          className="bg-muted hover:bg-secondary flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors"
                        >
                          <span
                            className="size-3 rounded-[3px] ring-1 ring-black/10"
                            style={{ backgroundColor: color.value }}
                            aria-hidden
                          />
                          <span className="text-muted-foreground">{color.label}</span>
                          <span className="font-mono">{color.value}</span>
                        </button>
                      ))}
                    </div>

                    <dl className="mt-3">
                      <KeyValue label="Endereço no rodapé" value={kit.footerAddress} />
                      <KeyValue label="Base legal" value={kit.footerLegal} />
                    </dl>
                  </div>
                </Reveal>
              ))}
            </ul>
          </TabsContent>

          {/* Entregabilidade ---------------------------------------------- */}
          <TabsContent value="entrega" className="m-0 space-y-4">
            <Reveal index={0}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <ChartFrame
                  title="Do envio à caixa de entrada"
                  description="Todos os e-mails dos últimos 30 dias, transacionais e de marketing"
                >
                  <FunnelBars
                    stages={[
                      { label: "Enviados", value: stats.sent },
                      { label: "Entregues", value: stats.delivered },
                      { label: "Abertos", value: stats.opened },
                      { label: "Clicados", value: stats.clicked },
                    ]}
                    formatValue={formatNumber}
                  />
                </ChartFrame>

                <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground text-[11px]">Bounce</dt>
                    <dd
                      className={cn(
                        "figure text-lg font-semibold",
                        bounceRate > 2 ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {formatPercent(bounceRate, 2)}
                    </dd>
                    <dd className="text-muted-foreground text-[11px]">limite do provedor: 2%</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-[11px]">Reclamações</dt>
                    <dd
                      className={cn(
                        "figure text-lg font-semibold",
                        complaintRate > 0.1 ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {formatPercent(complaintRate, 3)}
                    </dd>
                    <dd className="text-muted-foreground text-[11px]">limite do provedor: 0,1%</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-[11px]">Descadastros</dt>
                    <dd className="figure text-lg font-semibold">
                      {formatNumber(stats.unsubscribed)}
                    </dd>
                    <dd className="text-muted-foreground text-[11px]">
                      {formatPercent((stats.unsubscribed / Math.max(stats.delivered, 1)) * 100, 2)}{" "}
                      do entregue
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-[11px]">Na supressão</dt>
                    <dd className="figure text-lg font-semibold">
                      {formatNumber(suppressions.length)}
                    </dd>
                    <dd className="text-muted-foreground text-[11px]">endereços bloqueados</dd>
                  </div>
                </dl>
              </div>
            </Reveal>

            {/* Domínios */}
            <Reveal index={1}>
              <ul className="space-y-3">
                {domains.map((domain) => (
                  <li key={domain.id} className="bg-card shadow-card rounded-lg p-5">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-mono text-sm font-semibold">
                            {domain.domain}
                          </h3>
                          <Badge variant={domain.purpose === "marketing" ? "info" : "primary"}>
                            {domain.purpose}
                          </Badge>
                          <Tooltip content="Reputação informada pelo provedor de envio.">
                            <Badge
                              variant={
                                domain.reputation === "alta"
                                  ? "success"
                                  : domain.reputation === "media"
                                    ? "warning"
                                    : "danger"
                              }
                            >
                              <StatusDot
                                tone={
                                  domain.reputation === "alta"
                                    ? "success"
                                    : domain.reputation === "media"
                                      ? "warning"
                                      : "danger"
                                }
                              />
                              reputação {domain.reputation}
                            </Badge>
                          </Tooltip>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <DnsBadge label="SPF" status={domain.spf} />
                          <DnsBadge label="DKIM" status={domain.dkim} />
                          <DnsBadge label={`DMARC ${domain.dmarcPolicy}`} status={domain.dmarc} />
                        </div>
                      </div>

                      <div className="w-56 shrink-0">
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="text-muted-foreground text-[11px]">
                            Uso do limite diário
                          </span>
                          <span className="text-[11px] font-medium tabular-nums">
                            {formatPercent((domain.sentToday / domain.dailyLimit) * 100)}
                          </span>
                        </div>
                        <ProgressBar
                          value={(domain.sentToday / domain.dailyLimit) * 100}
                          tone={domain.sentToday / domain.dailyLimit > 0.7 ? "warning" : "success"}
                          label="Uso do limite diário"
                        />
                        <p className="text-muted-foreground mt-1 text-[11px] tabular-nums">
                          {formatNumber(domain.sentToday)} de {formatNumber(domain.dailyLimit)} hoje
                        </p>
                      </div>
                    </div>

                    {domain.warmupDay ? (
                      <div className="bg-info-soft mt-3 flex items-start gap-2 rounded-md px-3 py-2">
                        <Thermometer className="text-info mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <p className="text-foreground text-[11px] leading-relaxed">
                          Em aquecimento: dia {domain.warmupDay} de {domain.warmupTotalDays}. O
                          volume sobe aos poucos para o provedor construir reputação — subir antes
                          da hora derruba a entrega de tudo que passa por este domínio.
                        </p>
                      </div>
                    ) : null}

                    {domain.records.some((record) => record.status !== "verificado") ? (
                      <div className="mt-3">
                        <Eyebrow className="mb-1.5">Registros pendentes</Eyebrow>
                        <ul className="space-y-1">
                          {domain.records
                            .filter((record) => record.status !== "verificado")
                            .map((record) => (
                              <li
                                key={`${record.type}-${record.host}`}
                                className="bg-muted/60 flex items-center gap-2 rounded-md px-2.5 py-2"
                              >
                                <Badge variant="neutral">{record.type}</Badge>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-mono text-[11px]">
                                    {record.host}
                                  </span>
                                  <span className="text-muted-foreground block truncate font-mono text-[10px]">
                                    {record.value}
                                  </span>
                                </span>
                                <Badge variant={DNS_TONE[record.status]}>{record.purpose}</Badge>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label={`Copiar valor do registro ${record.purpose}`}
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(record.value);
                                    toast.success("Valor copiado", {
                                      description: "Cole no painel de DNS do domínio.",
                                    });
                                  }}
                                >
                                  <Copy />
                                </Button>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Reveal>

            {/* Supressões */}
            <Reveal index={2}>
              <div className="bg-card shadow-card rounded-lg p-5">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display flex items-center gap-2 text-sm font-semibold tracking-tight">
                      <ShieldOff className="text-muted-foreground size-4" aria-hidden />
                      Lista de supressão
                    </h2>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Endereços que nenhum envio alcança, qualquer que seja a campanha ou a jornada.
                    </p>
                  </div>
                  <SearchInput
                    value={suppressionSearch}
                    onChange={(event) => setSuppressionSearch(event.target.value)}
                    onClear={() => setSuppressionSearch("")}
                    placeholder="Buscar endereço ou origem"
                    className="ml-auto w-72"
                    aria-label="Buscar na lista de supressão"
                  />
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  {Object.entries(reasonCounts).map(([reason, count]) => (
                    <Badge
                      key={reason}
                      variant={
                        reason === "bounce_permanente" || reason === "reclamacao"
                          ? "danger"
                          : reason === "bounce_temporario"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {SUPPRESSION_REASON_LABEL[reason as keyof typeof SUPPRESSION_REASON_LABEL]}{" "}
                      {count}
                    </Badge>
                  ))}
                </div>

                <ul>
                  {filteredSuppressions.map((entry) => (
                    <li
                      key={entry.id}
                      className="shadow-inset-hairline flex items-start gap-3 py-2.5"
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          entry.reason === "bounce_permanente" || entry.reason === "reclamacao"
                            ? "bg-destructive"
                            : entry.reason === "bounce_temporario"
                              ? "bg-warning"
                              : "bg-muted-foreground/40",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-mono text-xs">{entry.address}</span>
                          <Badge variant="neutral">{SUPPRESSION_REASON_LABEL[entry.reason]}</Badge>
                          {entry.expiresAt ? (
                            <Badge variant="warning">
                              expira {formatRelative(entry.expiresAt)}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-[11px]">
                          {entry.source}
                          {entry.detail ? ` · ${entry.detail}` : ""}
                        </p>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
                        {formatRelative(entry.occurredAt)}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="text-muted-foreground mt-4 text-[11px] leading-relaxed">
                  Bounce permanente e reclamação nunca saem da lista — reenviar para um endereço que
                  já marcou spam é o caminho mais rápido para queimar o domínio. Bounce temporário
                  expira sozinho.
                </p>
              </div>
            </Reveal>
          </TabsContent>
        </Tabs>
      </div>
    </RevealScope>
  );
}
