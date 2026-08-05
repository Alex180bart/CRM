/**
 * Configuração pública do widget.
 *
 * Primeira chamada que o widget faz. Devolve o necessário para se desenhar e
 * nada além disso — e é aqui que a lista de domínios deixa de ser texto na tela
 * de administração e passa a valer: origem fora da lista recebe 403 e o script
 * não monta nada.
 */

import type { NextRequest } from "next/server";

import { assertOrigin, failWithCors, jsonWithCors, preflight, readOrigin } from "@/lib/webchat/http";
import { publicConfig, resolveByKey } from "@/lib/webchat/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest): Response {
  return preflight(readOrigin(request));
}

export async function GET(request: NextRequest): Promise<Response> {
  const origin = readOrigin(request);
  const key = request.nextUrl.searchParams.get("key")?.trim() ?? "";

  if (!key) {
    return failWithCors("invalido", "Chave do widget ausente.", origin, 400);
  }

  const resolved = await resolveByKey(key);
  if (!resolved) {
    // A mesma resposta para chave inexistente e para widget sem versão
    // publicada: distinguir os dois entregaria a quem sonda a informação de que
    // a chave existe.
    return failWithCors("nao_encontrado", "Widget não encontrado ou não publicado.", origin, 404);
  }

  const denied = assertOrigin(resolved.widget, origin);
  if (denied) return denied;

  return jsonWithCors(publicConfig(resolved), origin);
}
