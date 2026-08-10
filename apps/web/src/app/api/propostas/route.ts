/**
 * Ciclo de vida da proposta.
 *
 * Rota separada de `/api/admin` de propósito. Aquela responde a atos de
 * **configuração** — cadastrar produto, mexer em fila, editar permissão —, feitos
 * por quem administra a operação, raramente. Esta responde a atos
 * **operacionais**, feitos por quem atende, o dia inteiro. Juntá-las faria a
 * permissão de administrar o catálogo virar pré-requisito para vender.
 *
 * A rota continua fina, pela mesma regra da outra: ela não decide se a
 * alteração pode acontecer. Quem decide é o repositório, com as funções puras de
 * `utils/commerce.ts`. Aqui só se confere a forma do corpo e se traduz a recusa
 * em HTTP.
 *
 * ## O ator ainda não é real
 *
 * Sem autenticação, o ator é o usuário fixo do protótipo — e aqui isso pesa mais
 * que na Administração, porque o ator é o **vendedor** que vai no link e quem o
 * portão de desconto impede de aprovar a própria proposta. Quando a sessão
 * existir, este é o único ponto que muda. **Não confie neste campo para nada
 * além de demonstração.**
 */

import type { AdminActor, AdminWriteResult } from "@elora/core";
import { CURRENT_USER_ID, repositories } from "@elora/core";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status = 400): Response {
  return Response.json({ ok: false, reason: message }, { status });
}

/** Recusa de regra de negócio é 409, não 400: o corpo estava certo. */
function respond(result: AdminWriteResult): Response {
  return Response.json(result, { status: result.ok ? 200 : 409 });
}

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

/**
 * Itens da proposta.
 *
 * Quantidade e desconto são recortados aqui só para não deixar passar `NaN` e
 * `Infinity` ao repositório. O **teto** de desconto não é conferido nesta
 * camada: quem confere é `checkDiscount`, no repositório, porque o teto vem do
 * produto e conferi-lo aqui exigiria ler o catálogo — que é exatamente a
 * decisão de negócio que a rota não deve tomar.
 */
function items(value: unknown): Array<{ productId: string; quantity: number; discountPct: number }> {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      productId: text(item.productId, 64),
      quantity: Math.min(999, Math.max(1, integer(item.quantity, 1))),
      discountPct: Math.min(100, Math.max(0, integer(item.discountPct, 0))),
    }))
    .filter((item) => item.productId)
    .slice(0, 20);
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Corpo da requisição não é JSON válido.");
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const action = text(record.action, 24);
  const id = text(record.id, 64);
  const data = (record.data ?? {}) as Record<string, unknown>;

  const users = await repositories.directory.listUsers();
  const me = users.find((user) => user.id === CURRENT_USER_ID);

  const actor: AdminActor = { id: CURRENT_USER_ID, label: me?.name ?? "Atendente" };
  const commerce = repositories.commerce;

  try {
    switch (action) {
      case "criar":
        return respond(
          await commerce.createProposal(actor, {
            conversationId: text(data.conversationId, 64),
            contactId: text(data.contactId, 64),
            /**
             * O vendedor é sempre quem está montando, nunca um campo do corpo.
             * Aceitá-lo do cliente permitiria montar proposta em nome de outra
             * pessoa — e o nome dela iria no link de pagamento.
             */
            sellerId: actor.id,
            items: items(data.items),
            message: text(data.message, 600),
            validForDays: Math.min(90, Math.max(1, integer(data.validForDays, 7))),
            origin: data.origin === "agente_ia" ? "agente_ia" : "atendente",
          }),
        );

      case "enviar":
        return respond(await commerce.submitProposal(actor, id));

      case "aprovar":
        return respond(await commerce.decideApproval(actor, id, true));

      case "reprovar":
        return respond(await commerce.decideApproval(actor, id, false, text(data.note, 400)));

      /**
       * Resposta do cliente registrada por quem atende.
       *
       * Hoje é o atendente que marca, porque o aceite pelo próprio cliente
       * depende do canal devolver o clique — o webchat já devolveria, o WhatsApp
       * depende da camada de escrita de conversas que ainda não existe. O
       * registro guarda quem marcou, e a auditoria não confunde as duas coisas.
       */
      case "aceitar":
        return respond(await commerce.recordClientDecision(actor, id, true));

      case "recusar":
        return respond(await commerce.recordClientDecision(actor, id, false));

      case "pago":
        return respond(await commerce.markPaid(actor, id));

      case "cancelar":
        return respond(await commerce.cancelProposal(actor, id, text(data.reason, 300)));

      default:
        return fail(`Operação desconhecida: ${action}`);
    }
  } catch (error) {
    console.error("[propostas] falha não prevista", error);
    return fail("A operação falhou de forma inesperada.", 500);
  }
}
