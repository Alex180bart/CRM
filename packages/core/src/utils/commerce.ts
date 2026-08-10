/**
 * Regras de preço, desconto e link de pagamento.
 *
 * Tudo aqui é **função pura**: recebe por parâmetro, não lê relógio, não sorteia
 * e não toca em repositório. É a mesma disciplina de `utils/distribution.ts`, e
 * pelo mesmo motivo — desconto é a regra que ninguém consegue depurar depois do
 * fato. "Por que essa proposta foi para o gestor e aquela não?" precisa de uma
 * resposta, não de um palpite, e três meses depois a conversa já foi arquivada.
 *
 * A consequência prática é que a tela e o repositório chamam **as mesmas
 * funções**: a tela para desabilitar o botão e avisar, o repositório para
 * recusar a gravação. Uma cópia da lógica em cada lado produz o par clássico —
 * botão habilitado e escrita recusada, sem explicação.
 */

import type {
  Product,
  Proposal,
  ProposalItem,
  ProposalStatus,
  ProposalTotals,
} from "../types/commerce";
import { PROPOSAL_TRANSITIONS } from "../types/commerce";

/* Identificação do vendedor ---------------------------------------------------- */

/**
 * "José Nogueira Ávila" → "jose-nogueira-avila".
 *
 * A decomposição Unicode (`NFD`) separa a letra do acento, e a faixa
 * `\u0300-\u036f` — os diacríticos combinantes — remove só o acento, preservando
 * a letra. Trocar isso por uma tabela de-para quebraria no primeiro nome com "ñ"
 * ou "ü", que existem em sobrenome brasileiro mais do que se imagina.
 *
 * A faixa é escrita em escape, e não com os caracteres literais: marca
 * combinante colada no arquivo é invisível no editor e some numa conversão de
 * codificação, levando junto a remoção de acento — sem erro nenhum, só nomes com
 * acento virando `jos-` no link.
 *
 * O resultado vai para dentro de uma URL que o cliente lê. Por isso nada de
 * ponto, sublinhado ou maiúscula: hífen é o único separador que sobrevive a
 * cópia, colagem, encurtador e leitura em voz alta por telefone.
 */
