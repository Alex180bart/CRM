/**
 * Catálogo e propostas, em memória.
 *
 * Mesma honestidade do resto da camada de escrita sem back-end: grava no armazém
 * preso ao `globalThis`, sobrevive à navegação e ao recarregamento do `next dev`
 * e **morre no reinício**. O que muda quando o Supabase entrar é o corpo destes
 * métodos, não o contrato em `types.ts` — que é o que a aplicação conhece.
 *
 * ## Nenhuma decisão de negócio mora aqui
 *
 * Preço, teto de desconto, portão do gestor, transição de estado e montagem do
 * link vêm inteiros de `utils/commerce.ts`, que é puro. Este arquivo orquestra:
 * lê, chama a regra, grava, audita e publica o evento. É o que permite a tela
 * responder "este botão vai pedir aprovação" **antes** do clique, usando a mesma
 * função que aqui decide se aceita a gravação.
 *
 * ## Toda escrita devolve `AdminWriteResult`, nunca lança
 *
 * "Desconto acima do teto" não é exceção: é resposta, com o motivo escrito para
 * quem vai ler. É a mesma regra da Administração, e pela mesma razão — o motivo
 * precisa caber dentro do diálogo, não num toast que some antes da leitura.
 */

import type { AuditEntry } from "../types/governance";
import type { Id } from "../types/common";
import type { Proposal, ProposalItem, ProposalStatus } from "../types/commerce";
import {
  buildCheckoutUrl,
  buildProposalItem,
  canTransition,
  checkDiscount,
  computeTotals,
  statusAfterSubmit,
} from "../utils/commerce";
import { formatCurrencyCents } from "../utils/format";
import { now, offsetIso } from "../utils/datetime";
import { ORG_ID } from "../mock/organization";
import { publishEvent } from "./events-memory";
import { store } from "./store";
import type { AdminActor, AdminWriteResult, CommerceRepository } from "./types";

