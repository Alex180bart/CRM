import type { BotFlow, FlowRunState, WebchatWidget, WebchatWidgetVersion } from "@crm/core";
import {
  BOT_RUN_OPTIONS,
  answerFlow,
  isWithinSchedule,
  now,
  offsetIso,
  repositories,
  startFlow,
} from "@crm/core";

/**
 * Servidor do webchat.
 *
 * É o que torna o widget funcional de verdade: resolve a configuração pela
 * chave pública, decide se o domínio pode carregar, guarda a sessão do visitante
 * e executa o fluxo de chatbot com o **mesmo** runtime do simulador.
 *
 * ## O que este armazenamento é e o que não é
 *
 * Um `Map` de módulo. Vive enquanto o processo vive, não é compartilhado entre
 * réplicas e some no reinício. É honesto para o estado atual do repositório —
 * não há Supabase nem fila — e suficiente para o ciclo completo funcionar: o
 * visitante escreve, o fluxo responde, a conversa aparece no Inbox.
 *
 * Quando o back-end entrar, o que troca é o corpo destas funções. A fronteira
 * HTTP e o widget continuam valendo.
 */

export interface WebchatMessage {
  id: string;
  role: "visitante" | "bot" | "agente" | "sistema";
  body: string;
  occurredAt: string;
}

export interface WebchatSession {
  id: string;
  widgetId: string;
  versionId: string;
  /** Domínio de onde a sessão foi aberta — entra na conversa como procedência. */
  origin: string;
  startedAt: string;
  /** Instante ancorado, para exibição — é o que a interface mostra. */
  lastActivityAt: string;
  /**
   * Último toque no relógio **real**, só para a expiração.
   *
   * `lastActivityAt` usa o instante ancorado do produto (`offsetIso`), que é o
   * que a interface exibe. Medir tempo decorrido com ele foi o erro que apagava
   * toda sessão na chamada seguinte: o carimbo ancorado fica no passado em
   * relação a `Date.now()`, e a varredura considerava tudo vencido no ato.
   * Expiração é tempo real; exibição é tempo ancorado. São dois relógios, e
   * misturá-los quebra em silêncio.
   */
  touchedAtMs: number;
  messages: WebchatMessage[];
  /** Respostas do formulário anterior à conversa, já mapeadas. */
  prechat: Record<string, string>;
  /** Estado do fluxo, quando há chatbot. */
  flow: FlowRunState | null;
  /** Verdadeiro quando o fluxo terminou e a conversa espera humano. */
  handedOff: boolean;
  /** Fila que recebeu a conversa. */
  queueId: string;
  visitorName?: string;
}

/**
 * O armazenamento precisa sobreviver ao recarregamento de módulo do `next dev`.
 * Sem o `globalThis`, cada edição de arquivo esvaziaria as sessões abertas e o
 * widget perderia a conversa no meio — sintoma que parece defeito do produto.
 */
const globalStore = globalThis as unknown as {
  __webchatSessions?: Map<string, WebchatSession>;
};

const sessions = (globalStore.__webchatSessions ??= new Map<string, WebchatSession>());

/** Sessão parada há mais de duas horas não volta; deixá-la vaza memória. */
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

function sweep(): void {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, session] of sessions) {
    if (session.touchedAtMs < cutoff) sessions.delete(id);
  }
}

/** Marca atividade nos dois relógios de uma vez, para não haver como esquecer um. */
function touch(session: WebchatSession): void {
  session.lastActivityAt = offsetIso({});
  session.touchedAtMs = Date.now();
}

/* Resolução do widget ------------------------------------------------------- */

export interface ResolvedWidget {
  widget: WebchatWidget;
  version: WebchatWidgetVersion;
}

/**
 * Encontra o widget pela chave pública e devolve a **versão publicada**.
 *
 * Rascunho nunca é servido ao visitante: é essa regra que dá sentido à
 * publicação. Quem quer ver o rascunho usa a prévia do editor.
 */
