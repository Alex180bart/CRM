/**
 * Cliente do AI Gateway.
 *
 * A seção 16.1 do plano manda o contrário do atalho óbvio: a aplicação **não**
 * chama o provedor. Ela envia uma tarefa a um serviço interno que escolhe
 * modelo, aplica política, mascara o que não é necessário, valida a saída e
 * mede custo. Este arquivo é o lado do consumidor desse serviço — e é a única
 * razão pela qual nenhum componente de tela conhece Gemini.
 *
 * A chave do provedor nunca chega ao navegador: ela vive no processo que
 * atende `/api/ai/copilot`.
 */

import { DEFAULT_APP_ORIGIN } from "../utils/app-origin";
import type {
  AiAnalyzeInput,
  AiAskInput,
  AiConversationAnalysis,
  AiRewriteInput,
  AiRunMeta,
  AiSuggestInput,
  AiTask,
  AiText,
} from "../types/ai";
import { AiGatewayError } from "../types/ai";
import type { AiRepository } from "./types";

const GATEWAY_PATH = "/api/ai/copilot";

/**
 * Em componente de cliente a URL relativa basta. Em execução de servidor
 * (renderização, teste, script) não existe origem implícita, então resolvemos
 * uma — sem isto o mesmo repositório falharia dependendo de onde foi chamado.
 */
function gatewayUrl(): string {
  if (typeof window !== "undefined") return GATEWAY_PATH;
  // `process` é lido por `globalThis` para o pacote não depender de tipos de
  // Node — ele precisa continuar rodando em qualquer runtime.
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;
  const base = env?.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_ORIGIN;
  return `${base.replace(/\/$/, "")}${GATEWAY_PATH}`;
}

interface GatewayFailure {
  error: { code: AiGatewayError["code"]; message: string };
}

function isFailure(value: unknown): value is GatewayFailure {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as GatewayFailure).error?.message === "string"
  );
}

async function post(task: AiTask, payload: unknown, stream: boolean): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(gatewayUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, stream, ...(payload as object) }),
    });
  } catch {
    // Rede indisponível é diferente de modelo indisponível: o atendente precisa
    // saber que o problema está na conexão dele, não no provedor.
    throw new AiGatewayError("indisponivel", "Não foi possível falar com o copiloto.");
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    if (isFailure(body)) throw new AiGatewayError(body.error.code, body.error.message);
    throw new AiGatewayError("falha", `O copiloto respondeu com erro ${response.status}.`);
  }

  return response;
}

async function postJson<T>(task: AiTask, payload: unknown): Promise<T> {
  const response = await post(task, payload, false);
  const body: unknown = await response.json().catch(() => null);
  if (body === null) throw new AiGatewayError("falha", "O copiloto devolveu uma resposta vazia.");
  return body as T;
}

/**
 * Fluxo em NDJSON: uma linha por evento, `{"delta"}` durante a geração e
 * `{"meta"}` no fim. Mais simples que SSE e suficiente aqui — não há
 * reconexão nem múltiplos canais para justificar o protocolo maior.
 */
async function postStream(
  task: AiTask,
  payload: unknown,
  onChunk: (text: string) => void,
): Promise<AiText> {
  const response = await post(task, payload, true);
  const body = response.body;
  if (!body) throw new AiGatewayError("falha", "O copiloto não devolveu conteúdo.");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let meta: AiRunMeta | undefined;

  function consume(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;

    let event: unknown;
    try {
      event = JSON.parse(trimmed);
    } catch {
      // Linha truncada por corte de conexão: ignorar é melhor que derrubar a
      // resposta inteira que já foi entregue ao atendente.
      return;
    }

    if (isFailure(event)) throw new AiGatewayError(event.error.code, event.error.message);

    const record = event as { delta?: unknown; meta?: unknown };
    if (typeof record.delta === "string") {
      text += record.delta;
      onChunk(text);
    }
    if (record.meta) meta = record.meta as AiRunMeta;
  }

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      consume(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
  consume(buffer);

  if (!meta) throw new AiGatewayError("falha", "O copiloto encerrou sem registrar a execução.");
  return { text, meta };
}

export const aiGatewayRepository: AiRepository = {
  analyzeConversation(input: AiAnalyzeInput) {
    return postJson<AiConversationAnalysis>("analisar_conversa", input);
  },

  suggestReply(input: AiSuggestInput) {
    return postJson<AiText>("sugerir_resposta", input);
  },

  rewrite(input: AiRewriteInput) {
    return postJson<AiText>("reescrever", input);
  },

  ask(input: AiAskInput, onChunk?: (text: string) => void) {
    if (!onChunk) return postJson<AiText>("perguntar", input);
    return postStream("perguntar", input, onChunk);
  },
};
