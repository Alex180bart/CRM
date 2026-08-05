import type { Conversation, SlaStatus } from "../types/inbox";
import { minutesUntil, nowMs } from "./datetime";

/**
 * Regra de SLA do atendimento (seção 10 do plano).
 *
 * O status é derivado do prazo de primeira resposta enquanto ela não ocorre e,
 * depois, do prazo de resolução. Conversas aguardando o cliente têm o relógio
 * pausado — o tempo de espera do contato não é contado contra o time.
 */
export function resolveSlaStatus(conversation: Conversation): SlaStatus {
  if (conversation.state === "resolvida" || conversation.state === "encerrada") {
    return "cumprido";
  }
  if (conversation.state === "aguardando_cliente") {
    return "pausado";
  }

  const deadline = conversation.firstRespondedAt
    ? conversation.resolutionDueAt
    : conversation.firstResponseDueAt;

  if (!deadline) return "dentro";

  const remaining = minutesUntil(deadline);
  if (remaining < 0) return "estourado";
  if (remaining <= 15) return "atencao";
  return "dentro";
}

/** Percentual do prazo já consumido, limitado a 100 — usado na barra de SLA. */
export function slaConsumedPercent(conversation: Conversation): number {
  const deadline = conversation.firstRespondedAt
    ? conversation.resolutionDueAt
    : conversation.firstResponseDueAt;
  if (!deadline) return 0;

  const startedAt = Date.parse(conversation.createdAt);
  const dueAt = Date.parse(deadline);
  const total = dueAt - startedAt;
  if (total <= 0) return 100;

  const elapsed = nowMs() - startedAt;
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}
