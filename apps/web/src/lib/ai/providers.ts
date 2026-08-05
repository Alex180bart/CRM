/**
 * Adaptadores de provedor e o fallback entre eles.
 *
 * Seção 16.1 do plano: o AI Gateway "escolhe provedor e modelo (…) e oferece
 * fallback". Até aqui existia um provedor só, e portanto nenhum fallback de
 * verdade: se o Gemini caísse ou estourasse cota, o copiloto morria com ele.
 *
 * Este arquivo e o `gateway.ts` são os **únicos** lugares do repositório que
 * podem nomear um provedor. Acima deles, a aplicação fala em tarefas.
 *
 * ## O que o fallback é, e o que ele não é
 *
 * É reserva de **disponibilidade**: quando o primário não responde, recusa a
 * credencial ou devolve cota estourada, o pedido vai ao próximo da fila.
 *
 * **Não** é troca por qualidade. Recusa de conteúdo e falha de schema não
 * acionam reserva, por dois motivos: o conteúdo recusado é o mesmo nos dois
 * provedores, e trocar de modelo no meio de uma falha de formato mudaria a
 * qualidade do caminho normal pelas costas de quem opera. Quem decide mudar
 * modelo por qualidade é gente, com o conjunto de avaliação da seção 16.4 na
 * mão — não um `catch`.
 */

export type ProviderId = "google" | "openai";

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompletionPolicy {
  temperature: number;
  maxOutputTokens: number;
  /**
   * Schema da saída estruturada, no formato do Gemini (subconjunto do OpenAPI 3
   * com `propertyOrdering`). É o formato canônico interno; cada adaptador
   * traduz para o que o seu provedor aceita. Ausente significa texto puro.
   */
  schema?: unknown;
}

export interface CompletionRequest {
  system: string;
  user: string;
  policy: CompletionPolicy;
}

export interface CompletionOutcome {
  text: string;
  /** Verdadeiro quando o provedor cortou a saída no limite de tokens. */
  truncated: boolean;
  usage: ProviderUsage;
}

export interface CompletionResult extends CompletionOutcome {
  provider: ProviderId;
  model: string;
  /** Verdadeiro quando o primário falhou e quem atendeu foi a reserva. */
  usedFallback: boolean;
}

export class GatewayFailure extends Error {
  constructor(
    readonly code:
      "sem_credencial" | "limite_excedido" | "invalido" | "indisponivel" | "cancelado" | "falha",
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GatewayFailure";
  }
}

/**
 * Falhas que valem tentar o próximo provedor.
 *
 * Todas são "este provedor não pode atender agora". `invalido` (conteúdo
 * recusado) e `falha` (saída não validou) ficam fora de propósito: a primeira
 * seria recusada igual do outro lado, e a segunda é problema de prompt, que já
 * tem passo de reparo próprio.
 */
const FALLBACK_CODES = new Set<GatewayFailure["code"]>([
  "indisponivel",
  "limite_excedido",
  "sem_credencial",
]);

function shouldFallback(error: unknown): boolean {
  return error instanceof GatewayFailure && FALLBACK_CODES.has(error.code);
}

interface Provider {
  id: ProviderId;
  label: string;
  model: string;
  /**
   * Preço em dólar por milhão de tokens.
   *
   * Versionado em código de propósito: custo é métrica de produto (16.4), e uma
   * tabela invisível é uma tabela que ninguém revisa. **Confira contra a página
   * de preços a cada mudança de modelo** — este número vira o custo que a
   * operação lê na tela.
   */
  price: { inputUsdPerMillion: number; outputUsdPerMillion: number };
  configured(): boolean;
  complete(request: CompletionRequest): Promise<CompletionOutcome>;
  stream(request: CompletionRequest): AsyncGenerator<string, ProviderUsage>;
}

function readEnv(name: string): string | undefined {
  // A aspa sobra com frequência em `.env` copiado à mão.
  return process.env[name]?.trim().replace(/^["']|["']$/g, "") || undefined;
}

/* Gemini -------------------------------------------------------------------- */

const GEMINI_ROOT = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = "gemini-2.5-flash";

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  promptFeedback?: { blockReason?: string };
}

function geminiBody(request: CompletionRequest) {
  const { system, user, policy } = request;
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature: policy.temperature,
      maxOutputTokens: policy.maxOutputTokens,
      /**
       * Desliga o raciocínio intermediário do 2.5 Flash. Não é economia de
       * centavo: com ele ligado, uma resposta de uma palavra consome dezenas de
       * tokens de pensamento e o atendente espera à toa. Nenhuma tarefa do
       * copiloto é de raciocínio profundo — são leitura, síntese e reescrita.
       */
      thinkingConfig: { thinkingBudget: 0 },
      ...(policy.schema
        ? { responseMimeType: "application/json", responseSchema: policy.schema }
        : {}),
    },
  };
}

