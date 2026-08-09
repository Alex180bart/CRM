/**
 * Fronteira HTTP do AI Gateway.
 *
 * Toda chamada de IA do produto entra por aqui. A rota é fina de propósito:
 * valida a forma do pedido, aplica o freio de uso, delega ao gateway e traduz
 * falha em código estável. Nenhuma regra de prompt, modelo ou preço vive neste
 * arquivo — isso é do gateway.
 *
 * A credencial do provedor nunca sai do processo: é por isso que a rota existe,
 * em vez de o navegador falar direto com o modelo.
 */

import type { NextRequest } from "next/server";
import type {
  AiAnalyzeInput,
  AiAskInput,
  AiContextMessage,
  AiConversationContext,
  AiFieldState,
  AiRewriteInput,
  AiSuggestInput,
  AiTask,
  AiToneAdjustment,
} from "@elora/core";

import {
  GatewayFailure,
  enforceRateLimit,
  providerStatus,
  runAnalysis,
  runText,
  streamAsk,
} from "@/lib/ai/gateway";
import { PROMPT_VERSIONS } from "@/lib/ai/prompts";

/** Chamada de modelo não cabe no runtime de borda: precisa de tempo e de fetch longo. */
export const runtime = "nodejs";
/** Resposta de IA nunca é cacheável — o contexto muda a cada mensagem. */
export const dynamic = "force-dynamic";

/**
 * Só as tarefas que assistem o **atendente** sobre uma conversa.
 *
 * Duas ficam de fora, cada uma por um motivo. Redigir e-mail entra por
 * `/api/ai/email`: o corpo não tem conversa nenhuma, e aceitá-lo aqui
 * obrigaria a afrouxar a exigência de contexto. Atender entra por
 * `/api/ai/agent`, e a razão é mais forte que roteamento: ali o texto vai
 * **direto ao contato**, sem revisão de ninguém. Compartilhar rota faria as
 * duas coisas dividirem o mesmo freio de uso e a mesma forma de erro, quando o
 * risco de cada uma é de outra ordem.
 */
type CopilotTask = Exclude<AiTask, "redigir_email" | "atender">;

const TASKS: CopilotTask[] = ["analisar_conversa", "sugerir_resposta", "reescrever", "perguntar"];

const TONES: AiToneAdjustment[] = [
  "formal",
  "cordial",
  "direto",
  "empatico",
  "resumir",
  "detalhar",
  "revisar",
];

const MAX_QUESTION_LENGTH = 1_000;
const MAX_DRAFT_LENGTH = 4_000;
const MAX_MESSAGES = 200;

function fail(code: GatewayFailure["code"], message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * Normaliza o contexto vindo do cliente.
 *
 * O corpo chega do navegador, então nada aqui é confiável: campo pode faltar,
 * vir com tipo errado ou trazer uma transcrição de dez mil mensagens para
 * inflar a conta. A normalização corta tudo isso antes de o prompt ser montado.
 */
function readContext(raw: unknown): AiConversationContext | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const conversationId = text(record.conversationId, 64);
  if (!conversationId) return null;

  const messages: AiContextMessage[] = Array.isArray(record.messages)
    ? record.messages
        .filter(
          (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
        )
        .map((item) => {
          const role = text(item.role, 16);
          return {
            role:
              role === "contato" || role === "agente" || role === "bot" || role === "nota_interna"
                ? role
                : "contato",
            author: text(item.author, 120),
            body: text(item.body, 4_000),
            at: text(item.at, 32),
            attachments: Array.isArray(item.attachments)
              ? item.attachments
                  .map((name) => text(name, 200))
                  .filter(Boolean)
                  .slice(0, 8)
              : undefined,
          } satisfies AiContextMessage;
        })
        .filter((message) => message.body || message.attachments?.length)
        // As últimas mensagens são as que decidem a resposta.
        .slice(-MAX_MESSAGES)
    : [];

  if (messages.length === 0) return null;

  return {
    conversationId,
    channel: text(record.channel, 32) || "whatsapp",
    subject: text(record.subject, 300),
    queue: text(record.queue, 120),
    state: text(record.state, 60),
    contactName: text(record.contactName, 120) || "Cliente",
    contactFacts: Array.isArray(record.contactFacts)
      ? record.contactFacts
          .map((fact) => text(fact, 240))
          .filter(Boolean)
          .slice(0, 12)
      : undefined,
    fieldStates: readFieldStates(record.fieldStates),
    agentName: text(record.agentName, 120) || "Atendente",
    messages,
  };
}

/**
 * Estado do cadastro para a tabulação.
 *
 * Precisa atravessar a rota: é a lista de campos vazios que o prompt manda o
 * modelo cruzar com a conversa, e é ela que restringe `field` a um caminho que a
 * aplicação sabe gravar. Sem isto o modelo adivinha o nome do campo — às vezes
 * acerta, e o acerto ocasional esconde o problema.
 *
 * `sample` é cortado curto de propósito: serve para o modelo não propor o valor
 * que já existe, não para carregar conteúdo de cadastro ao provedor.
 */
function readFieldStates(raw: unknown): AiFieldState[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const states = raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      field: text(item.field, 64),
      label: text(item.label, 80),
      filled: item.filled === true,
      sample: text(item.sample, 120) || undefined,
    }))
    .filter((state) => state.field && state.label)
    .slice(0, 40);

  return states.length > 0 ? states : undefined;
}

