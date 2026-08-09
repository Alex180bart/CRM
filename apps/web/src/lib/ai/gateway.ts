/**
 * AI Gateway.
 *
 * Seção 16.1 do plano: "A aplicação não deve chamar Claude ou Gemini
 * diretamente em dezenas de pontos do código. Um serviço interno, denominado AI
 * Gateway, recebe a tarefa, escolhe provedor e modelo, aplica políticas,
 * registra custo, mascara dados quando necessário, valida saída estruturada e
 * oferece fallback."
 *
 * Este módulo é esse serviço, na forma que cabe num monólito Next.js. Ele cuida
 * do que é do Gateway: política por tarefa, prompt versionado, mascaramento,
 * validação da saída estruturada e o registro de execução.
 *
 * **O transporte não está aqui.** Corpo de requisição, leitura de uso, tradução
 * de erro e a fila de reserva vivem em `providers.ts` — que junto com este
 * arquivo forma o único par do repositório que pode nomear um provedor. Acima
 * deles, a aplicação fala em tarefas. Quando o Gateway virar serviço próprio, o
 * que muda é o transporte; o contrato em `@elora/core` continua valendo.
 *
 * O que ainda não existe e está previsto na seção 16: RAG sobre base de
 * conhecimento (16.2), ferramentas com function calling (16.3) e conjunto de
 * avaliação automatizado (16.4).
 */

import type {
  AiAnalyzeInput,
  AiAskInput,
  AiChecklistItem,
  AiConversationAnalysis,
  AiEmailDraft,
  AiEmailDraftInput,
  AiExtractedField,
  AiProposal,
  AiProposalKind,
  AiRewriteInput,
  AiRunMeta,
  AiSentiment,
  AiSuggestInput,
  AiTask,
  AiUrgency,
} from "@elora/core";
import { offsetIso } from "@elora/core";

import {
  AGENT_SCHEMA,
  ANALYSIS_SCHEMA,
  EMAIL_SCHEMA,
  PROMPT_VERSIONS,
  analysisPrompt,
  askPrompt,
  emailPrompt,
  rewritePrompt,
  suggestPrompt,
} from "./prompts";
import {
  GatewayFailure as ProviderFailure,
  complete,
  costUsdCents,
  isConfigured,
  stream,
  type CompletionPolicy,
  type ProviderId,
  type ProviderUsage,
} from "./providers";

/**
 * Política por tarefa.
 *
 * Temperatura, teto de saída e schema. **Não** contém provedor nem modelo: essa
 * escolha é da fila em `providers.ts`, para que o fallback de disponibilidade
 * valha para todas as tarefas sem repetir a decisão cinco vezes.
 */
const TASK_POLICY: Record<AiTask, CompletionPolicy> = {
  analisar_conversa: {
    temperature: 0.25,
    // A tabulação acrescentou até seis propostas com trecho de evidência cada.
    // Com 2048 a saída era cortada no meio do JSON e caía no reparo.
    maxOutputTokens: 2800,
    schema: ANALYSIS_SCHEMA,
  },
  sugerir_resposta: { temperature: 0.6, maxOutputTokens: 700 },
  reescrever: { temperature: 0.4, maxOutputTokens: 700 },
  perguntar: { temperature: 0.5, maxOutputTokens: 1400 },
  // Temperatura mais alta que a análise: aqui se quer variação de redação, não
  // extração fiel. Ainda longe de 1 — e-mail de escritório contábil não é poesia.
  redigir_email: {
    temperature: 0.75,
    maxOutputTokens: 1600,
    schema: EMAIL_SCHEMA,
  },
  /**
   * Temperatura baixa: o agente decide caminho, não redige peça criativa.
   *
   * A saída carrega ao mesmo tempo a decisão (ferramenta, transferência) e o
   * texto que vai ao contato. Subir a temperatura para melhorar a redação
   * degradaria a decisão junto — e decisão errada aqui não é frase esquisita, é
   * conversa entregue na fila errada.
   */
  atender: {
    temperature: 0.3,
    maxOutputTokens: 1200,
    schema: AGENT_SCHEMA,
  },
};

/**
 * `GatewayFailure` mora em `providers.ts` — é lá que as falhas de provedor
 * nascem e é lá que a fila decide quais valem reserva. Reexportado aqui porque a
 * rota importa deste módulo desde antes da separação.
 */
