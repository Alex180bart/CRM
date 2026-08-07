/**
 * Laço de execução do agente de atendimento.
 *
 * Este arquivo é parte do AI Gateway — ele aplica política, valida saída contra
 * schema e mede custo, como manda a seção 16.1. **Ele não nomeia provedor nem
 * modelo**: a escolha continua sendo da fila em `providers.ts`, e a regra do
 * repositório ("dois arquivos, e só eles, podem nomear um provedor") segue
 * valendo sem exceção.
 *
 * Mora separado de `gateway.ts` por tamanho e por natureza: as outras tarefas
 * são uma chamada e uma validação; esta é um laço com efeito no meio.
 *
 * ## Por que não function calling nativo
 *
 * Os dois provedores declaram ferramenta de formas diferentes, e a fila de
 * reserva teria de traduzir mais um protocolo além do schema — com o agravante
 * de que uma troca de provedor no meio de um laço de ferramentas perderia o
 * estado da chamada pendente. A seção 16.3 descreve o que a saída estruturada
 * já faz: "o modelo apenas propõe a ferramenta e os parâmetros; a aplicação
 * valida permissão, executa a ação e retorna o resultado". Então o pedido de
 * ferramenta viaja como **dado**, no mesmo JSON validado das outras tarefas, e
 * funciona igual nos dois provedores pela tradução que já existe.
 *
 * ## O laço
 *
 * Uma decisão por chamada. O modelo pede uma ferramenta, a aplicação executa (ou
 * recusa, ou registra como pendente), o resultado volta como observação e o
 * modelo decide de novo. Termina quando ele responde, transfere, encerra, ou
 * quando um dos tetos estoura — e teto estourado **transfere**, nunca deixa o
 * contato sem resposta.
 */

import type {
  AgentHandoffResult,
  AgentPendingAction,
  AgentToolId,
  AgentTraceStep,
  AgentTurnResult,
  AiAgentVersion,
  AiRunMeta,
  Queue,
} from "@crm/core";
import { AGENT_TOOLS, repositories } from "@crm/core";

import { runAgentTool } from "./agent-tools";
import { buildMeta, redactCredentials } from "./gateway";
import { AGENT_SCHEMA, agentPrompt, type AgentPromptInput } from "./prompts";
import {
  GatewayFailure,
  complete,
  costUsdCents,
  type ProviderId,
  type ProviderUsage,
} from "./providers";

/**
 * Política desta tarefa.
 *
 * Repete os valores de `TASK_POLICY.atender` em `gateway.ts` porque aquele
 * registro é interno ao Gateway e torná-lo público só para este arquivo
 * alcançá-lo daria acesso à política de todas as tarefas. **Ao mexer numa,
 * mexa na outra** — e o schema, esse, vem de uma fonte só.
 */
const POLICY = { temperature: 0.3, maxOutputTokens: 1200, schema: AGENT_SCHEMA };

/* Saída do modelo ------------------------------------------------------------ */

type ParsedAction = "responder" | "usar_ferramenta" | "transferir" | "encerrar";

interface ParsedTurn {
  rationale: string;
  action: ParsedAction;
  reply: string;
  tool: AgentToolId | null;
  params: Record<string, string>;
  evidence: string;
  handoffQueue: string;
  handoffReason: string;
  confidence: number;
}

const ACTIONS: ParsedAction[] = ["responder", "usar_ferramenta", "transferir", "encerrar"];
const TOOL_IDS = new Set<string>(AGENT_TOOLS.map((tool) => tool.id));

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Validação própria da saída (seção 16.4).
 *
 * O `responseSchema` reduz o desvio mas não é contrato: saída cortada no limite
 * de tokens produz JSON incompleto, e já vi `enum` voltar com valor fora da
 * lista. O que não passa aqui vira reparo, e reparo que falha vira erro — não
 * uma mensagem estranha na cara do contato.
 */