export async function resolveByKey(embedKey: string): Promise<ResolvedWidget | null> {
  const widgets = await repositories.webchat.list();
  const widget = widgets.find((item) => item.embedKey === embedKey);
  if (!widget) return null;

  const version = widget.versions.find((item) => item.id === widget.activeVersionId);
  if (!version) return null;

  return { widget, version };
}

/**
 * O domínio da página pode carregar este widget?
 *
 * Compara o **host** da origem, não a string inteira: a lista guarda
 * `contabilidadefacilitada.com`, e a origem chega como
 * `https://contabilidadefacilitada.com`. Subdomínio autorizado explicitamente
 * conta; subdomínio arbitrário de um domínio autorizado não — permitir
 * `qualquer.site.com` porque `site.com` está na lista abriria a porta que a
 * lista existe para fechar.
 *
 * Sem origem (`null`) a resposta é liberar: é o caso da própria prévia do editor,
 * que roda no nosso domínio, e de requisição sem cabeçalho de origem.
 */
export function isOriginAllowed(widget: WebchatWidget, origin: string | null): boolean {
  if (!origin) return true;

  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }

  // O próprio host do CRM sempre pode: é onde a prévia e o quadro vivem.
  if (host === "localhost" || host === "127.0.0.1") return true;

  return widget.allowedDomains.some((domain) => domain.toLowerCase() === host);
}

/* Configuração pública ------------------------------------------------------ */

/**
 * O que o widget precisa saber para se desenhar.
 *
 * Deliberadamente magro: nada de identificador interno, nada de fila, nada de
 * estatística. O que sai daqui vai para o HTML de um site de terceiro, e o que
 * não é enviado não vaza.
 */
export interface WebchatPublicConfig {
  widgetId: string;
  versionId: string;
  appearance: WebchatWidgetVersion["appearance"];
  messages: WebchatWidgetVersion["messages"];
  privacy: WebchatWidgetVersion["privacy"];
  prechatEnabled: boolean;
  prechatFields: WebchatWidgetVersion["behavior"]["prechatFields"];
  /** Está dentro do horário de atendimento agora? */
  open: boolean;
  outsideHours: WebchatWidgetVersion["behavior"]["outsideHours"];
  hasBot: boolean;
}

export function publicConfig({ widget, version }: ResolvedWidget): WebchatPublicConfig {
  return {
    widgetId: widget.id,
    versionId: version.id,
    appearance: version.appearance,
    messages: version.messages,
    privacy: version.privacy,
    prechatEnabled: version.behavior.prechatEnabled,
    prechatFields: version.behavior.prechatFields,
    open: isWithinSchedule(version, now()),
    outsideHours: version.behavior.outsideHours,
    hasBot: Boolean(version.behavior.botFlowId),
  };
}