export function slugifySeller(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/* Preço ------------------------------------------------------------------------ */

/**
 * Total de uma linha, com o desconto já aplicado.
 *
 * O arredondamento acontece **uma vez**, no fim, e não a cada parcela: aplicar
 * desconto ao preço unitário e só então multiplicar por três acumula o erro de
 * arredondamento três vezes, e o cliente com três unidades vê um total que não
 * bate com "preço × 3 − desconto" feito na calculadora do celular.
 */
export function lineTotalCents(
  unitPriceCents: number,
  quantity: number,
  discountPct: number,
): number {
  const gross = unitPriceCents * quantity;
  return Math.round(gross * (1 - discountPct / 100));
}

/**
 * Monta o item copiando o produto.
 *
 * A cópia é o ponto: reajuste de tabela amanhã não pode mexer na proposta que
 * saiu hoje. `maxDiscountPct` também é copiado, porque é o teto **vigente na
 * montagem** que justifica a decisão de portão registrada junto.
 */
export function buildProposalItem(
  product: Product,
  quantity: number,
  discountPct: number,
): ProposalItem {
  const safeQuantity = Math.max(1, Math.round(quantity));
  const safeDiscount = Math.min(100, Math.max(0, Math.round(discountPct)));

  return {
    productId: product.id,
    productKey: product.key,
    name: product.name,
    kind: product.kind,
    recurrence: product.recurrence,
    quantity: safeQuantity,
    unitPriceCents: product.priceCents,
    discountPct: safeDiscount,
    maxDiscountPct: product.maxDiscountPct,
    totalCents: lineTotalCents(product.priceCents, safeQuantity, safeDiscount),
  };
}

/**
 * Somas da proposta.
 *
 * Devolve **quatro** números, e não um. Somar "R$ 300/mês" com "R$ 900 de
 * abertura" num total único produz R$ 1.200, que não é a primeira cobrança nem a
 * mensalidade — é um número que não existe em lugar nenhum da vida do cliente.
 * A tela mostra os dois eixos e a IA fala os dois.
 */
export function computeTotals(items: ProposalItem[]): ProposalTotals {
  let subtotalCents = 0;
  let totalCents = 0;
  let oneOffCents = 0;
  let recurringCents = 0;

  for (const item of items) {
    subtotalCents += item.unitPriceCents * item.quantity;
    totalCents += item.totalCents;
    if (item.recurrence === "unico") oneOffCents += item.totalCents;
    else recurringCents += item.totalCents;
  }

  return {
    subtotalCents,
    discountCents: subtotalCents - totalCents,
    totalCents,
    oneOffCents,
    recurringCents,
  };
}

/* Portão do desconto ------------------------------------------------------------ */

export interface DiscountCheck {
  /** Verdadeiro quando ao menos um item passou do teto do seu produto. */
  requiresApproval: boolean;
  /** Escrito para quem vai decidir: qual item, quanto pediu, quanto podia. */
  reason: string;
  /** Itens fora do teto, para a tela destacar a linha exata. */
  offending: Array<{ name: string; discountPct: number; maxDiscountPct: number }>;
}

/**
 * Decide se a proposta precisa do gestor.
 *
 * A conferência é **por item**, não pelo desconto médio da proposta. Média
 * deixaria passar 60% num serviço recorrente desde que houvesse um produto sem
 * desconto ao lado para diluir — e é exatamente a margem recorrente que o teto
 * existe para proteger.
 */
export function checkDiscount(items: ProposalItem[]): DiscountCheck {
  const offending = items
    .filter((item) => item.discountPct > item.maxDiscountPct)
    .map((item) => ({
      name: item.name,
      discountPct: item.discountPct,
      maxDiscountPct: item.maxDiscountPct,
    }));

  if (offending.length === 0) {
    return { requiresApproval: false, reason: "", offending };
  }

  const parts = offending.map(
    (item) => `${item.name}: ${item.discountPct}% pedido, teto de ${item.maxDiscountPct}%`,
  );

  return {
    requiresApproval: true,
    reason: `Desconto acima do teto em ${offending.length === 1 ? "um item" : `${offending.length} itens`} — ${parts.join("; ")}.`,
    offending,
  };
}

/**
 * O estado em que a proposta nasce quando é submetida.
 *
 * Existe como função separada — e não como um ternário dentro do repositório —
 * porque a tela precisa dizer, **antes** do clique, se aquele botão vai enviar
 * ao cliente ou pedir aprovação. Descobrir isso só depois de gravar é o que
 * produz "achei que tinha enviado".
 */
export function statusAfterSubmit(items: ProposalItem[]): ProposalStatus {
  return checkDiscount(items).requiresApproval ? "aguardando_aprovacao" : "enviada";
}

/* Máquina de estados ------------------------------------------------------------ */

export function canTransition(from: ProposalStatus, to: ProposalStatus): boolean {
  return PROPOSAL_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Prazo vencido.
 *
 * Recebe o instante por parâmetro em vez de chamar `Date.now()`, pelas duas
 * razões de sempre neste repositório: o tempo é ancorado em `REFERENCE_NOW_ISO`,
 * e função que lê relógio não se testa sem viajar no tempo.
 */
export function isExpired(proposal: Proposal, nowIso: string): boolean {
  if (proposal.status !== "enviada") return false;
  return new Date(proposal.expiresAt).getTime() < new Date(nowIso).getTime();
}

/* Link de pagamento -------------------------------------------------------------- */

export interface CheckoutLinkResult {
  ok: boolean;
  url?: string;
  reason?: string;
}

/**
 * Endereços que **nunca** podem sair daqui.
 *
 * O link é cadastrado por gente da operação e depois vira o `href` de um botão
 * que o cliente clica. `javascript:` num `href` executa no nosso domínio; `data:`
 * serve uma página que finge ser nossa. Nenhum dos dois é hipótese remota: é o
 * caminho mais curto entre "o formulário aceita texto livre" e roubo de sessão.
 *
 * A lista é de permissão, não de bloqueio. Enumerar o que é proibido perde para
 * o primeiro esquema que ninguém lembrou de listar.
 */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Monta o endereço de pagamento com o vendedor dentro.
 *
 * ## Por que parâmetro, e não caminho
 *
 * O endereço base é da ferramenta do cliente, não nossa. Acrescentar
 * `/rafael-souza` ao caminho exige que aquela ferramenta roteie o vendedor como
 * segmento — e quando ela não roteia, o link abre 404 **em silêncio**: o
 * vendedor vê o link montado, o cliente vê uma página de erro, e o defeito chega
 * como "o cliente disse que não abre". Parâmetro é ignorado por qualquer
 * destino que não o entenda, então o pior caso é perder o rastreio, nunca a
 * venda.
 *
 * A montagem usa `URL`, e não concatenação de texto: base com query já existente
 * (`?plano=anual`) viraria `...?plano=anual?vendedor=...` com um segundo `?`,
 * que a maioria dos servidores trata como parte do valor.
 *
 * ## O que cada parâmetro faz
 *
 * - `vendedor` — o nome pedido, legível pelo cliente;
 * - `vid` — identificador estável, porque dois Rafael Souza quebram o relatório
 *   montado pelo nome, e quem casa muda de nome sem deixar de ser a mesma pessoa;
 * - `ref` — a proposta, que é o que liga o pagamento de volta à conversa;
 * - `utm_*` — atribuição, na convenção que a seção 20 já usa.
 */
export function buildCheckoutUrl(input: {
  baseUrl: string;
  sellerName: string;
  sellerId: string;
  proposalId: string;
}): CheckoutLinkResult {
  const base = input.baseUrl.trim();
  if (!base) return { ok: false, reason: "O produto não tem endereço de pagamento cadastrado." };

  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return { ok: false, reason: "O endereço de pagamento do produto não é uma URL válida." };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: "O endereço de pagamento precisa começar com http:// ou https://." };
  }

  const slug = slugifySeller(input.sellerName);
  if (slug) url.searchParams.set("vendedor", slug);
  url.searchParams.set("vid", input.sellerId);
  url.searchParams.set("ref", input.proposalId);
  url.searchParams.set("utm_source", "elora");
  url.searchParams.set("utm_medium", "conversa");
  url.searchParams.set("utm_campaign", "proposta");

  return { ok: true, url: url.toString() };
}

/**
 * Valida o endereço no momento do cadastro, com a mesma régua do envio.
 *
 * Conferir só na hora de enviar deixaria o erro aparecer com o cliente na linha
 * esperando o link — o pior instante possível para descobrir que alguém colou o
 * endereço sem `https://`.
 */
export function validateCheckoutBaseUrl(value: string): { ok: boolean; reason?: string } {
  const result = buildCheckoutUrl({
    baseUrl: value,
    sellerName: "teste",
    sellerId: "teste",
    proposalId: "teste",
  });
  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}
