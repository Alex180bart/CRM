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
 * ## O pedido não carrega mais cálculo, e isso foi uma decisão
 *
 * Houve uma versão em que `QuoteRequest` guardava a fotografia do cálculo, feita
 * pelo visitante no simulador público. O simulador saiu do site e passou a viver
 * só na área comercial (`/admin`): quem dimensiona é quem vende, com os números
 * que o cliente disse na conversa.
 *
 * A consequência é que **o pedido é uma intenção, não uma proposta**. Ele carrega
 * o que o interessado sabe responder sem calculadora — edição de interesse,
 * tamanho do time, segmento e o texto livre — e o preço nasce depois, do outro
 * lado. Guardar um total aqui voltaria a exigir o simulador público para
 * preenchê-lo, ou nasceria sempre zerado, que é pior: um número exibido ao lado
 * da palavra "orçamento" é lido como preço mesmo quando é só o valor padrão de um
 * campo que ninguém preencheu.
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
  /**
   * Edição que despertou o interesse, conferida contra o catálogo antes de gravar.
   *
   * Opcional porque é legítimo pedir proposta sem ter escolhido: metade de quem
   * chega ao formulário quer justamente que alguém diga qual edição serve.
   * Obrigar a escolher aqui produziria o pior dos dois mundos — o campo preenchido
   * no chute, e o comercial partindo de uma edição que ninguém decidiu.
   */
  planKey?: string;
  /**
   * Quantas pessoas usariam a plataforma.
   *
   * É o único número que o interessado responde de cabeça, e é o que separa a
   * conversa de cinco assentos da de cinquenta. Volume de contato, conversa e
   * e-mail ficou de fora de propósito: quem sabe esses números já está em outra
   * ferramenta, e quem não sabe abandonaria o formulário no meio.
   */
  teamSize?: number;
  message?: string;
  status: QuoteRequestStatus;
  /** Número curto para citar por telefone: "orçamento 2026-0007". */
  reference: string;
  createdAt: IsoDateTime;
}

/** O que uma escrita do site devolve. Nunca lança — mesma regra do `AdminWriteResult`. */
export type SiteWriteResult<T> =
  { ok: true; value: T } | { ok: false; reason: string; field?: string };
