/**
 * Barramento de eventos: leitura e drenagem.
 *
 * `GET` mostra o que aconteceu e o estado da fila. `POST` roda o drenador — é o
 * papel que, com back-end, pertence a um **worker** acordado por agendador, não
 * a uma requisição HTTP.
 *
 * Expor a drenagem como rota é deliberado e temporário: sem worker, sem
 * agendador e sem processo de longa duração, é o único jeito de a fila andar — e
 * é o único jeito de **ver** que ela anda, que é o que prova o desenho.
 *
 * Quando a fundação entrar, esta rota some e o corpo do laço vira o worker. O
 * que fica é o contrato: publicar não entrega, entregar é outra transação, e
 * cada destino falha sozinho.
 */

import type { DomainEvent, OutboxDestination } from "@elora/core";
import { drainOutbox, listEvents, listOutbox, replayEntry } from "@elora/core";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { events: listEvents(60), outbox: listOutbox(120) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Consumidores de demonstração.
 *
 * Cada um representa o trabalho real que ainda não existe, e a lista é o mapa do
 * que falta construir: `inbox` abriria a conversa e notificaria a tela;
 * `automacoes` avaliaria as regras do `RULE_TRIGGER_EVENT`; `analytics`
 * incrementaria a série; `webhook_externo` faria uma requisição de saída.
 *
 * **`webhook_externo` falha de propósito.** É o único que depende de rede
 * alheia, e é o que exercita o caminho que importa: recuo, retentativa e fila de
 * erro. Um drenador em que tudo dá certo não prova nada — o valor deste desenho
 * aparece exatamente quando algo quebra.
 */
const HANDLERS: Record<OutboxDestination, (event: DomainEvent) => Promise<void>> = {
  async inbox() {
    // Abriria ou retomaria a conversa e avisaria a tela do atendente.
  },
  async automacoes() {
    // Avaliaria as regras que escutam este evento (`RULE_TRIGGER_EVENT`).
  },
  async analytics() {
    // Incrementaria a série do painel.
  },
  async webhook_externo(event) {
    throw new Error(
      `Sem endpoint externo cadastrado para entregar "${event.name}". Cadastre um em Integrações.`,
    );
  },
};

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Corpo vazio é o caso normal: drenar não precisa de argumento.
  }

  const record = (body ?? {}) as Record<string, unknown>;

  /* Reprocessamento de uma entrada morta (seção 11: DLQ com replay) ---------- */

  if (typeof record.replay === "string") {
    const done = replayEntry(record.replay);
    return Response.json(
      {
        ok: done,
        reason: done ? undefined : "Entrada não encontrada ou não está na fila de erro.",
      },
      { status: done ? 200 : 409 },
    );
  }

  /**
   * O relógio da drenagem é o **real**, não o ancorado.
   *
   * É a mesma distinção das sessões do webchat: `nextAttemptAt` mede tempo
   * decorrido, e comparar com o instante ancorado — que fica no passado — faria
   * toda entrada parecer vencida e o recuo nunca valer.
   */
  const report = await drainOutbox(
    (event, destination) => HANDLERS[destination](event),
    Date.now(),
  );

  return Response.json(report);
}