function geminiUsage(response: GeminiResponse): ProviderUsage {
  const usage = response.usageMetadata ?? {};
  return {
    inputTokens: usage.promptTokenCount ?? 0,
    // Tokens de pensamento são faturados como saída; ignorá-los subestima o custo.
    outputTokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
  };
}

function geminiText(response: GeminiResponse): { text: string; truncated: boolean } {
  const candidate = response.candidates?.[0];

  if (!candidate) {
    const blocked = response.promptFeedback?.blockReason;
    throw new GatewayFailure(
      "invalido",
      blocked
        ? `O provedor recusou o conteúdo (${blocked}).`
        : "O modelo não devolveu nenhuma resposta.",
      502,
    );
  }

  if (candidate.finishReason === "SAFETY" || candidate.finishReason === "PROHIBITED_CONTENT") {
    throw new GatewayFailure(
      "invalido",
      "O provedor bloqueou a resposta por política de conteúdo.",
      502,
    );
  }

  return {
    text: (candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim(),
    truncated: candidate.finishReason === "MAX_TOKENS",
  };
}

/** Traduz o status HTTP do provedor na categoria que a interface entende. */
function httpFailure(provider: string, status: number, detail: string): GatewayFailure {
  // O corpo do provedor pode conter detalhe de projeto e cota. Fica no log do
  // servidor; para a tela sobe só a categoria.
  console.error(`[ai-gateway] ${provider} respondeu ${status}: ${detail.slice(0, 500)}`);

  if (status === 429) {
    return new GatewayFailure("limite_excedido", "A cota do provedor de IA foi atingida.", 429);
  }
  if (status === 401 || status === 403) {
    return new GatewayFailure(
      "sem_credencial",
      "A credencial do provedor de IA foi recusada.",
      502,
    );
  }
  return new GatewayFailure("indisponivel", "O provedor de IA está indisponível.", 502);
}

const gemini: Provider = {
  id: "google",
  label: "Gemini",
  model: GEMINI_MODEL,
  price: { inputUsdPerMillion: 0.3, outputUsdPerMillion: 2.5 },
  configured: () => Boolean(readEnv("GEMINI_API_KEY")),

  async complete(request) {
    const key = readEnv("GEMINI_API_KEY");
    if (!key) {
      throw new GatewayFailure("sem_credencial", "Falta GEMINI_API_KEY no servidor.", 503);
    }

    let response: Response;
    try {
      response = await fetch(`${GEMINI_ROOT}/${GEMINI_MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(geminiBody(request)),
      });
    } catch {
      throw new GatewayFailure("indisponivel", "O provedor de IA não respondeu.", 504);
    }

    if (!response.ok) {
      throw httpFailure(GEMINI_MODEL, response.status, await response.text().catch(() => ""));
    }

    const body = (await response.json()) as GeminiResponse;
    return { ...geminiText(body), usage: geminiUsage(body) };
  },

  async *stream(request) {
    const key = readEnv("GEMINI_API_KEY");
    if (!key) {
      throw new GatewayFailure("sem_credencial", "Falta GEMINI_API_KEY no servidor.", 503);
    }

    let response: Response;
    try {
      response = await fetch(`${GEMINI_ROOT}/${GEMINI_MODEL}:streamGenerateContent?alt=sse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(geminiBody(request)),
      });
    } catch {
      throw new GatewayFailure("indisponivel", "O provedor de IA não respondeu.", 504);
    }

    if (!response.ok || !response.body) {
      throw httpFailure(GEMINI_MODEL, response.status, await response.text().catch(() => ""));
    }

    let usage: ProviderUsage = { inputTokens: 0, outputTokens: 0 };

    for await (const payload of sseEvents(response.body)) {
      let event: GeminiResponse;
      try {
        event = JSON.parse(payload) as GeminiResponse;
      } catch {
        continue;
      }

      // Cada evento traz o acumulado, não o incremento — o último vale.
      const current = geminiUsage(event);
      if (current.inputTokens || current.outputTokens) usage = current;

      const delta = (event.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("");
      if (delta) yield delta;
    }

    return usage;
  },
};

/* OpenAI -------------------------------------------------------------------- */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Modelo da reserva.
 *
 * `gpt-4.1-mini` foi escolhido por teste, não por catálogo: aceita `temperature`
 * e `max_tokens` (a mesma forma que a política de tarefa já monta), atende
 * saída estruturada com `strict` e transmitiu em fluxo sem ajuste. O
 * `gpt-5.4-mini` recusa `max_tokens` e respondeu em 3,3 s contra 2,2 s — numa
 * reserva, que já é caminho degradado, latência conta.
 */
const OPENAI_MODEL = "gpt-4.1-mini";

interface OpenAiResponse {
  choices?: Array<{
    message?: { content?: string | null; refusal?: string | null };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Converte o schema canônico para o modo estrito da OpenAI.
 *
 * As duas exigências que quebram uma conversão ingênua: **toda** propriedade
 * precisa estar em `required` (não existe campo opcional em modo estrito), e
 * todo objeto precisa de `additionalProperties: false`. Campo que era opcional
 * vira anulável — é o equivalente honesto, e a validação do gateway já trata
 * nulo como ausente.
 *
 * `propertyOrdering` é extensão do Gemini e é descartada.
 */
function toStrictSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toStrictSchema);
  if (typeof schema !== "object" || schema === null) return schema;

  const source = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (key === "propertyOrdering") continue;
    if (key === "description") {
      out[key] = value;
      continue;
    }
    out[key] = toStrictSchema(value);
  }

  if (source.type === "object" && typeof source.properties === "object" && source.properties) {
    const properties = out.properties as Record<string, Record<string, unknown>>;
    const declared = new Set((source.required as string[] | undefined) ?? []);

    for (const [name, definition] of Object.entries(properties)) {
      if (declared.has(name)) continue;
      // Era opcional: em modo estrito precisa existir e poder vir nulo.
      const type = definition.type;
      if (typeof type === "string") definition.type = [type, "null"];
    }

    out.required = Object.keys(properties);
    out.additionalProperties = false;
  }

  return out;
}

