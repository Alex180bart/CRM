/**
 * Barramento de eventos de domínio.
 *
 * Referência: seção 8 do plano. "Cada mudança importante deve gerar um evento de
 * domínio (…) Eventos possibilitam automações desacopladas, auditoria,
 * reprocessamento e integração com dados." E, no quadro destacado:
 * **"Idempotência obrigatória — todo webhook e job deve possuir uma chave de
 * deduplicação. A mesma mensagem recebida duas vezes não pode criar dois
 * contatos, disparar duas automações ou registrar duas vendas."**
 *
 * ## Por que evento e não chamada direta
 *
 * Hoje o webhook do WhatsApp precisaria, sozinho: resolver o contato, abrir a
 * conversa, avisar o Inbox, acordar o agente de IA, contar para o analytics e
 * disparar as automações. Seis dependências num arquivo que a Meta chama, e cujo
 * único trabalho de verdade é **responder 200 rápido**. Cada uma dessas seis
 * coisas que ficar lenta ou quebrar derruba o recebimento — e webhook que falha
 * repetido rebaixa a qualidade do número.
 *
 * Com o barramento, o webhook faz duas coisas: valida e publica. O resto acontece
 * depois, em outra transação, com retentativa própria.
 *
 * ## Evento e outbox são coisas diferentes
 *
 * O **evento** é o fato: aconteceu, é imutável, e existe uma vez. A **entrada de
 * outbox** é a intenção de entregar aquele fato a um destino específico, e existe
 * uma por destino — cada uma com o próprio contador de tentativas.
 *
 * Confundir os dois é o erro clássico: um contador de tentativas no evento faria
 * a falha na entrega ao analytics reprocessar também o Inbox, que já tinha dado
 * certo. Separados, cada destino falha e se recupera sozinho.
 */

import type { Id, IsoDateTime } from "./common";

/* Nomes ---------------------------------------------------------------------- */

/**
 * Catálogo de eventos.
 *
 * Fechado de propósito, e no formato `recurso.acontecimento` que o plano usa nos
 * exemplos. Um `string` livre aqui produziria `messageReceived`,
 * `message_received` e `MessageReceived` no mesmo sistema em três meses — e a
 * automação que escuta um dos três nunca dispararia para os outros.
 *
 * Verbo no **passado**: evento é fato consumado. `message.receive` sugeriria um
 * comando, e comando é outra coisa — é pedido, pode ser recusado.
 */
export type DomainEventName =
  // Atendimento
  | "conversation.opened"
  | "conversation.assigned"
  | "conversation.resolved"
  | "message.received"
  | "message.sent"
  | "message.status_changed"
  | "survey.answered"
  // Inteligência artificial
  | "agent.handed_off"
  | "agent.action.pending"
  // CRM
  | "contact.created"
  | "lead.qualified"
  | "deal.won"
  | "deal.lost"
  // Comercio (secao 26.1)
  | "proposal.sent"
  | "proposal.accepted"
  | "proposal.rejected"
  | "proposal.paid"
  // Configuração
  | "channel.connected"
  | "queue.created"
  | "user.invited"
  | "user.removed";

export const DOMAIN_EVENT_LABEL: Record<DomainEventName, string> = {
  "conversation.opened": "Conversa aberta",
  "conversation.assigned": "Conversa atribuída",
  "conversation.resolved": "Conversa resolvida",
  "message.received": "Mensagem recebida",
  "message.sent": "Mensagem enviada",
  "message.status_changed": "Status de mensagem mudou",
  "survey.answered": "Pesquisa respondida",
  "agent.handed_off": "Agente de IA transferiu",
  "agent.action.pending": "Agente pediu confirmação",
  "contact.created": "Contato criado",
  "lead.qualified": "Lead qualificado",
  "deal.won": "Negócio ganho",
  "deal.lost": "Negócio perdido",
  "proposal.sent": "Proposta enviada",
  "proposal.accepted": "Proposta aceita pelo cliente",
  "proposal.rejected": "Proposta recusada pelo cliente",
  "proposal.paid": "Compra aprovada",
  "channel.connected": "Canal conectado",
  "queue.created": "Fila criada",
  "user.invited": "Pessoa convidada",
  "user.removed": "Pessoa removida",
};

/* Evento --------------------------------------------------------------------- */

/**
 * Um fato, registrado.
 *
 * `payload` é `Record<string, unknown>` de propósito, e não um tipo por evento.
 * O evento é **guardado** e reprocessado meses depois, quando o tipo já mudou —
 * amarrá-lo à forma de hoje quebraria o replay, que é uma das razões de existir
 * do event store. Quem consome é que valida o que precisa.
 */
