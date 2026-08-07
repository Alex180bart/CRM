/**
 * Estado e guardas do canal WhatsApp.
 *
 * Reúne o que a rota do webhook e a tela de conexão precisam compartilhar: a
 * leitura das credenciais do servidor, a validação de assinatura e o registro
 * dos últimos eventos.
 *
 * ## O que este módulo não faz
 *
 * Não persiste mensagem. Não cria conversa. Não responde ao cliente. Nada disso
 * existe sem a fundação de back-end — fila, armazenamento, idempotência,
 * workers. O que existe aqui é a **fronteira**: receber, provar que é a Meta,
 * traduzir para a forma canônica e registrar que chegou.
 *
 * É deliberado, e o comentário fica para que ninguém "termine" isto gravando num
 * `Map` e chamando de canal. Um canal que perde mensagem no reinício não é um
 * canal — é a diferença entre o webchat, que é demonstração honesta rodando na
 * nossa máquina, e o WhatsApp, que é o número da empresa na mão do cliente.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { WhatsappWebhookEvents, WhatsappWebhookLog } from "@crm/core";
import { offsetIso } from "@crm/core";

/* Credenciais ---------------------------------------------------------------- */

function readEnv(name: string): string | undefined {
  // A aspa sobra com frequência em `.env` copiado à mão — mesmo tratamento do
  // AI Gateway, pelo mesmo motivo.
  return process.env[name]?.trim().replace(/^["']|["']$/g, "") || undefined;
}

export const whatsappEnv = {
  verifyToken: () => readEnv("WHATSAPP_VERIFY_TOKEN"),
  appSecret: () => readEnv("WHATSAPP_APP_SECRET"),
  accessToken: () => readEnv("WHATSAPP_ACCESS_TOKEN"),
  phoneNumberId: () => readEnv("WHATSAPP_PHONE_NUMBER_ID"),
};

/* Assinatura ----------------------------------------------------------------- */

/**
 * Confere `X-Hub-Signature-256`.
 *
 * A assinatura é HMAC-SHA256 do **corpo cru**, com o segredo do app. Três
 * detalhes decidem se isto funciona ou se é teatro:
 *
 * 1. **Corpo cru, byte a byte.** Reserializar o JSON parseado muda espaço e
 *    ordem de chave, e o resumo nunca bate. Por isso a rota lê `text()` antes de
 *    qualquer `JSON.parse`.
 * 2. **Comparação em tempo constante.** `===` sobre string vaza, pelo tempo de
 *    resposta, quantos bytes iniciais estavam certos — e uma assinatura pode ser
 *    descoberta byte a byte com requisições suficientes.
 * 3. **Sem segredo, recusa.** A tentação é liberar quando `WHATSAPP_APP_SECRET`
 *    está vazio, "só em desenvolvimento". Isso transforma esquecer a variável em
 *    produção num endpoint público que aceita qualquer corpo — e ninguém
 *    perceberia, porque tudo continuaria funcionando.
 */
export function verifySignature(
  rawBody: string,
  header: string | null,
  /**
   * Segredo da conta que recebeu, quando já se sabe qual é.
   *
   * Ausente, cai no `.env` — que é o caminho de uma conta só e continua valendo
   * para quem já configurou assim. Com várias contas, o segredo é por conta e a
   * resolução acontece antes desta chamada.
   */
  accountSecret?: string,
): boolean {
  const secret = accountSecret ?? whatsappEnv.appSecret();
  if (!secret || !header) return false;

  const [algorithm, received] = header.split("=");
  if (algorithm !== "sha256" || !received) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");

  // `timingSafeEqual` lança quando os tamanhos diferem — e o tamanho diferente
  // já é resposta suficiente.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Confere o token de verificação do webhook.
 *
 * Mesma disciplina da assinatura: comparação em tempo constante. É um segredo
 * curto, escolhido por gente, e portanto ainda mais vulnerável a descoberta
 * incremental que um resumo criptográfico.
 */
export function verifyToken(received: string | null): boolean {
  const expected = whatsappEnv.verifyToken();
  if (!expected || !received) return false;

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/* Registro dos últimos eventos ------------------------------------------------ */

/**
 * Anel de eventos recentes, em memória.
 *
 * Existe para uma pergunta só, e é a pergunta que trava toda conexão de
 * webhook: **"a Meta está chegando aqui?"**. Sem isso, quem configura fica
 * olhando o painel da Meta dizer "assinado" enquanto nada acontece, sem saber se
 * o problema é rede, token ou endereço.
 *
 * Preso ao `globalThis` para sobreviver ao recarregamento do `next dev`, como as
 * sessões do webchat. Morre no reinício, e isso é aceitável: é diagnóstico, não
 * registro — o registro de verdade é a auditoria da seção 20, no back-end.
 */
const LOG_SIZE = 25;

const globalStore = globalThis as unknown as { __whatsappLog?: WhatsappWebhookLog[] };
const log = (globalStore.__whatsappLog ??= []);

export function recordEvent(kind: WhatsappWebhookLog["kind"], detail: string): void {
  log.unshift({ at: offsetIso({}), kind, detail: detail.slice(0, 240) });
  if (log.length > LOG_SIZE) log.length = LOG_SIZE;
}

export function recentEvents(): WhatsappWebhookLog[] {
  return [...log];
}

/**
 * Resume o que chegou, para a linha do diagnóstico.
 *
 * O texto é para leitura humana durante a configuração: quem está ligando o
 * número quer ver "1 mensagem de 5511…" e reconhecer o próprio celular.
 */
export function summarizeEvents(events: WhatsappWebhookEvents): string {
  const parts: string[] = [];

  if (events.messages.length > 0) {
    const first = events.messages[0]!;
    parts.push(
      `${events.messages.length} mensagem(ns) — primeira de ${first.from}, tipo ${first.kind}${
        first.text ? `: "${first.text.slice(0, 60)}"` : ""
      }`,
    );
  }

  if (events.statuses.length > 0) {
    const first = events.statuses[0]!;
    parts.push(
      `${events.statuses.length} status — primeiro ${first.status} para ${first.recipient}`,
    );
  }

  if (events.ignored > 0) {
    parts.push(`${events.ignored} item(ns) não reconhecido(s)`);
  }

  return parts.join(" · ") || "corpo sem mensagens nem status";
}

/**
 * Endereço público do webhook, montado a partir do cabeçalho.
 *
 * Vem do cabeçalho e não de constante pelo mesmo motivo do trecho de
 * incorporação do webchat: fixar o domínio faria a tela mostrar, em
 * desenvolvimento, o endereço de produção — e alguém colaria isso no painel da
 * Meta.
 */
export function webhookUrlFrom(host: string): { url: string; publiclyReachable: boolean } {
  const local = host.startsWith("localhost") || host.startsWith("127.") || host.endsWith(".local");
  const protocol = local ? "http" : "https";

  return {
    url: `${protocol}://${host}/api/canais/whatsapp/webhook`,
    // A Meta chama de fora. `localhost` é inalcançável para ela, e este é o
    // motivo número um de a verificação falhar em desenvolvimento.
    publiclyReachable: !local,
  };
}

/* Resolução multiconta -------------------------------------------------------- */

/**
 * Descobre qual conta recebeu, pelo `phone_number_id` do corpo.
 *
 * É o que torna várias contas possíveis. A Meta entrega tudo no **mesmo**
 * endereço — o webhook é do app, não do número —, e o que distingue os números é
 * o identificador dentro de `entry[].changes[].value.metadata`. Sem esta
 * resolução, dois números só funcionariam se dividissem o mesmo segredo, e a
 * conversa cairia sempre na fila do primeiro.
 *
 * A leitura acontece **antes** de validar a assinatura, e isso merece explicação:
 * o identificador é lido de um corpo ainda não confiável, e usado apenas para
 * escolher com qual segredo conferir. Um corpo forjado com `phone_number_id` de
 * outra conta só consegue ser validado contra o segredo daquela conta — que
 * quem forjou não tem. A escolha do verificador não enfraquece a verificação.
 */
export function readPhoneNumberId(rawBody: string): string | null {
  try {
    const payload = JSON.parse(rawBody) as {
      entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string } } }> }>;
    };

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const id = change.value?.metadata?.phone_number_id;
        if (typeof id === "string" && id) return id;
      }
    }
  } catch {
    // Corpo ilegível: cai no segredo do `.env` e a assinatura decide.
  }

  return null;
}
