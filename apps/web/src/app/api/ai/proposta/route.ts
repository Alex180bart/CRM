/**
 * Mensagem de proposta pelo AI Gateway.
 *
 * ## Por que a rota monta o texto base antes de chamar o modelo
 *
 * Porque a mensagem precisa existir mesmo quando o modelo não responde. Sem
 * chave, com cota estourada ou com o provedor fora, esta rota devolve **200 com
 * o texto determinístico** de `buildProposalMessage` e diz, no corpo, que a IA
 * não participou. A alternativa — 502 — deixaria o vendedor sem mensagem no
 * exato momento em que ele precisa enviar o orçamento, e a proposta é o passo em
 * que a conversa vira dinheiro.
 *
 * É uma inversão consciente em relação à rota de e-mail, que falha quando o
 * modelo falha. Lá o produto é o texto: sem modelo, não há o que entregar. Aqui
 * o produto é o **orçamento**; o texto é a embalagem, e existe uma embalagem
 * padrão que sempre serve.
 *
 * ## A conferência dos valores mora no Gateway
 *
 * `runProposalMessage` recusa a saída que alterou ou omitiu um valor, e esta
 * rota trata a recusa como qualquer outra falha: cai no texto base. O cliente
 * nunca recebe um preço reescrito pelo modelo.
 *
 * ## A proposta é lida do repositório, não recebida do corpo
 *
 * O navegador manda o identificador; os itens e os valores vêm do armazém. Se
 * viessem do corpo, alguém poderia pedir a redação de um orçamento que não
 * existe — e a mensagem sairia com preços que a proposta gravada não tem.
 */

import type { NextRequest } from "next/server";
import {
  CHANNEL_LABEL,
  buildProposalMessage,
  computeTotals,
  formatCurrencyCents,
  formatDate,
  repositories,
  summarizeProposalItems,
  type ChannelKind,
} from "@elora/core";

import {
  GatewayFailure,
  enforceRateLimit,
  isCopilotConfigured,
  runProposalMessage,
} from "@/lib/ai/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Últimas falas que entram no prompt. Ver o comentário em `proposalContext`. */
const EXCERPT_MESSAGES = 8;
const MAX_EXCERPT_CHARS = 1_400;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function identify(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: "invalido", message: "Corpo inválido." } },
      { status: 400 },
    );
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const proposalId = text(record.proposalId, 64).trim();
  if (!proposalId) {
    return Response.json(
      { error: { code: "invalido", message: "Informe a proposta." } },
      { status: 400 },
    );
  }

  const proposals = await repositories.commerce.listProposals();
  const proposal = proposals.find((item) => item.id === proposalId);
  if (!proposal) {
    return Response.json(
      { error: { code: "invalido", message: "Proposta não encontrada." } },
      { status: 404 },
    );
  }

  const contact = await repositories.contacts.getById(proposal.contactId);
  const conversation = await repositories.conversations.getById(proposal.conversationId);
  const firstName = (contact?.preferredName || contact?.fullName || "").split(" ")[0] ?? "";

  const totals = computeTotals(proposal.items);
  const totalLabel =
    totals.recurringCents > 0 && totals.oneOffCents > 0
      ? `${formatCurrencyCents(totals.totalCents, true)} — ${formatCurrencyCents(totals.recurringCents, true)} por mês e ${formatCurrencyCents(totals.oneOffCents, true)} de entrada`
      : formatCurrencyCents(totals.totalCents, true);

  /** O texto que sempre serve. Vai na resposta mesmo quando a IA participa. */
  const fallback = buildProposalMessage({
    proposal,
    contactFirstName: firstName,
  });

  const needsApproval = Boolean(record.needsApproval);

  if (!isCopilotConfigured()) {
    return Response.json({ message: fallback, generatedByAi: false, meta: null });
  }

  try {
    enforceRateLimit(identify(request), Date.now());

    const messages = conversation
      ? await repositories.conversations.listMessages(conversation.id)
      : [];

    const excerpt = messages
      .slice(-EXCERPT_MESSAGES)
      .map((message) => `${message.direction === "entrada" ? "Cliente" : "Nós"}: ${message.body}`)
      .join("\n")
      .slice(-MAX_EXCERPT_CHARS);

    /**
     * O que precisa aparecer no texto final, palavra por palavra.
     *
     * Total e cada linha. É esta lista que o Gateway confere antes de aceitar a
     * saída do modelo — e é por ela que "cerca de oitocentos reais" é recusado.
     */
    const requiredAmounts = [
      formatCurrencyCents(totals.totalCents, true),
      ...proposal.items.map((item) => formatCurrencyCents(item.totalCents, true)),
    ];

    const result = await runProposalMessage(
      {
        contactFirstName: firstName,
        sellerName: proposal.sellerName,
        channel: conversation ? CHANNEL_LABEL[conversation.channel as ChannelKind] : "WhatsApp",
        conversationExcerpt: conversation
          ? `Assunto: ${conversation.subject}\n${excerpt}`
          : excerpt,
        itemsSummary: summarizeProposalItems(proposal.items),
        totalLabel,
        validUntil: formatDate(proposal.expiresAt),
        sellerNote: proposal.message,
        needsApproval,
      },
      requiredAmounts,
    );

    return Response.json({ message: result.message, generatedByAi: true, meta: result.meta });
  } catch (error) {
    /**
     * Falha de IA **não** vira erro para quem está vendendo.
     *
     * O motivo viaja no corpo para a interface poder dizer "escrevemos o texto
     * padrão porque a IA não respondeu" — que é diferente de esconder o
     * problema e diferente de bloquear o envio por causa dele.
     */
    const reason = error instanceof GatewayFailure ? error.message : "A IA não respondeu a tempo.";

    return Response.json({ message: fallback, generatedByAi: false, reason, meta: null });
  }
}
