/**
 * Mensagem do visitante e leitura da conversa.
 *
 * `POST` envia; `GET` busca o que chegou desde a última leitura. O widget usa o
 * `GET` em intervalo curto porque não há WebSocket aqui — quando o back-end
 * entrar, esta rota vira o ponto de assinatura e o widget deixa de perguntar.
 */

import type { NextRequest } from "next/server";

import { failWithCors, jsonWithCors, preflight, readOrigin } from "@/lib/webchat/http";
import { pollSession, receiveMessage } from "@/lib/webchat/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGE_LENGTH = 2_000;

export function OPTIONS(request: NextRequest): Response {
  return preflight(readOrigin(request));
}

export async function POST(request: NextRequest): Promise<Response> {
  const origin = readOrigin(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failWithCors("invalido", "Corpo da requisição não é JSON válido.", origin, 400);
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const sessionId = typeof record.sessionId === "string" ? record.sessionId : "";
  const text = typeof record.body === "string" ? record.body.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
  const portId = typeof record.portId === "string" ? record.portId : undefined;

  if (!sessionId) return failWithCors("invalido", "Sessão ausente.", origin, 400);
  if (!text) return failWithCors("invalido", "Mensagem vazia.", origin, 400);

  const session = await receiveMessage({ sessionId, body: text, portId });
  if (!session) {
    // Sessão expirada é o caso comum aqui: o widget reabre uma nova em vez de
    // mostrar erro, então a resposta precisa ser distinguível.
    return failWithCors("sessao_expirada", "Esta conversa não está mais ativa.", origin, 410);
  }

  return jsonWithCors(session, origin);
}

export async function GET(request: NextRequest): Promise<Response> {
  const origin = readOrigin(request);
  const sessionId = request.nextUrl.searchParams.get("session")?.trim() ?? "";

  if (!sessionId) return failWithCors("invalido", "Sessão ausente.", origin, 400);

  const session = await pollSession(sessionId);
  if (!session) {
    return failWithCors("sessao_expirada", "Esta conversa não está mais ativa.", origin, 410);
  }

  return jsonWithCors(session, origin);
}
