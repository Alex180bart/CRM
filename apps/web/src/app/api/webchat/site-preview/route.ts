/**
 * Pode este site ser exibido dentro de um quadro?
 *
 * A prévia do editor tenta mostrar o site **real** do cliente com o widget por
 * cima. Isso só funciona quando o site permite ser embutido — e a maioria dos
 * sites grandes não permite. Descobrir isso do lado do cliente é impossível:
 * quando `X-Frame-Options` barra o carregamento, o navegador não avisa a página
 * hospedeira; o quadro simplesmente fica branco, e a pessoa conclui que o nosso
 * editor está quebrado.
 *
 * Então perguntamos ao servidor antes: uma requisição, dois cabeçalhos lidos, e
 * a interface sabe se mostra o site de verdade ou explica por que não pode.
 *
 * A busca passa pela mesma guarda de SSRF da prévia de mídia — é URL informada
 * pelo cliente, com todos os riscos que isso carrega.
 */

import type { NextRequest } from "next/server";

import { MAX_URL_LENGTH, TargetError, inspect } from "@/lib/net/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface SitePreviewResult {
  url: string;
  /** Endereço final, depois dos redirecionamentos. */
  finalUrl: string;
  framable: boolean;
  /** Motivo legível quando `framable` é falso. */
  reason?: string;
  title?: string;
}

function fail(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * Lê `X-Frame-Options` e `frame-ancestors` da CSP.
 *
 * A CSP tem precedência sobre `X-Frame-Options` nos navegadores modernos, mas
 * checar as duas é mais barato que raciocinar sobre qual venceu — e um `DENY`
 * em qualquer das duas já basta para não tentar.
 */
function readFrameRules(response: Response): { framable: boolean; reason?: string } {
  const xfo = response.headers.get("x-frame-options")?.trim().toLowerCase();

  if (xfo === "deny") {
    return { framable: false, reason: "O site envia X-Frame-Options: DENY." };
  }
  if (xfo === "sameorigin") {
    return {
      framable: false,
      reason: "O site envia X-Frame-Options: SAMEORIGIN — só ele mesmo pode embuti-lo.",
    };
  }

  const csp = response.headers.get("content-security-policy") ?? "";
  const directive = /frame-ancestors\s+([^;]+)/i.exec(csp);

  if (directive) {
    const value = directive[1]?.trim().toLowerCase() ?? "";
    if (value.includes("'none'")) {
      return { framable: false, reason: "A política de segurança do site usa frame-ancestors 'none'." };
    }
    if (!value.includes("*")) {
      return {
        framable: false,
        reason: `A política de segurança do site só permite os quadros de: ${directive[1]?.trim()}.`,
      };
    }
  }

  return { framable: true };
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalido", "Corpo da requisição não é JSON válido.", 400);
  }

  const raw = typeof (body as Record<string, unknown>)?.url === "string"
    ? ((body as Record<string, unknown>).url as string).trim()
    : "";

  if (!raw) return fail("invalido", "Informe o endereço do site.", 400);
  if (raw.length > MAX_URL_LENGTH) return fail("invalido", "Endereço longo demais.", 400);

  let target: URL;
  try {
    // Quem digita "meusite.com.br" não está errado; só não escreveu o esquema.
    target = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return fail("invalido", "Endereço inválido.", 400);
  }

  try {
    const { response, finalUrl } = await inspect(target);
    await response.body?.cancel();

    if (response.status >= 400) {
      return Response.json({
        url: target.toString(),
        finalUrl: finalUrl.toString(),
        framable: false,
        reason: `O site respondeu ${response.status}.`,
      } satisfies SitePreviewResult);
    }

    const rules = readFrameRules(response);

    return Response.json({
      url: target.toString(),
      finalUrl: finalUrl.toString(),
      framable: rules.framable,
      reason: rules.reason,
    } satisfies SitePreviewResult);
  } catch (error) {
    if (error instanceof TargetError) {
      return fail(error.code, error.message, error.code === "bloqueado" ? 403 : 502);
    }
    console.error("[webchat] falha ao inspecionar site", error);
    return fail("falha", "Não foi possível verificar o site.", 500);
  }
}