export { GatewayFailure } from "./providers";

/** A interface consulta isto para não oferecer um recurso que vai falhar. */
export function isCopilotConfigured(): boolean {
  return isConfigured();
}

/** Diagnóstico: quem está configurado e com qual modelo. */
export { providerStatus } from "./providers";

/* Limite de uso ------------------------------------------------------------- */

/**
 * Freio por instância, em memória.
 *
 * Existe para o caso trivial e real: um atendente segurando o atalho de
 * sugestão, ou um laço acidental em desenvolvimento. Não substitui o controle
 * por organização que a seção 16.4 pede — esse é do back-end, com contador
 * compartilhado, porque este morre a cada reinício e não vê as outras réplicas.
 *
 * **Cuidado ao mover isto.** O freio usa o código `limite_excedido`, o mesmo que
 * a cota do provedor — e esse código aciona a reserva na fila de `providers.ts`.
 * Funciona porque a rota chama o freio **antes** de entrar na fila: nosso
 * próprio limite barra o chamador, não desvia para outro provedor. Chamá-lo de
 * dentro da fila transformaria o freio em porta de entrada para a reserva.
 */
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 30 };
const hits = new Map<string, number[]>();

export function enforceRateLimit(identity: string, nowMs: number): void {
  const cutoff = nowMs - RATE_LIMIT.windowMs;
  const recent = (hits.get(identity) ?? []).filter((at) => at > cutoff);

  if (recent.length >= RATE_LIMIT.maxRequests) {
    throw new ProviderFailure(
      "limite_excedido",
      "Muitas chamadas ao copiloto em pouco tempo. Aguarde um instante.",
      429,
    );
  }

  recent.push(nowMs);
  hits.set(identity, recent);

  // A tabela não pode crescer para sempre num processo longo.
  if (hits.size > 500) {
    for (const [key, timestamps] of hits) {
      if (timestamps.every((at) => at <= cutoff)) hits.delete(key);
    }
  }
}

/* Mascaramento -------------------------------------------------------------- */

/**
 * Redação antes do envio (seção 16.4).
 *
 * O alvo é estreito de propósito: **credencial e meio de pagamento**. Documento,
 * valor e competência ficam — são o caso em si, e mascará-los faria o copiloto
 * responder sobre um caso que não existe. O que sai daqui é o que o modelo não
 * tem por que ver e não deve poder repetir numa sugestão de resposta.
 */
export function redactCredentials(text: string): string {
  return (
    text
      // "senha: 1234", "token = abc", "código de acesso 998877"
      .replace(
        /\b(senha|token|c[óo]digo de acesso|c[óo]digo de barras|chave privada|certificado digital)\b\s*(?:[:=]|é|eh)?\s*\S{4,}/gi,
        (_match, label: string) => `${label}: [removido]`,
      )
      // Cartão: 13 a 16 dígitos, com ou sem separador.
      .replace(/\b(?:\d[ .-]?){13,16}\b/g, "[cartão removido]")
      // CVV explícito.
      .replace(/\bcvv\b\s*[:=]?\s*\d{3,4}/gi, "cvv: [removido]")
  );
}

/* Registro de execução ------------------------------------------------------ */

/**
 * O transporte para o provedor saiu deste arquivo.
 *
 * Montagem de corpo, leitura de uso, tradução de status HTTP e o próprio
 * `fetch` moram em `providers.ts`, junto da fila de reserva. Aqui ficou o que
 * é do Gateway e não do provedor: política por tarefa, prompt versionado,
 * mascaramento, validação da saída e o registro de execução.
 */

export function buildMeta(input: {
  task: AiTask;
  provider: ProviderId;
  model: string;
  usage: ProviderUsage;
  latencyMs: number;
  repaired: boolean;
}): AiRunMeta {
  return {
    runId: `run_${crypto.randomUUID()}`,
    task: input.task,
    // Quem de fato atendeu — não quem devia atender. É o que faz a reserva
    // aparecer na tela: o rodapé do painel passa a mostrar outro modelo, e a
    // operação percebe que o primário caiu sem precisar ler log.
    provider: input.provider,
    model: input.model,
    promptVersion: PROMPT_VERSIONS[input.task],
    inputTokens: input.usage.inputTokens,
    outputTokens: input.usage.outputTokens,
    latencyMs: Math.round(input.latencyMs),
    costUsdCents: costUsdCents(input.provider, input.usage),
    repaired: input.repaired,
    // Ancorado ao instante de referência, como todo horário exibido no produto.
    occurredAt: offsetIso({}),
  };
}

