/**
 * Agentes de IA de atendimento.
 *
 * Referência: seção 16.1 (linha "Autoatendimento": responder com base de
 * conhecimento, coletar dados, executar ferramentas autorizadas e transferir ao
 * humano), 16.3 (ferramentas), 16.4 (allowlist por agente/canal/contexto,
 * confirmação humana em ação de alto impacto, métricas) e 26.4 (P2: "Agentes de
 * IA com ferramentas; RAG; memória controlada; intents híbridas; handoff
 * contextual").
 *
 * ## Por que agente não é fluxo
 *
 * O fluxo do Chatbot Builder é determinístico: nó, aresta, ramo. Cada caminho
 * possível foi desenhado por alguém. O agente é um **laço**: recebe mensagem,
 * decide, eventualmente usa uma ferramenta, responde, repete até resolver ou
 * transferir. Modelar isso como fluxo obrigaria a desenhar sete nós para o que
 * uma instrução resolve — o mesmo erro que a separação entre Automações e
 * Jornadas já evitou aqui.
 *
 * Os dois convivem e a ponte vale nos dois sentidos: um fluxo pode entregar a
 * conversa a um agente, e o agente pode devolvê-la a uma fila ou encerrá-la.
 *
 * ## O que o modelo decide e o que ele não decide
 *
 * O modelo devolve **uma intenção de ação por turno**, como dado. Nada aqui
 * executa efeito: quem valida permissão, aplica o limite e executa é a
 * aplicação (16.3). É a mesma disciplina da tabulação — a IA propõe, a
 * aplicação confere, e no caso de escrita, uma pessoa confirma.
 */

import type { AiRunMeta } from "./ai";
import type { FlowStatus } from "./automation";
import type { BaseEntity, ChannelKind, Id, IsoDateTime } from "./common";

/* Identidade e missão -------------------------------------------------------- */

/**
 * Tom da voz do agente.
 *
 * Lista curta e fechada porque cada valor vira instrução literal no prompt. Um
 * campo de texto livre aqui produziria "seja profissional mas descontraído mas
 * técnico" — que não dirige nada e ainda gasta contexto.
 */
export type AgentTone =
  | "cordial"
  | "direto"
  | "tecnico"
  | "didatico"
  | "formal"
  | "consultivo"
  | "empatico"
  | "descontraido";

export const AGENT_TONE_LABEL: Record<AgentTone, string> = {
  cordial: "Cordial",
  direto: "Direto",
  tecnico: "Técnico",
  didatico: "Didático",
  formal: "Formal",
  consultivo: "Consultivo",
  empatico: "Empático",
  descontraido: "Descontraído",
};

export const AGENT_TONE_HINT: Record<AgentTone, string> = {
  cordial: "Acolhedor sem bajular. Uma frase de reconhecimento antes de resolver.",
  direto: "Vai ao ponto na primeira frase. Sem rodeio de abertura.",
  tecnico: "Usa o termo correto do ofício e assume que a pessoa conhece o vocabulário.",
  didatico: "Explica o mecanismo antes de pedir a ação. Um conceito por vez.",
  formal: "Tratamento respeitoso e impessoal, sem rigidez de ofício público. Nada de gíria.",
  consultivo: "Pergunta antes de afirmar. Entende a situação para recomendar, não para vender.",
  empatico: "Reconhece o incômodo em uma frase antes de resolver. Sem pedir desculpas repetidas.",
  descontraido: "Leve e informal, na medida de quem trabalha com dinheiro dos outros.",
};

/* Estilo ---------------------------------------------------------------------- */

/**
 * Ajustes finos de escrita.
 *
 * Separados do tom porque respondem a perguntas diferentes: o tom é a **atitude**
 * ("acolhedor", "direto"), o estilo é a **forma** (comprimento, emoji, jargão).
 * Misturá-los produziria uma lista de vinte tons onde metade é combinação da
 * outra metade — e cada item dessa lista vira instrução literal no prompt.
 */
export type AgentMessageLength = "curta" | "media" | "longa";