/* Sessão -------------------------------------------------------------------- */

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${sequence.toString(36)}${Math.trunc(performance.now()).toString(36)}`;
}

/**
 * Respostas do formulário viram variáveis do fluxo.
 *
 * É o que faz o formulário deixar de ser teatro. O `mapsTo` do campo já é o
 * caminho canônico (`contato.nome`, `campo.origem_detalhada`), e ele entra como
 * variável com esse nome — assim `{{contato.nome}}` funciona numa mensagem do
 * bot sem ninguém precisar aprender um segundo vocabulário.
 *
 * Os apelidos existem porque o autor do fluxo pensa no assunto, não no caminho
 * do cadastro onde ele foi parar: escrever `{{assunto}}` é o natural, e obrigar
 * `{{campo.origem_detalhada}}` seria vazar detalhe de modelagem para dentro do
 * texto que o visitante lê.
 */
const VARIABLE_ALIASES: Record<string, string> = {
  "contato.nome": "nome",
  "contato.telefone": "telefone",
  "contato.email": "email",
  "campo.origem_detalhada": "assunto",
};

function flowVariables(prechat: Record<string, string>): Record<string, string> {
  const variables: Record<string, string> = {};

  for (const [key, value] of Object.entries(prechat)) {
    if (!value) continue;
    variables[key] = value;
    const alias = VARIABLE_ALIASES[key];
    if (alias) variables[alias] = value;
  }

  return variables;
}

async function publishedFlow(version: WebchatWidgetVersion): Promise<BotFlow | null> {
  if (!version.behavior.botFlowId) return null;
  const flow = await repositories.automations.getBotFlowById(version.behavior.botFlowId);
  return flow ?? null;
}

/** Nós e arestas da versão publicada do fluxo — nunca do rascunho. */
function publishedDocument(flow: BotFlow) {
  const version =
    flow.versions.find((item) => item.id === flow.activeVersionId) ??
    flow.versions.find((item) => item.status === "publicado");
  return version ? { nodes: version.nodes, edges: version.edges } : null;
}

export interface SessionView {
  sessionId: string;
  messages: WebchatMessage[];
  /** Opções de resposta rápida quando o fluxo está esperando escolha. */
  options: Array<{ id: string; label: string }>;
  awaitingAnswer: boolean;
  handedOff: boolean;
  open: boolean;
}

function view(session: WebchatSession, open: boolean): SessionView {
  const awaiting = session.flow?.awaiting;
  return {
    sessionId: session.id,
    messages: session.messages,
    options: awaiting?.options.map((port) => ({ id: port.id, label: port.label })) ?? [],
    awaitingAnswer: Boolean(awaiting),
    handedOff: session.handedOff,
    open,
  };
}

/**
 * Converte os passos do fluxo em mensagens do chat.
 *
 * Passos de sistema — atualizar CRM, requisição HTTP, definir variável — não
 * aparecem para o visitante. Ele não deve ver a máquina funcionando; vê o
 * resultado. Só a transferência é anunciada, porque muda a expectativa de espera.
 */
function messagesFromFlow(state: FlowRunState, alreadyEmitted: number): WebchatMessage[] {
  return state.entries
    .slice(alreadyEmitted)
    .filter((entry) => entry.role === "bot" || (entry.role === "sistema" && entry.kind === "transferir"))
    .map((entry) => ({
      id: `msg_${entry.id}`,
      role: entry.role === "bot" ? ("bot" as const) : ("sistema" as const),
      body:
        entry.role === "bot"
          ? entry.text
          : "Estou passando você para um atendente. Já já alguém responde por aqui.",
      occurredAt: offsetIso({}),
    }));
}

export async function startSession(input: {
  resolved: ResolvedWidget;
  origin: string;
  prechat: Record<string, string>;
}): Promise<SessionView> {
  sweep();

  const { widget, version } = input.resolved;
  const open = isWithinSchedule(version, now());

  const session: WebchatSession = {
    id: nextId("wcs"),
    widgetId: widget.id,
    versionId: version.id,
    origin: input.origin,
    startedAt: offsetIso({}),
    lastActivityAt: offsetIso({}),
    touchedAtMs: Date.now(),
    messages: [],
    prechat: input.prechat,
    flow: null,
    handedOff: false,
    queueId: version.behavior.queueId,
    visitorName: input.prechat["contato.nome"],
  };

  // Fora do horário: o comportamento configurado decide, e nenhum deles é
  // "fingir que está aberto".
  if (!open && version.behavior.outsideHours !== "bot") {
    session.messages.push({
      id: nextId("msg"),
      role: "bot",
      body: version.messages.awayOutside,
      occurredAt: offsetIso({}),
    });
    session.handedOff = version.behavior.outsideHours === "recado";
    sessions.set(session.id, session);
    return view(session, open);
  }

  const flow = await publishedFlow(version);
  const document = flow ? publishedDocument(flow) : null;

  if (document) {
    const state = startFlow(
      document.nodes,
      document.edges,
      BOT_RUN_OPTIONS,
      flowVariables(input.prechat),
    );
    session.flow = state;
    session.messages.push(...messagesFromFlow(state, 0));
    session.handedOff = state.status === "encerrado" || state.status === "limite";
  } else {
    // Sem chatbot, a saudação configurada abre a conversa e o humano assume.
    session.messages.push({
      id: nextId("msg"),
      role: "bot",
      body: version.messages.greeting,
      occurredAt: offsetIso({}),
    });
    session.handedOff = true;
  }

  sessions.set(session.id, session);
  return view(session, open);
}

export async function receiveMessage(input: {
  sessionId: string;
  body: string;
  portId?: string;
}): Promise<SessionView | null> {
  const session = sessions.get(input.sessionId);
  if (!session) return null;

  const resolved = await resolveById(session.widgetId, session.versionId);
  if (!resolved) return null;

  const { version } = resolved;
  const open = isWithinSchedule(version, now());

  session.messages.push({
    id: nextId("msg"),
    role: "visitante",
    body: input.body,
    occurredAt: offsetIso({}),
  });
  touch(session);

  // Fluxo esperando resposta: ele continua o percurso.
  if (session.flow?.awaiting) {
    const flow = await publishedFlow(version);
    const document = flow ? publishedDocument(flow) : null;

    if (document) {
      const emitted = session.flow.entries.length;
      const next = answerFlow(
        session.flow,
        document.nodes,
        document.edges,
        BOT_RUN_OPTIONS,
        input.body,
        input.portId,
      );
      session.flow = next;
      session.messages.push(...messagesFromFlow(next, emitted));
      session.handedOff = next.status === "encerrado" || next.status === "limite";
      sessions.set(session.id, session);
      return view(session, open);
    }
  }

  // Sem fluxo esperando, a mensagem vai para a fila. A confirmação depende do
  // horário: prometer resposta "em instantes" às 23h é promessa que não se cumpre.
  if (!session.handedOff || session.messages.filter((m) => m.role === "visitante").length === 1) {
    session.messages.push({
      id: nextId("msg"),
      role: "bot",
      body: open ? version.messages.awayInside : version.messages.awayOutside,
      occurredAt: offsetIso({}),
    });
  }

  session.handedOff = true;
  sessions.set(session.id, session);
  return view(session, open);
}

export function getSession(sessionId: string): WebchatSession | null {
  return sessions.get(sessionId) ?? null;
}

export async function pollSession(sessionId: string): Promise<SessionView | null> {
  const session = sessions.get(sessionId);
  if (!session) return null;
  const resolved = await resolveById(session.widgetId, session.versionId);
  const open = resolved ? isWithinSchedule(resolved.version, now()) : false;
  return view(session, open);
}

async function resolveById(widgetId: string, versionId: string): Promise<ResolvedWidget | null> {
  const widget = await repositories.webchat.getById(widgetId);
  if (!widget) return null;
  const version = widget.versions.find((item) => item.id === versionId);
  return version ? { widget, version } : null;
}

/* Leitura pelo atendimento -------------------------------------------------- */

/** Resposta do atendente humano, vinda do Inbox. */
export function replyFromAgent(sessionId: string, body: string, authorLabel: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  session.messages.push({
    id: nextId("msg"),
    role: "agente",
    body,
    occurredAt: offsetIso({}),
  });
  touch(session);
  session.visitorName = session.visitorName ?? authorLabel;
  sessions.set(session.id, session);
  return true;
}

/**
 * Sessões que merecem a fila, da mais recente para a mais antiga.
 *
 * O Inbox lê daqui, e o critério é **o visitante ter dado algo de si**: uma
 * mensagem ou o formulário preenchido. Widget aberto e abandonado fica de fora —
 * entupir a fila com eles faria a operação parar de confiar na lista.
 *
 * A primeira versão exigia mensagem, e isso escondia o caso mais valioso: quem
 * informou nome, telefone e assunto e saiu antes de escrever. Esse não é um
 * visitante ocioso, é um lead identificado — e é justamente quem vale a pena
 * chamar de volta.
 */
export function listLiveSessions(): WebchatSession[] {
  sweep();
  return [...sessions.values()]
    .filter(
      (session) =>
        session.messages.some((message) => message.role === "visitante") ||
        Object.keys(session.prechat).length > 0,
    )
    .sort((a, b) => b.touchedAtMs - a.touchedAtMs);
}
