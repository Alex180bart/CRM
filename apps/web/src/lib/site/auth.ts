import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { repositories, type SiteAccount, type SiteAccountPublic } from "@elora/core";

/**
 * Sessão e senha da área do cliente do site público.
 *
 * ## O que isto é, e o que não é
 *
 * É autenticação **de verdade no que faz**: a senha nunca é guardada em texto,
 * a derivação é `scrypt` com sal por conta, a comparação é em tempo constante e
 * o cookie é assinado com HMAC — forjar `accountId=acc_1` no navegador não
 * funciona.
 *
 * E é **de demonstração no que guarda**: as contas vivem no armazém em memória
 * do servidor e somem no reinício, como as sessões do webchat. A tela de
 * cadastro diz isso antes do formulário, não depois. Um painel que parece
 * proteger e não protege é pior que a ausência dele — a mesma regra que a
 * política de acesso da Administração já enuncia.
 *
 * Quando o Supabase entrar, o que muda é o corpo destas funções.
 *
 * ## Por que `scrypt` e não `bcrypt`
 *
 * `node:crypto` já traz `scrypt`, e uma dependência a menos numa camada que
 * lida com senha é uma superfície a menos para auditar. O custo padrão do Node
 * (N=16384) é adequado para o volume desta área — não é fila de login de
 * produção.
 *
 * ## O segredo do cookie tem padrão, e o padrão avisa
 *
 * Sem `SITE_SESSION_SECRET` o módulo usa uma chave fixa de desenvolvimento e
 * registra o aviso uma vez. Recusar a subir travaria o ambiente local de quem
 * só quer ver a landing page; gerar uma chave aleatória por processo invalidaria
 * toda sessão a cada recarga do `next dev`, o que pareceria defeito de login.
 */

const COOKIE_NAME = "elora_site";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DEV_SECRET = "elora-dev-session-secret-nao-usar-em-producao";

let warned = false;

function sessionSecret(): string {
  const configured = process.env.SITE_SESSION_SECRET?.trim();
  if (configured) return configured;

  if (!warned) {
    warned = true;
    console.warn(
      "[site/auth] SITE_SESSION_SECRET ausente — usando a chave de desenvolvimento. " +
        "Defina a variável antes de expor o site publicamente.",
    );
  }
  return DEV_SECRET;
}

/* Senha ------------------------------------------------------------------------- */

export interface PasswordMaterial {
  passwordHash: string;
  passwordSalt: string;
}

export function hashPassword(password: string): PasswordMaterial {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password.normalize("NFKC"), salt, 64).toString("hex");
  return { passwordHash: hash, passwordSalt: salt };
}

/**
 * Comparação em tempo constante.
 *
 * Um `===` entre hashes vaza, pelo tempo de resposta, quantos caracteres
 * iniciais bateram. É pouco explorável sobre HTTP e é gratuito evitar.
 */