function parseTurn(raw: string): ParsedTurn | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const action = asString(record.action) as ParsedAction;
  if (!ACTIONS.includes(action)) return null;

  const rawTool = asString(record.tool);
  const tool = TOOL_IDS.has(rawTool) ? (rawTool as AgentToolId) : null;

  // Pedir ferramenta sem dizer qual é decisão que não dá para executar.
  if (action === "usar_ferramenta" && !tool) return null;

  const params: Record<string, string> = {};
  if (Array.isArray(record.params)) {
    for (const item of record.params) {
      if (typeof item !== "object" || item === null) continue;
      const pair = item as Record<string, unknown>;
      const name = asString(pair.nome);
      if (name) params[name] = asString(pair.valor);
    }
  }

  const confidence = Number(record.confidence);

  return {
    rationale: asString(record.rationale),
    action,
    reply: asString(record.reply),
    tool,
    params,
    evidence: asString(record.evidence),
    handoffQueue: asString(record.handoffQueue),
    handoffReason: asString(record.handoffReason),
    confidence: Number.isFinite(confidence)
      ? Math.max(0, Math.min(100, Math.round(confidence)))
      : 0,
  };
}

/* Entrada -------------------------------------------------------------------- */

export interface AgentTurnInput {
  version: AiAgentVersion;
  channel: string;
  contactName: string;
  contactId?: string;
  contactFacts?: string[];
  messages: Array<{ role: "contato" | "agente"; body: string; at: string }>;
  /** Turnos que o agente já gastou nesta conversa. */
  turnsUsed: number;
  /** Custo já gasto nesta conversa, em centavos de dólar. */
  spentUsdCents: number;
  withinBusinessHours?: boolean;
}

/* Execução ------------------------------------------------------------------- */

const REPAIR_HINT =
  "Sua resposta anterior não era um JSON válido segundo o schema. Responda novamente APENAS com o objeto JSON completo, sem texto antes ou depois, sem cerca de código.";

