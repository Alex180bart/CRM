/**
 * Site público: conta do interessado e pedido de orçamento.
 *
 * Este é o **outro lado** do produto. Todo o resto do repositório modela a
 * operação de quem já usa a Elora; aqui estão as duas entidades que existem
 * antes disso — quem pediu proposta e o que ele dimensionou.
 *
 * ## Por que não reaproveitar `Contact` e `Proposal`
 *
 * Foi a primeira ideia e ela quebra em dois pontos. `Contact` carrega
 * `organizationId` de uma organização que **ainda não existe**: o interessado é
 * anterior à conta que ele talvez contrate. E `Proposal` (seção 26.1) é a
 * proposta que o cliente da Elora envia ao cliente dele — misturar as duas faria
 * o funil comercial da Elora aparecer dentro do Pipeline de quem comprou.
 *
 * Quando o back-end entrar, o pedido de orçamento vira lead no CRM interno da
 * Elora. Hoje ele é registro próprio, e a fronteira é essa.
 *
 * ## A senha não mora aqui, e o formato é opaco
 *
 * `SiteAccount` guarda `passwordHash` e `passwordSalt` como texto sem
 * significado para este pacote: quem deriva é a camada de aplicação, com
 * `node:crypto`. Trazer a derivação para cá arrastaria um módulo de Node para
 * dentro de um pacote que também é empacotado para o navegador — e um `scrypt`
 * no cliente é, na melhor hipótese, inútil.
 *
 * ## A proposta é fotografia, como em `commerce.ts`
 *
 * `QuoteRequest` copia o resultado do cálculo. Guardar só a entrada e recalcular
 * na hora de exibir faria o orçamento que o cliente recebeu por R$ 4.180 aparecer
 * por R$ 4.610 depois de um reajuste de tabela — e o print que ele tem passaria a
 * contradizer a tela.
 */

import type { Id, IsoDateTime } from "./common";

export interface SiteAccount {
  id: Id;
  name: string;
  /** Normalizado em minúsculas — é a chave de login e de unicidade. */
  email: string;
  company: string;
  phone?: string;
  /** Cargo declarado no cadastro; livre, serve para qualificar o lead. */
  jobTitle?: string;
  passwordHash: string;
  passwordSalt: string;
  /**
   * Conta da equipe comercial da Elora, não do interessado.
   *
   * Separa duas populações que usam o mesmo formulário de entrada e enxergam
   * coisas diferentes: quem pede orçamento vê os próprios pedidos; quem vende
   * vê também as bases de demonstração e pode carregá-las na instância. A
   * distinção existe porque a demonstração é **material de venda** — um
   * visitante que a abre sozinho troca a base debaixo de uma apresentação em
   * andamento, já que o repositório em memória é único.
   *
   * Não há autocadastro de administrador: a conta é semeada a partir do
   * ambiente. Ver `ensureAdminAccount` em `apps/web/src/lib/site/auth.ts`.
   */
  isAdmin: boolean;
  createdAt: IsoDateTime;
  lastLoginAt?: IsoDateTime;
}

/** O que a pessoa vê da própria conta. Nunca inclui o material da senha. */
export type SiteAccountPublic = Omit<SiteAccount, "passwordHash" | "passwordSalt">;

export type QuoteRequestStatus = "novo" | "em_analise" | "respondido" | "fechado";

export const QUOTE_STATUS_LABEL: Record<QuoteRequestStatus, string> = {
  novo: "Novo",
  em_analise: "Em análise",
  respondido: "Respondido",
  fechado: "Fechado",
};

/** Fotografia do cálculo, no instante do pedido. */
export interface QuoteSnapshot {
  planKey: string;
  planName: string;
  billing: string;
  seats: number;
  contacts: number;
  conversations: number;
  emails: number;
  aiReplies: number;
  monthlyTotalCents: number;
  annualTotalCents: number;
  oneTimeCents: number;
  firstInvoiceCents: number;
  passthroughCents: number;
  discountPct: number;
  lines: Array<{ label: string; detail: string; totalCents: number }>;
}

export interface QuoteRequest {
  id: Id;
  /** Ausente quando o pedido veio de alguém que não criou conta. */
  accountId?: Id;
  name: string;
  email: string;
  company: string;
  phone?: string;
  /** Segmento declarado — casa com as verticais de demonstração quando possível. */
  segment?: string;
  message?: string;
  snapshot: QuoteSnapshot;
  status: QuoteRequestStatus;
  /** Número curto para citar por telefone: "orçamento 2026-0007". */
  reference: string;
  createdAt: IsoDateTime;
}

/** O que uma escrita do site devolve. Nunca lança — mesma regra do `AdminWriteResult`. */
export type SiteWriteResult<T> =
  { ok: true; value: T } | { ok: false; reason: string; field?: string };