/* Validação da saída estruturada -------------------------------------------- */

const SENTIMENTS: AiSentiment[] = ["positivo", "neutro", "impaciente", "irritado"];
const URGENCIES: AiUrgency[] = ["baixa", "normal", "alta", "critica"];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean).slice(0, max);
}

/**
 * Validação própria (seção 16.4: "saída estruturada validada por schema").
 *
 * O `responseSchema` do provedor reduz o desvio, mas não é garantia contratual:
 * resposta cortada por limite de tokens produz JSON incompleto, e o campo
 * `enum` já voltou com valor fora da lista. Sem esta barreira, o erro chegaria
 * como tela quebrada em vez de reparo.
 */
function parseAnalysis(raw: string): Omit<AiConversationAnalysis, "meta"> | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const summary = asString(record.summary);
  const nextStep = asString(record.nextStep);
  const suggestedReply = asString(record.suggestedReply);

  // Sem estes três não há copiloto: é o mínimo que a tela promete mostrar.
  if (!summary || !nextStep || !suggestedReply) return null;

  const sentiment = asString(record.sentiment) as AiSentiment;
  const urgency = asString(record.urgency) as AiUrgency;

  const extracted: AiExtractedField[] = Array.isArray(record.extracted)
    ? record.extracted
        .filter(
          (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
        )
        .map((item) => ({
          label: asString(item.label),
          value: asString(item.value),
          evidence: asString(item.evidence) || undefined,
        }))
        .filter((item) => item.label && item.value)
        .slice(0, 6)
    : [];

  const checklist: AiChecklistItem[] = Array.isArray(record.checklist)
    ? record.checklist
        .filter(
          (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
        )
        .map((item) => ({ label: asString(item.label), done: item.done === true }))
        .filter((item) => item.label)
        .slice(0, 6)
    : [];

  return {
    summary,
    intent: asString(record.intent) || "Não identificada",
    sentiment: SENTIMENTS.includes(sentiment) ? sentiment : "neutro",
    urgency: URGENCIES.includes(urgency) ? urgency : "normal",
    extracted,
    nextStep,
    checklist,
    suggestedReply,
    suggestedTags: asStringList(record.suggestedTags, 3),
    openQuestions: asStringList(record.openQuestions, 3),
    proposals: parseProposals(record.proposals),
  };
}

/**
 * Prazo da tarefa proposta.
 *
 * O modelo não tem relógio: sem âncora ele datava o retorno em um ano qualquer
 * do treinamento, e a tarefa nascia vencida há dois anos. O prompt agora informa
 * o instante atual, mas isto continua aqui como rede — data no passado é erro
 * evidente, e uma tarefa de retorno sem prazo é honesta, enquanto uma com prazo
 * errado é armadilha: some da fila de atenção sem ninguém perceber.
 */
function readDueAt(value: unknown, nowMs: number): string | undefined {
  const raw = asString(value);
  if (!raw) return undefined;

  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed) || parsed < nowMs) return undefined;

  // Um ano à frente não é retorno, é alucinação de data.
  if (parsed > nowMs + 365 * 24 * 60 * 60 * 1000) return undefined;

  return raw;
}

const PROPOSAL_KINDS: AiProposalKind[] = [
  "preencher_campo",
  "vincular_empresa",
  "criar_tarefa",
  "mover_etapa",
];

/**
 * Saneamento das propostas.
 *
 * A validação de negócio — dígito verificador, comparação com o cadastro — é da
 * camada de resolução em `@elora/core`. O que acontece aqui é anterior e mais
 * grosseiro: garantir que o que chegou tem a **forma** de proposta. Sem isto, um
 * `kind` fora do enum ou um `field` com caminho inventado desceria até a tela e
 * viraria botão que grava em lugar nenhum.
 *
 * `evidence` obrigatório não é rigor gratuito: é o único elemento que permite ao
 * atendente conferir a proposta sem reler a conversa inteira. Proposta sem
 * evidência é palpite com botão de aplicar.
 */
