/**
 * Contas do site e pedidos de orçamento, em memória.
 *
 * Mesmo compromisso do armazém da Administração e das sessões do webchat: vive
 * no processo do servidor, sobrevive à navegação e ao recarregamento, morre no
 * reinício. A tela de cadastro **diz isso em voz alta** — um formulário de conta
 * que some sem aviso é pior que a ausência dele, porque a pessoa volta amanhã e
 * conclui que a plataforma perdeu o cadastro dela.
 *
 * As duas coleções nascem vazias, e é a mesma razão de `store.proposals`: semear
 * conta de interessado inventaria lead que nunca existiu, e o primeiro relatório
 * comercial nasceria contaminado.
 */

import type { Id } from "../types/common";
import type {
  QuoteRequest,
  QuoteSnapshot,
  SiteAccount,
  SiteAccountPublic,
  SiteWriteResult,
} from "../types/site";
import { offsetIso } from "../utils/datetime";
import { store } from "./store";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toPublicAccount(account: SiteAccount): SiteAccountPublic {
  const { passwordHash: _hash, passwordSalt: _salt, ...rest } = account;
  return rest;
}

export interface CreateAccountInput {
  name: string;
  email: string;
  company: string;
  phone?: string;
  jobTitle?: string;
  passwordHash: string;
  passwordSalt: string;
  /**
   * Só a semeadura por ambiente passa `true`.
   *
   * O formulário público de cadastro nunca envia este campo — se enviasse,
   * bastaria forjar o corpo da requisição para virar administrador e abrir as
   * bases de demonstração de qualquer navegador.
   */
  isAdmin?: boolean;
}

export interface CreateQuoteInput {
  accountId?: Id;
  name: string;
  email: string;
  company: string;
  phone?: string;
  segment?: string;
  message?: string;
  snapshot: QuoteSnapshot;
}

export interface SiteRepository {
  createAccount(input: CreateAccountInput): Promise<SiteWriteResult<SiteAccount>>;
  getAccountByEmail(email: string): Promise<SiteAccount | null>;
  getAccountById(id: Id): Promise<SiteAccount | null>;
  registerLogin(id: Id): Promise<void>;
  createQuote(input: CreateQuoteInput): Promise<SiteWriteResult<QuoteRequest>>;
  listQuotes(accountId: Id): Promise<QuoteRequest[]>;
  getQuoteByReference(reference: string): Promise<QuoteRequest | null>;
}

/**
 * A referência é sequencial e legível por telefone.
 *
 * Um identificador aleatório seria mais seguro e inútil aqui: ninguém dita
 * `q_8f3a1c` para o comercial. O número não é segredo — o que protege o
 * orçamento é a sessão, não a dificuldade de adivinhar a referência.
 */
function nextReference(): string {
  const sequence = store.quoteRequests.length + 1;
  return `2026-${String(sequence).padStart(4, "0")}`;
}

export const siteMemoryRepository: SiteRepository = {
  async createAccount(input) {
    const email = normalizeEmail(input.email);

    if (store.siteAccounts.some((account) => account.email === email)) {
      return {
        ok: false,
        field: "email",
        reason: "Já existe uma conta com este e-mail. Entre em vez de cadastrar.",
      };
    }

    const account: SiteAccount = {
      id: `acc_${store.siteAccounts.length + 1}_${email.replace(/[^a-z0-9]/g, "").slice(0, 8)}`,
      name: input.name.trim(),
      email,
      company: input.company.trim(),
      phone: input.phone?.trim() || undefined,
      jobTitle: input.jobTitle?.trim() || undefined,
      passwordHash: input.passwordHash,
      passwordSalt: input.passwordSalt,
      isAdmin: input.isAdmin === true,
      createdAt: offsetIso({}),
    };

    store.siteAccounts.push(account);
    return { ok: true, value: account };
  },

  async getAccountByEmail(email) {
    const normalized = normalizeEmail(email);
    return store.siteAccounts.find((account) => account.email === normalized) ?? null;
  },

  async getAccountById(id) {
    return store.siteAccounts.find((account) => account.id === id) ?? null;
  },

  async registerLogin(id) {
    const account = store.siteAccounts.find((item) => item.id === id);
    if (account) account.lastLoginAt = offsetIso({});
  },

  async createQuote(input) {
    const reference = nextReference();

    const quote: QuoteRequest = {
      id: `qr_${reference}`,
      accountId: input.accountId,
      name: input.name.trim(),
      email: normalizeEmail(input.email),
      company: input.company.trim(),
      phone: input.phone?.trim() || undefined,
      segment: input.segment,
      message: input.message?.trim() || undefined,
      snapshot: input.snapshot,
      status: "novo",
      reference,
      createdAt: offsetIso({}),
    };

    store.quoteRequests.push(quote);
    return { ok: true, value: quote };
  },

  async listQuotes(accountId) {
    return store.quoteRequests
      .filter((quote) => quote.accountId === accountId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  },

  async getQuoteByReference(reference) {
    return store.quoteRequests.find((quote) => quote.reference === reference) ?? null;
  },
};
