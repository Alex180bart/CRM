/**
 * Barramento de eventos em memória.
 *
 * Implementa a mesma interface que a versão Supabase vai implementar. Quando as
 * tabelas `domain_events` e `outbox_events` existirem, o corpo destas funções
 * troca e nada acima muda — o mesmo movimento dos repositórios de leitura.
 *
 * ## O que já está certo aqui, e vale preservar na troca
 *
 * 1. **Publicar é atômico do ponto de vista de quem chama.** Ou o evento entra
 *    com todas as entradas de outbox, ou nada entra. No Postgres isso é uma
 *    transação; aqui é a ordem das operações num processo de thread única.
 * 2. **A deduplicação acontece na publicação, não na entrega.** Barrar depois
 *    significaria ter criado o evento duas vezes e escolhido um — e o segundo
 *    já teria disparado outbox.
 * 3. **A drenagem respeita `nextAttemptAt`.** Sem isso, uma entrada que falha
 *    volta na passada seguinte e queima as seis tentativas em segundos.
 *
 * ## O que muda no Supabase, e é o motivo de a fila existir
 *
 * O `SELECT ... FOR UPDATE SKIP LOCKED` — aqui não há concorrência, lá haverá
 * mais de um worker puxando da mesma fila. É a linha que impede dois workers de
 * entregarem a mesma entrada, e ela não tem equivalente em memória.
 */

import type {
  DomainEvent,
  DrainReport,
  OutboxDestination,
  OutboxEntry,
  PublishInput,
  PublishResult,
} from "../types/events";
import { destinationsFor, isExhausted, nextAttemptMs, newCorrelationId } from "../utils/events";
import { offsetIso } from "../utils/datetime";
import { ORG_ID } from "../mock/organization";

interface EventStore {
  events: DomainEvent[];
  outbox: OutboxEntry[];
  /** Chave de idempotência → identificador do evento que já a usou. */
  seen: Map<string, string>;
}

const globalStore = globalThis as unknown as { __crmEventStore?: EventStore };

const store: EventStore = (globalStore.__crmEventStore ??= {
  events: [],
  outbox: [],
  seen: new Map(),
});

/**
 * O event store cresce para sempre por natureza — é o registro do que
 * aconteceu. Em memória isso é um vazamento, então há um teto; no Postgres o
 * teto vira particionamento por data e arquivamento, não descarte.
 */