export const AGENT_LENGTH_LABEL: Record<AgentMessageLength, string> = {
  curta: "Curta — 1 a 2 frases",
  media: "Média — até 4 frases",
  longa: "Longa — pode usar dois parágrafos",
};

export type AgentEmojiUse = "nunca" | "raro" | "livre";

export const AGENT_EMOJI_LABEL: Record<AgentEmojiUse, string> = {
  nunca: "Nunca usa emoji",
  raro: "No máximo um, e só quando cabe",
  livre: "Usa quando o tom pedir",
};

export interface AgentStyle {
  messageLength: AgentMessageLength;
  emojiUse: AgentEmojiUse;
  /** Trata pelo primeiro nome em vez de "você" genérico. */
  useFirstName: boolean;
  /**
   * Traduz o jargão contábil.
   *
   * Muda mais a percepção de qualidade que o tom: "DCTFWeb" dito a um MEI é
   * ruído, e a mesma frase com "a declaração da folha" resolve.
   */
  explainJargon: boolean;
  /** Frase fixa no fim da última mensagem — assinatura, aviso, link. */
  signature: string;
}

export interface AgentIdentity {
  /** Nome pelo qual o agente se apresenta ao contato. */
  displayName: string;
  /** Papel — "consultor de primeiro atendimento", "assistente de matrículas". */
  role: string;
  tone: AgentTone;
  /**
   * Foto de perfil.
   *
   * Endereço externo, não arquivo: não existe armazenamento de mídia neste
   * repositório (seção 11 é back-end). Vazio cai nas iniciais, que é melhor que
   * um quadrado quebrado na frente do visitante.
   */
  avatarUrl?: string;
  /** Iniciais usadas quando não há foto. */
  avatarInitials: string;
  /**
   * Primeira mensagem.
   *
   * Vazio significa que o agente abre a conversa a partir do que o contato
   * disse, em vez de recitar saudação. É a opção certa quando o agente entra
   * depois de um formulário — ali o contato já escreveu o assunto.
   */
  greeting: string;
  /** Se o agente diz que é uma inteligência artificial ao se apresentar. */
  discloseAi: boolean;
  style: AgentStyle;
}

/**
 * O que o agente está tentando conseguir.
 *
 * Não é enfeite de configuração: muda o critério de encerramento. Um agente de
 * `qualificar` termina com dados coletados e transferência; um de `resolver`
 * termina quando o contato diz que está resolvido.
 */
export type AgentObjective =
  | "resolver"
  | "qualificar"
  | "agendar"
  | "triar"
  | "coletar_documento"
  | "reativar"
  | "acompanhar_pedido"
  | "pesquisar_satisfacao";

export const AGENT_OBJECTIVE_LABEL: Record<AgentObjective, string> = {
  resolver: "Resolver a dúvida",
  qualificar: "Qualificar o lead",
  agendar: "Agendar conversa",
  triar: "Triar e encaminhar",
  coletar_documento: "Coletar documento ou dado",
  reativar: "Reativar quem sumiu",
  acompanhar_pedido: "Acompanhar uma solicitação em andamento",
  pesquisar_satisfacao: "Ouvir a experiência do cliente",
};

export const AGENT_OBJECTIVE_HINT: Record<AgentObjective, string> = {
  resolver:
    "Termina quando o contato confirma que resolveu — ou quando o agente conclui que não vai.",
  qualificar: "Termina com os dados de qualificação coletados e o lead entregue ao comercial.",
  agendar: "Termina com data e horário combinados e o retorno registrado.",
  triar: "Termina identificando o assunto e entregando à fila certa, sem tentar resolver.",
  coletar_documento:
    "Termina quando a pessoa entrega o que faltava, ou combina quando entrega. Um item por vez, sem lista intimidadora.",
  reativar:
    "Termina reaquecendo quem parou de responder. Uma tentativa, sem insistir: quem não quer falar não é convencido por bot.",
  acompanhar_pedido:
    "Termina informando o estado de algo já aberto. Não abre caso novo — se aparecer outro assunto, transfere.",
  pesquisar_satisfacao:
    "Termina com a nota e, quando houver, o motivo. Nota baixa não vira defesa do escritório: vira transferência.",
};

