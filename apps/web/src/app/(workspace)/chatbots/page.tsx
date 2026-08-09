import type { Metadata } from "next";
import Link from "next/link";
import { repositories } from "@elora/core";
import { FLOW_STATUS_LABEL, formatDate, formatNumber, formatPercent } from "@elora/core";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, ProgressBar } from "@elora/ui";
import { ArrowUpRight, Bot, Plus } from "lucide-react";

import { ChannelIcon } from "@/lib/channel";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Chatbots" };

export default async function ChatbotsPage() {
  const flows = await repositories.automations.listBotFlows();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        compact
        title="Chatbots"
        description="Fluxos conversacionais versionados, com simulador, validação e publicação controlada."
        actions={
          <Button size="sm">
            <Plus />
            Novo chatbot
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-[86rem] px-5 py-6">
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {flows.map((flow) => {
            const active = flow.versions.find((version) => version.id === flow.activeVersionId);
            const draft = flow.versions.find((version) => version.id === flow.draftVersionId);

            return (
              <Card key={flow.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start gap-2.5">
                    <span className="bg-primary-soft text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                      <Bot className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate">{flow.name}</CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {flow.channels.map((channel) => (
                          <ChannelIcon key={channel} kind={channel} withBackground />
                        ))}
                        {active ? (
                          <Badge variant="success">v{active.version} em produção</Badge>
                        ) : (
                          <Badge variant="neutral">sem versão publicada</Badge>
                        )}
                        {draft && draft.id !== flow.activeVersionId ? (
                          <Badge variant="warning">
                            v{draft.version} {FLOW_STATUS_LABEL[draft.status]}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col">
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {flow.description}
                  </p>

                  <dl className="border-border mt-4 grid grid-cols-3 gap-3 border-t pt-3">
                    <div>
                      <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        Sessões 30 d
                      </dt>
                      <dd className="text-sm font-semibold tabular-nums">
                        {formatNumber(flow.stats.sessions30d)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        Resolvido
                      </dt>
                      <dd className="text-success text-sm font-semibold tabular-nums">
                        {formatPercent(flow.stats.resolvedByBotPct)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        Transbordo
                      </dt>
                      <dd className="text-sm font-semibold tabular-nums">
                        {formatPercent(flow.stats.handoffPct)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3">
                    <div className="text-muted-foreground mb-1 flex items-center justify-between text-[11px]">
                      <span>Resolução pelo bot</span>
                      <span className="tabular-nums">meta 45%</span>
                    </div>
                    <ProgressBar
                      value={flow.stats.resolvedByBotPct}
                      tone={flow.stats.resolvedByBotPct >= 45 ? "success" : "accent"}
                      label="Resolução pelo bot"
                    />
                  </div>

                  {active?.publishedAt ? (
                    <p className="text-muted-foreground mt-3 text-[11px]">
                      Publicado em {formatDate(active.publishedAt)} · {active.changeNote}
                    </p>
                  ) : null}

                  <Button asChild variant="outline" size="sm" className="mt-auto w-full">
                    <Link href={`/chatbots/${flow.id}`}>
                      Abrir editor
                      <ArrowUpRight />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