/* Apoios --------------------------------------------------------------------- */

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${sequence.toString(36)}${Date.now().toString(36).slice(-4)}`;
}

function ok<T>(data?: T): AdminWriteResult<T> {
  return { ok: true, data };
}

function no(reason: string): AdminWriteResult<never> {
  return { ok: false, reason };
}

function audit(
  actor: AdminActor,
  input: {
    action: string;
    target: string;
    detail: string;
    severity?: AuditEntry["severity"];
  },
): void {
  store.audit.unshift({
    id: nextId("aud"),
    occurredAt: offsetIso({}),
    actorId: actor.id,
    actorLabel: actor.label,
    action: input.action,
    category: "configuracao",
    target: input.target,
    detail: input.detail,
    severity: input.severity ?? "informativo",
  });
}

function findProposal(id: Id): Proposal | undefined {
  return store.proposals.find((item) => item.id === id);
}

/**
 * Aplica a transição conferindo a tabela antes.
 *
 * Centralizado porque cada método precisa da mesma recusa, escrita da mesma
 * forma. Espalhar `if (proposal.status !== "enviada")` por seis métodos produz
 * seis mensagens diferentes para o mesmo problema — e a sétima, esquecida.
 */
function transition(proposal: Proposal, to: ProposalStatus): AdminWriteResult<never> | null {
  if (!canTransition(proposal.status, to)) {
    return no(
      `Uma proposta em "${proposal.status}" não pode ir para "${to}". Recarregue: alguém pode ter mexido nela.`,
    );
  }
  proposal.status = to;
  proposal.updatedAt = offsetIso({});
  return null;
}

/* Repositório ---------------------------------------------------------------- */

export const commerceMemoryRepository: CommerceRepository = {
  async listProducts() {
    return store.products;
  },

  async listProposals() {
    return store.proposals;
  },

  async listProposalsByConversation(conversationId) {
    return store.proposals.filter((item) => item.conversationId === conversationId);
  },

  /**
   * Monta a proposta em rascunho.
   *
   * Nasce em `rascunho` sempre, mesmo sem desconto nenhum: a montagem e o envio
   * são dois atos, e juntá-los tiraria do vendedor a única chance de reler o que
   * vai sair antes de o cliente ver. O passo seguinte é `submitProposal`, que é
   * quem consulta o portão.
   */
  async createProposal(actor, input) {
    if (input.items.length === 0) return no("A proposta precisa de ao menos um item.");
    if (input.items.length > 20) return no("A proposta aceita no máximo 20 itens.");

    const items: ProposalItem[] = [];

    for (const line of input.items) {
      const product = store.products.find((item) => item.id === line.productId);
      if (!product) return no("Produto não encontrado. Recarregue o catálogo.");
      if (!product.active) {
        return no(`"${product.name}" está inativo e não pode entrar em proposta nova.`);
      }
      items.push(buildProposalItem(product, line.quantity, line.discountPct));
    }

    const seller = store.users.find((user) => user.id === input.sellerId);
    if (!seller) return no("Vendedor não encontrado.");

    const totals = computeTotals(items);
    const timestamp = offsetIso({});

    const proposal: Proposal = {
      id: nextId("prop"),
      organizationId: ORG_ID,
      createdAt: timestamp,
      updatedAt: timestamp,
      conversationId: input.conversationId,
      contactId: input.contactId,
      sellerId: seller.id,
      sellerName: seller.name,
      items,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      totalCents: totals.totalCents,
      status: "rascunho",
      message: input.message.slice(0, 600),
      expiresAt: offsetIso({ days: input.validForDays ?? 7 }),
      origin: input.origin,
    };

    store.proposals.unshift(proposal);

    audit(actor, {
      action: "proposta.criada",
      target: `Proposta ${proposal.id}`,
      detail: `${items.length} item(ns), ${formatCurrencyCents(totals.totalCents)} — origem ${input.origin}.`,
    });

    return ok(proposal);
  },

  /**
   * Submete: vai ao cliente, ou trava esperando o gestor.
   *
   * O portão é conferido **aqui**, e não na criação, porque o vendedor pode
   * editar o rascunho — e conferir na criação avaliaria um desconto que já mudou.
   */
  async submitProposal(actor, id) {
    const proposal = findProposal(id);
    if (!proposal) return no("Proposta não encontrada.");

    const target = statusAfterSubmit(proposal.items);
    const failure = transition(proposal, target);
    if (failure) return failure;

    if (target === "aguardando_aprovacao") {
      const check = checkDiscount(proposal.items);
      proposal.approval = {
        requestedAt: offsetIso({}),
        requestedBy: actor.id,
        reason: check.reason,
      };

      audit(actor, {
        action: "proposta.aprovacao_solicitada",
        target: `Proposta ${proposal.id}`,
        detail: check.reason,
        severity: "atencao",
      });

      return ok(proposal);
    }

    proposal.sentAt = offsetIso({});

    publishEvent({
      name: "proposal.sent",
      source: "comercio",
      subjectType: "proposta",
      subjectId: proposal.id,
      /**
       * A chave usa o identificador da proposta, e não um resumo do conteúdo:
       * duas propostas idênticas para contatos diferentes são dois fatos, e um
       * resumo do corpo faria a segunda sumir como se fosse reentrega.
       */
      idempotencyKey: `proposal_sent:${proposal.id}`,
      payload: {
        proposalId: proposal.id,
        conversationId: proposal.conversationId,
        contactId: proposal.contactId,
        totalCents: proposal.totalCents,
      },
    });

    audit(actor, {
      action: "proposta.enviada",
      target: `Proposta ${proposal.id}`,
      detail: `Enviada ao cliente por ${formatCurrencyCents(proposal.totalCents)}.`,
    });

    return ok(proposal);
  },

  /**
   * Decisão do gestor sobre o desconto.
   *
   * **Quem pediu não pode aprovar.** Sem essa conferência o portão vira
   * formalidade: o mesmo vendedor clicaria em "solicitar" e "aprovar" em
   * sequência, e a trilha de auditoria registraria uma aprovação que nunca
   * existiu — pior que não ter portão, porque parece que tem.
   */
  async decideApproval(actor, id, approve, note) {
    const proposal = findProposal(id);
    if (!proposal) return no("Proposta não encontrada.");
    if (proposal.status !== "aguardando_aprovacao") {
      return no("Esta proposta não está aguardando aprovação.");
    }
    if (proposal.approval && proposal.approval.requestedBy === actor.id) {
      return no("Quem pediu a aprovação não pode aprovar a própria proposta.");
    }
    if (!approve && !note?.trim()) {
      return no("Escreva o motivo da reprovação — quem montou a proposta precisa saber o que mudar.");
    }

    const failure = transition(proposal, approve ? "enviada" : "reprovada_interna");
    if (failure) return failure;

    proposal.approval = {
      ...(proposal.approval ?? {
        requestedAt: offsetIso({}),
        requestedBy: actor.id,
        reason: "",
      }),
      decidedAt: offsetIso({}),
      decidedBy: actor.id,
      decidedByLabel: actor.label,
      note: note?.trim() || undefined,
    };

    if (approve) {
      proposal.sentAt = offsetIso({});
      publishEvent({
        name: "proposal.sent",
        source: "comercio",
        idempotencyKey: `proposal_sent:${proposal.id}`,
        payload: {
          proposalId: proposal.id,
          conversationId: proposal.conversationId,
          contactId: proposal.contactId,
          totalCents: proposal.totalCents,
        },
      });
    }

    audit(actor, {
      action: approve ? "proposta.aprovada" : "proposta.reprovada",
      target: `Proposta ${proposal.id}`,
      detail: approve
        ? `Desconto aprovado e proposta enviada. ${proposal.approval.reason}`
        : `Reprovada: ${note}`,
      severity: "atencao",
    });

    return ok(proposal);
  },

  /**
   * Resposta do cliente. Aceite é o que **gera** o link de pagamento.
   *
   * Gerar o endereço na montagem e escondê-lo até o aceite seria indistinguível
   * disto para quem inspeciona a rede, e o produto passaria a prometer uma ordem
   * que não cumpre. O campo nasce vazio e só é preenchido aqui.
   *
   * Falha ao montar o link **não desfaz o aceite**. O cliente aceitou — isso é
   * um fato, e apagá-lo porque a URL cadastrada estava errada perderia a
   * informação mais valiosa da conversa. A proposta fica aceita, sem link, e o
   * motivo volta para quem está atendendo resolver.
   */
  async recordClientDecision(actor, id, accepted) {
    const proposal = findProposal(id);
    if (!proposal) return no("Proposta não encontrada.");

    const failure = transition(proposal, accepted ? "aceita" : "recusada");
    if (failure) return failure;

    proposal.respondedAt = offsetIso({});

    if (!accepted) {
      publishEvent({
        name: "proposal.rejected",
        source: "comercio",
        subjectType: "proposta",
        subjectId: proposal.id,
        idempotencyKey: `proposal_rejected:${proposal.id}`,
        payload: { proposalId: proposal.id, contactId: proposal.contactId },
      });
      audit(actor, {
        action: "proposta.recusada_cliente",
        target: `Proposta ${proposal.id}`,
        detail: "O cliente recusou a proposta.",
      });
      return ok(proposal);
    }

    publishEvent({
      name: "proposal.accepted",
      source: "comercio",
      subjectType: "proposta",
      subjectId: proposal.id,
      idempotencyKey: `proposal_accepted:${proposal.id}`,
      payload: {
        proposalId: proposal.id,
        contactId: proposal.contactId,
        totalCents: proposal.totalCents,
      },
    });

    const link = resolveCheckout(proposal);
    if (link.ok) {
      proposal.checkoutUrl = link.url;
      audit(actor, {
        action: "proposta.aceita",
        target: `Proposta ${proposal.id}`,
        detail: `Aceita pelo cliente. Link de pagamento gerado para ${proposal.sellerName}.`,
      });
      return ok(proposal);
    }

    audit(actor, {
      action: "proposta.aceita",
      target: `Proposta ${proposal.id}`,
      detail: `Aceita pelo cliente, mas o link não pôde ser gerado: ${link.reason}`,
      severity: "atencao",
    });

    return { ok: true, data: proposal, reason: link.reason };
  },

  /**
   * Pagamento confirmado.
   *
   * No modo `link` isto é sempre afirmação de gente — a plataforma não fala com
   * a ferramenta de destino e não tem como saber. `paidConfirmedBy` guarda quem
   * afirmou, para que ninguém confunda depois "conciliado" com "alguém marcou".
   */
  async markPaid(actor, id) {
    const proposal = findProposal(id);
    if (!proposal) return no("Proposta não encontrada.");

    const failure = transition(proposal, "paga");
    if (failure) return failure;

    proposal.paidAt = offsetIso({});
    proposal.paidConfirmedBy = actor.id;

    publishEvent({
      name: "proposal.paid",
      source: "comercio",
      subjectType: "proposta",
      subjectId: proposal.id,
      idempotencyKey: `proposal_paid:${proposal.id}`,
      payload: {
        proposalId: proposal.id,
        contactId: proposal.contactId,
        totalCents: proposal.totalCents,
        confirmedBy: actor.id,
      },
    });

    audit(actor, {
      action: "proposta.paga",
      target: `Proposta ${proposal.id}`,
      detail: `Pagamento de ${formatCurrencyCents(proposal.totalCents)} confirmado manualmente.`,
      severity: "atencao",
    });

    return ok(proposal);
  },

  async cancelProposal(actor, id, reason) {
    const proposal = findProposal(id);
    if (!proposal) return no("Proposta não encontrada.");

    const failure = transition(proposal, "cancelada");
    if (failure) return failure;

    audit(actor, {
      action: "proposta.cancelada",
      target: `Proposta ${proposal.id}`,
      detail: reason?.trim() || "Cancelada sem motivo informado.",
    });

    return ok(proposal);
  },

  /**
   * Vence o que passou do prazo.
   *
   * Recebe o instante do chamador em vez de ler o relógio: `expiresAt` sai do
   * tempo ancorado (`offsetIso`), e comparar um carimbo ancorado com
   * `Date.now()` é o defeito que já derrubou as sessões do webchat — como a
   * âncora fica no passado, tudo nasceria vencido.
   */
  async expireOverdue() {
    const reference = now();
    let count = 0;

    for (const proposal of store.proposals) {
      if (proposal.status !== "enviada") continue;
      if (new Date(proposal.expiresAt).getTime() >= new Date(reference).getTime()) continue;
      proposal.status = "expirada";
      proposal.updatedAt = offsetIso({});
      count += 1;
    }

    return count;
  },
};

/**
 * Resolve o endereço de pagamento conforme o modo do produto.
 *
 * Proposta com itens de modos diferentes cai no `integrado` — que hoje não
 * existe —, e a recusa diz isso com todas as letras em vez de montar o link do
 * primeiro item e cobrar só uma parte. Misturar os dois modos num carrinho é
 * legítimo do ponto de vista comercial; o que não é legítimo é fingir que uma
 * URL só resolve os dois.
 */
function resolveCheckout(proposal: Proposal): { ok: boolean; url?: string; reason?: string } {
  /**
   * Produto excluído do catálogo não impede a proposta de ser paga.
   *
   * O item guarda a cópia do preço e do nome, então a proposta continua válida;
   * o que se perde é a **forma de pagamento**, que mora no produto. Filtrar os
   * ausentes e seguir com o que sobrou seria pior que recusar: montaria um link
   * que cobra menos do que a proposta que o cliente aceitou.
   */
  const products = proposal.items
    .map((item) => store.products.find((product) => product.id === item.productId))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  if (products.length !== proposal.items.length) {
    return {
      ok: false,
      reason:
        "Um dos produtos desta proposta não está mais no catálogo, e sem ele não dá para saber como cobrar. Envie o link manualmente.",
    };
  }

  const modes = new Set(products.map((product) => product.checkout.mode));

  if (modes.has("integrado")) {
    return {
      ok: false,
      reason:
        modes.size > 1
          ? "A proposta mistura itens de link próprio com itens de cobrança integrada. Separe em duas propostas enquanto o provedor financeiro não estiver conectado."
          : "Este item cobra pela ferramenta financeira integrada, que ainda não está conectada. Envie o link manualmente ou troque o produto para link próprio.",
    };
  }

  const baseUrl = products[0]?.checkout.baseUrl ?? "";

  /**
   * Um link para a proposta inteira, tirado do primeiro item.
   *
   * Vale enquanto a proposta de link próprio for de um item só, que é o caso do
   * catálogo atual. Com dois itens de páginas diferentes, um endereço não cobre
   * os dois — e a recusa abaixo é preferível a mandar o cliente pagar metade sem
   * avisar.
   */
  const distinctBases = new Set(
    products.map((product) => product.checkout.baseUrl ?? "").filter(Boolean),
  );

  if (distinctBases.size > 1) {
    return {
      ok: false,
      reason:
        "Os itens têm páginas de pagamento diferentes, e um link só não cobre os dois. Separe em duas propostas.",
    };
  }

  return buildCheckoutUrl({
    baseUrl,
    sellerName: proposal.sellerName,
    sellerId: proposal.sellerId,
    proposalId: proposal.id,
  });
}
