"use client";

import { useState } from "react";
import { AGENT_ACTION_LABEL, SATISFACTION_LABEL, agentTool } from "@crm/core";
import { Badge, Button, Callout, Eyebrow, Tooltip, cn } from "@crm/ui";
import {
  CircleAlert,
  CircleCheck,
  Clock,
  Coins,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";

import type { LiveAgentActivity, LiveSurvey } from "./use-live-webchat";

/**
 * O que a IA fez nesta conversa.
 *
 * Existe para responder duas perguntas de quem acaba de assumir uma conversa que
 * um agente conduziu: **o que ela já disse por mim** e **o que ela quer que eu
 * autorize**. Sem a primeira, o atendente repete a pergunta que a IA já fez e o
 * cliente conta a história duas vezes. Sem a segunda, o pedido de escrita fica
 * pendurado para sempre — e uma confirmação que ninguém vê é o mesmo que uma
 * ação que nunca acontece.
 *
 * A confirmação **não grava**. Não existe camada de escrita neste repositório, e
 * fingir que existe seria pior que a lacuna: o atendente marcaria a tarefa como
 * criada e ela não estaria em lugar nenhum. O botão registra a decisão na tela e
 * diz isso com todas as letras.
 */
export function AgentActivityPanel({
  activity,
  survey,
}: {
  activity: LiveAgentActivity;
  survey?: LiveSurvey;
}) {
  const [decided, setDecided] = useState<Record<string, "confirmado" | "descartado">>({});

  const openPending = activity.pending.filter((action) => !decided[action.id]);
  const toolSteps = activity.steps.filter((step) => step.action === "usar_ferramenta");

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      {/**
       * A nota vem primeiro quando é baixa.
       *
       * Quem abre esta aba depois de uma avaliação ruim precisa ver isso antes
       * do rastro: muda o tom da primeira frase que o atendente vai escrever.
       */}
      {survey?.score !== undefined ? (
        <Callout
          variant={survey.score <= 2 ? "danger" : survey.score >= 4 ? "success" : "warning"}
          title={`Avaliação do atendimento: ${survey.score}/5 — ${SATISFACTION_LABEL[survey.score] ?? ""}`}
        >
          {survey.comment ? (
            <p className="leading-relaxed">“{survey.comment}”</p>
          ) : (
            <p>Sem comentário.</p>
          )}
        </Callout>
      ) : survey?.offered ? (
        <p className="text-muted-foreground text-[11px]">
          A pesquisa de satisfação foi oferecida e ainda não foi respondida.
        </p>
      ) : null}

      {/* Resumo do handoff ------------------------------------------------- */}
      {activity.handoffSummary || activity.handoffReason ? (
        <Callout variant="info" title="Por que chegou até você">
          {activity.handoffReason ? <p>{activity.handoffReason}</p> : null}
          {activity.handoffSummary ? (
            <p className="mt-1 leading-relaxed">{activity.handoffSummary}</p>
          ) : null}
        </Callout>
      ) : null}

      {/* Pendências --------------------------------------------------------- */}
      {openPending.length > 0 ? (
        <section>
          <Eyebrow className="mb-1.5">Esperando sua confirmação</Eyebrow>
          <ul className="space-y-2">
            {openPending.map((action) => {
              const spec = agentTool(action.toolId);
              return (
                <li
                  key={action.id}
                  className="border-warning/40 bg-warning/5 rounded-lg border p-2.5"
                >
                  <p className="flex items-center gap-1.5 text-xs font-semibold">
                    <ShieldAlert className="text-warning size-3.5 shrink-0" aria-hidden />
                    {spec?.effect ?? action.label}
                  </p>
                  <dl className="mt-1.5 space-y-0.5">
                    {Object.entries(action.params).map(([name, value]) => (
                      <div key={name} className="flex gap-1.5 text-[11px]">
                        <dt className="text-muted-foreground shrink-0">{name}:</dt>
                        <dd className="min-w-0 break-words font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  {action.evidence ? (
                    <p className="text-muted-foreground mt-1.5 text-[11px] italic leading-relaxed">
                      “{action.evidence}”
                    </p>
                  ) : null}
                  <div className="mt-2 flex gap-1.5">
                    <Button
                      size="xs"
                      onClick={() =>
                        setDecided((current) => ({ ...current, [action.id]: "confirmado" }))
                      }
                    >
                      <ShieldCheck />
                      Confirmar
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        setDecided((current) => ({ ...current, [action.id]: "descartado" }))
                      }
                    >
                      <X />
                      Descartar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground mt-1.5 text-[10px] leading-relaxed">
            A gravação de verdade entra com a camada de escrita do back-end. Por enquanto a
            confirmação vale como decisão registrada nesta tela.
          </p>
        </section>
      ) : null}

      {Object.keys(decided).length > 0 ? (
        <p className="text-muted-foreground text-[11px]">
          {Object.values(decided).filter((value) => value === "confirmado").length} confirmada(s) ·{" "}
          {Object.values(decided).filter((value) => value === "descartado").length} descartada(s)
        </p>
      ) : null}

      {/* Custo -------------------------------------------------------------- */}
      <div className="bg-muted/50 flex items-center gap-3 rounded-lg px-3 py-2 text-[11px]">
        <span className="flex items-center gap-1">
          <Clock className="text-muted-foreground size-3" aria-hidden />
          {activity.turns} turno{activity.turns === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1">
          <Coins className="text-muted-foreground size-3" aria-hidden />
          {activity.costCents.toFixed(3)}¢
        </span>
        <span className="flex items-center gap-1">
          <Wrench className="text-muted-foreground size-3" aria-hidden />
          {toolSteps.length} consulta{toolSteps.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Rastro ------------------------------------------------------------- */}
      <section>
        <Eyebrow className="mb-1.5">O que a IA fez</Eyebrow>
        {activity.steps.length === 0 ? (
          <p className="text-muted-foreground text-xs">Nenhum passo registrado ainda.</p>
        ) : (
          <ol className="space-y-1.5">
            {activity.steps.map((step, index) => {
              const spec = step.toolId ? agentTool(step.toolId) : undefined;
              const failed = step.status === "falha" || step.status === "recusado";

              return (
                <li key={`${step.index}-${index}`} className="bg-muted/40 rounded-md p-2">
                  <div className="flex items-center gap-1.5">
                    {failed ? (
                      <CircleAlert className="text-warning size-3 shrink-0" aria-hidden />
                    ) : (
                      <CircleCheck className="text-success size-3 shrink-0" aria-hidden />
                    )}
                    <span className="text-[11px] font-medium">
                      {AGENT_ACTION_LABEL[step.action]}
                    </span>
                    {spec ? (
                      <Tooltip content={spec.description}>
                        <Badge variant={spec.impact === "escrita" ? "warning" : "neutral"}>
                          {spec.label}
                        </Badge>
                      </Tooltip>
                    ) : null}
                    <span
                      className={cn(
                        "ml-auto shrink-0 text-[10px] tabular-nums",
                        step.confidence < 60 ? "text-warning" : "text-muted-foreground",
                      )}
                    >
                      {step.confidence}
                    </span>
                  </div>
                  {step.rationale ? (
                    <p className="text-muted-foreground mt-1 text-[10px] italic leading-relaxed">
                      {step.rationale}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