export interface AgentMission {
  objective: AgentObjective;
  /** O que este agente atende. Vira o escopo declarado no prompt. */
  scope: string[];
  /** O que ele explicitamente não atende — e transfere ao encontrar. */
  outOfScope: string[];
  /** Como o agente sabe que terminou bem. */
  successCriteria: string;
}

/* Conhecimento --------------------------------------------------------------- */

/**
 * Quanto o agente pode falar além da base.
 *
 * `somente_base` é o modo seguro: sem trecho recuperado, o agente diz que não
 * sabe e transfere. `base_e_oficio` permite usar conhecimento geral de
 * contabilidade para explicar um conceito — mas nunca para afirmar valor,
 * alíquota ou prazo, que é onde erro de IA vira prejuízo do cliente.
 */
export type AgentKnowledgeMode = "somente_base" | "base_e_oficio";

export const AGENT_KNOWLEDGE_MODE_LABEL: Record<AgentKnowledgeMode, string> = {
  somente_base: "Só o que está na base",
  base_e_oficio: "Base mais conhecimento geral do ofício",
};

/**
 * De onde o conteúdo veio.
 *
 * A distinção importa porque cada origem falha de um jeito diferente, e o
 * sintoma precisa ser legível na tela: artigo escrito à mão nunca quebra; link
 * quebra quando a página muda ou sai do ar; arquivo quebra quando o formato não
 * é extraível. Um campo `kind` único evita três listas paralelas.
 */
export type AgentSourceKind = "artigo" | "link" | "arquivo";

export const AGENT_SOURCE_KIND_LABEL: Record<AgentSourceKind, string> = {
  artigo: "Artigo escrito aqui",
  link: "Página da web",
  arquivo: "Arquivo enviado",
};

/**
 * Estado da extração.
 *
 * `processando` é estado honesto, não enfeite: PDF e Word precisam de um
 * extrator que vive no caminho de mídia da seção 11 (upload, antivírus,
 * armazenamento), e esse caminho é back-end. O arquivo é aceito e fica visível
 * com o motivo — o que não pode acontecer é o agente responder como se tivesse
 * lido um documento que ninguém leu.
 */
export type AgentSourceStatus = "pronto" | "processando" | "falhou";

export const AGENT_SOURCE_STATUS_LABEL: Record<AgentSourceStatus, string> = {
  pronto: "Pronto para consulta",
  processando: "Aguardando extração",
  falhou: "Falhou",
};

/** Formatos cuja extração é pura leitura de texto, sem biblioteca externa. */
export const AGENT_TEXT_EXTENSIONS = [".txt", ".md", ".markdown", ".csv", ".tsv", ".json"];

/** Formatos aceitos mas que dependem do extrator do back-end (seção 11). */
export const AGENT_PENDING_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"];

/**
 * Fonte de conhecimento.
 *
 * A indexação com pgvector é da 16.2 e é trabalho de back-end. O que existe
 * aqui é o cadastro da fonte e o texto já extraído — suficiente para o agente
 * responder e citar, e o que muda quando o RAG real entrar é de onde o trecho
 * vem, não o contrato.
 */
export interface AgentKnowledgeSource {
  id: Id;
  kind: AgentSourceKind;
  title: string;
  /** Assuntos que esta fonte cobre, usados na recuperação. */
  topics: string[];
  /** Texto extraído. Vazio enquanto o estado for `processando` ou `falhou`. */
  body: string;
  status: AgentSourceStatus;
  /** Endereço original, em `link`. É o que o agente cita e o que se reprocessa. */
  url?: string;
  /** Nome do arquivo enviado, em `arquivo`. */
  fileName?: string;
  sizeBytes?: number;
  /** Quando o conteúdo foi lido da origem — não quando o cadastro mudou. */
  fetchedAt?: IsoDateTime;
  /** Motivo em `falhou`, ou o que falta em `processando`. */
  statusReason?: string;
  updatedAt: IsoDateTime;
}

export interface AgentKnowledge {
  mode: AgentKnowledgeMode;
  sourceIds: Id[];
  /** Se a resposta ao contato cita de qual artigo veio. */
  citeSources: boolean;
}

