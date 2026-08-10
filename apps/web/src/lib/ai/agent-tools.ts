/**
 * Execução das ferramentas do agente.
 *
 * Seção 16.3, literal: "o modelo apenas propõe a ferramenta e os parâmetros; a
 * aplicação valida permissão, executa a ação e retorna o resultado. A IA nunca
 * recebe uma credencial de banco ou provedor."
 *
 * Este arquivo é essa aplicação. Ele recebe um pedido já saneado pelo Gateway e
 * faz três coisas, nesta ordem, porque a ordem importa:
 *
 * 1. **confere a allowlist da versão** — ferramenta fora dela é recusada, e a
 *    recusa volta ao modelo como texto, não como exceção: o agente precisa
 *    saber que não pode, para dizer outra coisa ao contato em vez de travar;
 * 2. **separa leitura de escrita** — leitura executa; escrita **nunca** executa
 *    aqui, vira `AgentPendingAction` para uma pessoa confirmar (16.4);
 * 3. **devolve texto ao modelo**, nunca objeto de domínio. O que volta é o que
 *    entra no próximo prompt, e um JSON de `Contact` inteiro levaria ao modelo
 *    dado que ele não pediu e não deveria ver.
 *
 * ## Por que escrita não executa nem quando a política diz que pode
 *
 * A política `requiresConfirmation` existe e é respeitada — mas o efeito real
 * (gravar no CRM) depende da camada de escrita, que ainda não existe neste
 * repositório. Enquanto ela não entra, **toda escrita fica pendente**, e o
 * comentário fica aqui para que ninguém "conserte" isso escrevendo em estado
 * local de componente e chamando de gravação.
 */

import type {
  AgentKnowledgeSource,
  AgentPendingAction,
  AgentStepStatus,
  AgentToolId,
  AiAgentVersion,
} from "@elora/core";
import {
  RECURRENCE_SUFFIX,
  agentTool,
  formatCurrencyCents,
  formatDate,
  offsetIso,
  repositories,
  searchKnowledge,
} from "@elora/core";

export interface AgentToolRequest {
  toolId: AgentToolId;
  params: Record<string, string>;
  /** Trecho da conversa que sustenta o pedido — obrigatório em escrita. */
  evidence: string;
}

export interface AgentToolContext {
  version: AiAgentVersion;
  /** Artigos que esta versão do agente pode ler. Já filtrados. */
  knowledge: AgentKnowledgeSource[];
  contactName: string;
  contactId?: string;
  withinBusinessHours?: boolean;
}

export interface AgentToolOutcome {
  status: AgentStepStatus;
  /** O que volta ao modelo no próximo turno. Texto, sempre. */
  result: string;
  pending?: AgentPendingAction;
}

/**
 * Executa — ou recusa — um pedido de ferramenta.
 *
 * Nunca lança por pedido inválido. Uma exceção aqui derrubaria o turno inteiro
 * e o contato veria silêncio; o modelo lidando com "essa ferramenta não está
 * disponível" produz uma conversa que continua.
 */
export async function runAgentTool(
  request: AgentToolRequest,
  context: AgentToolContext,
): Promise<AgentToolOutcome> {
  const spec = agentTool(request.toolId);

  if (!spec) {
    return {
      status: "recusado",
      result: `A ferramenta "${request.toolId}" não existe. Não tente de novo; siga com o que você já sabe ou transfira.`,
    };
  }

  const policy = context.version.tools.find((item) => item.toolId === request.toolId);

  if (!policy?.enabled) {
    return {
      status: "recusado",
      result: `A ferramenta "${spec.label}" não está habilitada para este agente. Siga sem ela ou transfira para uma pessoa.`,
    };
  }

  if (spec.impact === "escrita") {
    return pendingWrite(request, spec.label, spec.effect);
  }

  switch (request.toolId) {
    case "buscar_conhecimento":
      return searchTool(request, context);
    case "consultar_crm":
      return crmTool(request, context);
    case "consultar_horario":
      return scheduleTool(context);
    case "consultar_catalogo":
      return catalogTool(request);
    default:
      return {
        status: "falha",
        result: "Ferramenta de leitura sem execução definida. Siga sem ela.",
      };
  }
}

/* Escrita — proposta, nunca efeito -------------------------------------------- */

