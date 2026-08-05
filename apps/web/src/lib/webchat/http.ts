import type { WebchatWidget } from "@crm/core";

import { isOriginAllowed } from "./server";

/**
 * Fronteira HTTP do webchat.
 *
 * O widget roda no domínio do cliente, então **toda** resposta destas rotas
 * precisa de CORS — sem isso o navegador do visitante recusa a leitura e o chat
 * fica em branco sem nenhum erro visível na tela.
 *
 * O cabeçalho `Access-Control-Allow-Origin` devolve a origem **específica**, não
 * `*`: eco da origem só acontece depois de a origem passar pela lista do widget,
 * e isso transforma o cabeçalho num segundo lugar onde a autorização aparece.
 */

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    // Sem origem (curl, mesma origem) não há o que ecoar.
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    // A resposta muda conforme a origem; sem isto um proxy serviria a resposta
    // de um domínio autorizado para outro que não é.
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
  };
}

export function jsonWithCors(data: unknown, origin: string | null, status = 200): Response {
  return Response.json(data, { status, headers: corsHeaders(origin) });
}

export function failWithCors(
  code: string,
  message: string,
  origin: string | null,
  status: number,
): Response {
  return Response.json({ error: { code, message } }, { status, headers: corsHeaders(origin) });
}

/** Resposta ao preflight. O navegador manda antes de qualquer POST com JSON. */
export function preflight(origin: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

/**
 * Origem da requisição.
 *
 * `Origin` é o cabeçalho correto e o navegador sempre o envia em requisição
 * cruzada. O `Referer` entra como reserva porque alguns ambientes o preservam
 * quando o `Origin` vem `null` — mas só o host dele é aproveitado.
 */
export function readOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== "null") return origin;

  const referer = request.headers.get("referer");
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/** Recusa a origem que não está na lista do widget. */
export function assertOrigin(widget: WebchatWidget, origin: string | null): Response | null {
  if (isOriginAllowed(widget, origin)) return null;
  return failWithCors(
    "dominio_nao_autorizado",
    "Este domínio não está autorizado a carregar o widget.",
    origin,
    403,
  );
}