const openai: Provider = {
  id: "openai",
  label: "OpenAI",
  model: OPENAI_MODEL,
  // Conferido contra a página de preços em 04/08/2026.
  price: { inputUsdPerMillion: 0.4, outputUsdPerMillion: 1.6 },
  configured: () => Boolean(readEnv("OPENAI_API_KEY")),

  async complete(request) {
    const body = await openaiCall(request, false);
    const parsed = body as OpenAiResponse;
    const choice = parsed.choices?.[0];

    if (choice?.message?.refusal) {
      throw new GatewayFailure(
        "invalido",
        "O provedor bloqueou a resposta por política de conteúdo.",
        502,
      );
    }

    return {
      text: (choice?.message?.content ?? "").trim(),
      truncated: choice?.finish_reason === "length",
      usage: {
        inputTokens: parsed.usage?.prompt_tokens ?? 0,
        outputTokens: parsed.usage?.completion_tokens ?? 0,
      },
    };
  },

  async *stream(request) {
    const stream = (await openaiCall(request, true)) as ReadableStream<Uint8Array>;
    let usage: ProviderUsage = { inputTokens: 0, outputTokens: 0 };

    for await (const payload of sseEvents(stream)) {
      if (payload === "[DONE]") break;

      let event: {
        choices?: Array<{ delta?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }

      if (event.usage) {
        usage = {
          inputTokens: event.usage.prompt_tokens ?? 0,
          outputTokens: event.usage.completion_tokens ?? 0,
        };
      }

      const delta = event.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }

    return usage;
  },
};

async function openaiCall(
  request: CompletionRequest,
  streaming: boolean,
): Promise<unknown | ReadableStream<Uint8Array>> {
  const key = readEnv("OPENAI_API_KEY");
  if (!key) {
    throw new GatewayFailure("sem_credencial", "Falta OPENAI_API_KEY no servidor.", 503);
  }

  const { system, user, policy } = request;

  let response: Response;
  try {
    response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: policy.temperature,
        max_tokens: policy.maxOutputTokens,
        ...(streaming ? { stream: true, stream_options: { include_usage: true } } : {}),
        ...(policy.schema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "saida",
                  strict: true,
                  schema: toStrictSchema(policy.schema),
                },
              },
            }
          : {}),
      }),
    });
  } catch {
    throw new GatewayFailure("indisponivel", "O provedor de IA não respondeu.", 504);
  }

  if (!response.ok) {
    throw httpFailure(OPENAI_MODEL, response.status, await response.text().catch(() => ""));
  }

  if (streaming) {
    if (!response.body) {
      throw new GatewayFailure("indisponivel", "O provedor não devolveu conteúdo.", 502);
    }
    return response.body;
  }
  return response.json();
}

/* Leitor de SSE compartilhado ----------------------------------------------- */

/**
 * Percorre um corpo `text/event-stream` e devolve o conteúdo de cada `data:`.
 *
 * Compartilhado pelos dois adaptadores porque o enquadramento do SSE é o mesmo;
 * o que difere é o JSON dentro. Linha parcial fica no buffer até completar —
 * sem isso, um evento partido no limite do pacote é descartado e a resposta
 * perde um trecho no meio.
 */
