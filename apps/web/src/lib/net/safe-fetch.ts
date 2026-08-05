/**
 * Busca segura de URL informada pelo cliente.
 *
 * Extraído da rota de prévia de mídia quando a prévia de site do webchat passou
 * a precisar da mesma proteção. Duplicar a guarda criaria duas verdades — e a
 * cópia que não recebesse a próxima correção seria justamente a explorável.
 *
 * Um endpoint que busca URL arbitrária a pedido do cliente é um pedido de SSRF:
 * sem guarda, `http://169.254.169.254/latest/meta-data/` transforma o servidor
 * em procurador para a rede interna e para os metadados da nuvem. Nada aqui é
 * opcional nem "para depois".
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Um recurso remoto que não responde em 6 s não vale a espera de quem pediu. */
export const FETCH_TIMEOUT_MS = 6_000;
export const MAX_REDIRECTS = 3;
export const MAX_URL_LENGTH = 2_048;

export type TargetFailureCode = "invalido" | "bloqueado" | "inacessivel" | "nao_suportado";

export class TargetError extends Error {
  constructor(
    readonly code: TargetFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "TargetError";
  }
}

/* Guarda de destino --------------------------------------------------------- */

/**
 * Faixas de IP que nunca devem ser alcançadas a pedido do cliente.
 *
 * Cobre loopback, redes privadas, link-local (que inclui o endereço de
 * metadados de nuvem, 169.254.169.254), CGNAT e as faixas reservadas de
 * documentação e teste.
 */
function isBlockedIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;

  const [a = 0, b = 0] = parts;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // privada
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local e metadados de nuvem
  if (a === 172 && b >= 16 && b <= 31) return true; // privada
  if (a === 192 && b === 168) return true; // privada
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 e 192.0.2.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // teste de desempenho
  if (a === 198 && b === 51) return true; // documentação
  if (a === 203 && b === 0) return true; // documentação
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast e reservado

  return false;
}

/**
 * Expande um IPv6 nos seus 16 bytes.
 *
 * Escrito à mão porque a comparação por prefixo de texto não sobrevive à
 * normalização: `new URL("http://[::ffff:127.0.0.1]/")` devolve o host já
 * comprimido como `::ffff:7f00:1`, e qualquer regex que procure o quarteto
 * pontuado passa reto. Comparar bytes é a única forma que não depende de como o
 * endereço foi escrito.
 */
function ipv6Bytes(address: string): Uint8Array | null {
  let text = address
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");

  const zone = text.indexOf("%");
  if (zone !== -1) text = text.slice(0, zone);

  // Sufixo IPv4 pontuado vira dois grupos hexadecimais antes de expandir.
  const dotted = /:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (dotted) {
    const octets = dotted.slice(1, 5).map(Number);
    if (octets.some((octet) => !Number.isInteger(octet) || octet > 255)) return null;
    const high = (((octets[0] ?? 0) << 8) | (octets[1] ?? 0)).toString(16);
    const low = (((octets[2] ?? 0) << 8) | (octets[3] ?? 0)).toString(16);
    text = `${text.slice(0, dotted.index)}:${high}:${low}`;
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...(Array(missing).fill("0") as string[]), ...tail];
  } else {
    if (head.length !== 8) return null;
    groups = head;
  }

  const bytes = new Uint8Array(16);
  for (let index = 0; index < 8; index += 1) {
    const group = groups[index] ?? "0";
    if (!/^[0-9a-f]{1,4}$/.test(group || "0")) return null;
    const value = Number.parseInt(group || "0", 16);
    bytes[index * 2] = value >> 8;
    bytes[index * 2 + 1] = value & 0xff;
  }
  return bytes;
}

function octet(bytes: Uint8Array, index: number): number {
  return bytes[index] ?? 0;
}