/* Ferramentas ---------------------------------------------------------------- */

/**
 * Ferramentas que um agente pode usar.
 *
 * O catálogo é fechado pelo mesmo motivo de `AiProposalField`: se o modelo
 * pudesse nomear qualquer ferramenta, a aplicação teria de decidir em tempo de
 * execução o que fazer com `cancelar_contrato` — e a resposta certa seria
 * recusar. Ferramenta nova entra aqui, no executor e no prompt, nos três
 * lugares, conscientemente.
 *
 * Os identificadores repetem os que o bloco de IA do Chatbot Builder já
 * declarava em `node.config.acoes` — aquele contrato de interface estava
 * esperando exatamente esta execução.
 */
export type AgentToolId =
  | "consultar_crm"
  | "buscar_conhecimento"
  | "consultar_horario"
  | "criar_tarefa"
  | "agendar_retorno"
  | "atualizar_cadastro"
  | "mover_etapa";

/**
 * Leitura ou escrita.
 *
 * A distinção é a que decide se a aplicação executa sozinha. Leitura devolve
 * dado que o agente já poderia ver de outra forma; escrita altera o CRM, e a
 * seção 16.4 pede confirmação humana para ação de impacto. Errar uma leitura
 * custa uma resposta ruim; errar uma escrita custa um cadastro corrompido que
 * ninguém sabe quando corrompeu.
 */
export type AgentToolImpact = "leitura" | "escrita";

export interface AgentToolSpec {
  id: AgentToolId;
  label: string;
  description: string;
  impact: AgentToolImpact;
  /** Descrição dos parâmetros, literal no prompt. */
  params: string;
  /** Rótulo do que aconteceria, usado no cartão de confirmação. */
  effect: string;
}

export const AGENT_TOOLS: AgentToolSpec[] = [
  {
    id: "consultar_crm",
    label: "Consultar o CRM",
    description: "Ler cadastro, empresa, negócio em aberto e tarefas do contato.",
    impact: "leitura",
    params: "`campo`: um de `cadastro`, `negocio`, `tarefas`.",
    effect: "Lê dados do contato",
  },
  {
    id: "buscar_conhecimento",
    label: "Buscar na base de conhecimento",
    description: "Procurar a resposta nos artigos publicados em vez de improvisar.",
    impact: "leitura",
    params: "`consulta`: a pergunta em palavras-chave, sem frase inteira.",
    effect: "Consulta os artigos publicados",
  },
  {
    id: "consultar_horario",
    label: "Consultar horário de atendimento",
    description: "Saber se há gente disponível agora antes de prometer transferência.",
    impact: "leitura",
    params: "Nenhum.",
    effect: "Verifica o expediente",
  },
  {
    id: "criar_tarefa",
    label: "Criar tarefa",
    description: "Abrir tarefa para o consultor quando o caso exigir uma pessoa.",
    impact: "escrita",
    params: "`titulo`: no imperativo. `prazo`: data ISO com fuso -03:00.",
    effect: "Cria uma tarefa para o responsável",
  },
  {
    id: "agendar_retorno",
    label: "Agendar retorno",
    description: "Registrar o horário combinado com o contato.",
    impact: "escrita",
    params: "`quando`: data e hora ISO com fuso -03:00. `assunto`: uma linha.",
    effect: "Agenda um retorno na agenda do responsável",
  },
  {
    id: "atualizar_cadastro",
    label: "Atualizar cadastro",
    description: "Gravar dado que o contato informou e o cadastro não tem.",
    impact: "escrita",
    params: "`campo`: caminho do catálogo. `valor`: como o contato escreveu.",
    effect: "Grava um dado no cadastro do contato",
  },
  {
    id: "mover_etapa",
    label: "Mover etapa do funil",
    description: "Avançar ou recuar o negócio quando a conversa deixar claro.",
    impact: "escrita",
    params: "`etapa`: nome da etapa de destino.",
    effect: "Move o negócio de etapa",
  },
];