function pendingWrite(request: AgentToolRequest, label: string, effect: string): AgentToolOutcome {
  /**
   * O texto que volta ao modelo é redigido com cuidado deliberado.
   *
   * A primeira versão dizia só "registrado". O agente lia aquilo como
   * confirmação e escrevia ao contato "pronto, já agendei seu retorno para
   * terça" — uma promessa que ninguém tinha cumprido. O contrato precisa ser
   * explícito sobre o tempo verbal: ainda não aconteceu.
   */
  const pending: AgentPendingAction = {
    id: `pend_${crypto.randomUUID()}`,
    toolId: request.toolId,
    label,
    params: request.params,
    evidence: request.evidence,
    requestedAt: offsetIso({}),
  };

  return {
    status: "pendente",
    pending,
    result: `PEDIDO REGISTRADO PARA CONFIRMAÇÃO HUMANA — ainda NÃO foi executado. "${effect}" só acontece depois que uma pessoa do time confirmar no Inbox. Ao falar com o contato, diga que vai encaminhar ou que o time vai confirmar. NUNCA diga que já está feito, agendado ou registrado.`,
  };
}

/* Leitura --------------------------------------------------------------------- */

/**
 * Catálogo de produtos e serviços.
 *
 * ## O teto de desconto não vai para o modelo
 *
 * `maxDiscountPct` existe no produto e **não** é incluído aqui, de propósito. O
 * agente informa preço e negocia escopo; quem move preço é gente. Entregar o
 * teto ao modelo é entregar a informação de que existe margem — e a partir daí
 * qualquer contato insistente extrai a frase "consigo até 20%", que vira
 * promessa antes de qualquer aprovação. A decisão foi tomada uma vez, na
 * configuração do agente; este é o lugar onde ela se sustenta.
 *
 * ## `salesNotes` vai, e é interno
 *
 * Aquele campo é escrito **para** o modelo — argumento, objeção conhecida, o que
 * não prometer. Vai marcado como interno no texto, porque um agente que lê
 * argumento de venda em voz alta soa como script de telemarketing.
 */
