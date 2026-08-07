/**
 * Montagem de evento para a Conversions API da Meta.
 *
 * Porte de `integracao_meta/conversions_api.py` e `offline_conversions.py`, que
 * são a especificação. **Só a montagem** — o envio é do consumidor de outbox,
 * porque é lá que existe credencial, retentativa e fila de erro. Separar as duas
 * coisas é o que torna esta parte testável sem rede.
 *
 * ## Por que este arquivo existe agora
 *
 * O barramento já publica `deal.won` e o roteia para `webhook_externo` — e nada
 * consumia. A CAPI é exatamente esse consumidor: negócio ganho vira `Purchase`
 * de volta para a Meta, e é isso que ensina o algoritmo de anúncio a procurar
 * mais gente como quem fechou. Sem esse retorno, a Meta otimiza para clique e a
 * conta gasta otimizando a métrica errada.
 */

import { buildUserData, matchSignalCount, type MetaMatchInput, type MetaUserData } from "./hashing";

/**
 * De onde a conversão veio.
 *
 * A lista é a da Meta, e o valor não é cosmético: é ele que separa venda de site
 * de venda fechada por telefone ou no balcão, e a atribuição muda conforme.
 * Mandar tudo como `website` — a tentação, porque é o padrão — atribuiria a
 * anúncios de tráfego uma venda que o comercial fechou por WhatsApp.
 */
export type MetaActionSource =
  | "email"
  | "website"
  | "app"
  | "phone_call"
  | "chat"
  | "physical_store"
  | "system_generated"
  | "business_messaging"
  | "other";

/** As que fazem sentido para venda registrada no CRM, não no site. */
export const OFFLINE_ACTION_SOURCES: MetaActionSource[] = [
  "phone_call",
  "chat",
  "email",
  "physical_store",
  "business_messaging",
  "other",
];

export interface MetaEvent {
  event_name: string;
  event_time: number;
  action_source: MetaActionSource;
  user_data: MetaUserData;
  event_id?: string;
  event_source_url?: string;
  custom_data?: Record<string, unknown>;
  opt_out?: boolean;
}

export interface BuildEventInput {
  eventName: string;
  match: MetaMatchInput;
  /** Instante **do fato**, não do envio. Ver a nota sobre a janela retroativa. */
  occurredAt: string | number;
  /**
   * Chave de deduplicação com o Pixel do navegador.
   *
   * A Meta une os dois lados por este valor. Usar o identificador do negócio no
   * CRM — estável e único — é o que impede a mesma venda ser contada duas vezes
   * quando o site também disparou o Pixel.
   */
  eventId?: string;
  actionSource?: MetaActionSource;
  sourceUrl?: string;
  customData?: Record<string, unknown>;
  /** Contato que pediu para não ser usado em publicidade. */
  optOut?: boolean;
}

/**
 * Janela retroativa aceita pela Meta em evento offline.
 *
 * Importa porque o caso comum do CRM é enviar em lote, dias depois. Passar do
 * limite não gera erro visível no lote inteiro: o evento é simplesmente
 * descartado, e a campanha fica sem a conversão que a justificava.
 */
export const MAX_BACKDATE_DAYS = 62;

export function isWithinBackdateWindow(occurredAt: string | number, nowMs: number): boolean {
  const at = typeof occurredAt === "number" ? occurredAt * 1000 : Date.parse(String(occurredAt));
  if (Number.isNaN(at)) return false;
  if (at > nowMs + 60_000) return false; // futuro não é conversão, é erro de relógio
  return nowMs - at <= MAX_BACKDATE_DAYS * 24 * 60 * 60 * 1000;
}

export function buildEvent(input: BuildEventInput): MetaEvent {
  const at =
    typeof input.occurredAt === "number"
      ? input.occurredAt
      : Math.floor(Date.parse(String(input.occurredAt)) / 1000);

  const event: MetaEvent = {
    event_name: input.eventName,
    // A Meta espera segundos, não milissegundos. Mandar milissegundos coloca o
    // evento no ano 56.000 e ele é descartado em silêncio.
    event_time: at,
    action_source: input.actionSource ?? "system_generated",
    user_data: buildUserData(input.match),
  };

  if (input.eventId) event.event_id = String(input.eventId);
  if (input.sourceUrl) event.event_source_url = input.sourceUrl;
  if (input.customData) event.custom_data = input.customData;
  if (input.optOut) event.opt_out = true;

  return event;
}

/* Decisão de envio ------------------------------------------------------------ */

export type SendRefusal =
  | { ok: true }
  | {
      ok: false;
      reason: string;
      code: "sem_identificador" | "fora_da_janela" | "sem_consentimento";
    };

/**
 * Vale enviar este evento?
 *
 * Três recusas, e cada uma evita um dano diferente:
 *
 * 1. **Sem identificador** — a Meta aceita, processa e nunca atribui. É custo
 *    sem retorno, e infla o denominador da qualidade de correspondência, que é
 *    a métrica pela qual a integração é julgada.
 * 2. **Fora da janela** — descartado em silêncio do outro lado. Melhor recusar
 *    aqui, onde dá para registrar o motivo.
 * 3. **Sem consentimento** — é a única que não é sobre eficácia. Enviar dado
 *    pessoal, ainda que hasheado, de quem não consentiu ou pediu descadastro é
 *    tratamento sem base legal (LGPD, seção 18). O hash não descaracteriza:
 *    ele existe justamente para permitir a correspondência.
 */
export function canSend(
  event: MetaEvent,
  options: { nowMs: number; hasMarketingConsent: boolean; suppressed: boolean },
): SendRefusal {
  if (!options.hasMarketingConsent || options.suppressed) {
    return {
      ok: false,
      code: "sem_consentimento",
      reason:
        "O contato não tem consentimento de marketing vigente ou está na lista de supressão. O hash não torna o envio anônimo.",
    };
  }

  if (matchSignalCount(event.user_data) === 0) {
    return {
      ok: false,
      code: "sem_identificador",
      reason: "Nenhum sinal de correspondência: a Meta aceitaria e nunca atribuiria.",
    };
  }

  if (!isWithinBackdateWindow(event.event_time, options.nowMs)) {
    return {
      ok: false,
      code: "fora_da_janela",
      reason: `A conversão está fora da janela de ${MAX_BACKDATE_DAYS} dias e seria descartada sem aviso.`,
    };
  }

  return { ok: true };
}

/** Corpo do `POST /{dataset}/events`. Máximo de mil eventos por requisição. */
export const MAX_EVENTS_PER_REQUEST = 1_000;

export function buildEventsPayload(
  events: MetaEvent[],
  testEventCode?: string,
): { data: MetaEvent[]; test_event_code?: string } {
  if (events.length > MAX_EVENTS_PER_REQUEST) {
    throw new Error(
      `A CAPI aceita no máximo ${MAX_EVENTS_PER_REQUEST} eventos por requisição; recebi ${events.length}.`,
    );
  }

  return testEventCode ? { data: events, test_event_code: testEventCode } : { data: events };
}
