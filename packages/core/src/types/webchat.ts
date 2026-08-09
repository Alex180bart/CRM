/**
 * Widget de webchat.
 *
 * Referência: o plano nomeia a tabela `webchat_widgets` na seção 17 e lista o
 * webchat entre os canais da fase P1 (seção 25), mas **não descreve o widget**.
 * O que está modelado aqui é derivado do que o resto do plano já exige de um
 * canal — fila, SLA, horário, consentimento, transbordo, versão publicada
 * imutável — e não de requisito inventado.
 *
 * A diferença em relação aos outros canais é o lugar: WhatsApp e e-mail chegam
 * de um provedor; o webchat **é código nosso rodando no site de terceiro**. Isso
 * muda três coisas no modelo:
 *
 * 1. a cor é dado da organização, não token nosso — e por isso vem verificada;
 * 2. há domínios autorizados, porque o mesmo trecho de incorporação copiado para
 *    outro site continuaria abrindo conversas na fila da empresa;
 * 3. a versão publicada é imutável, como fluxo e e-mail: o site do cliente
 *    carrega uma versão, e mudar o rascunho não pode alterar o que já está no ar.
 */

import type { BaseEntity, Id, IsoDateTime } from "./common";
import type { FlowStatus } from "./automation";

/* Aparência ---------------------------------------------------------------- */

export type WidgetPosition = "direita" | "esquerda";

export const WIDGET_POSITION_LABEL: Record<WidgetPosition, string> = {
  direita: "Canto inferior direito",
  esquerda: "Canto inferior esquerdo",
};

export type WidgetLauncher = "bolha" | "bolha_rotulo" | "barra";

export const WIDGET_LAUNCHER_LABEL: Record<WidgetLauncher, string> = {
  bolha: "Bolha com ícone",
  bolha_rotulo: "Bolha com rótulo",
  barra: "Barra na base",
};

export type WidgetCorner = "arredondado" | "suave" | "reto";

export const WIDGET_CORNER_LABEL: Record<WidgetCorner, string> = {
  arredondado: "Bem arredondado",
  suave: "Suave",
  reto: "Reto",
};

/**
 * Desenho do lançador fechado.
 *
 * `logo` existe porque a bolha é a peça de marca mais vista do site — aparece em
 * toda página, o tempo todo. Um glifo genérico serve para começar; quem já tem
 * marca quer a marca ali.
 */
export type WidgetIcon = "balao" | "mensagem" | "suporte" | "pergunta" | "raio" | "logo";

export const WIDGET_ICON_LABEL: Record<WidgetIcon, string> = {
  balao: "Balão de conversa",
  mensagem: "Mensagem",
  suporte: "Fone de atendimento",
  pergunta: "Interrogação",
  raio: "Raio",
  logo: "Logo da empresa",
};

export interface WidgetAppearance {
  /**
   * Cor da marca, em hexadecimal.
   *
   * É a exceção deliberada à regra "cor sai de token": o widget renderiza no
   * site do cliente, com a identidade dele. Vem sempre acompanhada da
   * verificação de contraste — quem escolhe a cor não escolhe a tinta.
   */
  brandColor: string;
  position: WidgetPosition;
  launcher: WidgetLauncher;
  /** Texto do lançador quando `launcher` mostra rótulo. */
  launcherLabel: string;
  corner: WidgetCorner;
  /** Nome exibido no cabeçalho da janela — normalmente o da empresa. */
  headerTitle: string;
  headerSubtitle: string;
  /** Iniciais no avatar do cabeçalho, quando não há logo. */
  avatarInitials: string;
  icon: WidgetIcon;
  /**
   * Endereço da imagem usada como logo, quando `icon` é `logo`.
   *
   * URL, não arquivo: o caminho de upload da seção 11 (antivírus, armazenamento,
   * URL assinada) não existe ainda, e fingir que existe deixaria o widget do
   * cliente apontando para um `blob:` que morre ao fechar a aba.
   */
  logoUrl?: string;
  /** Assinatura discreta "Atendimento por Elora" no pé da janela. */
  showBranding: boolean;
}

/* Comportamento ------------------------------------------------------------ */

export type PrechatFieldKind = "texto" | "email" | "telefone" | "selecao";

