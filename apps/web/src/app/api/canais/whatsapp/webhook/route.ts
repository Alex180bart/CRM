/**
 * Webhook do WhatsApp — o endereço que a Meta chama.
 *
 * Seção 11 do plano. Duas responsabilidades, uma por verbo:
 *
 * `GET` é o aperto de mão de verificação. A Meta chama uma vez, ao salvar a
 * configuração no painel, com `hub.mode=subscribe`, o token que você cadastrou e
 * um desafio. Responder o desafio **em texto puro**, com 200, é o que assina a
 * inscrição. Qualquer outra coisa — JSON, aspas em volta, 204 — falha com a
 * mensagem genérica que não explica nada.
 *
 * `POST` é o recebimento. Confere a assinatura, traduz para a forma canônica e
 * registra que chegou.
 *
 * ## Por que responde 200 mesmo sem processar
 *
 * A Meta reentrega o que não recebe 200, com espaçamento crescente, por horas. E
 * webhook que falha repetidamente **derruba a qualidade do número** — o ativo
 * que a seção 11 manda proteger. Então: erro nosso não vira erro HTTP. O único
 * caso que responde 4xx é assinatura inválida, porque aí não é a Meta chamando,
 * e reentregar não é o comportamento que se quer estimular.
 *
 * ## O que ainda não acontece
 *
 * A mensagem não vira conversa, não aparece no Inbox e não é respondida. Isso
 * exige persistência, fila, idempotência e worker — a fundação de back-end. Este
 * arquivo é a fronteira pronta: quando a fundação entrar, o que muda é o corpo
 * do laço no fim, não o contrato.
 */

import {
  idempotencyKey,
  newCorrelationId,
  parseWhatsappWebhook,
  publishEvent,
  repositories,
} from "@crm/core";
import type { NextRequest } from "next/server";

import { resolveSecret, secretRefFor } from "@/lib/canais/vault";
import {
  readPhoneNumberId,
  recordEvent,
  summarizeEvents,
  verifySignature,
  verifyToken,
} from "@/lib/canais/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Encontra o segredo da conta cujo `phoneNumberId` bate com o do corpo.
 *
 * Devolve `undefined` quando não há conta cadastrada com aquele identificador —
 * e aí a validação cai no `.env`, que é o caminho de instalação com um número
 * só. Recusar de imediato quebraria quem já configurou pelo ambiente.
 */
async function resolveAccountSecret(phoneNumberId: string): Promise<string | undefined> {
  const accounts = await repositories.directory.listChannelAccounts();

  const account = accounts.find((item) => item.connection?.fields.phoneNumberId === phoneNumberId);

  return account ? resolveSecret(secretRefFor(account.id), "appSecret") : undefined;
}