export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
  const { version } = input;
  const started = performance.now();

  const queues = await resolveQueues(version);
  const knowledge = await resolveKnowledge(version);

  const steps: AgentTraceStep[] = [];
  const pending: AgentPendingAction[] = [];
  const observations: Array<{ toolId: string; result: string }> = [];

  let usage: ProviderUsage = { inputTokens: 0, outputTokens: 0 };
  let servedBy: { provider: ProviderId; model: string } | null = null;
  let repaired = false;
  let cost = 0;

  const turnsLeft = Math.max(0, version.limits.maxTurns - input.turnsUsed);

  /**
   * Teto de custo por **conversa**, conferido antes de gastar mais.
   *
   * Por conversa e não por turno porque é onde o dano mora: um turno caro é
   * aceitável, cinquenta turnos baratos não. Estourar não devolve erro ao
   * contato — devolve transferência, que é o comportamento correto quando o
   * agente não pode mais trabalhar.
   */
  if (input.spentUsdCents >= version.limits.costCeilingCents) {
    return exhausted(
      version,
      steps,
      "O teto de custo desta conversa foi atingido.",
      started,
      input,
    );
  }

  if (turnsLeft <= 0) {
    return exhausted(
      version,
      steps,
      "O limite de turnos desta conversa foi atingido.",
      started,
      input,
    );
  }

  // +1 porque a última passada é a que produz a resposta, depois das ferramentas.
  const maxPasses = version.limits.maxToolCallsPerTurn + 1;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const promptInput: AgentPromptInput = {
      version,
      channel: input.channel,
      contactName: input.contactName,
      contactFacts: input.contactFacts,
      messages: input.messages,
      queues: queues.map((queue) => ({
        id: queue.id,
        name: queue.name,
        description: queue.description,
      })),
      observations,
      toolCallsLeft: version.limits.maxToolCallsPerTurn - observations.length,
      turnsLeft,
    };

    const { system, user } = agentPrompt(promptInput);
    const safeUser = redactCredentials(user);

    let parsed: ParsedTurn | null = null;

    for (const attempt of [0, 1]) {
      const result = await complete({
        system,
        user: attempt === 1 ? `${safeUser}\n\n${REPAIR_HINT}` : safeUser,
        policy: POLICY,
      });

      servedBy = { provider: result.provider, model: result.model };
      usage = {
        inputTokens: usage.inputTokens + result.usage.inputTokens,
        outputTokens: usage.outputTokens + result.usage.outputTokens,
      };
      cost += costUsdCents(result.provider, result.usage);

      parsed = parseTurn(result.text);
      if (parsed) break;
      repaired = true;
    }

    if (!parsed || !servedBy) {
      throw new GatewayFailure(
        "falha",
        "O agente não conseguiu produzir uma decisão válida para esta conversa.",
        502,
      );
    }

    const index = steps.length;

    /* Ferramenta ------------------------------------------------------------ */

    if (parsed.action === "usar_ferramenta" && parsed.tool) {
      const outcome = await runAgentTool(
        { toolId: parsed.tool, params: parsed.params, evidence: parsed.evidence },
        {
          version,
          knowledge,
          contactName: input.contactName,
          contactId: input.contactId,
          withinBusinessHours: input.withinBusinessHours,
        },
      );

      if (outcome.pending) pending.push(outcome.pending);

      steps.push({
        index,
        action: "usar_ferramenta",
        status: outcome.status,
        toolId: parsed.tool,
        params: parsed.params,
        result: outcome.result,
        rationale: parsed.rationale,
        confidence: parsed.confidence,
      });

      observations.push({ toolId: parsed.tool, result: outcome.result });

      // Última passada permitida: o modelo não terá chance de responder depois.
      if (pass === maxPasses - 1) {
        return handoffResult(
          version,
          steps,
          pending,
          queues,
          "O agente esgotou as consultas deste turno sem chegar a uma resposta.",
          cost,
          buildMeta({
            task: "atender",
            provider: servedBy.provider,
            model: servedBy.model,
            usage,
            latencyMs: performance.now() - started,
            repaired,
          }),
        );
      }

      continue;
    }

    const meta = buildMeta({
      task: "atender",
      provider: servedBy.provider,
      model: servedBy.model,
      usage,
      latencyMs: performance.now() - started,
      repaired,
    });

    /* Transferência --------------------------------------------------------- */

    if (parsed.action === "transferir") {
      steps.push({
        index,
        action: "transferir",
        status: "ok",
        rationale: parsed.rationale,
        confidence: parsed.confidence,
        meta,
      });

      return {
        reply: parsed.reply,
        steps,
        pending,
        handoff: await buildHandoff(version, queues, parsed, input),
        ended: true,
        costUsdCents: cost,
        meta,
      };
    }

    /* Encerramento ---------------------------------------------------------- */

    if (parsed.action === "encerrar") {
      steps.push({
        index,
        action: "encerrar",
        status: "ok",
        rationale: parsed.rationale,
        confidence: parsed.confidence,
        meta,
      });

      return {
        reply: parsed.reply,
        steps,
        pending,
        ended: true,
        costUsdCents: cost,
        meta,
      };
    }

    /* Resposta -------------------------------------------------------------- */

    /**
     * Piso de confiança: a resposta vira transferência.
     *
     * A checagem fica **aqui**, na aplicação, e não como instrução no prompt.
     * Pedir ao modelo que se autocensure abaixo de um número funciona às vezes;
     * conferir o número que ele mesmo declarou funciona sempre. É a diferença
     * entre uma guarda e uma sugestão.
     */
    if (
      version.handoff.transferOnUncertainty &&
      parsed.confidence < version.guards.confidenceFloor
    ) {
      steps.push({
        index,
        action: "responder",
        status: "recusado",
        result: `Confiança ${parsed.confidence} abaixo do piso ${version.guards.confidenceFloor}: a resposta virou transferência.`,
        rationale: parsed.rationale,
        confidence: parsed.confidence,
        meta,
      });

      return {
        reply: version.guards.fallbackMessage,
        steps,
        pending,
        handoff: await buildHandoff(version, queues, parsed, input, "Confiança abaixo do piso."),
        ended: true,
        costUsdCents: cost,
        meta,
      };
    }

    /**
     * Resposta vazia é falha, não silêncio.
     *
     * Deixar passar produziria uma bolha em branco no widget do visitante, que
     * é indistinguível de travamento.
     */
    if (!parsed.reply) {
      throw new GatewayFailure("falha", "O agente devolveu uma resposta vazia.", 502);
    }

    steps.push({
      index,
      action: "responder",
      status: "ok",
      rationale: parsed.rationale,
      confidence: parsed.confidence,
      meta,
    });

    return {
      reply: parsed.reply,
      steps,
      pending,
      ended: false,
      costUsdCents: cost,
      meta,
    };
  }

  // Inalcançável: a última passada do laço sempre retorna. Guarda de tipo.
  throw new GatewayFailure("falha", "O agente terminou o turno sem decidir nada.", 502);
}

/* Apoios --------------------------------------------------------------------- */

