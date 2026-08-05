/**
 * Montagem do contexto enviado ao copiloto.
 *
 * Função pura, fora de componente, por dois motivos: é ela que decide **o que a
 * IA vê**, e essa decisão merece ser lida em um lugar só; e é o ponto onde a
 * minimização de dado acontece de fato (seção 16.4 do plano). O que não é
 * montado aqui não chega ao provedor.
 *
 * Fica de fora, deliberadamente: identificador interno de contato, empresa e
 * conversa; telefone e e-mail; documento; campos de auditoria; e o binário de
 * qualquer anexo. O modelo precisa do caso, não do cadastro — e uma sugestão de
 * resposta não fica melhor por conhecer o CPF de quem a receberá.
 *
 * A tabulação parecia contradizer isso, e não contradiz: para propor "o CPF que
 * o cliente acabou de mandar não está no cadastro", o modelo precisa saber que a
 * lacuna existe, não qual valor ocuparia. `fieldStates` viaja **presença**, e o
 * conteúdo continua sem sair daqui.
 */

import type {
  AiContextMessage,
  AiConversationContext,
  AiFieldState,
  Company,
  Contact,
  Conversation,
  InternalNote,
  Message,
  Queue,
  Tag,
  User,
} from "@crm/core";
import { CONVERSATION_STATE_LABEL, LIFECYCLE_LABEL, formatCurrencyCents } from "@crm/core";

/**
 * Fatos do contato que mudam a resposta correta.
 *
 * A resposta certa sobre apuração depende do regime tributário, e o tom certo
 * depende de o contato ser cliente de cinco anos ou visitante que apareceu hoje.
 * Nome de empresa entra porque o atendente escreve "a {empresa}" na resposta.
 *
 * Os campos personalizados vão inteiros: é onde a organização guarda regime,
 * porte e sistema contábil, e enumerar chaves aqui significaria que cada campo
 * novo exigiria mexer neste arquivo para o copiloto passar a considerá-lo.
 */
function contactFacts(input: {
  contact?: Contact;
  company?: Company;
  tagById: Map<string, Tag>;
  openDealsCents?: number;
}): string[] {
  const facts: string[] = [];
  const { contact, company, tagById } = input;

  if (!contact) return facts;

  facts.push(`etapa do ciclo: ${LIFECYCLE_LABEL[contact.lifecycleStage]}`);
  if (contact.jobTitle) facts.push(`cargo: ${contact.jobTitle}`);
  if (company) {
    facts.push(`empresa: ${company.name}`);
    if (company.segment) facts.push(`segmento: ${company.segment}`);
  }

  const place = [contact.city ?? company?.city, contact.state ?? company?.state]
    .filter(Boolean)
    .join("/");
  if (place) facts.push(`cidade: ${place}`);

  for (const field of contact.customFields) {
    if (field.value) facts.push(`${field.label.toLowerCase()}: ${field.value}`);
  }

  const tags = contact.tagIds.map((id) => tagById.get(id)?.name).filter(Boolean);
  if (tags.length > 0) facts.push(`marcadores: ${tags.join(", ")}`);

  if (input.openDealsCents && input.openDealsCents > 0) {
    facts.push(`negócios em aberto: ${formatCurrencyCents(input.openDealsCents)}`);
  }

  return facts;
}

/**
 * Lacunas do cadastro, para a tabulação.
 *
 * Campos pessoais (documento, telefone, e-mail) vão só como preenchido/vazio. Os
 * demais levam o valor atual porque é ele que evita proposta redundante: sem
 * saber que a cidade já é "Campinas", o modelo proporia "Campinas" de novo a
 * cada análise, e a lista de tabulação viraria ruído permanente.
 *
 * Os campos personalizados entram inteiros a partir do próprio contato — assim
 * um campo novo criado pela organização passa a ser tabulável sem tocar aqui.
 */
