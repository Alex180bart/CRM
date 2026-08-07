/**
 * Idempotência e política de retentativa.
 *
 * Funções puras, testáveis sem banco e sem rede — o que importa porque são elas
 * que decidem se a reentrega da Meta vira uma mensagem ou duas.
 */

import { EVENT_SUBSCRIPTIONS, type DomainEventName, type OutboxDestination } from "../types/events";

/* Chave de deduplicação ------------------------------------------------------ */

/**
 * Monta a chave a partir da origem e do identificador **do provedor**.
 *
 * A escolha do identificador é o que decide se isto funciona. Precisa ser algo
 * que o provedor repete quando reentrega e não repete entre mensagens
 * diferentes: `wamid` no WhatsApp, `Message-ID` no e-mail, identificador da
 * sessão mais o carimbo no webchat.
 *
 * **Não use conteúdo.** Um resumo do corpo parece atraente e quebra no caso
 * real: duas pessoas mandando "ok" no mesmo minuto produziriam a mesma chave, e
 * a segunda mensagem sumiria. Perder mensagem de cliente é pior que duplicar.
 *
 * O prefixo por origem evita colisão entre provedores que gerem identificadores
 * no mesmo formato — e mantém a chave legível quando alguém precisa depurar.
 */
export function idempotencyKey(source: string, externalId: string): string {
  return `${source}:${externalId}`;
}

/**
 * Chave para o que não tem identificador externo.
 *
 * Ação de gente já é única por natureza — o clique aconteceu uma vez —, mas o
 * envio pode ser reenviado pela rede quando a resposta se perde. A chave vem de
 * quem, o quê e sobre o que, o que torna a repetição acidental inofensiva sem
 * impedir a repetição intencional de outro registro.
 */
export function actionKey(actorId: string, action: string, subjectId: string): string {
  return `acao:${actorId}:${action}:${subjectId}`;
}

/* Retentativa ---------------------------------------------------------------- */

/**
 * Quantas vezes tentar antes de mandar para a fila de erro.
 *
 * Seis tentativas com o recuo abaixo cobrem cerca de meia hora. É o bastante
 * para atravessar instabilidade momentânea e reinício de serviço, e curto o
 * bastante para o problema aparecer no mesmo turno de quem opera — uma entrada
 * que tenta por dois dias é uma falha que ninguém vê.
 */
export const MAX_ATTEMPTS = 6;

/**
 * Recuo exponencial: 5 s, 15 s, 45 s, 2 min, 7 min, 20 min.
 *
 * O crescimento por três, e não por dois, é deliberado: dobrar demora a sair da
 * casa dos segundos, e o destino que caiu costuma levar minutos para voltar.
 *
 * **Sem tremor de propósito.** O tremor existe para evitar que mil clientes
 * tentem no mesmo instante, e aqui a fila é de uma organização — o rebanho não
 * se forma. Acrescentá-lo tornaria o teste não determinístico em troca de nada.
 */
export function backoffMs(attempt: number): number {
  const base = 5_000;
  return Math.min(base * 3 ** Math.max(0, attempt - 1), 20 * 60_000);
}

/** Instante da próxima tentativa, em milissegundos de época. */
export function nextAttemptMs(attempt: number, nowMs: number): number {
  return nowMs + backoffMs(attempt);
}

/**
 * A entrada morreu?
 *
 * Separado de `backoffMs` porque a decisão é de outra natureza: uma é "quando
 * tentar", a outra é "desistir e chamar gente". Juntá-las esconderia o momento
 * em que o sistema para de tentar sozinho, que é justamente o que precisa gerar
 * alerta.
 */
export function isExhausted(attempts: number): boolean {
  return attempts >= MAX_ATTEMPTS;
}

/* Assinaturas ---------------------------------------------------------------- */

/** Para onde este evento precisa ir. Lista vazia significa que ninguém escuta. */
export function destinationsFor(name: DomainEventName): OutboxDestination[] {
  return EVENT_SUBSCRIPTIONS[name] ?? [];
}

/**
 * Correlacionador novo.
 *
 * Só nasce quando não veio de fora. O ponto do campo é atravessar a cadeia
 * inteira — mensagem recebida, conversa aberta, automação disparada, e-mail
 * enviado —, e gerar um novo a cada salto transformaria a cadeia em quatro
 * eventos soltos.
 */
export function newCorrelationId(): string {
  return `cor_${crypto.randomUUID().slice(0, 12)}`;
}
