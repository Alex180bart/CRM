/**
 * Normalização e hash de dado pessoal para a Meta.
 *
 * Porte do `integracao_meta/hashing.py`, que é a especificação desta função. As
 * regras são da Meta e não têm folga: minúsculas, telefone em E.164 sem `+`,
 * cidade sem acento e sem espaço, CEP só dígitos, data em `YYYYMMDD`. Um hash
 * fora da regra **não dá erro** — ele simplesmente nunca casa com ninguém, e o
 * sintoma é uma taxa de correspondência baixa que ninguém sabe explicar.
 *
 * Por isso os testes comparam contra hashes gerados pelo próprio Python: é a
 * única forma de provar equivalência em algo cujo erro é silencioso.
 *
 * ## Por que em TypeScript, e não chamando o Python
 *
 * O pacote inteiro é hash mais requisição HTTP. Manter um segundo runtime para
 * isso custa outro deploy, outro cofre de segredos e outra trilha de log — e
 * cria duas implementações da mesma normalização, das quais a que não receber a
 * próxima correção é a que vai gerar público que não casa. É o mesmo argumento
 * que fez `safe-fetch.ts` ser extraído em vez de duplicado.
 *
 * O Python continua valendo como **referência executável**: é dele que saem os
 * vetores de teste.
 */