export function GET(request: NextRequest): Response {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode !== "subscribe" || !challenge) {
    recordEvent("recusado", `Verificação com parâmetros inesperados (mode=${mode ?? "ausente"}).`);
    return new Response("parâmetros de verificação ausentes", { status: 400 });
  }

  if (!verifyToken(token)) {
    /**
     * Não diz **qual** parte está errada.
     *
     * "token inválido" e "token não configurado" são informações diferentes para
     * quem administra e a mesma informação para quem sonda. O detalhe fica no
     * registro interno, que a tela de conexão lê autenticada.
     */
    recordEvent("recusado", "Verificação recusada: token não confere com WHATSAPP_VERIFY_TOKEN.");
    return new Response("verificação recusada", { status: 403 });
  }

  recordEvent("verificacao", "Meta verificou o webhook com sucesso.");

  // Texto puro, exatamente o desafio recebido. Sem JSON, sem aspas, sem quebra.
  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  /**
   * O corpo cru vem antes de qualquer coisa.
   *
   * A assinatura é sobre os bytes que chegaram. Parsear e reserializar muda
   * espaço e ordem de chave, e o resumo deixa de bater — é o erro clássico
   * desta integração, e ele se manifesta como "assinatura sempre inválida" sem
   * pista da causa.
   */
  const raw = await request.text();

  /**
   * Qual conta recebeu — e portanto com qual segredo conferir.
   *
   * A Meta entrega todos os números no **mesmo** endereço: o webhook é do app,
   * não do número. Sem esta resolução, duas contas só funcionariam dividindo o
   * mesmo segredo.
   *
   * O identificador é lido de um corpo ainda não confiável, e isso é seguro
   * porque ele só **escolhe o verificador**: um corpo forjado apontando para
   * outra conta passa a ser conferido contra o segredo daquela conta, que quem
   * forjou não tem. Escolher o verificador não enfraquece a verificação.
   */
  const phoneNumberId = readPhoneNumberId(raw);
  const accountSecret = phoneNumberId ? await resolveAccountSecret(phoneNumberId) : undefined;

  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"), accountSecret)) {
    recordEvent(
      "recusado",
      phoneNumberId
        ? `Assinatura inválida para o número ${phoneNumberId}.`
        : "Corpo recebido com assinatura inválida ou ausente.",
    );
    return new Response("assinatura inválida", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Assinatura válida e JSON quebrado é problema da Meta, não nosso. Registra
    // e devolve 200: reentregar o mesmo corpo quebrado não resolveria nada.
    recordEvent("recusado", "Corpo assinado corretamente, mas não é JSON válido.");
    return new Response("ok", { status: 200 });
  }

  const events = parseWhatsappWebhook(payload);

  if (events.messages.length > 0) {
    recordEvent("mensagem", summarizeEvents(events));
  } else if (events.statuses.length > 0) {
    recordEvent("status", summarizeEvents(events));
  } else {
    recordEvent("recusado", summarizeEvents(events));
  }

  /**
   * Publicação no barramento — o trabalho do webhook termina aqui.
   *
   * Ele não resolve contato, não abre conversa, não acorda o agente. Faz duas
   * coisas: valida e publica. Tudo o mais acontece depois, em outra transação,
   * com retentativa própria — e é o que permite responder 200 rápido, que é a
   * única obrigação real deste endereço.
   *
   * **A chave de idempotência é o `waMessageId`** (seção 8: "todo webhook e job
   * deve possuir uma chave de deduplicação"). A Meta reentrega o que não recebe
   * 200 em tempo, e sem esta chave a mesma mensagem viraria dois eventos, duas
   * automações e dois contatos.
   *
   * O correlacionador nasce por **corpo recebido**, não por mensagem: as
   * mensagens que chegaram juntas vieram do mesmo pacote, e é assim que se
   * reconstrói depois o que aconteceu de uma vez só.
   */
  const correlationId = newCorrelationId();
  let published = 0;
  let deduplicated = 0;

  for (const message of events.messages) {
    const result = publishEvent({
      name: "message.received",
      source: "webhook:whatsapp",
      idempotencyKey: idempotencyKey("whatsapp", message.waMessageId),
      subjectType: "mensagem",
      subjectId: message.waMessageId,
      correlationId,
      payload: {
        from: message.from,
        phoneNumberId: message.phoneNumberId,
        profileName: message.profileName,
        kind: message.kind,
        text: message.text,
        mediaId: message.mediaId,
        occurredAt: message.occurredAt,
      },
    });

    if (result.deduplicated) deduplicated += 1;
    else published += 1;
  }

  for (const status of events.statuses) {
    /**
     * O status também deduplica, e pela mesma razão — mas a chave precisa do
     * **estado** junto do identificador: a mesma mensagem passa por enviada,
     * entregue e lida, e uma chave só pelo `waMessageId` faria os dois últimos
     * serem descartados como repetição do primeiro.
     */
    const result = publishEvent({
      name: "message.status_changed",
      source: "webhook:whatsapp",
      idempotencyKey: idempotencyKey("whatsapp-status", `${status.waMessageId}:${status.status}`),
      subjectType: "mensagem",
      subjectId: status.waMessageId,
      correlationId,
      payload: {
        status: status.status,
        recipient: status.recipient,
        errorCode: status.errorCode,
        errorTitle: status.errorTitle,
      },
    });

    if (result.deduplicated) deduplicated += 1;
    else published += 1;
  }

  if (deduplicated > 0) {
    recordEvent(
      "status",
      `${deduplicated} item(ns) já haviam sido recebidos e foram descartados pela chave de deduplicação.`,
    );
  }

  /**
   * O que ainda falta, e agora tem lugar certo para entrar: os **consumidores**.
   * Resolver o contato pelo telefone, abrir ou retomar a conversa, acordar o
   * agente — cada um lendo do outbox, com falha independente. E a persistência
   * durável, que é o que transforma este barramento em memória num barramento
   * de verdade.
   */
  void published;

  return new Response("ok", { status: 200 });
}