export function verifyPassword(password: string, material: PasswordMaterial): boolean {
  const candidate = scryptSync(password.normalize("NFKC"), material.passwordSalt, 64);
  const expected = Buffer.from(material.passwordHash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/* Sessão ------------------------------------------------------------------------- */

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

/**
 * O token carrega o vencimento **dentro** da assinatura.
 *
 * Confiar no `maxAge` do cookie seria confiar no navegador para expirar a
 * sessão — e o cookie que alguém copiou continuaria valendo para sempre. Com o
 * carimbo assinado, um token vencido é recusado no servidor mesmo que volte
 * intacto.
 */
/**
 * O papel viaja **dentro** do token, e isso é o que permite conferi-lo no
 * middleware.
 *
 * O middleware roda no runtime de borda: não tem `node:crypto`, não tem o
 * repositório e não pode consultar o armazém — que, além de tudo, vive noutro
 * processo. Sem o papel assinado aqui, a única checagem possível lá seria
 * "existe alguma sessão", e qualquer visitante que se cadastrasse em
 * `/cadastrar` entraria no produto.
 *
 * A contrapartida é conhecida: um papel revogado continua valendo até o token
 * vencer. Vale por sete dias e é aceitável porque o administrador nasce das
 * variáveis de ambiente e não é promovido nem rebaixado em tempo de execução —
 * quando isso mudar, o token precisa encurtar ou passar a ser conferido contra
 * uma lista de revogação.
 */
function issueToken(accountId: string, isAdmin: boolean): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${accountId}.${expiresAt}.${isAdmin ? "1" : "0"}`;
  return `${payload}.${sign(payload)}`;
}

interface TokenLido {
  accountId: string;
  isAdmin: boolean;
}

function readToken(token: string): TokenLido | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const [accountId, expiresRaw, adminRaw, signature] = parts;
  const payload = `${accountId}.${expiresRaw}.${adminRaw}`;

  const expected = Buffer.from(sign(payload), "hex");
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length) return null;
  if (!timingSafeEqual(expected, received)) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  return { accountId, isAdmin: adminRaw === "1" };
}

export async function startSession(accountId: string, isAdmin = false): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, issueToken(accountId, isAdmin), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/**
 * A conta da sessão, ou `null`.
 *
 * ## Por que o administrador é re-semeado aqui
 *
 * O armazém vive na memória do processo. Em hospedagem serverless cada
 * requisição pode cair numa instância diferente — e a instância nova nasce com o
 * armazém recém-semeado, **sem** a conta de administrador, que só é criada
 * dentro de `signInAction`. O efeito era visível e desnorteante: a pessoa
 * entrava, era redirecionada para a área logada, e o cabeçalho da página
 * seguinte mostrava "Entrar" de novo, como se o login não tivesse acontecido.
 * O cookie estava lá e era válido o tempo todo; quem sumia era a conta.
 *
 * Como o token é assinado e declara o papel, um token de administrador é prova
 * suficiente para recriar aquela conta a partir das variáveis de ambiente — que
 * é de onde ela nasce, sempre. A busca final é por **e-mail**, e não pelo
 * identificador do token, porque o identificador é derivado da posição no
 * armazém e não sobrevive a uma re-semeadura em outra ordem.
 *
 * Conta comum não tem esse resgate, e não há como ter: ela existiu apenas na
 * memória de uma instância que já morreu. Devolver `null` é a resposta honesta —
 * a pessoa é tratada como visitante e a tela de cadastro avisa que as contas não
 * duram. Quem resolve isso de verdade é a camada de escrita com back-end.
 */
export async function currentAccount(): Promise<SiteAccount | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const lido = readToken(token);
  if (!lido) return null;

  const encontrada = await repositories.site.getAccountById(lido.accountId);
  if (encontrada) return encontrada;

  if (!lido.isAdmin) return null;

  await ensureAdminAccount();

  const email = process.env.ELORA_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return null;

  const admin = await repositories.site.getAccountByEmail(email);
  // A conferência do papel não é cerimônia: se as variáveis de ambiente mudarem
  // e o e-mail passar a apontar para uma conta comum, o token antigo não pode
  // continuar valendo como credencial de administrador.
  return admin?.isAdmin ? admin : null;
}

export async function currentAccountPublic(): Promise<SiteAccountPublic | null> {
  const account = await currentAccount();
  if (!account) return null;

  const { passwordHash: _hash, passwordSalt: _salt, ...rest } = account;
  return rest;
}

/* Conta de administrador ---------------------------------------------------------- */

/**
 * A conta da equipe comercial nasce do ambiente, não de um formulário.
 *
 * ## Por que semeada, e não cadastrada
 *
 * Administrador é quem pode **carregar uma base de demonstração na instância** —
 * e, sem back-end, o armazém é único: quem troca a base troca para todo mundo
 * conectado. Um formulário público que criasse administrador entregaria esse
 * botão a qualquer visitante, e o sintoma apareceria no pior momento possível,
 * com a base mudando no meio de uma apresentação.
 *
 * ## Por que a senha fica no `.env`, e não aqui
 *
 * Este repositório está publicado. Uma credencial escrita no código vaza no
 * primeiro `git push`, e continua no histórico depois de removida. `.env` está
 * no `.gitignore`; `.env.example` carrega só o nome da variável.
 *
 * Sem as duas variáveis, **nenhuma conta é criada** e a área de demonstrações
 * fica inacessível — que é o padrão seguro. Criar um administrador com senha
 * conhecida por omissão seria abrir a porta e escrever "não use" ao lado.
 *
 * ## Por que é idempotente e roda no login
 *
 * O armazém morre no reinício do servidor, então a semeadura precisa acontecer
 * de novo na primeira necessidade. Rodar no login cobre exatamente esse
 * instante, e o `getAccountByEmail` antes da criação faz a segunda chamada não
 * fazer nada.
 */
export async function ensureAdminAccount(): Promise<void> {
  const email = process.env.ELORA_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ELORA_ADMIN_PASSWORD;

  if (!email || !password) return;

  const existing = await repositories.site.getAccountByEmail(email);
  if (existing) return;

  await repositories.site.createAccount({
    name: process.env.ELORA_ADMIN_NAME?.trim() || "Equipe Elora",
    email,
    company: "Elora · Contabilidade Facilitada",
    jobTitle: "Comercial",
    isAdmin: true,
    ...hashPassword(password),
  });
}

/**
 * O servidor tem conta de administrador configurada?
 *
 * Pergunta de **configuração**, não de credencial: responde se as variáveis
 * existem, nunca o que elas valem. A tela de entrada usa isto para explicar o
 * caso em que a credencial certa é recusada porque o servidor subiu sem o
 * `.env` — sem essa distinção, a mensagem é a mesma de senha errada e a pessoa
 * tenta a mesma senha cinco vezes.
 */
export function adminConfigured(): boolean {
  return Boolean(process.env.ELORA_ADMIN_EMAIL?.trim() && process.env.ELORA_ADMIN_PASSWORD);
}

/**
 * A conta da sessão, exigindo administrador.
 *
 * Devolve `null` para visitante e para cliente comum — quem chama decide se
 * redireciona ou se apenas esconde a peça. Separado de `currentAccount` de
 * propósito: uma única função que devolvesse a conta e deixasse a checagem para
 * a tela produziria o esquecimento clássico, uma página nova que lê a conta e
 * não confere o papel.
 */
export async function currentAdmin(): Promise<SiteAccount | null> {
  const account = await currentAccount();
  return account?.isAdmin ? account : null;
}
