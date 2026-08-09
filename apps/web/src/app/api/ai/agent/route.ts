/**
 * Turno do agente de atendimento.
 *
 * Rota separada de `/api/ai/copilot` por uma diferença que não é de
 * organização: aqui o texto vai **direto ao contato**, sem revisão de ninguém.
 * Compartilhar rota faria as duas coisas dividirem o mesmo freio de uso e a
 * mesma forma de erro, quando o risco de cada uma é de outra ordem.
 *
 * Quem chama é o simulador do editor. O webchat **não** passa por aqui: ele
 * chama `runAgentTurn` direto no servidor, porque a conversa já está no
 * processo e uma volta pela rede só acrescentaria latência ao visitante que
 * está esperando.
 *
 * O simulador pode rodar o **rascunho**, e é a única coisa que pode: é para isso
 * que ele existe — ver o comportamento antes de publicar.
 */

import type { AiAgentVersion } from "@elora/core";
import { repositories } from "@elora/core";
import type { NextRequest } from "next/server";

import { runAgentTurn } from "@/lib/ai/agent-runtime";
import { GatewayFailure, enforceRateLimit } from "@/lib/ai/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_MESSAGES = 40;

function fail(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function identify(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return `agent:${forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local"}`;
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

  /**
   * Sem versão informada, roda a publicada; com versão, roda aquela.
   *
   * A versão pedida é conferida contra as versões **deste** agente. Sem essa
   * checagem, um identificador de versão de outro agente rodaria com as
   * ferramentas e as filas do agente errado.
   */
  const version: AiAgentVersion | undefined = versionId
    ? agent.versions.find((item) => item.id === versionId)
    : agent.versions.find((item) => item.id === agent.activeVersionId);

  if (!version) return fail("nao_encontrado", "Versão do agente não encontrada.", 404);

  const messages = Array.isArray(record.messages)
    ? record.messages
        .filter(
          (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
        )
        .map((item) => ({
          role: item.role === "agente" ? ("agente" as const) : ("contato" as const),
          body: typeof item.body === "string" ? item.body.slice(0, MAX_MESSAGE_LENGTH).trim() : "",
          at: typeof item.at === "string" ? item.at : "",
        }))
        .filter((message) => message.body && message.at)
        .slice(-MAX_MESSAGES)
    : [];

  const contactName =
    typeof record.contactName === "string" && record.contactName.trim()
      ? record.contactName.trim().slice(0, 120)
      : "visitante";

  const facts = Array.isArray(record.contactFacts)
    ? record.contactFacts
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.slice(0, 200))
        .slice(0, 8)
    : undefined;

  try {
    // O freio vem antes de montar prompt, como no copiloto: nosso limite barra o
    // chamador em vez de virar porta de entrada para a reserva de provedor.
    enforceRateLimit(identify(request), performance.now());

    const result = await runAgentTurn({
      version,
      channel: typeof record.channel === "string" ? record.channel : "webchat",
      contactName,
      contactFacts: facts,
      messages,
      turnsUsed: Number(record.turnsUsed) || 0,
      spentUsdCents: Number(record.spentUsdCents) || 0,
      withinBusinessHours:
        typeof record.withinBusinessHours === "boolean" ? record.withinBusinessHours : undefined,
    });

    return Response.json(result);
  } catch (error) {
    if (error instanceof GatewayFailure) {
      return fail(error.code, error.message, error.status);
    }
    console.error("[ai-agent] falha não prevista", error);
    return fail("falha", "O agente falhou de forma inesperada.", 500);
  }
}