/**
 * Identidade para o freio de uso.
 *
 * Sem autenticação ainda, o IP é o que existe. Quando a sessão real entrar, isto
 * passa a ser o par organização/usuário — que é o correto: um escritório atrás
 * de um único IP de saída não deve dividir cota entre atendentes.
 */
function identify(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalido", "Corpo da requisição não é JSON válido.", 400);
  }

  if (typeof body !== "object" || body === null) {
    return fail("invalido", "Corpo da requisição vazio.", 400);
  }

  const record = body as Record<string, unknown>;
  const task = text(record.task, 32) as CopilotTask;

  if (!TASKS.includes(task)) {
    return fail("invalido", "Tarefa desconhecida para o copiloto.", 400);
  }

  const context = readContext(record.context);
  if (!context) {
    return fail("invalido", "Contexto da conversa ausente ou sem mensagens.", 400);
  }

  try {
    // O freio vem antes de qualquer trabalho — inclusive antes de montar prompt.
    enforceRateLimit(identify(request), performance.now());

    switch (task) {
      case "analisar_conversa":
        return Response.json(await runAnalysis({ context } satisfies AiAnalyzeInput));

      case "sugerir_resposta":
        return Response.json(
          await runText("sugerir_resposta", {
            context,
            draft: text(record.draft, MAX_DRAFT_LENGTH) || undefined,
            instruction: text(record.instruction, 400) || undefined,
          } satisfies AiSuggestInput),
        );

      case "reescrever": {
        const draft = text(record.draft, MAX_DRAFT_LENGTH).trim();
        const tone = text(record.tone, 24) as AiToneAdjustment;

        if (!draft) return fail("invalido", "Não há rascunho para reescrever.", 400);
        if (!TONES.includes(tone)) return fail("invalido", "Ajuste de tom desconhecido.", 400);

        return Response.json(
          await runText("reescrever", { context, draft, tone } satisfies AiRewriteInput),
        );
      }

      case "perguntar": {
        const question = text(record.question, MAX_QUESTION_LENGTH).trim();
        if (!question) return fail("invalido", "A pergunta está vazia.", 400);

        const history = Array.isArray(record.history)
          ? record.history
              .filter(
                (item): item is Record<string, unknown> =>
                  typeof item === "object" && item !== null,
              )
              .map((item) => ({
                role:
                  text(item.role, 16) === "copiloto"
                    ? ("copiloto" as const)
                    : ("atendente" as const),
                body: text(item.body, 4_000),
              }))
              .filter((turn) => turn.body)
              .slice(-8)
          : undefined;

        const input: AiAskInput = { context, question, history };

        return record.stream === true ? streamResponse(input) : Response.json(await collect(input));
      }
    }
  } catch (error) {
    if (error instanceof GatewayFailure) {
      return fail(error.code, error.message, error.status);
    }
    console.error("[ai-gateway] falha não prevista", error);
    return fail("falha", "O copiloto falhou de forma inesperada.", 500);
  }
}

/** Fluxo em NDJSON: uma linha por evento. O cliente em `@elora/core` lê o mesmo formato. */
function streamResponse(input: AiAskInput): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(payload: unknown) {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      }

      try {
        for await (const chunk of streamAsk(input)) {
          send(chunk);
        }
      } catch (error) {
        // O cabeçalho 200 já foi enviado: a falha precisa viajar como evento,
        // senão o cliente vê um fluxo que simplesmente termina sem explicação.
        const failure =
          error instanceof GatewayFailure
            ? { code: error.code, message: error.message }
            : { code: "falha" as const, message: "O copiloto falhou durante a resposta." };

        if (!(error instanceof GatewayFailure)) {
          console.error("[ai-gateway] falha no fluxo", error);
        }
        send({ error: failure });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      // Evita que proxy intermediário acumule o corpo e anule o fluxo.
      "X-Accel-Buffering": "no",
    },
  });
}

async function collect(input: AiAskInput) {
  let text = "";
  let meta;
  for await (const chunk of streamAsk(input)) {
    if (chunk.delta) text += chunk.delta;
    if (chunk.meta) meta = chunk.meta;
  }
  return { text, meta };
}

/** Diagnóstico do gateway: a tela usa para não oferecer um recurso desligado. */
export function GET(): Response {
  const providers = providerStatus();
  return Response.json({
    // Configurado agora significa "algum provedor de pé", não "o Gemini de pé":
    // com a reserva, o copiloto sobrevive à ausência do primário.
    configured: providers.some((provider) => provider.configured),
    // Ordem de tentativa, do primário para a reserva. Serve ao diagnóstico:
    // quando alguém reclama de lentidão, é aqui que se vê quem devia atender.
    providers,
    promptVersions: PROMPT_VERSIONS,
  });
}
