"use client";

import { useState } from "react";
import type { AgentEvalRun, AiAgentVersion } from "@crm/core";
import { AGENT_CHECK_LABEL, formatPercent } from "@crm/core";
import { Badge, Button, Callout, Eyebrow, ProgressBar, cn } from "@crm/ui";
import { CircleAlert, CircleCheck, FlaskConical, Loader2, PlayCircle } from "lucide-react";

/**
 * Conjunto de avaliação, executável.
 *
 * Seção 16.4: "conjunto de casos de avaliação antes de publicar". Enquanto a
 * lista era só leitura, ela documentava a intenção e não respondia à única
 * pergunta que importa antes de publicar — **melhorou ou piorou?**
 *
 * A leitura é por dimensão e não por acerto único de propósito. Um caso que
 * roteia certo e vaza um valor no texto tem dois defeitos de gravidade muito
 * diferente; um "reprovado" seco apagaria a informação que faz corrigir o
 * prompt. Por isso a falha diz **qual** verificação caiu, com o esperado e o
 * observado lado a lado.
 */
export function EvaluationPanel({
  agentId,
  version,
  readOnly,
}: {
  agentId: string;
  version: AiAgentVersion;
  /** Alterações locais tornam o resultado enganoso: ele mede a versão salva. */
  readOnly: boolean;
}) {
  const [run, setRun] = useState<AgentEvalRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function execute() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/agent/avaliar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, versionId: version.id }),
      });

      const payload = (await response.json()) as AgentEvalRun | { error: { message: string } };

      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error.message : "A avaliação não rodou.");
        return;
      }

      setRun(payload);
    } catch {
      setError("Não foi possível falar com o servidor.");
    } finally {
      setBusy(false);
    }
  }

  const cases = version.evaluation;
  const score = run ? (run.passed / Math.max(run.total, 1)) * 100 : 0;

  return (
    <div className="space-y-3">
      {cases.length === 0 ? (
        <Callout variant="warning" icon={<FlaskConical />}>
          Nenhum caso cadastrado. Sem eles, a comparação entre duas versões do prompt vira impressão
          — e impressão não distingue “melhorou” de “mudou”.
        </Callout>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={busy} onClick={() => void execute()}>
              {busy ? <Loader2 className="animate-spin" /> : <PlayCircle />}
              {busy ? "Rodando…" : `Rodar ${cases.length} casos`}
            </Button>
            {run ? (
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {run.costUsdCents.toFixed(3)}¢ · {run.model} · {run.promptVersion}
              </span>
            ) : null}
          </div>

          {busy ? (
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Os casos rodam em série, um de cada vez. Dispará-los juntos seria mais rápido e
              contaminaria o resultado: a cota do provedor derrubaria casos que o agente teria
              acertado.
            </p>
          ) : null}
        </>
      )}

      {error ? (
        <Callout variant="danger" icon={<CircleAlert />}>
          {error}
        </Callout>
      ) : null}

      {run ? (
        <div className="bg-card shadow-card rounded-lg p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <Eyebrow>Resultado</Eyebrow>
            <span className="figure text-sm font-semibold tabular-nums">
              {run.passed}/{run.total} · {formatPercent(score, 0)}
            </span>
          </div>
          <ProgressBar
            value={score}
            tone={score === 100 ? "success" : score >= 70 ? "accent" : "danger"}
            label="Casos aprovados"
          />
        </div>
      ) : null}

      <ul className="space-y-2">
        {cases.map((testCase) => {
          const result = run?.results.find((item) => item.caseId === testCase.id);

          return (
            <li
              key={testCase.id}
              className={cn(
                "rounded-lg p-2.5",
                !result ? "bg-muted/50" : result.passed ? "bg-success-soft" : "bg-destructive-soft",
              )}
            >
              <div className="flex items-start gap-1.5">
                {result ? (
                  result.passed ? (
                    <CircleCheck className="text-success mt-0.5 size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <CircleAlert
                      className="text-destructive mt-0.5 size-3.5 shrink-0"
                      aria-hidden
                    />
                  )
                ) : null}
                <p className="min-w-0 flex-1 text-xs font-medium">“{testCase.input}”</p>
              </div>

              {!result ? (
                <p className="text-muted-foreground mt-1 text-[11px]">
                  Espera-se: <strong>{testCase.expect.action}</strong>
                  {testCase.expect.toolId ? ` · ${testCase.expect.toolId}` : ""}
                  {testCase.expect.mustAvoid?.length
                    ? ` · sem citar ${testCase.expect.mustAvoid.join(", ")}`
                    : ""}
                </p>
              ) : (
                <>
                  {/* Só as verificações que caíram: listar as que passaram
                      empurraria a informação útil para fora da tela. */}
                  <ul className="mt-1.5 space-y-0.5">
                    {result.checks
                      .filter((check) => !check.passed)
                      .map((check, index) => (
                        <li key={index} className="text-[11px]">
                          <Badge variant="danger">{AGENT_CHECK_LABEL[check.kind]}</Badge>{" "}
                          <span className="text-muted-foreground">esperado</span>{" "}
                          <strong>{check.expected}</strong>{" "}
                          <span className="text-muted-foreground">· veio</span>{" "}
                          <strong>{check.actual}</strong>
                        </li>
                      ))}
                  </ul>

                  {result.error ? (
                    <p className="text-destructive mt-1 text-[11px]">{result.error}</p>
                  ) : null}

                  {result.reply ? (
                    <p className="text-muted-foreground bg-card/60 mt-1.5 max-h-24 overflow-y-auto rounded px-2 py-1.5 text-[11px] leading-relaxed">
                      {result.reply}
                    </p>
                  ) : null}

                  <p className="text-muted-foreground mt-1 text-[10px] tabular-nums">
                    confiança {result.confidence} · {result.latencyMs} ms ·{" "}
                    {result.costUsdCents.toFixed(4)}¢
                  </p>
                </>
              )}

              {testCase.note ? (
                <p className="text-muted-foreground mt-1 text-[11px] italic">{testCase.note}</p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {readOnly ? null : (
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          A rodada mede a versão <strong>salva</strong>. Alterações feitas nesta tela ainda vivem no
          navegador — não existe camada de escrita neste protótipo.
        </p>
      )}
    </div>
  );
}
