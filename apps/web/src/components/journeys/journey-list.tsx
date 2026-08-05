"use client";

import Link from "next/link";
import { useState } from "react";
import type { Journey } from "@crm/core";
import {
  FLOW_STATUS_LABEL,
  formatDate,
  formatNumber,
  formatPercent,
  REENTRY_LABEL,
} from "@crm/core";
import {
  Badge,
  Button,
  EmptyState,
  Eyebrow,
  FunnelBars,
  ProgressBar,
  Reveal,
  SearchInput,
  StatTile,
  StatusDot,
  Tooltip,
  cn,
} from "@crm/ui";
import { ArrowUpRight, Clock, RefreshCcw, Target, TrendingUp, Users, Workflow } from "lucide-react";

/**
 * Lista de jornadas.
 *
 * O cartão responde três perguntas nesta ordem, que é a ordem em que quem
 * mantém uma jornada pergunta: quanta gente está dentro agora, quanta chegou à
 * meta, e o que acontece com quem entra hoje. O funil no meio existe porque a
 * perda entre "entrou" e "chegou" é a única métrica que faz alguém abrir o
 * editor — os quatro números soltos escondiam exatamente isso.
 */

type Filter = "todas" | "publicadas" | "rascunho";

export function JourneyList({ journeys }: { journeys: Journey[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");

  const filtered = journeys.filter((journey) => {
    if (filter === "publicadas" && !journey.activeVersionId) return false;
    if (filter === "rascunho" && journey.activeVersionId) return false;
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      if (!`${journey.name} ${journey.description} ${journey.goal}`.toLowerCase().includes(term)) {
        return false;
      }
    }
    return true;
  });

  const totals = journeys.reduce(
    (acc, journey) => ({
      active: acc.active + journey.stats.active,
      completed: acc.completed + journey.stats.completed,
      goal: acc.goal + journey.stats.goalReached,
      exited: acc.exited + journey.stats.exited,
    }),
    { active: 0, completed: 0, goal: 0, exited: 0 },
  );

  const finished = totals.completed + totals.exited;

  return (
    <div className="mx-auto w-full max-w-[86rem] px-5 py-6">
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal index={0}>
          <StatTile
            label="Contatos em jornada"
            value={formatNumber(totals.active)}
            hint={`em ${journeys.filter((journey) => journey.stats.active > 0).length} jornadas`}
            icon={<Users />}
          />
        </Reveal>
        <Reveal index={1}>
          <StatTile
            label="Chegaram à meta"
            value={formatNumber(totals.goal)}
            trend={{
              direction: "up",
              label: `${formatPercent((totals.goal / Math.max(finished, 1)) * 100, 1)} de quem terminou`,
              good: true,
            }}
            icon={<Target />}
          />
        </Reveal>
        <Reveal index={2}>
          <StatTile
            label="Saíram antes do fim"
            value={formatNumber(totals.exited)}
            hint="descadastro, conversão por outro caminho ou regra de saída"
          />
        </Reveal>
        <Reveal index={3}>
          <StatTile
            label="Jornadas publicadas"
            value={`${journeys.filter((journey) => journey.activeVersionId).length}/${journeys.length}`}
            hint="as demais estão em rascunho"
            icon={<Workflow />}
          />
        </Reveal>
      </div>

      <Reveal index={4} className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
          placeholder="Buscar jornada, meta ou descrição"
          className="w-72"
          aria-label="Buscar jornadas"
        />
        <div className="flex items-center gap-1">
          {(["todas", "publicadas", "rascunho"] as Filter[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              aria-pressed={filter === option}
              className={cn(
                "h-8 rounded-md px-2.5 text-xs font-medium capitalize transition-colors",
                filter === option
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </Reveal>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Workflow />}
          title="Nenhuma jornada neste recorte"
          description="Uma jornada acompanha o contato por dias ou meses. Para reagir a um clique agora, use uma automação."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {filtered.map((journey, index) => {
            const active = journey.versions.find(
              (version) => version.id === journey.activeVersionId,
            );
            const draft = journey.versions.find((version) => version.id === journey.draftVersionId);
            const entered = journey.stats.active + journey.stats.completed + journey.stats.exited;

            return (
              <Reveal key={journey.id} index={Math.min(index + 5, 9)} as="li">
                <div className="bg-card shadow-card lift flex h-full flex-col rounded-lg p-5">
                  <div className="flex items-start gap-2.5">
                    <span className="bg-primary-soft text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <Workflow className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display truncate text-sm font-semibold tracking-tight">
                        {journey.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {active ? (
                          <Badge variant="success">
                            <StatusDot tone="success" pulse />v{active.version} em produção
                          </Badge>
                        ) : (
                          <Badge variant="neutral">sem versão publicada</Badge>
                        )}
                        {draft && draft.id !== journey.activeVersionId ? (
                          <Badge variant="warning">
                            v{draft.version} {FLOW_STATUS_LABEL[draft.status]}
                          </Badge>
                        ) : null}
                        <Tooltip content="Janela em que a jornada pode enviar mensagem. Fora dela, o passo espera.">
                          <Badge variant="neutral">
                            <Clock aria-hidden />
                            {journey.sendWindow.startHour}h–{journey.sendWindow.endHour}h
                          </Badge>
                        </Tooltip>
                      </div>
                    </div>
                  </div>

                  <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
                    {journey.description}
                  </p>

                  <div className="bg-muted/50 mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5">
                    <Target className="text-success mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium">Meta: {journey.goal}</p>
                      <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px]">
                        <span className="flex items-center gap-1">
                          <RefreshCcw className="size-2.5" aria-hidden />
                          {REENTRY_LABEL[journey.reentryPolicy]}
                          {journey.reentryAfterDays ? ` · ${journey.reentryAfterDays} dias` : ""}
                        </span>
                        <span>prioridade {journey.priority}</span>
                      </p>
                    </div>
                  </div>

                  {/* Onde a jornada perde gente */}
                  {entered > 0 ? (
                    <div className="mt-4">
                      <Eyebrow className="mb-2">Do que entrou até a meta</Eyebrow>
                      <FunnelBars
                        stages={[
                          { label: "Entraram", value: entered },
                          {
                            label: "Seguem dentro",
                            value: journey.stats.active,
                            hint: "ainda percorrendo os passos",
                          },
                          {
                            label: "Concluíram",
                            value: journey.stats.completed,
                            hint: "chegaram ao fim do fluxo",
                          },
                          {
                            label: "Chegaram à meta",
                            value: journey.stats.goalReached,
                            hint: journey.goal,
                          },
                        ]}
                      />
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <div className="text-muted-foreground mb-1 flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="size-3" aria-hidden />
                        Conversão para a meta
                      </span>
                      <span className="tabular-nums">
                        {formatPercent(journey.stats.conversionPct, 1)}
                      </span>
                    </div>
                    <ProgressBar
                      value={journey.stats.conversionPct}
                      tone={journey.stats.conversionPct >= 20 ? "success" : "accent"}
                      label="Conversão para a meta"
                    />
                  </div>

                  {active?.publishedAt ? (
                    <p className="text-muted-foreground mt-3 text-[11px]">
                      Publicada em {formatDate(active.publishedAt)}
                      {active.changeNote ? ` · ${active.changeNote}` : ""}
                    </p>
                  ) : null}

                  <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                    <Link href={`/jornadas/${journey.id}`}>
                      Abrir editor
                      <ArrowUpRight />
                    </Link>
                  </Button>
                </div>
              </Reveal>
            );
          })}
        </ul>
      )}
    </div>
  );
}