import { createHash } from "node:crypto";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stripAccents(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/** Vazio devolve `undefined`, e não hash de string vazia — que casaria com tudo. */
function orNothing(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function hashEmail(email?: string | null): string | undefined {
  const value = orNothing(email);
  return value ? sha256(value.toLowerCase()) : undefined;
}

/**
 * Nome preserva acento de propósito.
 *
 * A Meta aceita caractere especial em `fn`/`ln`, e remover o acento aqui —
 * como se faz em cidade — mudaria "conceição" para "conceicao" e perderia a
 * correspondência com quem a Meta guardou acentuado.
 */
export function hashName(name?: string | null): string | undefined {
  const value = orNothing(name);
  return value ? sha256(value.toLowerCase()) : undefined;
}

export function hashCity(city?: string | null): string | undefined {
  const value = orNothing(city);
  if (!value) return undefined;
  const normalized = stripAccents(value.toLowerCase()).replace(/[^a-z]/g, "");
  return normalized ? sha256(normalized) : undefined;
}

export function hashState(state?: string | null): string | undefined {
  return hashCity(state);
}

export function hashZip(zip?: string | null): string | undefined {
  const digits = String(zip ?? "").replace(/\D/g, "");
  return digits ? sha256(digits) : undefined;
}

export function hashCountry(country?: string | null): string | undefined {
  const value = orNothing(country);
  if (!value) return undefined;
  const normalized = stripAccents(value.toLowerCase()).replace(/[^a-z]/g, "");
  return normalized ? sha256(normalized) : undefined;
}

export function hashGender(gender?: string | null): string | undefined {
  const first = orNothing(gender)?.toLowerCase().charAt(0);
  return first === "m" || first === "f" ? sha256(first) : undefined;
}

export function hashBirthDate(date?: string | null): string | undefined {
  const digits = String(date ?? "").replace(/\D/g, "");
  return digits.length === 8 ? sha256(digits) : undefined;
}

/* Telefone -------------------------------------------------------------------- */

/**
 * Normaliza o telefone e devolve o hash — **corrigindo dois defeitos da
 * referência**, ambos confirmados executando o Python.
 *
 * ### 1. O DDD 55 quebrava
 *
 * A heurística original era "se não começa com 55, prefixe 55". Só que **55 é
 * um DDD real** (Santa Maria e região, no Rio Grande do Sul). O número
 * `5599998888` começa com 55, então não recebia o país, e o hash saía de um
 * número sem DDI — que nunca casa. Toda a base daquela região sumia da
 * correspondência em silêncio.
 *
 * ### 2. Número sem DDD virava lixo, e pior: colidia
 *
 * Um celular digitado sem DDD (`999998888`, 9 dígitos) recebia o país e virava
 * `55999998888`. Isso não é o número de ninguém — mas é **exatamente** o que um
 * celular legítimo de DDD 55 produzia no caso anterior. Dois contatos
 * diferentes com o mesmo hash: além de não casar, casa errado.
 *
 * ### A regra aqui
 *
 * Decide pelo **comprimento**, que é o que de fato distingue, e recusa o que
 * não dá para salvar. Recusar é melhor que hash inventado: um campo ausente
 * apenas não contribui para a correspondência; um campo errado a estraga e
 * ainda envia dado pessoal de alguém para o lugar errado.
 */
export function normalizePhone(phone?: string | null, countryCode = "55"): string | undefined {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return undefined;

  // Já em formato internacional: DDI + DDD(2) + 8 ou 9 dígitos.
  if (digits.startsWith(countryCode) && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // Local com DDD: 10 (fixo) ou 11 (celular) dígitos.
  if (digits.length === 10 || digits.length === 11) return countryCode + digits;

  /**
   * Sem DDD não há como completar. O número local do assinante não identifica
   * ninguém sozinho — existe um `99999-8888` em cada uma das dezenas de DDDs — e
   * inventar um produziria correspondência com a pessoa errada.
   */
  return undefined;
}

export function hashPhone(phone?: string | null, countryCode = "55"): string | undefined {
  const normalized = normalizePhone(phone, countryCode);
  return normalized ? sha256(normalized) : undefined;
}

/* Bloco de correspondência ---------------------------------------------------- */

export interface MetaUserData {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  ct?: string[];
  st?: string[];
  zp?: string[];
  country?: string[];
  ge?: string[];
  db?: string[];
  /** Em texto puro por exigência da Meta — não são dado pessoal identificável. */
  external_id?: string;
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string;
  fbp?: string;
}

export interface MetaMatchInput {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  gender?: string | null;
  birthDate?: string | null;
  externalId?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  fbc?: string | null;
  fbp?: string | null;
}

/**
 * Monta `user_data` com o que existe, e só com o que existe.
 *
 * Campo ausente é **omitido**, nunca enviado vazio: a Meta conta campo presente
 * na qualidade da correspondência, e um `ph: [""]` piora a métrica sem
 * adicionar informação.
 */
export function buildUserData(input: MetaMatchInput): MetaUserData {
  const data: MetaUserData = {};

  const put = (key: keyof MetaUserData, value?: string) => {
    if (value) (data[key] as string[]) = [value];
  };

  put("em", hashEmail(input.email));
  put("ph", hashPhone(input.phone));
  put("fn", hashName(input.firstName));
  put("ln", hashName(input.lastName));
  put("ct", hashCity(input.city));
  put("st", hashState(input.state));
  put("zp", hashZip(input.zip));
  put("country", hashCountry(input.country));
  put("ge", hashGender(input.gender));
  put("db", hashBirthDate(input.birthDate));

  if (input.externalId) data.external_id = String(input.externalId);
  if (input.clientIp) data.client_ip_address = input.clientIp;
  if (input.userAgent) data.client_user_agent = input.userAgent;
  if (input.fbc) data.fbc = input.fbc;
  if (input.fbp) data.fbp = input.fbp;

  return data;
}

/**
 * Quantos sinais de correspondência este bloco carrega.
 *
 * Serve para a decisão que a integração precisa tomar antes de enviar: um
 * evento com **nenhum** identificador é peso morto — a Meta aceita, cobra
 * processamento e nunca atribui. Vale barrar na origem.
 */
export function matchSignalCount(data: MetaUserData): number {
  const keys: Array<keyof MetaUserData> = [
    "em",
    "ph",
    "fn",
    "ln",
    "ct",
    "st",
    "zp",
    "country",
    "ge",
    "db",
    "external_id",
    "fbc",
    "fbp",
  ];
  return keys.filter((key) => data[key]).length;
}