export function agentTool(id: AgentToolId): AgentToolSpec | undefined {
  return AGENT_TOOLS.find((tool) => tool.id === id);
}

/**
 * Política de uma ferramenta neste agente.
 *
 * `requiresConfirmation` existe separado de `impact` porque são coisas
 * diferentes: o impacto é do verbo, a confirmação é da política. O padrão de
 * fábrica liga a confirmação em toda escrita, e desligá-la é decisão explícita
 * de quem configura — registrada na versão, portanto auditável.
 */
export interface AgentToolPolicy {
  toolId: AgentToolId;
  enabled: boolean;
  requiresConfirmation: boolean;
}

/* Transferência -------------------------------------------------------------- */

/**
 * Regra de encaminhamento.
 *
 * `when` é descrição em linguagem natural porque é o modelo que decide a
 * correspondência — o que a 26.4 chama de "intents híbridas". A fila, essa, é
 * identificador: o modelo escolhe o motivo, a aplicação resolve o destino. Sem
 * essa separação o modelo poderia inventar uma fila que não existe.
 */
export interface AgentHandoffRule {
  id: Id;
  when: string;
  queueId: Id;
}

/**
 * Como o destino da transferência é decidido.
 *
 * `regras` é o modo previsível: alguém escreveu a condição, e fora dela tudo cai
 * na fila padrão. Funciona enquanto os assuntos são poucos e conhecidos — e para
 * de funcionar exatamente quando o atendimento cresce, porque a lista de regras
 * vira manutenção e o que não foi previsto some na fila padrão.
 *
 * `automatico` inverte: o agente recebe o catálogo de filas com a descrição de
 * cada uma e escolhe pela **necessidade que identificou**, sem regra escrita.
 * Custa previsibilidade e ganha cobertura.
 *
 * `hibrido` é o que quase sempre se quer: as regras valem primeiro, porque são
 * as decisões que alguém já tomou de propósito, e o que nenhuma cobre vai para a
 * escolha do modelo em vez de cair no genérico. A fila padrão deixa de ser
 * depósito do imprevisto e vira último recurso de verdade.
 *
 * Nos três modos o identificador escolhido é **validado contra o catálogo** pela
 * aplicação: o modelo escolhe o motivo, quem resolve o destino é o código.
 */
export type AgentRoutingMode = "regras" | "automatico" | "hibrido";

export const AGENT_ROUTING_LABEL: Record<AgentRoutingMode, string> = {
  regras: "Só pelas regras escritas",
  automatico: "A IA identifica e escolhe o setor",
  hibrido: "Regras primeiro, IA no que sobrar",
};

export const AGENT_ROUTING_HINT: Record<AgentRoutingMode, string> = {
  regras:
    "Previsível: só encaminha pelo que está escrito abaixo. O que nenhuma regra cobre cai na fila padrão.",
  automatico:
    "O agente lê a descrição de cada fila e escolhe pela necessidade. Cobre o imprevisto; exige descrição de fila bem escrita.",
  hibrido:
    "As regras valem primeiro. O que nenhuma cobre, o agente decide pelo catálogo em vez de cair no genérico.",
};

export interface AgentHandoff {
  routing: AgentRoutingMode;
  rules: AgentHandoffRule[];
  /**
   * Filas que o agente pode escolher no modo automático.
   *
   * Lista vazia significa **todas** as filas da organização. É allowlist de
   * destino, e existe pelo mesmo motivo da allowlist de ferramenta: um agente de
   * matrículas escolhendo a fila do financeiro não é roteamento inteligente, é
   * conversa perdida.
   */
  queueIds: Id[];
  /** Destino quando nenhuma regra casa e o agente precisa sair. */
  defaultQueueId: Id;
  /**
   * Resumo do handoff (seção 10, linha "Continuidade": "handoff com resumo").
   *
   * Sem ele o atendente recebe uma conversa de quinze mensagens e relê tudo —
   * que é exatamente o custo que o agente deveria ter poupado.
   */
  summarize: boolean;
  /** Transfere quando o agente não tem confiança, em vez de responder no chute. */
  transferOnUncertainty: boolean;
  /** Transfere quando o contato pede pessoa, mesmo que o agente saiba responder. */
  transferOnRequest: boolean;
}

