/**
 * Resolução de mídia por link.
 *
 * Recebe uma URL e devolve **metadados**: tipo, título, capa, tamanho e tipo
 * MIME. Nunca devolve o conteúdo. Serve a dois casos que o navegador não resolve
 * sozinho: descobrir se um endereço é de fato uma imagem (a extensão mente, e o
 * `Content-Type` de outro domínio é ilegível pelo cliente por causa do CORS) e
 * obter título e capa de um vídeo do YouTube.
 *
 * É o embrião do processamento de mídia da seção 11. Quando o back-end existir,
 * o mesmo endereço passa a enfileirar o download, o antivírus e o armazenamento
 * em vez de só olhar o cabeçalho.
 *
 * ## Por que esta rota exige cuidado
 *
 * Um endpoint que busca URL arbitrária a pedido do cliente é um pedido de SSRF:
 * sem guarda, `http://169.254.169.254/latest/meta-data/` transforma o servidor
 * em procurador para a rede interna e para os metadados da nuvem. As proteções
 * abaixo não são opcionais nem "para depois".
 */

import type { NextRequest } from "next/server";
import type { AttachmentKind, MediaProvider } from "@elora/core";
import { classifyUrl, fileNameFromUrl, kindFromMimeType, parseYouTube } from "@elora/core";

import {
  FETCH_TIMEOUT_MS,
  MAX_URL_LENGTH,
  TargetError,
  inspect,
  type TargetFailureCode,
} from "@/lib/net/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** oEmbed do YouTube: host fixo, então não passa pela guarda de destino. */
const YOUTUBE_OEMBED = "https://www.youtube.com/oembed";

export interface MediaPreview {
  url: string;
  kind: AttachmentKind;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  previewUrl?: string;
  title?: string;
  provider?: MediaProvider;
  externalUrl?: string;
}

type FailureCode = TargetFailureCode;

function fail(code: FailureCode, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * Tamanho declarado pelo servidor.
 *
 * Com `Range` atendido (206), `Content-Length` vale 1 byte e o total real está
 * em `Content-Range`. Sem isso, o tamanho de todo link cairia para "1 B".
 */
function readSize(response: Response): number | undefined {
  const range = response.headers.get("content-range");
  const total = range ? /\/(\d+)\s*$/.exec(range)?.[1] : undefined;
  if (total) return Number(total);

  if (response.status === 206) return undefined;

  const length = response.headers.get("content-length");
  return length ? Number(length) : undefined;
}

/* YouTube ------------------------------------------------------------------- */

interface OEmbed {
  title?: string;
  thumbnail_url?: string;
  author_name?: string;
}

/**
 * Título e capa oficiais via oEmbed.
 *
 * A capa também sai de `parseYouTube` sem chamada alguma, mas o título só o
 * provedor tem — e é o título que faz o cartão dizer "Aula 3 — Fechamento
 * contábil" em vez de um identificador. Falha aqui não é fatal: cai para a capa
 * previsível e o nome genérico.
 */
async function resolveYouTube(watchUrl: string): Promise<OEmbed | null> {
  try {
    const response = await fetch(
      `${YOUTUBE_OEMBED}?url=${encodeURIComponent(watchUrl)}&format=json`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store" },
    );
    if (!response.ok) return null;
    return (await response.json()) as OEmbed;
  } catch {
    return null;
  }
}

/* Rota ---------------------------------------------------------------------- */

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalido", "Corpo da requisição não é JSON válido.", 400);
  }

  const raw = (body as { url?: unknown })?.url;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return fail("invalido", "Informe o endereço do link.", 400);
  }
  if (raw.length > MAX_URL_LENGTH) {
    return fail("invalido", "O endereço é longo demais.", 400);
  }

  // `classifyUrl` já completa o esquema (`withHttpScheme`), então colar
  // `youtu.be/abc` funciona sem que a rota repita a regra.
  const classified = classifyUrl(raw);

  let parsed: URL;
  try {
    parsed = new URL(classified.normalizedUrl);
  } catch {
    return fail("invalido", "Endereço inválido.", 400);
  }

  /* Vídeo de provedor: resolve por oEmbed, sem buscar a página. */
  if (classified.provider === "youtube") {
    const youtube = parseYouTube(classified.normalizedUrl);
    if (!youtube) return fail("invalido", "Não reconheci o vídeo neste link do YouTube.", 400);

    const meta = await resolveYouTube(youtube.watchUrl);

    const preview: MediaPreview = {
      url: youtube.watchUrl,
      kind: "video",
      provider: "youtube",
      fileName: meta?.title ?? `Vídeo do YouTube (${youtube.id})`,
      title: meta?.title,
      // A capa devolvida pelo oEmbed é a que o provedor considera vigente;
      // `hqdefault` é o retorno seguro porque existe para todo vídeo.
      previewUrl: meta?.thumbnail_url ?? youtube.thumbnailUrl,
      mimeType: "text/html",
      externalUrl: youtube.watchUrl,
    };
    return Response.json(preview);
  }

  /* Link comum: confere o que o servidor de fato entrega. */
  try {
    const { response, finalUrl } = await inspect(parsed);
    await response.body?.cancel();

    if (!response.ok && response.status !== 206) {
      return fail("inacessivel", `O link respondeu ${response.status}.`, 422);
    }

    const mimeType = response.headers.get("content-type") ?? "application/octet-stream";
    const kind = kindFromMimeType(mimeType);

    if (kind === "desconhecido") {
      return fail(
        "nao_suportado",
        "Este link é uma página, não um arquivo. Cole o endereço direto da imagem.",
        422,
      );
    }

    const preview: MediaPreview = {
      url: finalUrl.toString(),
      kind,
      fileName: fileNameFromUrl(finalUrl.toString()),
      mimeType: mimeType.split(";")[0]?.trim() ?? mimeType,
      sizeBytes: readSize(response),
      previewUrl: kind === "imagem" ? finalUrl.toString() : undefined,
      externalUrl: finalUrl.toString(),
    };
    return Response.json(preview);
  } catch (error) {
    if (error instanceof TargetError) {
      return fail(error.code, error.message, error.code === "bloqueado" ? 403 : 422);
    }
    console.error("[media-preview] falha não prevista", error);
    return fail("inacessivel", "Não foi possível verificar o link.", 502);
  }
}