function fieldStates(contact?: Contact): AiFieldState[] {
  if (!contact) return [];

  const states: AiFieldState[] = [
    {
      field: "contato.documento",
      label: "CPF ou CNPJ",
      filled: contact.identifiers.some((item) => item.kind === "cpf"),
    },
    { field: "contato.telefone", label: "Telefone", filled: Boolean(contact.phone) },
    { field: "contato.email", label: "E-mail", filled: Boolean(contact.email) },
    {
      field: "contato.cargo",
      label: "Cargo",
      filled: Boolean(contact.jobTitle),
      sample: contact.jobTitle,
    },
    {
      field: "contato.cidade",
      label: "Cidade",
      filled: Boolean(contact.city),
      sample: contact.city,
    },
    {
      field: "contato.estado",
      label: "UF",
      filled: Boolean(contact.state),
      sample: contact.state,
    },
  ];

  for (const field of contact.customFields) {
    // Campo derivado é calculado pelo sistema; propor valor para ele seria propor
    // sobrescrever um cálculo com um palpite (seção 27.2).
    if (field.derived) continue;
    states.push({
      field: `campo.${field.key}`,
      label: field.label,
      filled: isFilled(field.value),
      sample: isFilled(field.value) ? field.value : undefined,
    });
  }

  return states;
}

/**
 * "Não informado" é lacuna, não valor.
 *
 * Formulário e importação preenchem campo obrigatório com marcador de ausência,
 * e o cadastro passa a parecer completo sem estar. Tratá-los como preenchidos
 * faria o copiloto calar justamente onde ele mais serve: o cliente acaba de
 * dizer o regime tributário, e a proposta não aparece porque o campo "já tem
 * valor".
 */
const PLACEHOLDERS = new Set([
  "não informado",
  "nao informado",
  "n/a",
  "na",
  "-",
  "--",
  "sem informação",
  "sem informacao",
  "desconhecido",
  "a definir",
]);

function isFilled(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return Boolean(normalized) && !PLACEHOLDERS.has(normalized!);
}

/**
 * Ordena mensagens e notas em uma só linha do tempo.
 *
 * A nota interna vai junto, marcada como interna. Ela carrega o que o time sabe
 * e o cliente não — "duas parcelas em aberto, verificar antes de prometer
 * prazo" muda completamente a resposta certa. Omiti-la produziria um copiloto
 * que sugere o que um colega experiente jamais sugeriria. O prompt é explícito
 * sobre a natureza dessas linhas para que não vazem para o texto do cliente.
 */
function timeline(messages: Message[], notes: InternalNote[]): AiContextMessage[] {
  const items: Array<{ at: string; entry: AiContextMessage }> = [
    ...messages.map((message) => ({
      at: message.occurredAt,
      entry: {
        role:
          message.authorKind === "contato"
            ? ("contato" as const)
            : message.authorKind === "bot"
              ? ("bot" as const)
              : ("agente" as const),
        author: message.authorLabel,
        body: message.body,
        at: message.occurredAt,
        attachments: message.attachments?.map((attachment) => attachment.fileName),
      } satisfies AiContextMessage,
    })),
    ...notes.map((note) => ({
      at: note.occurredAt,
      entry: {
        role: "nota_interna" as const,
        author: note.authorLabel,
        body: note.body,
        at: note.occurredAt,
      } satisfies AiContextMessage,
    })),
  ];

  return items.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).map((item) => item.entry);
}

export function buildConversationContext(input: {
  conversation: Conversation;
  contact?: Contact;
  company?: Company;
  queue?: Queue;
  currentUser: User;
  messages: Message[];
  notes: InternalNote[];
  tagById: Map<string, Tag>;
  openDealsCents?: number;
}): AiConversationContext {
  return {
    conversationId: input.conversation.id,
    channel: input.conversation.channel,
    subject: input.conversation.subject,
    queue: input.queue?.name ?? "sem fila",
    state: CONVERSATION_STATE_LABEL[input.conversation.state],
    contactName: input.contact?.fullName ?? "Cliente",
    contactFacts: contactFacts({
      contact: input.contact,
      company: input.company,
      tagById: input.tagById,
      openDealsCents: input.openDealsCents,
    }),
    fieldStates: fieldStates(input.contact),
    agentName: input.currentUser.name,
    messages: timeline(input.messages, input.notes),
  };
}

/**
 * Assinatura do estado da conversa.
 *
 * O cache do copiloto é por conversa, mas invalidar só na troca de conversa
 * deixaria o resumo desatualizado assim que uma mensagem nova entra — e um
 * resumo velho é pior que resumo nenhum, porque parece atual. A assinatura
 * muda quando o conteúdo muda, e é isso que dispara a oferta de reanalisar.
 */
export function contextSignature(context: AiConversationContext): string {
  const last = context.messages[context.messages.length - 1];
  return `${context.conversationId}:${context.messages.length}:${last?.at ?? ""}`;
}