/* Limites e guardas ---------------------------------------------------------- */

/**
 * Freios do laço.
 *
 * Um agente sem teto de turno conversa para sempre com quem responde "ok" —
 * e cada turno é uma chamada paga. O teto de ferramenta existe pelo motivo
 * oposto: laço de consulta que nunca converge, com o modelo pedindo a mesma
 * busca de novo porque não gostou do resultado.
 */
export interface AgentLimits {
  maxTurns: number;
  maxToolCallsPerTurn: number;
  /** Teto de custo por conversa, em centavos de dólar — a unidade de `AiRunMeta`. */
  costCeilingCents: number;
  replyTimeoutSeconds: number;
  channels: ChannelKind[];
}

export interface AgentGuards {
  /** Assuntos que o agente recusa e encaminha, mesmo sabendo responder. */
  forbiddenTopics: string[];
  /** Dados que o agente nunca pede — senha, código do gov.br, cartão. */
  neverAsk: string[];
  /** O que o agente diz quando não sabe. Antes de transferir. */
  fallbackMessage: string;
  /** 0 a 100. Abaixo disso o turno não vira resposta: vira transferência. */
  confidenceFloor: number;
}

/* Avaliação ------------------------------------------------------------------ */

/**
 * Caso do conjunto de avaliação (seção 16.4).
 *
 * O conjunto roda antes de publicar. É o que permite responder "o prompt novo
 * melhorou ou piorou?" com evidência em vez de impressão — a pergunta que
 * ninguém consegue responder sem isto.
 */
export interface AgentEvalCase {
  id: Id;
  /** O que o contato diz. */
  input: string;
  /** O que se espera que o agente faça. */
  expect: {
    action: AgentActionKind;
    /** Ferramenta esperada, quando a ação é `usar_ferramenta`. */
    toolId?: AgentToolId;
    /** Fila esperada, quando a ação é `transferir`. */
    queueId?: Id;
    /** Palavras que a resposta precisa conter — nome de imposto, prazo, condição. */
    mustMention?: string[];
    /** Palavras que a resposta não pode conter — promessa, valor inventado. */
    mustAvoid?: string[];
  };
  note?: string;
}

/**
 * O que uma verificação do caso conferiu.
 *
 * Granular de propósito. Um caso que passa na ação e falha em `mustAvoid` não é
 * "reprovado" e pronto: é um agente que roteou certo e vazou um valor no texto —
 * dois defeitos de gravidade muito diferente, e agregar os dois num booleano
 * apagaria justamente a informação que faz corrigir o prompt.
 */
export type AgentCheckKind = "acao" | "ferramenta" | "fila" | "mencao" | "proibicao";

export const AGENT_CHECK_LABEL: Record<AgentCheckKind, string> = {
  acao: "Ação",
  ferramenta: "Ferramenta",
  fila: "Fila de destino",
  mencao: "Citou o que devia",
  proibicao: "Não citou o proibido",
};

export interface AgentEvalCheck {
  kind: AgentCheckKind;
  passed: boolean;
  expected: string;
  actual: string;
}

export interface AgentEvalCaseResult {
  caseId: Id;
  input: string;
  passed: boolean;
  checks: AgentEvalCheck[];
  /** O que o agente respondeu, para leitura humana quando o caso reprova. */
  reply: string;
  rationale?: string;
  confidence: number;
  costUsdCents: number;
  latencyMs: number;
  /** Preenchido quando o turno nem chegou a rodar. */
  error?: string;
}

/**
 * Resultado de uma rodada do conjunto (seção 16.4).
 *
 * `promptVersion` viaja junto porque o resultado só significa alguma coisa
 * atrelado à versão do prompt que o produziu — é o que permite dizer "a v2
 * passou 8 de 10 e a v3 passou 6" em vez de "pioraram as respostas".
 */
export interface AgentEvalRun {
  agentId: Id;
  versionId: Id;
  promptVersion: string;
  model: string;
  passed: number;
  total: number;
  costUsdCents: number;
  results: AgentEvalCaseResult[];
  occurredAt: IsoDateTime;
}

