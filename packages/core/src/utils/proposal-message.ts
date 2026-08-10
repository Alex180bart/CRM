/**
 * A mensagem que leva a proposta ao cliente.
 *
 * ## Por que ela existe como função pura, e não só como saída da IA
 *
 * Porque **enviar não pode depender de a IA estar no ar**. Sem chave de
 * provedor, com cota estourada ou com o modelo fora, a proposta continua tendo
 * de chegar ao cliente — e chegar com o preço certo, que é o que a conversa
 * inteira estava esperando. A IA melhora a redação; ela não é pré-requisito para
 * o negócio acontecer.
 *
 * Essa é a mesma disciplina do resto do produto: o que é dinheiro é calculado
 * por função determinística, e o modelo entra em cima. Aqui o texto sai daqui, e
 * `/api/ai/proposta` devolve uma versão personalizada pela conversa — quando dá.
 *
 * ## Por que os valores são reescritos, e não deixados para o modelo
 *
 * Um modelo somando três linhas erra de vez em quando, e o erro é caro de um
 * jeito específico: o cliente lê um total que a cobrança não vai bater. Então a
 * mensagem gerada pela IA recebe os números **prontos** no prompt, e esta função
 * continua sendo a única a formatá-los. Nenhuma aritmética é pedida ao modelo.
 *
 * ## O que a mensagem sempre tem
 *
 * Item por item com quantidade e preço, o total, o prazo de validade e — quando
 * há recorrente e avulso juntos — os dois separados. Somar "R$ 99/mês" com
 * "R$ 290 de entrada" num número só é a forma mais rápida de gerar reclamação na
 * primeira fatura.
 */

import type { Proposal, ProposalItem } from "../types/commerce";
import { RECURRENCE_SUFFIX } from "../types/commerce";
import { computeTotals } from "./commerce";
import { formatCurrencyCents } from "./format";
import { formatDate } from "./datetime";

/**
 * Preço para o cliente sai **com centavos**, sempre.
 *
 * O resto do produto usa o formato curto — "R$ 329" — porque ali o número é
 * indicador: soma de funil, custo por atendimento, valor em aberto. Aqui ele é
 * o preço que vai ser cobrado, e "R$ 1.234" com fatura de "R$ 1.234,50" é a
 * discussão mais barata de evitar e mais cara de ter.
 */
function price(cents: number): string {
  return formatCurrencyCents(cents, true);
}

export interface ProposalMessageInput {
  proposal: Pick<Proposal, "items" | "message" | "expiresAt" | "sellerName">;
  /** Primeiro nome do contato. Vazio troca a saudação por uma sem nome. */
  contactFirstName?: string;
  /** Nome da empresa que envia — o cliente da Elora, não a Elora. */
  companyName?: string;
}

function line(item: ProposalItem): string {
  const quantity = item.quantity > 1 ? `${item.quantity}× ` : "";
  const amount = `${price(item.totalCents)}${RECURRENCE_SUFFIX[item.recurrence]}`;
  const discount = item.discountPct > 0 ? ` (${item.discountPct}% de desconto)` : "";

  return `• ${quantity}${item.name} — ${amount}${discount}`;
}

/**
 * O texto base, sem IA.
 *
 * Escrito para caber num balão de WhatsApp: frases curtas, uma lista, um total e
 * uma pergunta no fim. Sem cabeçalho de carta, sem "prezado" — o canal é o mesmo
 * em que as duas pessoas vinham conversando, e uma mudança de registro no meio
 * da conversa soa como mensagem automática.
 */
export function buildProposalMessage(input: ProposalMessageInput): string {
  const { proposal } = input;
  const totals = computeTotals(proposal.items);

  const greeting = input.contactFirstName ? `Oi, ${input.contactFirstName}!` : "Oi! Tudo bem?";

  const parts: string[] = [`${greeting} Segue o orçamento que combinamos:`];

  if (proposal.message.trim()) parts.push(proposal.message.trim());

  parts.push(proposal.items.map(line).join("\n"));

  /**
   * Recorrente e avulso viajam separados quando os dois existem.
   *
   * O total único continua aparecendo — é o que a pessoa procura primeiro —, mas
   * seguido da composição. Sem ela, "R$ 419" para uma assinatura de R$ 30 e uma
   * instalação de R$ 389 sugere cobrança única de R$ 419, e a segunda fatura
   * chega como surpresa.
   */
  if (totals.recurringCents > 0 && totals.oneOffCents > 0) {
    parts.push(
      `Total: ${price(totals.totalCents)} — ` +
        `${price(totals.recurringCents)} por mês e ` +
        `${price(totals.oneOffCents)} de entrada.`,
    );
  } else {
    parts.push(`Total: ${price(totals.totalCents)}`);
  }

  parts.push(`Os valores valem até ${formatDate(proposal.expiresAt)}.`);
  parts.push("Se estiver tudo certo, é só me responder por aqui que eu sigo com o pedido.");

  return parts.join("\n\n");
}

/**
 * O resumo dos itens em uma linha, para o prompt e para o registro.
 *
 * Existe separado da mensagem porque quem consome é outro: aqui não há saudação
 * nem chamada para ação, só o fato. É o que vai no rastro de auditoria e no
 * bloco de dados do prompt — onde uma saudação seria ruído que o modelo copiaria.
 */
export function summarizeProposalItems(items: ProposalItem[]): string {
  return items
    .map(
      (item) =>
        `${item.quantity}× ${item.name} = ${price(item.totalCents)}${RECURRENCE_SUFFIX[item.recurrence]}` +
        (item.discountPct > 0 ? ` (desconto ${item.discountPct}%)` : ""),
    )
    .join("; ");
}