async function catalogTool(request: AgentToolRequest): Promise<AgentToolOutcome> {
  const query = (request.params.busca ?? "").trim().toLowerCase();
  const all = await repositories.commerce.listProducts();
  const active = all.filter((product) => product.active);

  const matches = query
    ? active.filter((product) =>
        [product.name, product.summary, product.description, product.key]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
    : active;

  if (matches.length === 0) {
    return {
      status: "ok",
      result: query
        ? `Nenhum produto ou serviço do catálogo corresponde a "${query}". Não invente oferta: diga que vai confirmar com o time o que existe para esse caso.`
        : "O catálogo está vazio. Não cite preço nenhum.",
    };
  }

  /**
   * O limite existe por erro observado no RAG: devolvendo pouco, o agente
   * responde com o que veio e emenda "sobre o resto, preciso verificar" — com a
   * resposta inteira disponível no item seguinte. Seis cabe no contexto e cobre
   * o catálogo real de um escritório.
   */
  const lines = matches.slice(0, 6).map((product) => {
    const price = formatCurrencyCents(product.priceCents) + RECURRENCE_SUFFIX[product.recurrence];
    const includes = product.includes.length ? ` Inclui: ${product.includes.join("; ")}.` : "";
    const notes = product.salesNotes ? ` [orientação interna, não leia ao cliente: ${product.salesNotes}]` : "";
    return `- ${product.name} (chave \`${product.key}\`) — ${price}. ${product.summary}${includes}${notes}`;
  });

  const catalog = lines.join("\n");

  return {
    status: "ok",
    result: `Catálogo ativo (${matches.length} item(ns)):\n${catalog}\n\nInforme os valores exatamente como estão. Você NÃO tem autorização para oferecer desconto, condição especial ou parcelamento que não esteja escrito aqui — se o contato pedir, diga que vai encaminhar para o time comercial avaliar.`,
  };
}

function searchTool(request: AgentToolRequest, context: AgentToolContext): AgentToolOutcome {
  const query = (request.params.consulta ?? "").trim();

  if (!query) {
    return {
      status: "recusado",
      result: "A busca precisa do parâmetro `consulta` com as palavras-chave da dúvida.",
    };
  }

  const hits = searchKnowledge(context.knowledge, query);

  if (hits.length === 0) {
    /**
     * Não achar é resultado, não falha.
     *
     * E precisa voltar assim, explícito: sem esta frase o modelo tratava a
     * lista vazia como "a ferramenta não funcionou" e tentava a mesma busca de
     * novo, queimando o teto de chamadas do turno para chegar ao mesmo lugar.
     */
    return {
      status: "ok",
      result: `Nenhum artigo da base responde a "${query}". Não invente a resposta: use a mensagem de desconhecimento e transfira.`,
    };
  }

  return {
    status: "ok",
    result: hits
      .map((hit) => `FONTE: ${hit.title}\n${hit.excerpt}`)
      .join("\n\n---\n\n")
      .concat(
        "\n\nResponda apenas com o que está acima. O que a pergunta pedir e não estiver aqui, você não sabe.",
      ),
  };
}

async function crmTool(
  request: AgentToolRequest,
  context: AgentToolContext,
): Promise<AgentToolOutcome> {
  const field = (request.params.campo ?? "cadastro").trim();

  const contact = context.contactId
    ? await repositories.contacts.getById(context.contactId)
    : (await repositories.contacts.list({ search: context.contactName }))[0];

  if (!contact) {
    /**
     * Visitante de site normalmente **não** está no CRM — é lead novo, e esse é
     * o caso comum, não a exceção. Voltar "não encontrado" com a orientação
     * junto evita que o agente conclua que o sistema falhou e peça desculpa ao
     * contato por um problema que não existe.
     */
    return {
      status: "ok",
      result:
        "Este contato ainda não está no CRM — é um primeiro contato. Trate como lead novo: colete o que precisar perguntando, sem dizer que houve erro de sistema.",
    };
  }

  if (field === "negocio") {
    const deals = await repositories.deals.listByContact(contact.id);
    if (deals.length === 0) {
      return { status: "ok", result: "Nenhum negócio em aberto para este contato." };
    }
    return {
      status: "ok",
      result: deals
        .map(
          (deal) =>
            `Negócio: ${deal.title} · produto ${deal.product} · previsão de fechamento ${formatDate(deal.expectedCloseDate)}`,
        )
        .join("\n"),
    };
  }

  if (field === "tarefas") {
    const tasks = await repositories.contacts.listTasks(contact.id);
    const open = tasks.filter((task) => task.status !== "concluida");
    if (open.length === 0) {
      return { status: "ok", result: "Nenhuma tarefa em aberto para este contato." };
    }
    return {
      status: "ok",
      result: open
        .map((task) => `Tarefa em aberto: ${task.title} · prazo ${formatDate(task.dueAt)}`)
        .join("\n"),
    };
  }

  /**
   * Cadastro: presença, não conteúdo — a mesma regra da tabulação.
   *
   * O agente precisa saber se falta telefone para pedir o telefone. Não precisa
   * do telefone que já está lá, e mandá-lo colocaria dado pessoal no prompt sem
   * necessidade (16.4). Cidade e cargo saem por extenso porque o valor **é** o
   * rótulo: sem ele o agente perguntaria a cidade de quem já disse.
   */
  const parts = [
    `Nome no cadastro: ${contact.fullName}`,
    `Etapa de ciclo: ${contact.lifecycleStage}`,
    `E-mail: ${contact.email ? "preenchido" : "VAZIO"}`,
    `Telefone: ${contact.phone ? "preenchido" : "VAZIO"}`,
    `Documento: ${contact.identifiers.some((item) => item.kind === "cpf") ? "preenchido" : "VAZIO"}`,
    `Cargo: ${contact.jobTitle ?? "VAZIO"}`,
    `Cidade: ${contact.city ?? "VAZIO"}`,
  ];

  if (contact.companyId) {
    const company = await repositories.contacts.getCompanyById(contact.companyId);
    if (company) parts.push(`Empresa vinculada: ${company.name}`);
  }

  return { status: "ok", result: parts.join("\n") };
}

function scheduleTool(context: AgentToolContext): AgentToolOutcome {
  if (context.withinBusinessHours === undefined) {
    return {
      status: "ok",
      result:
        "Não é possível confirmar o expediente agora. Não prometa atendimento imediato; diga que o time retorna assim que possível.",
    };
  }

  return {
    status: "ok",
    result: context.withinBusinessHours
      ? "Estamos dentro do horário de atendimento: há gente disponível para assumir agora."
      : "Estamos FORA do horário de atendimento. Não prometa resposta imediata — o retorno é no próximo dia útil.",
  };
}