/* Avaliação do atendimento --------------------------------------------------- */

/**
 * Pesquisa de satisfação ao fim da conversa.
 *
 * Seção 17 nomeia `satisfaction_surveys`; a seção 10 lista "avaliação do
 * cliente" entre os requisitos de qualidade. Aqui ela serve a duas coisas ao
 * mesmo tempo: mede o atendimento e mede **o agente** — sem ela, "resolvido pela
 * IA" é uma contagem de conversas que não foram transferidas, o que não é a
 * mesma coisa que conversas bem resolvidas.
 *
 * A escala é de 1 a 5 e não de 0 a 10 porque o visitante responde no widget, com
 * o polegar, numa linha só. NPS de onze botões não cabe e não é respondido.
 */
export interface SatisfactionSurvey {
  id: Id;
  /** Sessão de webchat ou conversa que originou a pesquisa. */
  conversationRef: string;
  score: number;
  comment?: string;
  /** Quem conduzia quando a pesquisa foi respondida. */
  handledBy: "agente_ia" | "humano";
  agentId?: Id;
  answeredAt: IsoDateTime;
}

export const SATISFACTION_LABEL: Record<number, string> = {
  1: "Péssimo",
  2: "Ruim",
  3: "Regular",
  4: "Bom",
  5: "Ótimo",
};

/* Versão e agente ------------------------------------------------------------ */

export interface AiAgentVersion {
  id: Id;
  agentId: Id;
  version: number;
  status: FlowStatus;
  publishedAt?: IsoDateTime;
  publishedBy?: Id;
  changeNote: string;
  identity: AgentIdentity;
  mission: AgentMission;
  knowledge: AgentKnowledge;
  tools: AgentToolPolicy[];
  handoff: AgentHandoff;
  limits: AgentLimits;
  guards: AgentGuards;
  evaluation: AgentEvalCase[];
}

/**
 * Métricas por agente (seção 16.4: "precisão, resolução, transferência, custo,
 * latência, aceitação da sugestão e incidentes").
 *
 * `resolvedPct` e `handoffPct` não somam 100: existe a conversa abandonada, que
 * é a que mais interessa quando cresce — o contato saiu sem resposta e sem
 * atendente.
 */
export interface AgentStats {
  conversations30d: number;
  resolvedPct: number;
  handoffPct: number;
  abandonedPct: number;
  avgTurns: number;
  /** Custo médio por conversa, em centavos de dólar. */
  avgCostCents: number;
  medianFirstReplySeconds: number;
  csat: number;
}

export interface AiAgent extends BaseEntity {
  name: string;
  description: string;
  /** Pausado continua publicado, mas não recebe conversa nova. */
  status: "ativo" | "pausado";
  ownerId: Id;
  activeVersionId?: Id;
  draftVersionId: Id;
  versions: AiAgentVersion[];
  stats: AgentStats;
}

export function agentVersion(agent: AiAgent, versionId?: Id): AiAgentVersion | undefined {
  return agent.versions.find((version) => version.id === versionId);
}

/** A versão que atende de verdade. Rascunho só roda no simulador. */
export function activeAgentVersion(agent: AiAgent): AiAgentVersion | undefined {
  return agentVersion(agent, agent.activeVersionId);
}

/* Validação ------------------------------------------------------------------ */

/**
 * Achado da checagem que roda antes de publicar.
 *
 * Mesma forma da validação de fluxo, e-mail e widget. O que bloqueia aqui foi
 * escolhido pelo dano em produção: agente sem saída para humano deixa o contato
 * preso, e agente sem fonte de conhecimento no modo restrito não consegue
 * responder nada — os dois só apareceriam na frente do cliente.
 */
export interface AgentValidationIssue {
  id: string;
  rule: string;
  severity: "erro" | "alerta";
  message: string;
}

/* Execução ------------------------------------------------------------------- */