function parseProposals(value: unknown): AiProposal[] {
  if (!Array.isArray(value)) return [];

  const nowMs = Date.parse(offsetIso({}));

  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item, index) => {
      const kind = asString(item.kind) as AiProposalKind;
      const field = asString(item.field);
      const raw = Number(item.confidence);

      return {
        id: `prop_${index}`,
        kind,
        field: field ? (field as AiProposal["field"]) : undefined,
        label: asString(item.label),
        value: asString(item.value),
        evidence: asString(item.evidence),
        // Confiança fora da faixa é sinal de saída malformada; trata como fraca.
        confidence: Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : 0,
        dueAt: readDueAt(item.dueAt, nowMs),
      } satisfies AiProposal;
    })
    .filter(
      (proposal) =>
        PROPOSAL_KINDS.includes(proposal.kind) &&
        proposal.label &&
        proposal.value &&
        proposal.evidence &&
        // Preencher campo sem dizer qual campo é proposta que não dá para executar.
        (proposal.kind !== "preencher_campo" || Boolean(proposal.field)),
    )
    .slice(0, 6);
}

/* Tarefas ------------------------------------------------------------------- */

const REPAIR_HINT =
  "Sua resposta anterior não era um JSON válido segundo o schema. Responda novamente APENAS com o objeto JSON completo, sem texto antes ou depois, sem cerca de código.";

export async function runAnalysis(input: AiAnalyzeInput): Promise<AiConversationAnalysis> {
  const policy = TASK_POLICY.analisar_conversa;
  const { system, user } = analysisPrompt(input.context);
  const safeUser = redactCredentials(user);
  const started = performance.now();

  let usage: ProviderUsage = { inputTokens: 0, outputTokens: 0 };
  let parsed: Omit<AiConversationAnalysis, "meta"> | null = null;
  let repaired = false;
  let servedBy: { provider: ProviderId; model: string } | null = null;

  // Uma tentativa e um reparo. Uma terceira rodada custaria o dobro para
  // resolver quase nada: quando o reparo falha, o problema é o prompt.
  for (const attempt of [0, 1]) {
    const result = await complete({
      system,
      user: attempt === 1 ? `${safeUser}\n\n${REPAIR_HINT}` : safeUser,
      policy,
    });
    servedBy = { provider: result.provider, model: result.model };
    usage = {
      inputTokens: usage.inputTokens + result.usage.inputTokens,
      outputTokens: usage.outputTokens + result.usage.outputTokens,
    };

    parsed = parseAnalysis(result.text);
    if (parsed) break;
    repaired = true;
  }

  if (!parsed || !servedBy) {
    throw new ProviderFailure(
      "falha",
      "O copiloto não conseguiu produzir uma análise válida desta conversa.",
      502,
    );
  }

  return {
    ...parsed,
    meta: buildMeta({
      task: "analisar_conversa",
      provider: servedBy.provider,
      model: servedBy.model,
      usage,
      latencyMs: performance.now() - started,
      repaired,
    }),
  };
}

/** Sugestão e reescrita: texto puro, uma chamada, sem reparo a fazer. */
export async function runText(
  task: Extract<AiTask, "sugerir_resposta" | "reescrever">,
  input: AiSuggestInput | AiRewriteInput,
): Promise<{ text: string; meta: AiRunMeta }> {
  const policy = TASK_POLICY[task];
  const prompt =
    task === "sugerir_resposta"
      ? suggestPrompt(
          input.context,
          (input as AiSuggestInput).draft,
          (input as AiSuggestInput).instruction,
        )
      : rewritePrompt(
          input.context,
          (input as AiRewriteInput).draft,
          (input as AiRewriteInput).tone,
        );

  const started = performance.now();
  const result = await complete({
    system: prompt.system,
    user: redactCredentials(prompt.user),
    policy,
  });

  if (!result.text) {
    throw new ProviderFailure("falha", "O copiloto devolveu uma resposta vazia.", 502);
  }

  return {
    // Modelo às vezes devolve o texto entre aspas apesar da instrução.
    text: stripWrappingQuotes(result.text) + (result.truncated ? "…" : ""),
    meta: buildMeta({
      task,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      latencyMs: performance.now() - started,
      repaired: false,
    }),
  };
}

function stripWrappingQuotes(text: string): string {
  const match = /^"([\s\S]+)"$/.exec(text.trim());
  return match?.[1] ?? text;
}

/* Redação de e-mail --------------------------------------------------------- */

