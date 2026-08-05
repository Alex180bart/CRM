/**
 * Redação de e-mail pelo AI Gateway.
 *
 * Rota separada da do copiloto porque o contrato de entrada não tem nada em
 * comum: o copiloto sempre recebe uma conversa; aqui chega um briefing. Forçar as
 * duas no mesmo corpo faria o validador aceitar pedido sem contexto — que é
 * exatamente o que a rota do copiloto precisa recusar.
 */

import type { NextRequest } from "next/server";
import type { AiEmailDraftInput, AiEmailObjective, AiEmailTone } from "@crm/core";

import { GatewayFailure, enforceRateLimit, runEmailDraft } from "@/lib/ai/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OBJECTIVES: AiEmailObjective[] = [
  "apresentar_servico",
  "reengajar",
  "avisar_prazo",
  "convidar_evento",
  "anunciar_novidade",
  "pedir_documento",
];

const TONES: AiEmailTone[] = ["profissional", "proximo", "urgente", "didatico"];

/** Briefing longo demais não melhora o e-mail; só encarece a chamada. */
const MAX_BRIEF = 2_000;

function fail(code: GatewayFailure["code"], message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function identify(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalido", "Corpo da requisição não é JSON válido.", 400);
  }

  if (typeof body !== "object" || body === null) {
    return fail("invalido", "Corpo da requisição vazio.", 400);
  }

  const record = body as Record<string, unknown>;
  const brief = text(record.brief, MAX_BRIEF).trim();
  const objective = text(record.objective, 32) as AiEmailObjective;
  const tone = text(record.tone, 24) as AiEmailTone;

  if (brief.length < 12) {
    return fail("invalido", "O briefing está curto demais para virar um e-mail.", 400);
  }
  if (!OBJECTIVES.includes(objective)) {
    return fail("invalido", "Objetivo desconhecido para o e-mail.", 400);
  }
  if (!TONES.includes(tone)) {
    return fail("invalido", "Tom desconhecido para o e-mail.", 400);
  }

  const input: AiEmailDraftInput = {
    brief,
    objective,
    tone,
    audience: text(record.audience, 240).trim(),
  };

  try {
    enforceRateLimit(identify(request), performance.now());
    return Response.json(await runEmailDraft(input));
  } catch (error) {
    if (error instanceof GatewayFailure) {
      return fail(error.code, error.message, error.status);
    }
    console.error("[ai-gateway] falha ao redigir e-mail", error);
    return fail("falha", "A redação do e-mail falhou de forma inesperada.", 500);
  }
}