/**
 * O que o modelo decide num turno.
 *
 * Uma ação por turno de propósito. Deixar o modelo encadear "usa a ferramenta,
 * depois responde, depois transfere" numa só saída tornaria impossível
 * interromper no meio — e é justamente no meio que a aplicação precisa recusar
 * uma ferramenta fora da lista.
 */
export type AgentActionKind = "responder" | "usar_ferramenta" | "transferir" | "encerrar";

export const AGENT_ACTION_LABEL: Record<AgentActionKind, string> = {
  responder: "Responder",
  usar_ferramenta: "Usar ferramenta",
  transferir: "Transferir",
  encerrar: "Encerrar",
};

/** Como um passo do rastro terminou. */
export type AgentStepStatus = "ok" | "recusado" | "pendente" | "falha";

/**
 * Um passo do rastro.
 *
 * É o "tracing" que qualquer construtor de agente sério oferece, e aqui é mais
 * exigível que em produto genérico: sem ele, depurar um agente vira adivinhação
 * sobre por que ele respondeu aquilo. Cada passo diz o que foi decidido, com
 * que parâmetro, o que voltou e quanto custou.
 */
export interface AgentTraceStep {
  index: number;
  action: AgentActionKind;
  status: AgentStepStatus;
  /** Ferramenta pedida, quando a ação foi `usar_ferramenta`. */
  toolId?: AgentToolId;
  params?: Record<string, string>;
  /** O que a aplicação devolveu ao modelo, ou o motivo da recusa. */
  result?: string;
  /** Raciocínio curto que o modelo declarou. Não é o texto enviado ao contato. */
  rationale?: string;
  confidence: number;
  meta?: AiRunMeta;
}

/**
 * Escrita que o modelo pediu e uma pessoa precisa confirmar.
 *
 * Atravessa a fronteira como **dado**, igual à proposta da tabulação: o agente
 * segue a conversa dizendo o que vai encaminhar, e o efeito só existe depois do
 * clique de alguém no Inbox. É o que a 16.4 chama de confirmação humana para
 * ação de impacto.
 */
export interface AgentPendingAction {
  id: Id;
  toolId: AgentToolId;
  label: string;
  params: Record<string, string>;
  /** Trecho da conversa que sustenta o pedido. Sem ele não há como conferir. */
  evidence: string;
  requestedAt: IsoDateTime;
}

export interface AgentHandoffResult {
  queueId: Id;
  reason: string;
  /** Resumo para quem assume, quando `handoff.summarize` está ligado. */
  summary?: string;
}

/**
 * Resultado de um turno completo — já com o laço de ferramentas resolvido.
 *
 * `reply` pode ser vazio quando o turno terminou em transferência sem despedida.
 * `ended` marca o fim da participação do agente, seja por encerramento, seja
 * por transferência, seja por limite estourado.
 */
export interface AgentTurnResult {
  reply: string;
  steps: AgentTraceStep[];
  pending: AgentPendingAction[];
  handoff?: AgentHandoffResult;
  ended: boolean;
  /** Custo acumulado do turno, somando todas as chamadas do laço. */
  costUsdCents: number;
  meta: AiRunMeta;
}

/** Mensagem da conversa, como o agente a enxerga. */
export interface AgentConversationMessage {
  role: "contato" | "agente";
  body: string;
  at: IsoDateTime;
}

export interface AgentRunInput {
  agentId: Id;
  /** Rascunho em vez da versão publicada — só o simulador usa. */
  versionId?: Id;
  channel: ChannelKind;
  contactName: string;
  /** O que já se sabe do contato antes da conversa (formulário, cadastro). */
  contactFacts?: string[];
  messages: AgentConversationMessage[];
  /** Passos já executados na conversa, para o agente não repetir consulta. */
  previousSteps?: AgentTraceStep[];
  /**
   * Se há gente disponível agora.
   *
   * Vem de quem chamou porque é o canal que sabe: o widget tem o horário do
   * webchat, e o número tem o do WhatsApp. Sem isso o agente prometeria
   * transferência imediata às onze da noite.
   */
  withinBusinessHours?: boolean;
  /** Custo já gasto nesta conversa, para o teto valer por conversa e não por turno. */
  spentUsdCents?: number;
}
