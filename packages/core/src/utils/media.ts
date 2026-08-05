/**
 * Classificação de mídia por URL.
 *
 * Funções puras, sem rede: o mesmo código roda no navegador (para decidir a
 * interface antes de qualquer chamada) e no servidor (para validar o que o
 * cliente mandou). Nenhuma das duas pontas confia na outra.
 *
 * A separação importa: **o que a URL parece** é decidido aqui, offline e de
 * graça; **o que a URL é de fato** só o servidor descobre, buscando o recurso.
 * Um link terminado em `.jpg` pode servir HTML, e é por isso que a rota de
 * prévia confere o `Content-Type` em vez de acreditar na extensão.
 */

import type { AttachmentKind, MediaProvider } from "../types/inbox";

export interface ClassifiedUrl {
  /** Palpite do tipo, a partir da forma da URL. */
  kind: AttachmentKind | "desconhecido";
  provider?: MediaProvider;
  /** Identificador no provedor, quando houver (id do vídeo do YouTube). */
  providerId?: string;
  /** URL normalizada — sem parâmetros de rastreio e de tempo. */
  normalizedUrl: string;
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|bmp|svg|ico|heic|heif)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogv|mov|m4v|avi|mkv)$/i;
const AUDIO_EXTENSIONS = /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|weba)$/i;
const DOCUMENT_EXTENSIONS =
  /\.(pdf|docx?|xlsx?|pptx?|txt|csv|ods|odt|odp|rtf|xml|json|zip|rar|7z)$/i;

/**
 * Hosts do YouTube. `youtube-nocookie` entra porque links de incorporação
 * chegam nessa forma, e `music.youtube` porque o aluno cola o que estava
 * ouvindo. Todos servem o mesmo identificador de 11 caracteres.
 */
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
]);

const YOUTUBE_ID = /^[\w-]{11}$/;

/** Caminhos que carregam o identificador no primeiro segmento após o prefixo. */
const YOUTUBE_PATH_PREFIXES = ["embed", "shorts", "live", "v"];

export interface YouTubeVideo {
  id: string;
  /** URL canônica de visualização, sem playlist nem parâmetro de tempo. */
  watchUrl: string;
  /** Capa. `hqdefault` existe para todo vídeo; `maxresdefault` só em HD. */
  thumbnailUrl: string;
  highResThumbnailUrl: string;
  /** Incorporação sem cookie de rastreio, para quando houver player embutido. */
  embedUrl: string;
}

/**
 * Extrai o vídeo de uma URL do YouTube.
 *
 * Devolve `null` para qualquer coisa que não seja reconhecidamente um vídeo —
 * inclusive URLs do YouTube que apontam para canal, playlist ou busca. Melhor
 * tratar como link comum do que exibir a capa do vídeo errado.
 */
export function parseYouTube(rawUrl: string): YouTubeVideo | null {
  let url: URL;
  try {
    url = new URL(withHttpScheme(rawUrl));
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  let id: string | undefined;

  if (url.hostname.toLowerCase().endsWith("youtu.be")) {
    // youtu.be/ID
    id = segments[0];
  } else if (segments[0] && YOUTUBE_PATH_PREFIXES.includes(segments[0])) {
    // youtube.com/embed/ID · /shorts/ID · /live/ID · /v/ID
    id = segments[1];
  } else {
    // youtube.com/watch?v=ID
    id = url.searchParams.get("v") ?? undefined;
  }

  if (!id || !YOUTUBE_ID.test(id)) return null;

  return {
    id,
    watchUrl: `https://www.youtube.com/watch?v=${id}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    highResThumbnailUrl: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
  };
}

/**
 * Remove parâmetros que não identificam o recurso.
 *
 * Dois links para a mesma imagem não deveriam virar dois anexos diferentes só
 * porque um veio com `utm_source`. Também evita carregar rastreio de campanha
 * de terceiro para dentro do histórico do cliente.
 */
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "si",
  "feature",
];

/**
 * Completa o esquema quando falta.
 *
 * Colar `youtu.be/abc` ou `exemplo.com/foto.jpg` é o caso comum, e recusar por
 * falta de `https://` seria pedantismo. Fica em core porque tanto a rota (que
 * valida o pedido) quanto a interface (que dá retorno enquanto o atendente
 * digita) precisam concordar sobre o que o texto significa — duas
 * implementações divergiriam na primeira semana.
 */
export function withHttpScheme(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return trimmed;
  return /^[a-z][\w+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function normalizeMediaUrl(rawUrl: string): string {
  try {
    const url = new URL(withHttpScheme(rawUrl));
    for (const param of TRACKING_PARAMS) url.searchParams.delete(param);
    return url.toString();
  } catch {
    return rawUrl.trim();
  }
}

/** Palpite do tipo pela extensão do caminho — ignora a query. */
export function kindFromUrl(rawUrl: string): AttachmentKind | "desconhecido" {
  let path: string;
  try {
    path = new URL(withHttpScheme(rawUrl)).pathname;
  } catch {
    return "desconhecido";
  }

  if (IMAGE_EXTENSIONS.test(path)) return "imagem";
  if (VIDEO_EXTENSIONS.test(path)) return "video";
  if (AUDIO_EXTENSIONS.test(path)) return "audio";
  if (DOCUMENT_EXTENSIONS.test(path)) return "documento";
  return "desconhecido";
}

export function classifyUrl(rawUrl: string): ClassifiedUrl {
  const normalizedUrl = normalizeMediaUrl(rawUrl);
  const youtube = parseYouTube(normalizedUrl);

  if (youtube) {
    return {
      kind: "video",
      provider: "youtube",
      providerId: youtube.id,
      normalizedUrl: youtube.watchUrl,
    };
  }

  return { kind: kindFromUrl(normalizedUrl), normalizedUrl };
}

/** Tipo derivado do `Content-Type` devolvido pelo servidor — este é o confiável. */
export function kindFromMimeType(mimeType: string): AttachmentKind | "desconhecido" {
  const type = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (type.startsWith("image/")) return "imagem";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (!type || type === "text/html" || type === "application/octet-stream") {
    // HTML é página, não arquivo; octet-stream é "não sei". Nos dois casos a
    // interface não deve prometer visualização.
    return type === "text/html" ? "desconhecido" : "documento";
  }
  return "documento";
}

/** Nome de exibição a partir da URL, quando o servidor não informa um. */
export function fileNameFromUrl(rawUrl: string, fallback = "arquivo"): string {
  try {
    const url = new URL(rawUrl.trim());
    const last = url.pathname.split("/").filter(Boolean).pop();
    if (!last) return url.hostname;
    return decodeURIComponent(last).slice(0, 180);
  } catch {
    return fallback;
  }
}