/**
 * Filas que o agente pode ver e escolher.
 *
 * No modo `regras` são só as citadas nas regras, mais a padrão: mandar o
 * catálogo inteiro ali seria oferecer escolha que a política não autoriza, e o
 * modelo escolheria. Nos modos em que ele decide, entra a allowlist de
 * `handoff.queueIds` — e lista vazia significa todas, que é o padrão sensato
 * para quem acabou de ligar o roteamento automático.
 *
 * Em qualquer modo a fila padrão entra, senão o último recurso deixaria de
 * existir justamente quando é usado.
 */
async function resolveQueues(version: AiAgentVersion): Promise<Queue[]> {
  const all = await repositories.directory.listQueues();
  const { routing, queueIds, rules, defaultQueueId } = version.handoff;

  if (routing !== "regras" && queueIds.length === 0) return all;

  const allowed = new Set([
    defaultQueueId,
    ...rules.map((rule) => rule.queueId),
    ...(routing === "regras" ? [] : queueIds),
  ]);

  return all.filter((queue) => allowed.has(queue.id));
}

async function resolveKnowledge(version: AiAgentVersion) {
  const sources = await repositories.agents.listKnowledge();
  return sources.filter((source) => version.knowledge.sourceIds.includes(source.id));
}

/**
 * Resolve a fila que o modelo escolheu.
 *
 * O identificador é conferido contra a lista permitida, e fila desconhecida cai
 * na padrão em vez de derrubar a transferência. O modelo escolhe o **motivo**;
 * quem resolve o **destino** é a aplicação — sem isso, uma fila alucinada
 * mandaria a conversa para lugar nenhum.
 */
async function buildHandoff(
  version: AiAgentVersion,
  queues: Queue[],
  parsed: ParsedTurn,
  input: AgentTurnInput,
  reasonOverride?: string,
): Promise<AgentHandoffResult> {
  const known = queues.some((queue) => queue.id === parsed.handoffQueue);
  const queueId = known ? parsed.handoffQueue : version.handoff.defaultQueueId;

  return {
    queueId,
    reason: reasonOverride ?? parsed.handoffReason ?? "Transferido pelo agente.",
    summary: version.handoff.summarize ? summarize(input) : undefined,
  };
}

/**
 * Resumo do handoff, montado de graça.
 *
 * Chamar o modelo de novo só para resumir custaria uma requisição inteira num
 * momento em que o contato já está esperando alguém. As últimas falas dele são
 * o que quem assume precisa ler, e são exatamente o que já está em memória.
 */
function summarize(input: AgentTurnInput): string {
  const said = input.messages
    .filter((message) => message.role === "contato")
    .slice(-3)
    .map((message) => message.body);

  const facts = input.contactFacts?.length ? `Já sabíamos: ${input.contactFacts.join("; ")}. ` : "";

  return `${facts}O contato disse: ${said.map((line) => `"${line}"`).join(" · ")}`;
}

/** Teto estourado: transfere com o motivo, em vez de deixar o contato falando sozinho. */
function exhausted(
  version: AiAgentVersion,
  steps: AgentTraceStep[],
  reason: string,
  started: number,
  input: AgentTurnInput,
): AgentTurnResult {
  const meta: AiRunMeta = buildMeta({
    task: "atender",
    // Nenhuma chamada foi feita: o teto barrou antes. O registro existe para a
    // métrica não perder o evento, com custo zero, que é o que de fato ocorreu.
    provider: "google",
    model: "—",
    usage: { inputTokens: 0, outputTokens: 0 },
    latencyMs: performance.now() - started,
    repaired: false,
  });

  steps.push({
    index: steps.length,
    action: "transferir",
    status: "recusado",
    result: reason,
    confidence: 0,
    meta,
  });

  return {
    reply: version.guards.fallbackMessage,
    steps,
    pending: [],
    handoff: {
      queueId: version.handoff.defaultQueueId,
      reason,
      summary: version.handoff.summarize ? summarize(input) : undefined,
    },
    ended: true,
    costUsdCents: 0,
    meta,
  };
}

function handoffResult(
  version: AiAgentVersion,
  steps: AgentTraceStep[],
  pending: AgentPendingAction[],
  queues: Queue[],
  reason: string,
  cost: number,
  meta: AiRunMeta,
): AgentTurnResult {
  const queueId = queues[0]?.id ?? version.handoff.defaultQueueId;

  return {
    reply: version.guards.fallbackMessage,
    steps,
    pending,
    handoff: { queueId: version.handoff.defaultQueueId || queueId, reason },
    ended: true,
    costUsdCents: cost,
    meta,
  };
}
