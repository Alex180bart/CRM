"use client";

import Link from "next/link";
import type { AiAgent, Queue, User } from "@elora/core";
import {
  AGENT_OBJECTIVE_LABEL,
  AGENT_TOOLS,
  activeAgentVersion,
  agentVersion,
  formatDate,
  formatNumber,
  formatPercent,
  hasBlockingAgentIssue,
  validateAgentVersion,
} from "@elora/core";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Eyebrow,
  Reveal,
  ShareBar,
  StatTile,
  StatusDot,
  Tooltip,
} from "@elora/ui";
import { ArrowUpRight, Bot, CircleAlert, Coins, Headset, ShieldCheck, Wrench } from "lucide-react";

/**
 * Lista de agentes.
 *
 * O cartão responde três perguntas, nesta ordem, porque é a ordem em que a
 * dúvida aparece na operação: **o que ele resolve sozinho**, **para onde manda
 * o resto** e **quanto custa**. Nome, status e data vêm depois — são
 * identificação, não avaliação.
 *
 * A barra de desfecho é a peça central e mostra três fatias, não duas.
 * Resolvido e transferido somam quase tudo, mas é o **abandonado** que informa:
 * conversa que morreu sem resposta e sem atendente é o defeito que uma média de
 * satisfação esconde, porque quem abandona não responde pesquisa.
 */