export const PRECHAT_FIELD_LABEL: Record<PrechatFieldKind, string> = {
  texto: "Texto",
  email: "E-mail",
  telefone: "Telefone",
  selecao: "Seleção",
};

/**
 * Campo do formulário anterior à conversa.
 *
 * Cada campo aqui é atrito: o visitante que ia perguntar o preço passa a
 * preencher cadastro antes. Vale a pena para telefone quando o time precisa
 * retornar; raramente vale para mais de três campos.
 */
export interface PrechatField {
  id: Id;
  kind: PrechatFieldKind;
  label: string;
  placeholder?: string;
  required: boolean;
  /** Opções de `selecao`. Vazio nos outros tipos. */
  options?: string[];
  /**
   * Campo do contato que recebe o valor — `contato.email`, `campo.regime`.
   * Sem isto o dado morre na conversa em vez de virar cadastro.
   */
  mapsTo?: string;
}

export interface WidgetMessages {
  /** Primeira bolha, antes de qualquer mensagem do visitante. */
  greeting: string;
  /** Segundos de espera antes de a saudação aparecer. Zero abre junto. */
  greetingDelaySeconds: number;
  /** Texto acima do formulário anterior à conversa. */
  prechatIntro: string;
  /** Resposta automática confirmando o recebimento dentro do horário. */
  awayInside: string;
  /** O que aparece fora do horário de atendimento. */
  awayOutside: string;
  /** Aviso quando a fila está acima da capacidade. */
  queueBusy: string;
  placeholder: string;
}

/** Faixa de atendimento de um dia da semana. `null` significa fechado. */
export interface WidgetSchedule {
  /** 0 é domingo, como `Date.getDay()`. */
  weekday: number;
  from: string | null;
  to: string | null;
}

export type OutsideHoursBehavior = "recado" | "somente_aviso" | "bot";

export const OUTSIDE_HOURS_LABEL: Record<OutsideHoursBehavior, string> = {
  recado: "Aceitar recado e responder depois",
  somente_aviso: "Só avisar que está fechado",
  bot: "Deixar o chatbot atender",
};

/**
 * Quem conduz a conversa antes do humano.
 *
 * Campo explícito, e não a presença de `botFlowId` ou `agentId`, porque os dois
 * podem estar preenchidos ao mesmo tempo — alguém experimenta o agente e não
 * apaga o fluxo antigo. Deduzir o condutor da presença do identificador
 * transformaria essa situação comum num estado ambíguo, resolvido por
 * precedência escondida no código. Aqui a escolha é dado, e a validação recusa
 * escolher "agente" sem agente.
 *
 * A diferença entre os dois é a da seção 26.4: o fluxo percorre um caminho
 * desenhado; o agente decide. Fluxo para o que se repete igual — menu, coleta,
 * roteamento fixo. Agente para o que varia — dúvida escrita em texto livre.
 */
/**
 * Pesquisa de satisfação do widget.
 *
 * Uma pergunta e cinco carinhas. O comentário é opcional e aparece **depois** da
 * nota, nunca junto: pedir os dois de uma vez derruba a taxa de resposta de quem
 * só queria dar a nota e sair.
 */
export interface WidgetSurvey {
  enabled: boolean;
  question: string;
  /** Texto exibido depois da resposta. */
  thanks: string;
  /** Abre o campo de comentário depois da nota. */
  askComment: boolean;
  /**
   * Nota a partir da qual o comentário não é pedido.
   *
   * Quem avaliou bem não tem o que explicar, e insistir gasta a boa vontade que
   * a nota alta acabou de demonstrar. Nota baixa é onde o motivo vale ouro.
   */
  commentBelowScore: number;
}

export type WidgetResponder = "ninguem" | "fluxo" | "agente";

export const WIDGET_RESPONDER_LABEL: Record<WidgetResponder, string> = {
  ninguem: "Entrar direto na fila",
  fluxo: "Fluxo de chatbot",
  agente: "Agente de IA",
};

