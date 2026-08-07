/**
 * Execução do conjunto de avaliação (seção 16.4).
 *
 * "Prompts versionados, ambientes de teste e conjunto de casos de avaliação
 * antes de publicar." Até aqui os casos existiam como lista para conferir à mão;
 * esta rota os executa e pontua.
 *
 * ## Por que a verificação é por dimensão, e não um acerto único
 *
 * Um caso que roteia certo e vaza um valor no texto não é "reprovado" e pronto:
 * são dois defeitos de gravidade muito diferente, e agregá-los num booleano
 * apaga justamente o que faria alguém corrigir o prompt. Por isso cada caso
 * devolve uma lista de `AgentEvalCheck` — ação, ferramenta, fila, menção
 * obrigatória e proibição — e a reprovação diz **qual**.
 *
 * ## O que esta avaliação não é
 *
 * Não é julgamento de qualidade por outro modelo. Todas as verificações aqui são
 * **determinísticas**: comparação de enum e busca de substring com acentuação
 * normalizada. Um juiz-modelo traria o problema que a avaliação existe para
 * resolver — variância — para dentro da própria régua. Avaliar tom e utilidade
 * pede rubrica humana, e isso é trabalho do back-end junto com o histórico de
 * execuções.
 *
 * Roda **em série** de propósito: o objetivo é medir, e disparar dez chamadas ao
 * mesmo tempo é o caminho mais curto para o `limite_excedido` do provedor
 * contaminar o resultado com falhas que não são do agente.
 */

import type { AgentEvalCheck, AgentEvalCaseResult, AgentEvalRun, AiAgentVersion } from "@crm/core";
import { normalizeTerm, offsetIso, repositories } from "@crm/core";
import type { NextRequest } from "next/server";

import { runAgentTurn } from "@/lib/ai/agent-runtime";
import { GatewayFailure, enforceRateLimit } from "@/lib/ai/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Um conjunto grande vira conta grande; acima disso, é trabalho de back-end. */
const MAX_CASES = 12;

function fail(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalido", "Corpo da requisição não é JSON válido.", 400);
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const agentId = typeof record.agentId === "string" ? record.agentId.trim() : "";
  const versionId = typeof record.versionId === "string" ? record.versionId.trim() : "";

  if (!agentId) return fail("invalido", "Agente não informado.", 400);

  const agent = await repositories.agents.getById(agentId);
  if (!agent) return fail("nao_encontrado", "Agente não encontrado.", 404);

  const version: AiAgentVersion | undefined = versionId
    ? agent.versions.find((item) => item.id === versionId)
    : agent.versions.find((item) => item.id === agent.activeVersionId);

  if (!version) return fail("nao_encontrado", "Versão do agente não encontrada.", 404);

  const cases = version.evaluation.slice(0, MAX_CASES);
  if (cases.length === 0) {
    return fail("invalido", "Esta versão não tem casos de avaliação cadastrados.", 400);
  }

  const results: AgentEvalCaseResult[] = [];
  let cost = 0;
  let model = "—";
  let promptVersion = "—";

  try {
    enforceRateLimit(`eval:${agentId}`, performance.now());
  } catch (error) {
    if (error instanceof GatewayFailure) return fail(error.code, error.message, error.status);
    throw error;
  }

  for (const testCase of cases) {
    const started = performance.now();

    try {
      /**
       * Cada caso roda numa conversa nova.
       *
       * Encadear os casos mediria a memória do agente, não o caso — e o
       * resultado deixaria de ser comparável entre execuções, porque a ordem
       * passaria a importar.
       */
      const turn = await runAgentTurn({
        version,
        channel: "webchat",
        contactName: "Cliente de teste",
        messages: [{ role: "contato", body: testCase.input, at: offsetIso({}) }],
        turnsUsed: 0,
        spentUsdCents: 0,
        withinBusinessHours: true,
      });

      cost += turn.costUsdCents;
      model = turn.meta.model;
      promptVersion = turn.meta.promptVersion;

      // O passo que decidiu o turno é o último: os anteriores são consultas.
      const decisive = turn.steps[turn.steps.length - 1];
      const toolStep = turn.steps.find((step) => step.action === "usar_ferramenta");

      /**
       * A ação observada precisa de um cuidado.
       *
       * Quando o caso espera `usar_ferramenta`, o agente costuma usar a
       * ferramenta **e** responder no mesmo turno — o laço resolve as duas
       * coisas. Comparar só a ação final reprovaria o comportamento correto.
       * Então: se a expectativa é ferramenta, o que conta é ter havido um passo
       * de ferramenta.
       */
      const observedAction =
        testCase.expect.action === "usar_ferramenta" && toolStep
          ? "usar_ferramenta"
          : (decisive?.action ?? "responder");

      const checks: AgentEvalCheck[] = [
        {
          kind: "acao",
          passed: observedAction === testCase.expect.action,
          expected: testCase.expect.action,
          actual: observedAction,
        },
      ];

      if (testCase.expect.toolId) {
        checks.push({
          kind: "ferramenta",
          passed: toolStep?.toolId === testCase.expect.toolId,
          expected: testCase.expect.toolId,
          actual: toolStep?.toolId ?? "nenhuma",
        });
      }

      if (testCase.expect.queueId) {
        checks.push({
          kind: "fila",
          passed: turn.handoff?.queueId === testCase.expect.queueId,
          expected: testCase.expect.queueId,
          actual: turn.handoff?.queueId ?? "não transferiu",
        });
      }

      const haystack = normalizeTerm(turn.reply);

      for (const term of testCase.expect.mustMention ?? []) {
        checks.push({
          kind: "mencao",
          passed: haystack.includes(normalizeTerm(term)),
          expected: term,
          actual: haystack.includes(normalizeTerm(term)) ? "citou" : "não citou",
        });
      }

      for (const term of testCase.expect.mustAvoid ?? []) {
        const leaked = haystack.includes(normalizeTerm(term));
        checks.push({
          kind: "proibicao",
          passed: !leaked,
          expected: `sem "${term}"`,
          actual: leaked ? `citou "${term}"` : "não citou",
        });
      }

      results.push({
        caseId: testCase.id,
        input: testCase.input,
        passed: checks.every((check) => check.passed),
        checks,
        reply: turn.reply,
        rationale: decisive?.rationale,
        confidence: decisive?.confidence ?? 0,
        costUsdCents: turn.costUsdCents,
        latencyMs: Math.round(performance.now() - started),
      });
    } catch (error) {
      /**
       * Falha de provedor não derruba a rodada inteira.
       *
       * Perder oito casos porque o nono estourou cota transformaria a avaliação
       * em algo que só funciona quando tudo está bem — que é quando ela menos
       * serve. O caso entra como falha, com o motivo, e a leitura fica honesta.
       */
      results.push({
        caseId: testCase.id,
        input: testCase.input,
        passed: false,
        checks: [],
        reply: "",
        confidence: 0,
        costUsdCents: 0,
        latencyMs: Math.round(performance.now() - started),
        error: error instanceof GatewayFailure ? error.message : "O agente falhou neste caso.",
      });
    }
  }

  const run: AgentEvalRun = {
    agentId,
    versionId: version.id,
    promptVersion,
    model,
    passed: results.filter((result) => result.passed).length,
    total: results.length,
    costUsdCents: cost,
    results,
    occurredAt: offsetIso({}),
  };

  return Response.json(run);
}