export function AgentList({
  agents,
  queues,
  users,
}: {
  agents: AiAgent[];
  queues: Queue[];
  users: User[];
}) {
  const queueById = new Map(queues.map((queue) => [queue.id, queue]));
  const userById = new Map(users.map((user) => [user.id, user]));

  const totals = agents.reduce(
    (acc, agent) => ({
      conversations: acc.conversations + agent.stats.conversations30d,
      resolved: acc.resolved + (agent.stats.conversations30d * agent.stats.resolvedPct) / 100,
      cost: acc.cost + (agent.stats.conversations30d * agent.stats.avgCostCents) / 100,
    }),
    { conversations: 0, resolved: 0, cost: 0 },
  );

  const live = agents.filter((agent) => agent.status === "ativo" && agent.activeVersionId).length;

  return (
    <div className="mx-auto w-full max-w-[86rem] px-5 py-6">
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal index={0}>
          <StatTile
            label="Conversas (30 d)"
            value={formatNumber(totals.conversations)}
            hint="atendidas por agente de IA"
            icon={<Headset />}
          />
        </Reveal>
        <Reveal index={1}>
          <StatTile
            label="Resolvidas sem humano"
            value={formatPercent((totals.resolved / Math.max(totals.conversations, 1)) * 100, 1)}
            hint={`${formatNumber(Math.round(totals.resolved))} conversas`}
          />
        </Reveal>
        <Reveal index={2}>
          <StatTile
            label="Custo do período"
            value={`US$ ${totals.cost.toFixed(2)}`}
            hint="soma das chamadas ao modelo"
            icon={<Coins />}
          />
        </Reveal>
        <Reveal index={3}>
          <StatTile
            label="Agentes no ar"
            value={`${live}/${agents.length}`}
            hint="os demais estão pausados ou em rascunho"
            icon={<Bot />}
          />
        </Reveal>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          icon={<Bot />}
          title="Nenhum agente criado"
          description="Um agente de IA atende de ponta a ponta: entende o pedido, consulta a base, coleta o que falta e transfere para a fila certa quando precisa de gente."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {agents.map((agent, index) => {
            const active = activeAgentVersion(agent);
            const draft = agentVersion(agent, agent.draftVersionId);
            const shown = active ?? draft ?? agent.versions[0]!;
            const owner = userById.get(agent.ownerId);
            const blocked = draft ? hasBlockingAgentIssue(validateAgentVersion(draft)) : false;

            const writeTools = shown.tools.filter((policy) => {
              const spec = AGENT_TOOLS.find((tool) => tool.id === policy.toolId);
              return policy.enabled && spec?.impact === "escrita";
            });
            const unconfirmed = writeTools.filter((policy) => !policy.requiresConfirmation);

            const defaultQueue = queueById.get(shown.handoff.defaultQueueId);

            return (
              <Reveal key={agent.id} index={Math.min(index + 4, 9)} as="li">
                <div className="bg-card shadow-card lift flex h-full flex-col rounded-lg p-5">
                  <div className="flex items-start gap-3">
                    <span
                      className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-2xl"
                      aria-hidden
                    >
                      <Bot className="size-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-display truncate text-sm font-semibold tracking-tight">
                        {agent.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {agent.status === "ativo" && active ? (
                          <Badge variant="success">
                            <StatusDot tone="success" pulse />v{active.version} atendendo
                          </Badge>
                        ) : (
                          <Badge variant="neutral">
                            {agent.status === "pausado" ? "pausado" : "nunca publicado"}
                          </Badge>
                        )}
                        {draft && draft.id !== agent.activeVersionId ? (
                          <Badge variant={blocked ? "danger" : "warning"}>
                            v{draft.version} rascunho
                          </Badge>
                        ) : null}
                        <Badge variant="neutral">
                          {AGENT_OBJECTIVE_LABEL[shown.mission.objective]}
                        </Badge>
                        {unconfirmed.length > 0 ? (
                          <Tooltip content="Este agente grava no CRM sem ninguém conferir. A seção 16.4 pede confirmação humana para ação de impacto.">
                            <Badge variant="warning">
                              <CircleAlert aria-hidden />
                              grava sem confirmar
                            </Badge>
                          </Tooltip>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                    {agent.description}
                  </p>

                  <div className="mt-4">
                    <div className="text-muted-foreground mb-1.5 flex items-center justify-between text-[11px]">
                      <span>Desfecho das conversas</span>
                      <span className="tabular-nums">
                        {formatNumber(agent.stats.conversations30d)} em 30 dias
                      </span>
                    </div>
                    <ShareBar
                      formatValue={(value) => formatPercent(value, 1)}
                      segments={[
                        {
                          label: "Resolvido pela IA",
                          value: agent.stats.resolvedPct,
                          colorIndex: 0,
                        },
                        {
                          label: "Transferido",
                          value: agent.stats.handoffPct,
                          colorIndex: 1,
                        },
                        {
                          label: "Abandonado",
                          value: agent.stats.abandonedPct,
                          colorIndex: 2,
                        },
                      ]}
                    />
                  </div>

                  <dl className="mt-4 grid grid-cols-4 gap-2">
                    <div>
                      <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        Turnos
                      </dt>
                      <dd className="figure text-sm font-semibold">{agent.stats.avgTurns}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        Custo/conv.
                      </dt>
                      <dd className="figure text-sm font-semibold">
                        {agent.stats.avgCostCents.toFixed(2)}¢
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        1ª resposta
                      </dt>
                      <dd className="figure text-sm font-semibold">
                        {agent.stats.medianFirstReplySeconds}s
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground text-[10px] uppercase tracking-wide">
                        CSAT
                      </dt>
                      <dd className="figure text-sm font-semibold">{agent.stats.csat}</dd>
                    </div>
                  </dl>

                  <div className="bg-muted/50 mt-3 space-y-1 rounded-lg px-3 py-2.5">
                    <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                      <Wrench className="size-3 shrink-0" aria-hidden />
                      {shown.tools.filter((policy) => policy.enabled).length} ferramentas ·{" "}
                      {writeTools.length} de escrita
                      {writeTools.length > 0 && unconfirmed.length === 0 ? " sob confirmação" : ""}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                      <ShieldCheck className="size-3 shrink-0" aria-hidden />
                      Sai para {defaultQueue?.name ?? "fila não definida"} ·{" "}
                      {shown.handoff.rules.length} regras de encaminhamento
                    </p>
                  </div>

                  <div className="text-muted-foreground mt-3 flex items-center gap-2 text-[11px]">
                    {owner ? (
                      <>
                        <Avatar initials={owner.initials} hue={owner.accentHue} size="xs" />
                        {owner.name}
                      </>
                    ) : null}
                    {active?.publishedAt ? (
                      <span>· no ar desde {formatDate(active.publishedAt)}</span>
                    ) : null}
                  </div>

                  <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                    <Link href={`/agentes/${agent.id}`}>
                      Configurar e testar
                      <ArrowUpRight />
                    </Link>
                  </Button>
                </div>
              </Reveal>
            );
          })}
        </ul>
      )}

      <Reveal index={9} className="mt-6">
        <Eyebrow className="mb-1.5">Agente não é fluxo</Eyebrow>
        <p className="text-muted-foreground max-w-3xl text-xs leading-relaxed">
          O fluxo do Chatbot Builder percorre um caminho que alguém desenhou: nó, aresta, ramo. O
          agente decide a cada mensagem — consulta a base, coleta o que falta, transfere quando o
          assunto sai do escopo. Use fluxo para o que se repete igual e agente para o que chega
          escrito em texto livre. Os dois convivem, e o widget de webchat escolhe qual conduz.
        </p>
      </Reveal>
    </div>
  );
}