function isBlockedIPv6(address: string): boolean {
  const bytes = ipv6Bytes(address);
  // Endereço que não consigo interpretar não é liberado — na dúvida, bloqueia.
  if (!bytes) return true;

  const prefixIsZero = (upTo: number) =>
    Array.from({ length: upTo }, (_, index) => octet(bytes, index)).every((value) => value === 0);

  // :: (indefinido) e ::1 (loopback)
  if (prefixIsZero(15) && octet(bytes, 15) <= 1) return true;

  const embeddedIPv4 = () =>
    `${octet(bytes, 12)}.${octet(bytes, 13)}.${octet(bytes, 14)}.${octet(bytes, 15)}`;

  // IPv4-mapeado (::ffff:a.b.c.d) e IPv4-compatível (::a.b.c.d): os dois
  // alcançam a pilha v4 e precisam da checagem v4.
  if (prefixIsZero(10)) {
    const marker = (octet(bytes, 10) << 8) | octet(bytes, 11);
    if (marker === 0xffff || marker === 0) return isBlockedIPv4(embeddedIPv4());
  }

  // 6to4 (2002:AABB:CCDD::/48) carrega o IPv4 nos bytes 2 a 5 — é uma rota
  // conhecida para alcançar endereço privado por um endereço v6 público.
  if (octet(bytes, 0) === 0x20 && octet(bytes, 1) === 0x02) {
    return isBlockedIPv4(
      `${octet(bytes, 2)}.${octet(bytes, 3)}.${octet(bytes, 4)}.${octet(bytes, 5)}`,
    );
  }

  if ((octet(bytes, 0) & 0xfe) === 0xfc) return true; // fc00::/7 única local
  if (octet(bytes, 0) === 0xfe && (octet(bytes, 1) & 0xc0) === 0x80) return true; // fe80::/10
  if (octet(bytes, 0) === 0xff) return true; // ff00::/8 multicast

  return false;
}

function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isBlockedIPv4(address);
  if (family === 6) return isBlockedIPv6(address);
  return true;
}

/**
 * Valida um destino antes de qualquer requisição.
 *
 * Resolve o nome e confere **todos** os endereços devolvidos: um nome pode
 * apontar para um endereço público e um privado, e aceitar o primeiro que
 * agrada é a forma clássica de furar esta checagem.
 *
 * Persiste a janela de corrida entre esta resolução e a do `fetch` (o clássico
 * DNS rebinding). Fechá-la de vez exige conectar por IP com o cabeçalho `Host`
 * preservado, o que o `fetch` não oferece. O risco residual é aceitável aqui —
 * a resposta ao cliente é só metadado, nunca o corpo — e o comentário fica para
 * quem for endurecer isto no back-end real.
 */
export async function assertAllowedTarget(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TargetError("bloqueado", "Só endereços http e https são aceitos.");
  }

  // Porta fora do padrão quase sempre significa serviço interno.
  const port = url.port;
  if (port && port !== "80" && port !== "443") {
    throw new TargetError("bloqueado", "Porta não permitida para link externo.");
  }

  // `URL.hostname` devolve IPv6 entre colchetes (`[::1]`), forma que `isIP` não
  // reconhece. Sem remover os colchetes, um literal IPv6 escaparia da checagem
  // de IP e cairia no DNS, onde o resultado passa a depender do resolvedor.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new TargetError("bloqueado", "Endereço interno não é permitido.");
  }

  // Host escrito como IP não precisa de DNS, mas precisa da mesma checagem.
  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new TargetError("bloqueado", "Endereço de rede interna não é permitido.");
    }
    return;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new TargetError("inacessivel", "Não foi possível resolver o endereço do link.");
  }

  if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new TargetError("bloqueado", "O link aponta para a rede interna.");
  }
}

/**
 * Segue redirecionamentos manualmente, revalidando cada salto.
 *
 * Com `redirect: "follow"` o destino final escapa da guarda: basta um endereço
 * público que responde 302 para `http://127.0.0.1:6379`.
 */
export async function inspect(target: URL): Promise<{ response: Response; finalUrl: URL }> {
  let current = target;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertAllowedTarget(current);

    let response: Response;
    try {
      response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        // Corpo não é lido: o `Range` evita puxar um arquivo de 200 MB só para
        // ler o cabeçalho. Servidor que ignora o cabeçalho é cortado pelo abort.
        headers: { Accept: "*/*", Range: "bytes=0-0" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      throw new TargetError("inacessivel", "O link não respondeu.");
    }

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      // O corpo do redirecionamento não interessa e precisa ser descartado para
      // a conexão não ficar pendurada.
      await response.body?.cancel();
      try {
        current = new URL(location, current);
      } catch {
        throw new TargetError("invalido", "O link redireciona para um endereço inválido.");
      }
      continue;
    }

    return { response, finalUrl: current };
  }

  throw new TargetError("invalido", "O link tem redirecionamentos demais.");
}