export interface DomainEvent {
  id: Id;
  organizationId: Id;
  name: DomainEventName;
  /** Quem originou: `webhook:whatsapp`, `webchat`, `admin`, `agente`. */
  source: string;
  /**
   * Chave de deduplicação (seção 8).
   *
   * Duas publicações com a mesma chave produzem **um** evento. É o que impede a
   * reentrega da Meta de virar duas mensagens, duas automações e dois contatos.
   * Ausente significa "não deduplicar" — válido para o que nasce de clique
   * humano, que já é único por natureza.
   */
  idempotencyKey?: string;
  /** Entidade a que o fato se refere, quando há uma. */
  subjectType?: string;
  subjectId?: Id;
  payload: Record<string, unknown>;
  /**
   * Liga eventos de uma mesma causa raiz.
   *
   * A mensagem que chega, a conversa que abre e a automação que dispara
   * compartilham o correlacionador. Sem ele, depurar "por que este e-mail foi
   * enviado" vira arqueologia por horário.
   */
  correlationId: string;
  occurredAt: IsoDateTime;
}

/* Outbox --------------------------------------------------------------------- */

/**
 * Para onde um evento precisa ir.
 *
 * Cada destino é um consumidor com falha independente. `inbox` atualiza a tela;
 * `automacoes` avalia as regras; `analytics` conta; `webhook_externo` entrega a
 * quem integrou conosco — e é o único que depende de rede alheia, portanto o que
 * mais falha.
 */
export type OutboxDestination = "inbox" | "automacoes" | "analytics" | "webhook_externo";

export const OUTBOX_DESTINATION_LABEL: Record<OutboxDestination, string> = {
  inbox: "Inbox",
  automacoes: "Automações",
  analytics: "Analytics",
  webhook_externo: "Webhook externo",
};

/**
 * Estado da entrega.
 *
 * `morto` é a DLQ da seção 11 ("erro permanente deve gerar DLQ, alerta e opção
 * de reprocessamento"). Não é um lixo: é uma fila de trabalho para gente, e o
 * evento continua lá inteiro para ser reprocessado depois da correção.
 */
export type OutboxState = "pendente" | "entregue" | "falhando" | "morto";

export const OUTBOX_STATE_LABEL: Record<OutboxState, string> = {
  pendente: "Aguardando entrega",
  entregue: "Entregue",
  falhando: "Falhando, vai tentar de novo",
  morto: "Na fila de erro",
};

export interface OutboxEntry {
  id: Id;
  eventId: Id;
  organizationId: Id;
  destination: OutboxDestination;
  state: OutboxState;
  attempts: number;
  /**
   * Quando a próxima tentativa pode acontecer.
   *
   * É o que faz o recuo exponencial funcionar sem um agendador por entrada: o
   * drenador simplesmente ignora o que ainda não chegou a hora. Sem isso, uma
   * entrada que falha volta na próxima passada e queima as tentativas em
   * segundos, transformando a proteção contra instabilidade momentânea em
   * nada.
   */
  nextAttemptAt: IsoDateTime;
  lastError?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/**
 * Quem escuta o quê.
 *
 * Declarado como dado, e não como `if` dentro do publicador, porque é isso que
 * mantém o produtor ignorante do consumidor — o ponto inteiro de um barramento.
 * Acrescentar um destino não toca o webhook.
 */
export const EVENT_SUBSCRIPTIONS: Record<DomainEventName, OutboxDestination[]> = {
  "conversation.opened": ["inbox", "automacoes", "analytics"],
  "conversation.assigned": ["inbox", "analytics"],
  "conversation.resolved": ["inbox", "automacoes", "analytics"],
  "message.received": ["inbox", "automacoes", "analytics"],
  "message.sent": ["inbox", "analytics"],
  "message.status_changed": ["inbox", "analytics"],
  "survey.answered": ["analytics", "automacoes"],
  "agent.handed_off": ["inbox", "analytics"],
  "agent.action.pending": ["inbox"],
  "contact.created": ["automacoes", "analytics"],
  /**
   * Proposta enviada não vai para `automacoes`: nada deve disparar por ela.
   * O fato comercial que interessa a jornada é o aceite e o pagamento — reagir
   * ao envio produziria régua de cobrança para quem ainda nem leu a proposta.
   */
  "proposal.sent": ["inbox", "analytics"],
  "proposal.accepted": ["inbox", "automacoes", "analytics"],
  "proposal.rejected": ["inbox", "automacoes", "analytics"],
  "proposal.paid": ["inbox", "automacoes", "analytics"],
  "lead.qualified": ["automacoes", "analytics"],
  "deal.won": ["automacoes", "analytics", "webhook_externo"],
  "deal.lost": ["automacoes", "analytics"],
  "channel.connected": ["analytics"],
  "queue.created": ["analytics"],
  "user.invited": ["analytics"],
  "user.removed": ["analytics"],
};

/* Publicação e drenagem ------------------------------------------------------ */

export interface PublishInput {
  name: DomainEventName;
  source: string;
  idempotencyKey?: string;
  subjectType?: string;
  subjectId?: Id;
  payload?: Record<string, unknown>;
  correlationId?: string;
}

export interface PublishResult {
  event: DomainEvent;
  /** Verdadeiro quando a chave de idempotência já existia e nada foi criado. */
  deduplicated: boolean;
  /** Entradas de outbox criadas. Vazio quando deduplicado. */
  queued: OutboxDestination[];
}

export interface DrainReport {
  processed: number;
  delivered: number;
  retried: number;
  dead: number;
  /** Entradas que ainda não chegaram a hora — contadas, não tentadas. */
  skipped: number;
}
