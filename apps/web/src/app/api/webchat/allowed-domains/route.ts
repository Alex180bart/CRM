/**
 * Domínios autorizados de um widget.
 *
 * Existe para o middleware montar a política `frame-ancestors` do quadro. É a
 * única informação que ele precisa, e devolvê-la sozinha evita carregar o
 * módulo de dados dentro do runtime de borda a cada requisição.
 *
 * Não leva CORS de propósito: é consumo interno. A lista de domínios de um
 * widget não é segredo — ela aparece na tela de administração — mas também não
 * há motivo para publicá-la a qualquer origem.
 */

import type { NextRequest } from "next/server";

import { resolveByKey } from "@/lib/webchat/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  const key = request.nextUrl.searchParams.get("key")?.trim() ?? "";
  if (!key) return Response.json({ domains: [] }, { status: 400 });

  const resolved = await resolveByKey(key);
  // Widget inexistente ou sem versão publicada devolve lista vazia, e o
  // middleware traduz isso em `frame-ancestors 'none'`.
  return Response.json(
    { domains: resolved?.widget.allowedDomains ?? [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}
