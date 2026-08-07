/**
 * Identidade e organização.
 * Referência: Plano Completo, seções 6 (perfis) e 17 (domínio de identidade).
 */

import type { BaseEntity, ChannelKind, Id, IsoDateTime } from "./common";

export type RoleKey =
  | "superadmin"
  | "admin_empresa"
  | "gestor_atendimento"
  | "atendente"
  | "gestor_comercial"
  | "marketing"
  | "criador_automacoes"
  | "analista_dados"
  | "auditor_dpo";

export const ROLE_LABEL: Record<RoleKey, string> = {
  superadmin: "Superadministrador",
  admin_empresa: "Administrador da empresa",
  gestor_atendimento: "Gestor de atendimento",
  atendente: "Atendente",
  gestor_comercial: "Gestor comercial",
  marketing: "Marketing",
  criador_automacoes: "Criador de automações",
  analista_dados: "Analista de dados",
  auditor_dpo: "Auditor / DPO",
};

export interface Organization {
  id: Id;
  name: string;
  slug: string;
  brandColor?: string;
  timezone: string;
}

export type UserPresence = "disponivel" | "ausente" | "ocupado" | "offline";

export const PRESENCE_LABEL: Record<UserPresence, string> = {
  disponivel: "Disponível",
  ausente: "Ausente",
  ocupado: "Ocupado",
  offline: "Offline",
};

export interface User {
  id: Id;
  organizationId: Id;
  name: string;
  email: string;
  initials: string;
  role: RoleKey;
  teamIds: Id[];
  presence: UserPresence;
  /** Conversas simultâneas que o roteamento pode atribuir (seção 10). */
  capacity: number;
  accentHue: number;
  /**
   * Competências declaradas — chaves de `SkillDefinition`.
   *
   * É o que o modelo `habilidade` filtra. Vazio significa "recebe o que não
   * exige nada", e não "recebe tudo": quem não declarou fiscal não deveria
   * receber a conversa marcada como fiscal só porque a lista está vazia.
   */
  skills: string[];
  /**
   * Aceita receber conversa nova agora.
   *
   * Separado de `presence` de propósito, e a diferença aparece no caso comum:
   * quem está terminando o expediente continua **disponível** para responder as
   * conversas que já tem, e não deveria receber mais nenhuma. Resolver isso
   * mudando a presença para "ausente" mentiria para quem procura essa pessoa
   * numa transferência.
   */
  acceptingNew: boolean;
  /** Escala de trabalho. Ausente segue a escala da fila. */
  scheduleId?: Id;
}

export interface Team {
  id: Id;
  organizationId: Id;
  name: string;
}

/* Distribuição --------------------------------------------------------------- */

/**
 * Como a fila escolhe quem atende (seção 10, linha "Roteamento").
 *
 * Os quatro modelos automáticos se dividem em **dois que escolhem** e **dois que
 * restringem**, e confundir isso foi o primeiro erro do desenho:
 *
 * - `roleta` e `menor_carga` sabem apontar uma pessoa sozinhos;
 * - `proprietario` e `habilidade` só sabem dizer *quem não serve* — o dono do
 *   contato pode estar offline, e cinco pessoas podem ter a mesma habilidade.
 *
 * É por isso que `QueueDistribution` tem `tiebreak`: os dois últimos filtram e
 * delegam o desempate. Sem esse campo, "por habilidade" precisaria escolher
 * entre os habilitados por alguma regra escondida no código, e a operação
 * descobriria qual só observando o resultado por algumas semanas.
 */
export type DistributionModel = "manual" | "roleta" | "menor_carga" | "proprietario" | "habilidade";

export const DISTRIBUTION_MODEL_LABEL: Record<DistributionModel, string> = {
  manual: "Manual — ninguém recebe automaticamente",
  roleta: "Roleta (rodízio)",
  menor_carga: "Menor carga",
  proprietario: "Proprietário do contato",
  habilidade: "Por habilidade",
};

export const DISTRIBUTION_MODEL_HINT: Record<DistributionModel, string> = {
  manual: "A conversa fica na fila até alguém puxar. É o comportamento de hoje.",
  roleta:
    "Rodízio circular: cada nova conversa vai para o próximo da lista. Volume igual, esforço não.",
  menor_carga: "Vai para quem tem a menor ocupação em relação à própria capacidade.",
  proprietario: "Se o contato já tem responsável, vai para ele. Senão, cai no desempate.",
  habilidade:
    "Só recebe quem declarou as competências exigidas. O desempate escolhe entre os habilitados.",
};

/** Desempate dos modelos que apenas restringem. Nunca é `manual`. */
export type DistributionTiebreak = "roleta" | "menor_carga";

/**
 * Como a conversa chega em quem foi escolhido.
 *
 * `direta` atribui e pronto. `oferta` reserva a conversa por um tempo e espera
 * o aceite — se ninguém aceitar, ela volta para a fila em vez de envelhecer na
 * mão de quem saiu para o café ainda marcado como disponível.
 *
 * É configurável por fila porque as duas escolhas são legítimas em contextos
 * diferentes: fila de lead novo ganha com oferta (quem aceita, atende agora);
 * fila interna de baixo volume ganha com atribuição direta (o aceite vira
 * cerimônia sem retorno).
 */
export type QueueDelivery = "direta" | "oferta";

export const QUEUE_DELIVERY_LABEL: Record<QueueDelivery, string> = {
  direta: "Atribuição direta",
  oferta: "Oferta com tempo de aceite",
};

