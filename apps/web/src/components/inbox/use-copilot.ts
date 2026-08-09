"use client";

import { useCallback, useRef, useState } from "react";
import type {
  AiConversationAnalysis,
  AiConversationContext,
  AiRunMeta,
  AiToneAdjustment,
} from "@elora/core";
import { AiGatewayError, repositories } from "@elora/core";

import { contextSignature } from "@/lib/ai/context";

export type CopilotStatus = "ocioso" | "carregando" | "erro" | "pronto";

interface AnalysisEntry {
  analysis: AiConversationAnalysis;
  /** Assinatura do contexto no momento da análise, para detectar desatualização. */
  signature: string;
}

export interface AskTurn {
  role: "atendente" | "copiloto";
  body: string;
  /** Presente só nos turnos do copiloto, para expor custo e latência. */
  meta?: AiRunMeta;
}

/**
 * Estado do copiloto, mantido acima da conversa.
 *
 * O cache vive aqui, e não dentro do painel, por uma razão concreta: o painel
 * desmonta ao trocar de conversa. Se o resultado morresse com ele, voltar a uma
 * conversa já analisada custaria outra chamada ao provedor — e navegar com as
 * setas por dez conversas custaria dez análises. Com o cache, reabrir é grátis.
 *
 * A invalidação é por assinatura de conteúdo: mensagem nova não apaga a análise
 * (o atendente pode ainda estar lendo), mas a marca como desatualizada para que
 * a interface ofereça reanalisar em vez de mentir que está atual.
 */
export function useCopilot() {
  const [analyses, setAnalyses] = useState<Record<string, AnalysisEntry>>({});
  const [status, setStatus] = useState<CopilotStatus>("ocioso");
  const [error, setError] = useState<string | null>(null);

  const [conversation, setConversation] = useState<Record<string, AskTurn[]>>({});
  const [asking, setAsking] = useState(false);
  const [streamingAnswer, setStreamingAnswer] = useState<string>("");

  /** Impede que a resposta de uma conversa apareça em outra após a troca. */
  const activeRequest = useRef(0);

  const describe = useCallback((failure: unknown): string => {
    if (failure instanceof AiGatewayError) return failure.message;
    return "O copiloto falhou. Tente novamente.";
  }, []);

  const analyze = useCallback(
    async (context: AiConversationContext) => {
      const ticket = ++activeRequest.current;
      setStatus("carregando");
      setError(null);

      try {
        const analysis = await repositories.ai.analyzeConversation({ context });
        if (ticket !== activeRequest.current) return;

        setAnalyses((current) => ({
          ...current,
          [context.conversationId]: { analysis, signature: contextSignature(context) },
        }));
        setStatus("pronto");
      } catch (failure) {
        if (ticket !== activeRequest.current) return;
        setError(describe(failure));
        setStatus("erro");
      }
    },
    [describe],
  );

  const suggest = useCallback(
    async (context: AiConversationContext, draft?: string): Promise<string | null> => {
      try {
        const result = await repositories.ai.suggestReply({ context, draft });
        return result.text;
      } catch (failure) {
        setError(describe(failure));
        return null;
      }
    },
    [describe],
  );

  const rewrite = useCallback(
    async (
      context: AiConversationContext,
      draft: string,
      tone: AiToneAdjustment,
    ): Promise<string | null> => {
      try {
        const result = await repositories.ai.rewrite({ context, draft, tone });
        return result.text;
      } catch (failure) {
        setError(describe(failure));
        return null;
      }
    },
    [describe],
  );

  const ask = useCallback(
    async (context: AiConversationContext, question: string) => {
      const key = context.conversationId;
      const history = (conversation[key] ?? []).map((turn) => ({
        role: turn.role,
        body: turn.body,
      }));

      setConversation((current) => ({
        ...current,
        [key]: [...(current[key] ?? []), { role: "atendente", body: question }],
      }));
      setAsking(true);
      setStreamingAnswer("");
      setError(null);

      const ticket = ++activeRequest.current;

      try {
        const result = await repositories.ai.ask({ context, question, history }, (partial) => {
          if (ticket === activeRequest.current) setStreamingAnswer(partial);
        });

        if (ticket !== activeRequest.current) return;

        setConversation((current) => ({
          ...current,
          [key]: [
            ...(current[key] ?? []),
            { role: "copiloto", body: result.text, meta: result.meta },
          ],
        }));
      } catch (failure) {
        if (ticket !== activeRequest.current) return;
        setError(describe(failure));
        // A pergunta fica no histórico visível: apagá-la faria o atendente
        // achar que não enviou nada, e ele digitaria de novo.
      } finally {
        if (ticket === activeRequest.current) {
          setAsking(false);
          setStreamingAnswer("");
        }
      }
    },
    [conversation, describe],
  );

  const reset = useCallback((conversationId: string) => {
    setConversation((current) => {
      const next = { ...current };
      delete next[conversationId];
      return next;
    });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  /**
   * O que o painel precisa saber sobre uma conversa específica.
   *
   * Recebe **identificador e assinatura**, não o contexto montado. A assinatura
   * é uma string curta derivada da conversa; montar o contexto completo (mapear
   * e ordenar todas as mensagens e notas, derivar os fatos do contato) custava
   * cerca de 25 ms a cada troca de conversa — trabalho jogado fora, porque só a
   * chamada ao provedor precisa dele. Agora o contexto é construído no clique.
   */
  const stateFor = useCallback(
    (conversationId: string | null, signature: string) => {
      if (!conversationId) {
        return { analysis: null, stale: false, turns: [] as AskTurn[] };
      }
      const entry = analyses[conversationId];
      return {
        analysis: entry?.analysis ?? null,
        stale: entry ? entry.signature !== signature : false,
        turns: conversation[conversationId] ?? [],
      };
    },
    [analyses, conversation],
  );

  return {
    status,
    error,
    asking,
    streamingAnswer,
    analyze,
    suggest,
    rewrite,
    ask,
    reset,
    clearError,
    stateFor,
  };
}

export type CopilotController = ReturnType<typeof useCopilot>;
