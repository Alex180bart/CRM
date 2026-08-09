/**
 * Conversas de webchat vivas, para o Inbox.
 *
 * Fecha o ciclo: o visitante escreve no site, e o atendente vê a conversa aqui
 * dentro. Sem esta rota o webchat seria uma caixa que engole mensagem — o pior
 * defeito possível num canal de atendimento.
 *
 * `GET` lista; `POST` grava a resposta do atendente na sessão, e o widget a
 * recebe na próxima leitura.
 *
 * Rota **interna**: ao contrário das outras de webchat, não leva CORS. Ela é
 * consumida pelo Inbox, que roda no nosso domínio; abri-la a origem externa
 * exporia a transcrição de qualquer visitante a quem soubesse o identificador
 * da sessão.
 */

import type { AgentPendingAction, AgentTraceStep } from "@elora/core";
import type { NextRequest } from "next/server";

import { listLiveSessions, replyFromAgent } from "@/lib/webchat/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface LiveConversation {
  sessionId: string;
  widgetId: string;
  origin: string;
  startedAt: string;
  lastActivityAt: string;
  visitorName: string;
  queueId: string;
  handedOff: boolean;
  prechat: Record<string, string>;
  messages: Array<{ id: string; role: string; body: string; occurredAt: string }>;

  /**
   * O que a IA fez, quando foi um agente que atendeu.
   *
   * Vai junto da conversa e não numa rota separada por um motivo prático: quem
   * assume a conversa precisa do rastro **no mesmo instante** em que a lê. Uma
   * segunda chamada significaria abrir o painel e esperar, e o que se espera
   * ninguém consulta.
   */
  agentId?: string;
  agentTurns: number;
  agentCostCents: number;
  agentSteps: AgentTraceStep[];
  agentPending: AgentPendingAction[];
  handoffReason?: string;
  handoffSummary?: string;

  /**
   * Avaliação do atendimento.
   *
   * `surveyOffered` viaja junto da nota porque as duas ausências dizem coisas
   * diferentes: não perguntamos, ou perguntamos e a pessoa não respondeu. A
   * segunda é sinal — e some se guardarmos só a nota.
   */
  surveyOffered: boolean;
  surveyScore?: number;
  surveyComment?: string;
  surveyAnsweredAt?: string;
}

export function GET(): Response {
  const conversations: LiveConversation[] = listLiveSessions().map((session) => ({
    sessionId: session.id,
    widgetId: session.widgetId,
    origin: session.origin,
    startedAt: session.startedAt,
    lastActivityAt: session.lastActivityAt,
    // Sem formulário não há nome; "Visitante" é honesto e melhor que um
    // identificador de sessão na lista do Inbox.
    visitorName: session.visitorName ?? session.prechat["contato.nome"] ?? "Visitante do site",
    queueId: session.queueId,
    handedOff: session.handedOff,
    prechat: session.prechat,
    messages: session.messages,
    agentId: session.agentId,
    agentTurns: session.agentTurns,
    agentCostCents: session.agentSpentCents,
    agentSteps: session.agentSteps,
    agentPending: session.agentPending,
    handoffReason: session.handoffReason,
    handoffSummary: session.handoffSummary,
    surveyOffered: session.surveyOffered,
    surveyScore: session.surveyScore,
    surveyComment: session.surveyComment,
    surveyAnsweredAt: session.surveyAnsweredAt,
  }));

  return Response.json({ conversations }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { message: "Corpo inválido." } }, { status: 400 });
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const sessionId = typeof record.sessionId === "string" ? record.sessionId : "";
  const text = typeof record.body === "string" ? record.body.trim().slice(0, 2_000) : "";
  const author = typeof record.author === "string" ? record.author.slice(0, 120) : "Atendimento";

  if (!sessionId || !text) {
    return Response.json({ error: { message: "Sessão ou mensagem ausente." } }, { status: 400 });
  }

  const delivered = replyFromAgent(sessionId, text, author);
  if (!delivered) {
    return Response.json({ error: { message: "Sessão encerrada." } }, { status: 410 });
  }

  return Response.json({ ok: true });
}