export interface WidgetBehavior {
  prechatEnabled: boolean;
  prechatFields: PrechatField[];
  /** Fila que recebe as conversas abertas por este widget. */
  queueId: Id;
  responder: WidgetResponder;
  /** Fluxo de chatbot que atende antes do humano. */
  botFlowId?: Id;
  /** Agente de IA que atende antes do humano (seção 16.1, autoatendimento). */
  agentId?: Id;
  schedule: WidgetSchedule[];
  outsideHours: OutsideHoursBehavior;
  /**
   * Pesquisa de satisfação ao fim da conversa.
   *
   * Fica no widget, e não no agente, porque a conversa pode terminar com o
   * agente **ou** com uma pessoa — e a nota tem de ser comparável entre os dois.
   * Amarrá-la ao agente mediria só o que a IA resolveu sozinha, que é o recorte
   * mais favorável e o menos útil.
   */
  survey: WidgetSurvey;
  /** Minutos de inatividade antes de encerrar a sessão do visitante. */
  idleTimeoutMinutes: number;
  /** Oferece transcrição por e-mail ao encerrar. */
  offerTranscript: boolean;
}

/* Privacidade e alcance ---------------------------------------------------- */

export interface WidgetPrivacy {
  /**
   * Texto do aceite mostrado antes da primeira mensagem.
   *
   * Não é enfeite jurídico: a conversa vira base de contato, e a seção 18 exige
   * prova de consentimento por finalidade. O texto exibido é o que fica gravado
   * junto do aceite.
   */
  consentText: string;
  consentRequired: boolean;
  privacyUrl?: string;
  /** Dias de retenção da transcrição para quem não virou contato. */
  transcriptRetentionDays: number;
}

export interface WebchatWidgetVersion {
  id: Id;
  widgetId: Id;
  version: number;
  status: FlowStatus;
  appearance: WidgetAppearance;
  messages: WidgetMessages;
  behavior: WidgetBehavior;
  privacy: WidgetPrivacy;
  publishedAt?: IsoDateTime;
  publishedBy?: Id;
  changeNote?: string;
}

export interface WebchatWidgetStats {
  /** Aberturas do lançador nos últimos 30 dias. */
  opens30d: number;
  conversations30d: number;
  /** Aberturas que viraram conversa. É o número que diz se o widget funciona. */
  conversionPct: number;
  /** Conversas que geraram contato novo no CRM. */
  leads30d: number;
  medianFirstReplySeconds: number;
  csat?: number;
}

export interface WebchatWidget extends BaseEntity {
  name: string;
  description: string;
  /** Conta de canal correspondente — liga o widget à fila e ao histórico. */
  channelAccountId: Id;
  /**
   * Chave pública do trecho de incorporação. Aparece no HTML do cliente, então
   * não autoriza nada por si: a autorização é a lista de domínios.
   */
  embedKey: string;
  /**
   * Domínios onde o widget pode carregar.
   *
   * Sem esta lista, o trecho copiado para qualquer site abriria conversas na
   * fila da empresa — e o primeiro sintoma seria a fila entupida de spam sem
   * ninguém entender de onde vem.
   */
  allowedDomains: string[];
  versions: WebchatWidgetVersion[];
  activeVersionId?: Id;
  draftVersionId: Id;
  ownerId: Id;
  stats: WebchatWidgetStats;
}

/* Validação antes de publicar ---------------------------------------------- */

export type WidgetValidationRule =
  | "sem_dominio"
  | "contraste_insuficiente"
  | "saudacao_vazia"
  | "campo_sem_rotulo"
  | "selecao_sem_opcoes"
  | "consentimento_sem_texto"
  | "horario_vazio"
  | "fora_do_horario_sem_bot"
  | "condutor_sem_fluxo"
  | "condutor_sem_agente";

export const WIDGET_VALIDATION_LABEL: Record<WidgetValidationRule, string> = {
  sem_dominio: "Nenhum domínio autorizado",
  contraste_insuficiente: "Contraste insuficiente",
  saudacao_vazia: "Saudação vazia",
  campo_sem_rotulo: "Campo sem rótulo",
  selecao_sem_opcoes: "Seleção sem opções",
  consentimento_sem_texto: "Consentimento sem texto",
  horario_vazio: "Nenhum dia de atendimento",
  fora_do_horario_sem_bot: "Fora do horário sem chatbot",
  condutor_sem_fluxo: "Atendimento por fluxo sem fluxo escolhido",
  condutor_sem_agente: "Atendimento por agente sem agente escolhido",
};

export interface WidgetValidationIssue {
  id: string;
  rule: WidgetValidationRule;
  severity: "erro" | "alerta";
  message: string;
}
