/**
 * Abertura de sessão do webchat.
 *
 * Recebe as respostas do formulário anterior à conversa (quando há) e devolve as
 * primeiras mensagens — do chatbot, se houver fluxo publicado, ou a saudação.
 * A partir daqui existe conversa: ela aparece no Inbox e o atendente pode
 * responder.
 */

import type { NextRequest } from "next/server";

import { assertOrigin, failWithCors, jsonWithCors, preflight, readOrigin } from "@/lib/webchat/http";
import { resolveByKey, startSession } from "@/lib/webchat/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Formulário curto por natureza; um corpo grande aqui é abuso, não uso. */
const MAX_FIELD_LENGTH = 400;
const MAX_FIELDS = 12;

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
  const key = typeof record.key === "string" ? record.key.trim() : "";

  if (!key) return failWithCors("invalido", "Chave do widget ausente.", origin, 400);

  const resolved = await resolveByKey(key);
  if (!resolved) {
    return failWithCors("nao_encontrado", "Widget não encontrado ou não publicado.", origin, 404);
  }

  const denied = assertOrigin(resolved.widget, origin);
  if (denied) return denied;

  // O que chega do navegador do visitante não é confiável: corta comprimento e
  // quantidade antes de guardar qualquer coisa.
  const prechat: Record<string, string> = {};
  if (typeof record.prechat === "object" && record.prechat !== null) {
    for (const [rawKey, rawValue] of Object.entries(record.prechat).slice(0, MAX_FIELDS)) {
      if (typeof rawValue !== "string") continue;
      const trimmed = rawValue.trim().slice(0, MAX_FIELD_LENGTH);
      if (trimmed) prechat[rawKey.slice(0, 64)] = trimmed;
    }
  }

  /**
   * A procedência é a da página, não a do quadro.
   *
   * O `Origin` da requisição é sempre o nosso domínio — a chamada parte de
   * dentro do `iframe`. O `host` vem do `embed.js` e é o endereço real do site
   * que hospeda o widget: é ele que responde "de qual site veio este lead".
   *
   * Vale como **informação**, nunca como autorização: qualquer um pode mandar
   * qualquer string aqui. Quem autoriza é a política `frame-ancestors` que o
   * middleware aplica ao quadro, e essa o navegador não deixa forjar.
   */
  const host = typeof record.host === "string" ? record.host.slice(0, 200) : "";

  const session = await startSession({
    resolved,
    origin: host || origin || "desconhecida",
    prechat,
  });

  return jsonWithCors(session, origin);
}
