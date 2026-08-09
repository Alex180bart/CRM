/**
 * Anexos no compositor.
 *
 * Enquanto não há armazenamento, o arquivo escolhido **não sai do navegador**:
 * fica num `File` em memória e a prévia é um object URL local. A seção 11 do
 * plano descreve o caminho real da mídia — download temporário, antivírus,
 * armazenamento, expiração, miniatura e controle de acesso — e nada disso pode
 * ser simulado de forma honesta aqui. O que a interface faz é o que dá para
 * fazer bem: validar antes, mostrar a prévia, e dizer em letras claras que o
 * envio real depende do back-end.
 *
 * A validação sendo do cliente é conveniência, não segurança. Quando o upload
 * existir, o servidor precisa repetir cada uma destas checagens — tipo, tamanho
 * e extensão vindos do navegador são declaração do usuário, não fato.
 */

import type { Attachment, AttachmentKind, MediaProvider } from "@elora/core";

/** Teto por arquivo. O WhatsApp aceita 16 MB em mídia e 100 MB em documento. */
export const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024;

/** Teto por mensagem — evita a bandeja virar transferência de pasta inteira. */
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

/**
 * Extensões recusadas de saída.
 *
 * Não é antivírus: é o mínimo para o atendente não enviar um executável a um
 * cliente por engano, e para o anexo não virar vetor de distribuição usando
 * nosso número como remetente confiável.
 */
const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "msi",
  "bat",
  "cmd",
  "com",
  "scr",
  "cpl",
  "vbs",
  "vbe",
  "js",
  "jse",
  "jar",
  "ps1",
  "psm1",
  "sh",
  "app",
  "dmg",
  "apk",
  "lnk",
  "reg",
  "dll",
  "hta",
  "wsf",
]);

export interface DraftAttachment {
  id: string;
  file: File;
  kind: AttachmentKind;
  /**
   * Object URL do arquivo. Serve a qualquer tipo: imagem exibe, áudio e vídeo
   * tocam, documento baixa. Ausente apenas quando o arquivo foi recusado.
   */
  objectUrl?: string;
  /** Miniatura. Só imagem tem — não há como derivar capa de PDF no navegador. */
  previewUrl?: string;
  /** Motivo da recusa. Presente = o arquivo não vai junto no envio. */
  error?: string;
}

export function attachmentKindOf(file: File): AttachmentKind {
  if (file.type.startsWith("image/")) return "imagem";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "documento";
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

function validate(file: File): string | undefined {
  if (file.size === 0) return "Arquivo vazio.";
  if (file.size > MAX_ATTACHMENT_BYTES) return "Acima de 16 MB.";
  if (BLOCKED_EXTENSIONS.has(extensionOf(file.name))) return "Tipo de arquivo não permitido.";
  return undefined;
}

let sequence = 0;

/**
 * Converte arquivos escolhidos em rascunhos de anexo.
 *
 * O object URL é criado aqui e precisa ser revogado por quem descarta o
 * rascunho — sem isso o navegador segura o arquivo em memória até a aba fechar.
 * Arquivo recusado não ganha URL: não há o que exibir nem o que baixar.
 */
export function toDraftAttachments(files: File[]): DraftAttachment[] {
  return files.map((file) => {
    const kind = attachmentKindOf(file);
    const error = validate(file);
    sequence += 1;
    const objectUrl = error ? undefined : URL.createObjectURL(file);

    return {
      id: `draft_${sequence}`,
      file,
      kind,
      objectUrl,
      previewUrl: kind === "imagem" ? objectUrl : undefined,
      error,
    };
  });
}

export function revokeDraft(draft: DraftAttachment): void {
  // `previewUrl` é o mesmo endereço de `objectUrl` quando existe: revogar uma
  // vez basta, e revogar duas seria inofensivo mas confundiria quem lê.
  if (draft.objectUrl) URL.revokeObjectURL(draft.objectUrl);
}

/**
 * Materializa o rascunho no formato canônico da mensagem.
 *
 * `url` recebe o object URL local, o que faz a bolha exibir a imagem e oferecer
 * o download do documento imediatamente. É verdade enquanto a aba viver — e é
 * por isso que a interface avisa que o anexo é local. Com o back-end, aqui entra
 * a URL assinada devolvida pelo upload.
 */
export function toAttachment(draft: DraftAttachment): Attachment {
  return {
    id: `att_local_${draft.id}`,
    fileName: draft.file.name,
    mimeType: draft.file.type || "application/octet-stream",
    sizeBytes: draft.file.size,
    kind: draft.kind,
    source: "arquivo",
    url: draft.objectUrl,
    previewUrl: draft.previewUrl,
  };
}

/** Extrai arquivos de um evento de colar — print de tela cai aqui. */
export function filesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.files);
}

/* Anexo por link ------------------------------------------------------------ */

/**
 * Metadados devolvidos por `/api/media/preview`.
 *
 * Espelha o tipo da rota de propósito, em vez de importá-lo: um componente de
 * cliente que importa de um arquivo de rota arrasta a dependência de servidor
 * para o pacote do navegador.
 */
export interface ResolvedLink {
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

export class LinkError extends Error {}

/**
 * Resolve um link em anexo.
 *
 * A verificação é do servidor por dois motivos que o navegador não contorna: o
 * CORS impede ler o `Content-Type` de outro domínio, e o título do vídeo só o
 * provedor tem. Sem isso, colar um link seria apostar que a extensão do arquivo
 * diz a verdade.
 */
export async function resolveLink(rawUrl: string): Promise<ResolvedLink> {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new LinkError("Informe o endereço do link.");

  let response: Response;
  try {
    // O endereço vai como o atendente digitou. Normalizar (completar esquema,
    // tirar rastreio) é da rota: é lá que o contrato mora, e duplicar a regra
    // aqui garantiria que as duas versões divergissem com o tempo.
    response = await fetch("/api/media/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed }),
    });
  } catch {
    throw new LinkError("Não foi possível verificar o link agora.");
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (body as { error?: { message?: string } })?.error?.message;
    throw new LinkError(message ?? "Não foi possível usar este link.");
  }

  return body as ResolvedLink;
}

let linkSequence = 0;

/**
 * Converte o link resolvido em anexo canônico.
 *
 * `source: "link"` não é decoração: é o que faz a bolha avisar que o conteúdo
 * mora em servidor de terceiro, e é o que o back-end vai usar para saber que
 * precisa baixar o arquivo antes de despachar pelo WhatsApp (seção 11).
 */
export function toLinkAttachment(resolved: ResolvedLink): Attachment {
  linkSequence += 1;

  return {
    id: `att_link_${linkSequence}`,
    fileName: resolved.title ?? resolved.fileName,
    mimeType: resolved.mimeType,
    sizeBytes: resolved.sizeBytes,
    kind: resolved.kind,
    source: "link",
    // Vídeo de provedor não tem bytes para servir: `url` fica vazio e a página
    // vai em `externalUrl`, o que impede a bolha de tentar tocá-lo num <video>.
    url: resolved.provider ? undefined : resolved.url,
    previewUrl: resolved.previewUrl,
    provider: resolved.provider,
    title: resolved.title,
    externalUrl: resolved.externalUrl ?? resolved.url,
  };
}