/**
 * Validação do rascunho de e-mail.
 *
 * O corte de comprimento não é capricho: assunto acima de 60 caracteres é
 * truncado pelo cliente de e-mail, e preheader acima de 110 vira reticências na
 * caixa de entrada. Cortar aqui é preferível a devolver um campo que a interface
 * marcaria como erro logo em seguida.
 */
function parseEmailDraft(raw: string): Omit<AiEmailDraft, "meta"> | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;

  const record = value as Record<string, unknown>;
  const subject = asString(record.subject);
  const headline = asString(record.headline);
  const paragraphs = asStringList(record.paragraphs, 4);

  // Sem estes três não há e-mail: é o mínimo que o editor precisa para montar.
  if (!subject || !headline || paragraphs.length === 0) return null;

  const href = asString(record.ctaHref);

  return {
    subject: truncateAt(subject, 60),
    preheader: truncateAt(asString(record.preheader), 110),
    headline,
    paragraphs,
    ctaLabel: asString(record.ctaLabel) || "Falar com o time",
    // Um href inventado com esquema estranho vira link quebrado no e-mail enviado.
    ctaHref: /^https?:\/\//i.test(href) ? href : "https://contabilidadefacilitada.com/",
    closing: asString(record.closing),
  };
}

function truncateAt(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

export async function runEmailDraft(input: AiEmailDraftInput): Promise<AiEmailDraft> {
  const policy = TASK_POLICY.redigir_email;
  const { system, user } = emailPrompt(input);
  const started = performance.now();

  let usage: ProviderUsage = { inputTokens: 0, outputTokens: 0 };
  let parsed: Omit<AiEmailDraft, "meta"> | null = null;
  let repaired = false;
  let servedBy: { provider: ProviderId; model: string } | null = null;

  const safeUser = redactCredentials(user);

  for (const attempt of [0, 1]) {
    const result = await complete({
      system,
      user: attempt === 1 ? `${safeUser}\n\n${REPAIR_HINT}` : safeUser,
      policy,
    });
    servedBy = { provider: result.provider, model: result.model };
    usage = {
      inputTokens: usage.inputTokens + result.usage.inputTokens,
      outputTokens: usage.outputTokens + result.usage.outputTokens,
    };

    parsed = parseEmailDraft(result.text);
    if (parsed) break;
    repaired = true;
  }

  if (!parsed || !servedBy) {
    throw new ProviderFailure(
      "falha",
      "O modelo não conseguiu produzir um rascunho de e-mail válido a partir deste briefing.",
      502,
    );
  }

  return {
    ...parsed,
    meta: buildMeta({
      task: "redigir_email",
      provider: servedBy.provider,
      model: servedBy.model,
      usage,
      latencyMs: performance.now() - started,
      repaired,
    }),
  };
}

/* Pergunta livre, em fluxo -------------------------------------------------- */

export interface AskChunk {
  delta?: string;
  meta?: AiRunMeta;
}

/**
 * Emite o texto conforme o modelo gera.
 *
 * Uma resposta de três parágrafos leva alguns segundos. Esperar em silêncio
 * parece travamento, e o atendente clica de novo — o que custa uma segunda
 * chamada. O fluxo resolve isso mostrando a primeira frase quase imediatamente.
 */
export async function* streamAsk(input: AiAskInput): AsyncGenerator<AskChunk> {
  const policy = TASK_POLICY.perguntar;
  const { system, user } = askPrompt(input.context, input.question, input.history);
  const started = performance.now();

  let produced = false;

  for await (const chunk of stream({ system, user: redactCredentials(user), policy })) {
    if (chunk.delta) {
      produced = true;
      yield { delta: chunk.delta };
      continue;
    }

    if (!chunk.done) continue;

    /**
     * Resposta vazia com HTTP 200 acontece — filtro de segurança no meio,
     * `finishReason` sem conteúdo. Vale erro, e não uma bolha em branco no
     * painel, porque o atendente precisa saber que não houve resposta.
     */
    if (!produced) {
      throw new ProviderFailure("falha", "O copiloto devolveu uma resposta vazia.", 502);
    }

    yield {
      meta: buildMeta({
        task: "perguntar",
        provider: chunk.done.provider,
        model: chunk.done.model,
        usage: chunk.done.usage,
        latencyMs: performance.now() - started,
        repaired: false,
      }),
    };
  }
}
