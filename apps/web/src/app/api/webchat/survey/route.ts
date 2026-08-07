/**
 * Resposta da pesquisa de satisfação.
 *
 * Rota própria, e não um campo a mais em `/api/webchat/message`, por dois
 * motivos. A nota **não é uma mensagem**: ela não entra na transcrição, não vai
 * para o modelo e não dispara turno de agente. E o corpo é minúsculo e o
 * caminho é quente — todo visitante que responde passa por aqui, inclusive
 * depois de o atendimento acabar, quando a sessão já não deveria acordar o
 * runtime de conversa.
 *
 * Leva CORS como as demais rotas públicas do webchat: quem chama é o quadro no
 * site do cliente.
 */

import type { NextRequest } from "next/server";

import {
  assertOrigin,
  failWithCors,
  jsonWithCors,
  preflight,
  readOrigin,
} from "@/lib/webchat/http";
import { getSession, recordSurvey, resolveByKey } from "@/lib/webchat/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_COMMENT = 500;

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
  const sessionId = typeof record.sessionId === "string" ? record.sessionId.trim() : "";
  const score = Number(record.score);

  if (!key || !sessionId) {
    return failWithCors("invalido", "Chave ou sessão ausente.", origin, 400);
  }

  const resolved = await resolveByKey(key);
  if (!resolved) {
    return failWithCors("nao_encontrado", "Widget não encontrado.", origin, 404);
  }

  const denied = assertOrigin(resolved.widget, origin);
  if (denied) return denied;

  /**
   * A sessão tem de pertencer a este widget.
   *
   * Sem a checagem, um identificador de sessão vazado permitiria pontuar a
   * conversa de outro widget — e a nota é dado que alimenta métrica de time.
   */
  const session = getSession(sessionId);
  if (!session || session.widgetId !== resolved.widget.id) {
    return failWithCors("nao_encontrado", "Sessão não encontrada.", origin, 404);
  }

  const comment =
    typeof record.comment === "string" ? record.comment.slice(0, MAX_COMMENT) : undefined;

  const saved = recordSurvey(sessionId, score, comment);

  if (!saved) {
    /**
     * Já respondida devolve sucesso, não erro.
     *
     * O visitante que clicou duas vezes por lentidão não fez nada errado, e uma
     * mensagem de erro na cara dele depois de avaliar bem o atendimento é a
     * última impressão que se quer deixar. A primeira nota é a que vale; a
     * segunda é ignorada em silêncio.
     */
    if (session.surveyScore !== undefined) {
      return jsonWithCors({ ok: true, alreadyAnswered: true }, origin);
    }
    return failWithCors("invalido", "Nota inválida.", origin, 400);
  }

  return jsonWithCors({ ok: true }, origin);
}
