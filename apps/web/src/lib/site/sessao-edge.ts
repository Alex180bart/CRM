/**
 * Verificação da sessão no runtime de borda.
 *
 * O middleware precisa saber se quem pede uma tela do produto é administrador, e
 * lá não existe `node:crypto` nem acesso ao repositório. Este módulo refaz a
 * conferência do token com a Web Crypto API, que existe nos dois runtimes.
 *
 * **Não é uma segunda fonte de verdade — é o mesmo formato, lido de outro lado.**
 * O token é emitido por `issueToken` em `lib/site/auth.ts` como
 * `id.vencimento.papel.assinatura`, com HMAC-SHA256 sobre os três primeiros
 * campos. Se aquele formato mudar, este arquivo tem de mudar junto: há teste
 * cobrindo os dois lados justamente porque a divergência não produziria erro,
 * produziria uma porta destrancada.
 *
 * O que ele **não** faz é decidir política. Diz apenas o que o token afirma;
 * quem decide o que fazer com isso é o middleware.
 */

const DEV_SECRET = "elora-dev-session-secret-nao-usar-em-producao";

export const COOKIE_DA_SESSAO = "elora_site";

export interface SessaoDoToken {
  accountId: string;
  isAdmin: boolean;
}

/**
 * O índice existe para `process.env` caber aqui.
 *
 * Sem ele o TypeScript recusa a chamada do middleware — `ProcessEnv` declara
 * outras chaves e "não tem propriedades em comum" com um tipo de campo único.
 * Declarar o parâmetro como `ProcessEnv` amarraria este módulo ao ambiente do
 * Node, que é justamente o que ele evita.
 */
export interface AmbienteDaSessao {
  SITE_SESSION_SECRET?: string | undefined;
  [chave: string]: string | undefined;
}

function segredo(env: AmbienteDaSessao): string {
  return env.SITE_SESSION_SECRET?.trim() || DEV_SECRET;
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Comparação em tempo constante, escrita à mão.
 *
 * `timingSafeEqual` não existe aqui. O laço percorre o comprimento inteiro e
 * acumula a diferença em vez de sair no primeiro byte distinto — um `===` entre
 * as assinaturas vazaria, pelo tempo de resposta, quantos caracteres iniciais
 * bateram.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diferenca = 0;
  for (let i = 0; i < a.length; i += 1) {
    diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferenca === 0;
}

export async function lerSessao(
  token: string | undefined,
  env: AmbienteDaSessao,
  agoraMs: number = Date.now(),
): Promise<SessaoDoToken | null> {
  if (!token) return null;

  const partes = token.split(".");
  if (partes.length !== 4) return null;

  const [accountId, vencimentoBruto, papel, assinatura] = partes;
  const carga = `${accountId}.${vencimentoBruto}.${papel}`;

  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const esperada = hex(await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(carga)));

  if (!iguaisEmTempoConstante(esperada, assinatura)) return null;

  const vencimento = Number(vencimentoBruto);
  if (!Number.isFinite(vencimento) || vencimento < agoraMs) return null;

  return { accountId, isAdmin: papel === "1" };
}
