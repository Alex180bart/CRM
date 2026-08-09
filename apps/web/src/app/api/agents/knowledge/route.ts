/**
 * Ingestão de fonte para a base de conhecimento do agente.
 *
 * Duas entradas, a mesma saída: um `AgentKnowledgeSource` com o texto já
 * extraído, pronto para `searchKnowledge` encontrar. Quem chama é o editor do
 * agente; o resultado vive em estado local até existir camada de escrita.
 *
 * ## A guarda de SSRF não é opcional aqui
 *
 * `POST` com `url` busca um endereço **informado pelo cliente**, exatamente como
 * a prévia de mídia e a prévia de site do webchat. É o terceiro consumidor de
 * `lib/net/safe-fetch.ts`, e é por isso que aquela guarda foi extraída: sem ela,
 * colar `http://169.254.169.254/latest/meta-data/` no campo "link" transformaria
 * o servidor em procurador para os metadados da nuvem — e o texto voltaria
 * gravado numa base de conhecimento que o modelo lê em voz alta.
 *
 * ## O que não acontece aqui
 *
 * O arquivo **não é armazenado**. Ele é lido, o texto é extraído e o binário é
 * descartado — não existe bucket, antivírus nem URL assinada neste repositório
 * (seção 11 é back-end). Formato que depende de extrator externo volta com
 * estado `processando` e o motivo escrito, em vez de voltar vazio fingindo que
 * deu certo.
 */

import type { AgentKnowledgeSource } from "@elora/core";
import {
  csvToText,
  htmlToText,
  offsetIso,
  planFile,
  readHtmlTitle,
  suggestTopics,
} from "@elora/core";
import type { NextRequest } from "next/server";

import { TargetError, assertAllowedTarget, inspect } from "@/lib/net/safe-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Teto do que entra na base.
 *
 * Uma página de 2 MB não tem 2 MB de conteúdo útil: tem menu, script e rodapé.
 * O corte protege memória e, mais que isso, a qualidade da recuperação — quanto
 * maior o documento, mais fácil casar por acaso.
 */
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_LENGTH = 60_000;
const MIN_TEXT_LENGTH = 120;

function fail(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export async function POST(request: NextRequest): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";

  return contentType.includes("multipart/form-data") ? ingestFile(request) : ingestLink(request);
}

/* Link ------------------------------------------------------------------------ */

async function ingestLink(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalido", "Corpo da requisição não é JSON válido.", 400);
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const raw = typeof record.url === "string" ? record.url.trim() : "";

  if (!raw) return fail("invalido", "Informe o endereço da página.", 400);

  let target: URL;
  try {
    target = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return fail("invalido", "Endereço inválido.", 400);
  }

  try {
    await assertAllowedTarget(target);
  } catch (error) {
    if (error instanceof TargetError) return fail(error.code, error.message, 400);
    throw error;
  }

  let response: Response;
  let finalUrl: URL;
  try {
    ({ response, finalUrl } = await inspect(target));
  } catch (error) {
    if (error instanceof TargetError) return fail(error.code, error.message, 400);
    return fail("inacessivel", "Não foi possível ler essa página.", 502);
  }

  if (!response.ok) {
    return fail("inacessivel", `A página respondeu ${response.status}.`, 502);
  }

  const type = response.headers.get("content-type") ?? "";
  const isHtml = type.includes("html") || type === "";
  const isPlain = type.includes("text/plain") || type.includes("markdown");

  if (!isHtml && !isPlain) {
    /**
     * Endereço que aponta direto para um PDF é caso comum — e é a mesma
     * limitação do arquivo enviado, não um erro do usuário. Vale dizer o que
     * fazer em vez de só recusar.
     */
    return fail(
      "nao_suportado",
      `Esse endereço devolve ${type.split(";")[0] || "um formato não textual"}. Só páginas HTML e texto são lidas aqui — PDF e documento dependem do extrator do back-end.`,
      415,
    );
  }

  const buffer = await readCapped(response);
  if (!buffer) return fail("nao_suportado", "A página é grande demais para ser lida.", 413);

  const source = new TextDecoder("utf-8").decode(buffer);
  const text = (isHtml ? htmlToText(source) : source).slice(0, MAX_TEXT_LENGTH);

  if (text.length < MIN_TEXT_LENGTH) {
    return fail(
      "nao_suportado",
      "Quase não há texto nessa página — ela provavelmente é montada por JavaScript no navegador, e o servidor recebe só o esqueleto.",
      422,
    );
  }

  const title = readHtmlTitle(source) || finalUrl.hostname;

  const knowledge: AgentKnowledgeSource = {
    id: newId("kb"),
    kind: "link",
    status: "pronto",
    title,
    topics: suggestTopics(title, text),
    body: text,
    // O endereço **final**, depois dos redirecionamentos: é o que se relê depois.
    url: finalUrl.toString(),
    fetchedAt: offsetIso({}),
    updatedAt: offsetIso({}),
  };

  return Response.json({ source: knowledge });
}

/**
 * Lê o corpo com teto, sem confiar no `content-length`.
 *
 * O cabeçalho é informado pelo servidor remoto, que é justamente quem não é
 * confiável neste caminho: um servidor hostil declara 1 KB e envia sem fim. O
 * corte tem de acontecer sobre os bytes que chegam.
 */
async function readCapped(response: Response): Promise<Uint8Array | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/* Arquivo --------------------------------------------------------------------- */

async function ingestFile(request: NextRequest): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("invalido", "Não foi possível ler o arquivo enviado.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return fail("invalido", "Nenhum arquivo recebido.", 400);

  if (file.size > MAX_BYTES) {
    return fail("nao_suportado", "Arquivo acima de 2 MB.", 413);
  }

  const plan = planFile(file.name);

  if (plan.status !== "pronto") {
    /**
     * Pendente e recusado voltam com HTTP 200, de propósito.
     *
     * Não é falha da requisição: o arquivo foi recebido e classificado. Devolver
     * 4xx faria a interface tratar como erro de envio, e a pessoa tentaria de
     * novo o mesmo PDF esperando resultado diferente.
     */
    const knowledge: AgentKnowledgeSource = {
      id: newId("kb"),
      kind: "arquivo",
      status: plan.status,
      title: file.name,
      topics: suggestTopics(file.name, ""),
      body: "",
      fileName: file.name,
      sizeBytes: file.size,
      statusReason: plan.reason,
      updatedAt: offsetIso({}),
    };
    return Response.json({ source: knowledge });
  }

  const raw = await file.text();
  const text = (plan.reader === "csv" ? csvToText(raw) : raw).slice(0, MAX_TEXT_LENGTH);

  if (text.trim().length < MIN_TEXT_LENGTH) {
    return Response.json({
      source: {
        id: newId("kb"),
        kind: "arquivo",
        status: "falhou",
        title: file.name,
        topics: [],
        body: "",
        fileName: file.name,
        sizeBytes: file.size,
        statusReason: "O arquivo tem texto de menos para servir de fonte.",
        updatedAt: offsetIso({}),
      } satisfies AgentKnowledgeSource,
    });
  }

  const title = file.name.replace(/\.[^.]+$/, "");

  const knowledge: AgentKnowledgeSource = {
    id: newId("kb"),
    kind: "arquivo",
    status: "pronto",
    title,
    topics: suggestTopics(title, text),
    body: text,
    fileName: file.name,
    sizeBytes: file.size,
    fetchedAt: offsetIso({}),
    updatedAt: offsetIso({}),
  };

  return Response.json({ source: knowledge });
}