export interface QueueDistribution {
  model: DistributionModel;
  /** Desempate de `proprietario` e `habilidade`; ignorado nos demais. */
  tiebreak: DistributionTiebreak;
  delivery: QueueDelivery;
  /** Segundos para aceitar. Só vale em `oferta`. */
  offerTimeoutSeconds: number;
  /**
   * Quantas pessoas a fila tenta antes de desistir.
   *
   * Sem teto, uma conversa percorreria o time inteiro em ofertas de 30 s e
   * chegaria ao último com o SLA de primeira resposta já estourado. Esgotado o
   * teto, ela volta para a fila (ou vai para `overflowQueueId`) e o gestor vê.
   */
  maxOffers: number;
  /** Acima da capacidade da pessoa, ninguém recebe mais. */
  respectCapacity: boolean;
  /**
   * Exige presença "Disponível".
   *
   * Desligado, "Ausente" e "Ocupado" também recebem. "Offline" nunca recebe em
   * nenhuma configuração: atribuir a quem não está conectado é o mesmo que
   * deixar a conversa parada, com o agravante de parecer atendida.
   */
  requireAvailable: boolean;
  /** Competências exigidas quando o modelo é `habilidade`. */
  requiredSkills: string[];
  /** Para onde vai o que ninguém aceitou. Vazio devolve à própria fila. */
  overflowQueueId?: Id;
  /** Fora do horário da escala, a distribuição para. */
  pauseOutsideSchedule: boolean;
}

export const DEFAULT_DISTRIBUTION: QueueDistribution = {
  model: "manual",
  tiebreak: "menor_carga",
  delivery: "direta",
  offerTimeoutSeconds: 45,
  maxOffers: 3,
  respectCapacity: true,
  requireAvailable: true,
  requiredSkills: [],
  pauseOutsideSchedule: true,
};

/**
 * Cursor da roleta, por fila.
 *
 * A roleta precisa lembrar quem foi o último — sem isso, ela vira "sempre o
 * primeiro da lista", que é o defeito clássico de round-robin sem estado. Fica
 * separado de `Queue` porque é estado de execução, não configuração: exportar a
 * configuração de uma fila e importar em outro ambiente não deve carregar junto
 * a posição do rodízio.
 */
export interface QueueRotation {
  queueId: Id;
  lastUserId?: Id;
  updatedAt: IsoDateTime;
}

/** Fila de atendimento: separação por produto, canal, assunto, unidade ou prioridade. */
export interface Queue extends BaseEntity {
  name: string;
  description: string;
  channels: ChannelKind[];
  teamId: Id;
  /** Minutos para a primeira resposta, conforme a política de SLA da fila. */
  firstResponseSlaMinutes: number;
  resolutionSlaMinutes: number;
  color: string;
  distribution: QueueDistribution;
  /** Escala de atendimento. Ausente significa fila sem horário — sempre aberta. */
  scheduleId?: Id;
}

/**
 * Estado da conexão de uma conta com o provedor.
 *
 * Separado de `ChannelAccount.status` de propósito: aquele é a saúde
 * operacional que o provedor reporta — conectado, degradado, fora do ar. Este é
 * **o quanto da configuração foi feita**, que é outra pergunta e tem outro dono.
 * Uma conta pode estar `conectado` na configuração e `degradado` na operação, e
 * confundir os dois esconderia justamente o caso em que tudo foi preenchido e
 * mesmo assim não funciona.
 */
export type ChannelConnectionState =
  "nao_configurado" | "aguardando_verificacao" | "conectado" | "erro";

export const CHANNEL_CONNECTION_LABEL: Record<ChannelConnectionState, string> = {
  nao_configurado: "Não configurado",
  aguardando_verificacao: "Aguardando verificação",
  conectado: "Conectado",
  erro: "Com erro",
};

/**
 * O que liga esta conta ao provedor.
 *
 * `fields` guarda só identificador público — o que aparece no painel do
 * provedor e não abre porta nenhuma sozinho: `phone_number_id`, `waba_id`,
 * `page_id`, domínio de envio. Fica no repositório como qualquer outro dado.
 *
 * `secretRef` é o **endereço** do segredo no cofre do servidor, nunca o valor.
 * A separação é o ponto: este objeto viaja até o navegador de quem administra,
 * e um token de acesso do WhatsApp ali seria o fim da história. O cofre grava e
 * não devolve; a tela pergunta apenas "existe?".
 */
export interface ChannelConnection {
  /** Identificador do provedor — `meta_cloud`, `meta_messenger`, `smtp`, `nosso`. */
  provider: string;
  fields: Record<string, string>;
  /** Chave no cofre. Presente significa que o segredo foi gravado alguma vez. */
  secretRef?: string;
  state: ChannelConnectionState;
  /** Quando a última verificação rodou, e o que ela disse. */
  lastCheckedAt?: IsoDateTime;
  lastError?: string;
}

export interface ChannelAccount extends BaseEntity {
  kind: ChannelKind;
  label: string;
  /** Número em E.164 para WhatsApp/telefone; endereço para e-mail. */
  address: string;
  queueId: Id;
  status: "conectado" | "degradado" | "desconectado";
  qualityRating?: "alta" | "media" | "baixa";
  dailyLimit?: number;
  sentToday?: number;
  /**
   * Ausente em canal derivado — o webchat não tem provedor a conectar, e um
   * bloco de conexão vazio ali sugeriria uma configuração que não existe.
   */
  connection?: ChannelConnection;
  lastSyncAt?: IsoDateTime;
}