async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (line.startsWith("data:")) {
        const payload = line.slice(5).trim();
        if (payload) yield payload;
      }
    }
  }

  const tail = buffer.trim();
  if (tail.startsWith("data:")) {
    const payload = tail.slice(5).trim();
    if (payload) yield payload;
  }
}

/* Fila de provedores -------------------------------------------------------- */

/**
 * Ordem de tentativa: Gemini primeiro, OpenAI como reserva.
 *
 * A ordem é fixa e não configurável por tarefa de propósito. O usuário pediu
 * reserva de disponibilidade, não roteamento por qualidade: manter uma ordem só
 * garante que o caminho normal seja sempre o mesmo modelo, e portanto que a
 * qualidade que a operação vê no dia a dia não mude sem alguém decidir.
 */
const CHAIN: Provider[] = [gemini, openai];

function available(): Provider[] {
  return CHAIN.filter((provider) => provider.configured());
}

/** A interface consulta isto para não oferecer um recurso que vai falhar. */
export function isConfigured(): boolean {
  return available().length > 0;
}

/** Quem está de pé, para a documentação e o diagnóstico da rota. */
export function providerStatus(): Array<{ id: ProviderId; model: string; configured: boolean }> {
  return CHAIN.map((provider) => ({
    id: provider.id,
    model: provider.model,
    configured: provider.configured(),
  }));
}

export function costUsdCents(providerId: ProviderId, usage: ProviderUsage): number {
  const provider = CHAIN.find((item) => item.id === providerId) ?? gemini;
  const dollars =
    (usage.inputTokens / 1_000_000) * provider.price.inputUsdPerMillion +
    (usage.outputTokens / 1_000_000) * provider.price.outputUsdPerMillion;
  // Quatro casas: uma sugestão de resposta custa fração de centavo, e arredondar
  // para centavo inteiro mostraria zero em tudo.
  return Number((dollars * 100).toFixed(4));
}

/**
 * Executa a requisição no primeiro provedor que conseguir atender.
 *
 * Erro que não é de disponibilidade sobe na hora, sem tentar o próximo: recusa
 * de conteúdo tem a mesma resposta nos dois, e insistir só gastaria a cota de
 * reserva para receber o mesmo "não".
 */
export async function complete(request: CompletionRequest): Promise<CompletionResult> {
  const chain = available();
  if (chain.length === 0) {
    throw new GatewayFailure(
      "sem_credencial",
      "O copiloto está desligado: nenhum provedor de IA configurado no servidor.",
      503,
    );
  }

  let last: unknown;

  for (const [index, provider] of chain.entries()) {
    try {
      const outcome = await provider.complete(request);
      if (index > 0) {
        console.warn(`[ai-gateway] atendido pela reserva: ${provider.label} (${provider.model})`);
      }
      return { ...outcome, provider: provider.id, model: provider.model, usedFallback: index > 0 };
    } catch (error) {
      last = error;
      if (!shouldFallback(error)) throw error;
      if (index === chain.length - 1) throw error;
      console.warn(
        `[ai-gateway] ${provider.label} indisponível (${(error as GatewayFailure).code}), tentando a reserva`,
      );
    }
  }

  throw last;
}

export interface StreamChunk {
  delta?: string;
  done?: { usage: ProviderUsage; provider: ProviderId; model: string; usedFallback: boolean };
}

/**
 * Fluxo com reserva **antes do primeiro byte**.
 *
 * Passada a primeira parte do texto não há como trocar de provedor: o atendente
 * já está lendo, e recomeçar apagaria o que apareceu na tela. Então a reserva
 * cobre a falha na abertura da conexão — que é onde cota estourada e serviço
 * fora do ar aparecem — e uma queda no meio sobe como erro, com o texto parcial
 * preservado.
 */
export async function* stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
  const chain = available();
  if (chain.length === 0) {
    throw new GatewayFailure(
      "sem_credencial",
      "O copiloto está desligado: nenhum provedor de IA configurado no servidor.",
      503,
    );
  }

  for (const [index, provider] of chain.entries()) {
    const iterator = provider.stream(request);
    let emitted = false;

    try {
      for (;;) {
        const step = await iterator.next();

        if (step.done) {
          yield {
            done: {
              usage: step.value,
              provider: provider.id,
              model: provider.model,
              usedFallback: index > 0,
            },
          };
          return;
        }

        emitted = true;
        yield { delta: step.value };
      }
    } catch (error) {
      // Já emitiu texto: trocar de provedor agora reescreveria o que o
      // atendente está lendo. A falha sobe e o parcial fica.
      if (emitted) throw error;
      if (!shouldFallback(error) || index === chain.length - 1) throw error;
      console.warn(
        `[ai-gateway] ${provider.label} indisponível no fluxo (${(error as GatewayFailure).code}), tentando a reserva`,
      );
    }
  }
}
