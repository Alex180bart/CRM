/**
 * Verticais de demonstração.
 *
 * Até aqui a base de demonstração era uma só — uma contabilidade — e cada tela
 * a lia direto de `mock/`. Isso resolvia o problema de "o front precisa parecer
 * uma operação real", mas não o de **mostrar o produto a um cliente que não é
 * contabilidade**: quem vende para e-commerce abre o Inbox e encontra DAS,
 * Simples Nacional e obrigação acessória. A demonstração passa a exigir tradução
 * simultânea, e o que fica na cabeça de quem assiste é o vocabulário errado.
 *
 * ## O que uma vertical é
 *
 * Um **overlay** sobre a base. A vertical reescreve o que carrega narrativa —
 * organização, times, filas, contatos, conversas, funis, campanhas — e herda o
 * resto. Não é um banco paralelo: é a mesma forma com outro conteúdo, e é isso
 * que mantém o custo de acrescentar a quinta vertical parecido com o da segunda.
 *
 * ## Três famílias de identificador não mudam, e o motivo é concreto
 *
 * `queue_*`, `chan_*` e as chaves de habilidade são citados por módulos que a
 * vertical **não** reescreve — `mock/agents.ts` aponta a fila de transbordo,
 * `mock/webchat.ts` aponta a fila do widget, `mock/bots.ts` exige competência.
 * Trocar o identificador junto com o rótulo deixaria essas referências penduradas,
 * e o sintoma seria discreto do jeito pior: nome de fila em branco no meio da
 * demonstração, sem erro no console.
 *
 * Então o identificador é estável e o **rótulo** é da vertical. `queue_fiscal`
 * chama-se "Suporte fiscal" na contabilidade e "Trocas e devoluções" no
 * e-commerce. O mesmo vale para `usr_*`: `CURRENT_USER_ID` é uma constante
 * exportada e consumida por componente de cliente; mudar o conjunto de usuários
 * por vertical quebraria a sessão do protótipo em toda troca.
 */

import type { ChannelKind, Id } from "../types/common";
import type { ChannelAccount, Organization, Queue, Team, User } from "../types/organization";
import type { Company, Contact, Deal, Pipeline, Tag, Task, TimelineEntry } from "../types/crm";
import type { CannedResponse, Conversation, InternalNote, Message } from "../types/inbox";
import type { Campaign, MessageTemplate, Segment } from "../types/marketing";
import type { ClosingReason, CustomFieldDefinition, SkillDefinition } from "../types/catalog";
import type { Product, Proposal } from "../types/commerce";

export type DemoVerticalId = "contabilidade" | "ecommerce" | "clinica" | "imobiliaria";

/**
 * O cartão da vertical — o que a landing page mostra antes de alguém entrar.
 *
 * Vive junto do conjunto de dados, e não numa lista à parte no site, porque as
 * duas coisas envelhecem juntas: quem acrescenta a vertical de logística tem de
 * escrever o cartão no mesmo arquivo, ou a vitrine anuncia uma vertical que o
 * seletor não oferece.
 */
export interface DemoVerticalMeta {
  id: DemoVerticalId;
  /** Nome do segmento — "E-commerce", "Clínica". */
  name: string;
  /** Empresa fictícia que a base representa. */
  company: string;
  tagline: string;
  description: string;
  /**
   * Matiz do cartão na vitrine, no mesmo esquema das tags.
   *
   * A vertical **não** troca a paleta da instalação, e isso foi uma decisão
   * revertida: a primeira versão aplicava uma paleta por segmento, o que ficava
   * bonito dentro do produto e virava defeito no site — a landing page é a marca
   * da Elora, e mudava de cor porque alguém tinha aberto a demonstração de
   * e-commerce. A cor da vertical fica no cartão, onde é decoração; a paleta da
   * organização continua sendo escolha da Administração.
   */
  hue: number;
  /** Três frases do que esta base demonstra bem. */
  highlights: string[];
  channels: ChannelKind[];
  /** Números do cartão: rótulo e valor já formatados. */
  stats: Array<{ label: string; value: string }>;
}

/**
 * Tudo o que uma vertical pode reescrever.
 *
 * O que não está aqui é compartilhado de propósito: matriz de permissão, escala
 * de trabalho, política de retenção, módulos de e-mail e catálogo de eventos
 * descrevem **a plataforma**, não o negócio de quem a usa. Duplicá-los por
 * vertical criaria quatro cópias para manter e nenhuma diferença visível.
 */
export interface DemoDataset {
  meta: DemoVerticalMeta;
  organization: Organization;
  teams: Team[];
  users: User[];
  queues: Queue[];
  channelAccounts: ChannelAccount[];
  tags: Tag[];
  skills: SkillDefinition[];
  closingReasons: ClosingReason[];
  customFields: CustomFieldDefinition[];
  cannedResponses: CannedResponse[];
  companies: Company[];
  contacts: Contact[];
  timeline: TimelineEntry[];
  conversations: Conversation[];
  messages: Message[];
  internalNotes: InternalNote[];
  pipelines: Pipeline[];
  deals: Deal[];
  tasks: Task[];
  segments: Segment[];
  campaigns: Campaign[];
  messageTemplates: MessageTemplate[];
  /**
   * Catálogo comercial da vertical (seção 26.1).
   *
   * Entra no conjunto de dados, e não numa lista compartilhada, porque produto é
   * exatamente o que **não** viaja entre segmentos: quem vende luminária não tem
   * DAS no catálogo, e o agente de IA responde preço a partir daqui.
   */
  products: Product[];
  /**
   * Propostas de demonstração, uma por estado que tem tela.
   *
   * Geradas a partir das conversas da vertical pelas funções puras de
   * `utils/commerce.ts` — ver `demo/comercio.ts`. Não são dado literal, de
   * propósito: literal envelheceria na primeira mudança de regra de preço.
   */
  proposals: Proposal[];
}

/** O que uma vertical entrega; o que ela omite vem da base. */
export type DemoOverlay = Partial<Omit<DemoDataset, "meta">> & { meta: DemoVerticalMeta };

/** Identificadores estáveis entre verticais. Ver o cabeçalho deste arquivo. */
export const STABLE_QUEUE_IDS = [
  "queue_fiscal",
  "queue_comercial",
  "queue_matriculas",
  "queue_regularizacao",
] as const satisfies readonly Id[];

export const STABLE_CHANNEL_IDS = [
  "chan_wa_atendimento",
  "chan_wa_comercial",
  "chan_email_atendimento",
  "chan_instagram",
] as const satisfies readonly Id[];

export const STABLE_TEAM_IDS = [
  "team_atendimento",
  "team_comercial",
  "team_marketing",
  "team_aluno",
] as const satisfies readonly Id[];

export const STABLE_USER_IDS = [
  "usr_alex",
  "usr_marina",
  "usr_rafael",
  "usr_juliana",
  "usr_bruno",
  "usr_carla",
  "usr_diego",
] as const satisfies readonly Id[];