const MAX_EVENTS = 500;

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${sequence.toString(36)}${Date.now().toString(36).slice(-4)}`;
}

/* Publicação ------------------------------------------------------------------ */

export function publishEvent(input: PublishInput): PublishResult {
  /**
   * A deduplicação vem antes de qualquer escrita.
   *
   * Devolver o evento original — e não um erro — é deliberado: para quem chama,
   * "já publiquei isto" e "publiquei agora" têm o mesmo desfecho desejado. O
   * webhook da Meta que reentrega precisa responder 200 igual, e tratar
   * duplicata como falha faria a Meta reentregar de novo, para sempre.
   */
  if (input.idempotencyKey) {
    const existingId = store.seen.get(input.idempotencyKey);
    if (existingId) {
      const existing = store.events.find((event) => event.id === existingId);
      if (existing) return { event: existing, deduplicated: true, queued: [] };
    }
  }

  const event: DomainEvent = {
    id: nextId("evt"),
    organizationId: ORG_ID,
    name: input.name,
    source: input.source,
    idempotencyKey: input.idempotencyKey,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    payload: input.payload ?? {},
    correlationId: input.correlationId ?? newCorrelationId(),
    occurredAt: offsetIso({}),
  };

  store.events.unshift(event);
  if (store.events.length > MAX_EVENTS) store.events.length = MAX_EVENTS;

  if (input.idempotencyKey) store.seen.set(input.idempotencyKey, event.id);

  const destinations = destinationsFor(input.name);
  const now = offsetIso({});

  for (const destination of destinations) {
    store.outbox.unshift({
      id: nextId("obx"),
      eventId: event.id,
      organizationId: event.organizationId,
      destination,
      state: "pendente",
      attempts: 0,
      // Disponível já: o recuo só entra depois da primeira falha.
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { event, deduplicated: false, queued: destinations };
}

/* Leitura --------------------------------------------------------------------- */

export function listEvents(limit = 50): DomainEvent[] {
  return store.events.slice(0, limit);
}

export function listOutbox(limit = 100): OutboxEntry[] {
  return store.outbox.slice(0, limit);
}

export function findEvent(id: string): DomainEvent | undefined {
  return store.events.find((event) => event.id === id);
}

/* Drenagem -------------------------------------------------------------------- */

/** O que um consumidor faz com o evento. Lançar significa falha e retentativa. */
export type Handler = (event: DomainEvent, destination: OutboxDestination) => Promise<void>;

/**
 * Entrega o que está pendente e vencido.
 *
 * A ordem é da mais antiga para a mais nova — a fila é FIFO por natureza, e
 * inverter faria a mensagem recente passar na frente da que já estava
 * esperando, que é o oposto do que se quer quando há acúmulo.
 */
export async function drainOutbox(
  handler: Handler,
  nowMs: number,
  batch = 25,
): Promise<DrainReport> {
  const report: DrainReport = { processed: 0, delivered: 0, retried: 0, dead: 0, skipped: 0 };

  const ready = store.outbox
    .filter((entry) => entry.state === "pendente" || entry.state === "falhando")
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  for (const entry of ready) {
    if (report.processed >= batch) break;

    if (Date.parse(entry.nextAttemptAt) > nowMs) {
      report.skipped += 1;
      continue;
    }

    const event = store.events.find((item) => item.id === entry.eventId);

    if (!event) {
      /**
       * Evento sumiu do teto de memória mas a entrada ficou.
       *
       * Não é retentável: tentar de novo procuraria o mesmo evento inexistente
       * seis vezes. Vai direto para a fila de erro, com o motivo — e no
       * Postgres, onde o evento não some, esta situação simplesmente não
       * existe.
       */
      entry.state = "morto";
      entry.lastError = "O evento saiu do armazenamento em memória antes da entrega.";
      entry.updatedAt = offsetIso({});
      report.processed += 1;
      report.dead += 1;
      continue;
    }

    entry.attempts += 1;
    report.processed += 1;

    try {
      await handler(event, entry.destination);
      entry.state = "entregue";
      entry.lastError = undefined;
      report.delivered += 1;
    } catch (error) {
      entry.lastError = error instanceof Error ? error.message : "Falha na entrega.";

      if (isExhausted(entry.attempts)) {
        entry.state = "morto";
        report.dead += 1;
      } else {
        entry.state = "falhando";
        entry.nextAttemptAt = new Date(nextAttemptMs(entry.attempts, nowMs)).toISOString();
        report.retried += 1;
      }
    }

    entry.updatedAt = offsetIso({});
  }

  return report;
}

/**
 * Devolve uma entrada morta para a fila.
 *
 * É a "opção de reprocessamento" que a seção 11 exige junto da DLQ. Zera as
 * tentativas de propósito: quem reprocessa o faz **depois de corrigir a causa**,
 * e manter o contador daria uma tentativa só antes de morrer de novo.
 */
export function replayEntry(id: string): boolean {
  const entry = store.outbox.find((item) => item.id === id);
  if (!entry || entry.state !== "morto") return false;

  entry.state = "pendente";
  entry.attempts = 0;
  entry.nextAttemptAt = offsetIso({});
  entry.lastError = undefined;
  entry.updatedAt = offsetIso({});
  return true;
}

/** Só para teste e demonstração: zera o barramento. */
export function resetEventStore(): void {
  store.events.length = 0;
  store.outbox.length = 0;
  store.seen.clear();
}
