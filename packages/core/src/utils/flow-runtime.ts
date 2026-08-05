/**
 * Execução de fluxo — semântica única, dois consumidores.
 *
 * Nasceu dentro do simulador do editor, em `use-simulator.ts`, preso ao React.
 * O webchat ao vivo precisa percorrer o mesmo documento com as mesmas regras, e
 * um segundo caminhar produziria a divergência clássica: o fluxo testado no
 * simulador se comportando de outro jeito na frente do visitante.
 *
 * Por isso o percurso vive aqui, puro e sem estado próprio: recebe o documento e
 * o estado, devolve estado novo. O simulador virou casca de React em volta; o
 * servidor do webchat chama as mesmas funções.
 */

import type { FlowEdge, FlowNode, FlowPort } from "../types/automation";

export interface FlowEntry {
  id: string;
  role: "bot" | "contato" | "sistema";
  nodeId: string;
  kind: string;
  text: string;
  detail?: string;
  tone?: "normal" | "alerta" | "sucesso";
}

export type FlowRunStatus = "parado" | "executando" | "aguardando" | "encerrado" | "limite";

export interface FlowRunOptions {
  entryKinds: string[];
  terminalKinds: string[];
  /** Blocos que interrompem a execução esperando o usuário. */
  questionKinds: string[];
  /** Limite de passos por execução — o guardrail contra laço sem fim. */
  maxSteps: number;
}

export interface FlowRunState {
  entries: FlowEntry[];
  currentNodeId: string | null;
  visited: string[];
  awaiting: { nodeId: string; options: FlowPort[]; freeText: boolean } | null;
  status: FlowRunStatus;
  variables: Record<string, string>;
  steps: number;
}

export const EMPTY_FLOW_RUN: FlowRunState = {
  entries: [],
  currentNodeId: null,
  visited: [],
  awaiting: null,
  status: "parado",
  variables: {},
  steps: 0,
};

/** Blocos de chatbot, com os nomes que o documento usa. */
export const BOT_RUN_OPTIONS: FlowRunOptions = {
  entryKinds: ["inicio"],
  terminalKinds: ["transferir", "finalizar"],
  questionKinds: ["pergunta"],
  maxSteps: 40,
};

function asText(value: unknown): string {
  if (Array.isArray(value)) return value.join(" · ");
  return value === undefined || value === null ? "" : String(value);
}

/**
 * Substitui `{{variavel}}` pelo que a sessão já capturou.
 *
 * Sem isto, a mensagem "Certo, {{nome}}, vou verificar" chega ao visitante com
 * as chaves à mostra — o defeito mais visível que um chatbot pode ter.
 */
export function applyFlowVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => variables[key] ?? match);
}

function nextNodeId(edges: FlowEdge[], nodeId: string, portId: string): string | null {
  return edges.find((item) => item.source === nodeId && item.sourcePort === portId)?.target ?? null;
}

/**
 * Caminha a partir de um nó até parar em pergunta, terminal ou limite.
 *
 * Um bloco por vez, escolhendo a porta de saída e registrando o rastro. O
 * percurso é síncrono de propósito: bloco que dependeria de rede (requisição
 * HTTP, IA) entra como passo de sistema com o rótulo do bloco. Fingir a resposta
 * de uma integração seria pior que mostrar que ela existe e não rodou.
 */
export function runFlowFrom(
  startNodeId: string,
  base: FlowRunState,
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: FlowRunOptions,
): FlowRunState {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  let current: string | null = startNodeId;
  const entries = [...base.entries];
  const visited = [...base.visited];
  const variables = { ...base.variables };
  let steps = base.steps;

  while (current) {
    const node: FlowNode | undefined = nodeById.get(current);
    if (!node) break;

    steps += 1;
    if (steps > options.maxSteps) {
      entries.push({
        id: `run_${steps}_limite`,
        role: "sistema",
        nodeId: node.id,
        kind: node.kind,
        text: `Limite de ${options.maxSteps} passos atingido. A execução foi interrompida pelo guardrail.`,
        tone: "alerta",
      });
      return {
        ...base,
        entries,
        visited,
        variables,
        steps,
        currentNodeId: node.id,
        awaiting: null,
        status: "limite",
      };
    }

    if (!visited.includes(node.id)) visited.push(node.id);

    if (node.kind === "mensagem" || node.kind === "enviar_whatsapp" || node.kind === "enviar_email") {
      entries.push({
        id: `run_${steps}_${node.id}`,
        role: "bot",
        nodeId: node.id,
        kind: node.kind,
        text: applyFlowVariables(
          asText(node.config.texto ?? node.config.assunto ?? node.label),
          variables,
        ),
        detail: node.config.template ? `template ${asText(node.config.template)}` : undefined,
      });
    } else if (options.questionKinds.includes(node.kind)) {
      // Já respondida antes de o fluxo começar: segue direto, sem repetir.
      const known = alreadyAnswered(node, variables);
      if (known) {
        const port =
          node.outputs.find((item) => !item.fallback) ?? node.outputs[0];
        const target = port ? nextNodeId(edges, node.id, port.id) : null;
        if (!target) break;
        current = target;
        continue;
      }

      entries.push({
        id: `run_${steps}_${node.id}`,
        role: "bot",
        nodeId: node.id,
        kind: node.kind,
        text: applyFlowVariables(asText(node.config.pergunta ?? node.label), variables),
      });
      const answerPorts = node.outputs.filter((port) => !port.fallback);
      const optionLabels = Array.isArray(node.config.opcoes) ? node.config.opcoes : [];
      return {
        entries,
        visited,
        variables,
        steps,
        currentNodeId: node.id,
        awaiting: {
          nodeId: node.id,
          options: optionLabels.length > 0 ? answerPorts : [],
          freeText: optionLabels.length === 0,
        },
        status: "aguardando",
      };
    } else if (options.terminalKinds.includes(node.kind)) {
      entries.push({
        id: `run_${steps}_${node.id}`,
        role: "sistema",
        nodeId: node.id,
        kind: node.kind,
        text: node.label,
        detail: node.summary,
        tone: "sucesso",
      });
      return {
        entries,
        visited,
        variables,
        steps,
        currentNodeId: node.id,
        awaiting: null,
        status: "encerrado",
      };
    } else {
      const detail = Object.entries(node.config)
        .filter(([key]) => key !== "simulationPort")
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${asText(value)}`)
        .join(" · ");

      entries.push({
        id: `run_${steps}_${node.id}`,
        role: "sistema",
        nodeId: node.id,
        kind: node.kind,
        text: node.label,
        detail: detail || node.summary,
      });

      if (node.kind === "variavel" && typeof node.config.nome === "string") {
        variables[node.config.nome] = asText(node.config.expressao);
      }
    }

    if (node.outputs.length === 0) break;
    const preferred = asText(node.config.simulationPort);
    const port =
      node.outputs.find((item) => item.id === preferred) ??
      node.outputs.find((item) => !item.fallback) ??
      node.outputs[0];
    if (!port) break;

    const target = nextNodeId(edges, node.id, port.id);
    if (!target) {
      entries.push({
        id: `run_${steps}_${node.id}_semdestino`,
        role: "sistema",
        nodeId: node.id,
        kind: node.kind,
        text: `A saída "${port.label}" não tem destino. A execução para aqui.`,
        tone: "alerta",
      });
      return {
        entries,
        visited,
        variables,
        steps,
        currentNodeId: node.id,
        awaiting: null,
        status: "encerrado",
      };
    }
    current = target;
  }

  return {
    entries,
    visited,
    variables,
    steps,
    currentNodeId: current,
    awaiting: null,
    status: "encerrado",
  };
}

/**
 * Começa do bloco de entrada. Sem entrada, devolve o estado que explica o porquê.
 *
 * `variables` entra preenchido quando o canal já sabe alguma coisa — é o caso do
 * webchat com formulário: o visitante acabou de digitar nome, telefone e
 * assunto, e um bot que pergunta tudo de novo faz o formulário parecer inútil.
 * O que já se sabe vira variável antes do primeiro passo.
 */
export function startFlow(
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: FlowRunOptions,
  variables: Record<string, string> = {},
): FlowRunState {
  const entry = nodes.find((node) => options.entryKinds.includes(node.kind));
  if (!entry) {
    return {
      ...EMPTY_FLOW_RUN,
      entries: [
        {
          id: "run_sem_entrada",
          role: "sistema",
          nodeId: "",
          kind: "",
          text: "O fluxo não possui bloco de entrada. Adicione um gatilho antes de executar.",
          tone: "alerta",
        },
      ],
      status: "encerrado",
    };
  }
  return runFlowFrom(
    entry.id,
    { ...EMPTY_FLOW_RUN, variables, status: "executando" },
    nodes,
    edges,
    options,
  );
}

/**
 * Pergunta cuja resposta o fluxo já tem é pulada.
 *
 * Sem isto, o formulário do webchat vira teatro: o visitante informa o telefone
 * e o bot pede o telefone na frase seguinte. A checagem é pela variável que o
 * bloco captura — se ela já tem valor, o percurso segue pela saída principal
 * como se a resposta tivesse acabado de chegar.
 */
function alreadyAnswered(node: FlowNode, variables: Record<string, string>): string | null {
  const target = typeof node.config.variavel === "string" ? node.config.variavel : null;
  if (!target) return null;
  const value = variables[target];
  return value && value.trim() ? value : null;
}

/** Responde ao bloco que está esperando e retoma o percurso. */
export function answerFlow(
  state: FlowRunState,
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: FlowRunOptions,
  text: string,
  portId?: string,
): FlowRunState {
  if (!state.awaiting) return state;

  const node = nodes.find((item) => item.id === state.awaiting?.nodeId);
  if (!node) return state;

  const variables = { ...state.variables };
  if (typeof node.config.variavel === "string") {
    variables[node.config.variavel] = text;
  }

  const withAnswer: FlowRunState = {
    ...state,
    variables,
    entries: [
      ...state.entries,
      {
        id: `run_${state.steps}_${node.id}_resposta`,
        role: "contato",
        nodeId: node.id,
        kind: node.kind,
        text,
      },
    ],
    awaiting: null,
    status: "executando",
  };

  const chosenPort =
    node.outputs.find((port) => port.id === portId) ??
    node.outputs.find((port) => !port.fallback) ??
    node.outputs[0];
  if (!chosenPort) return { ...withAnswer, status: "encerrado" };

  const target = nextNodeId(edges, node.id, chosenPort.id);
  if (!target) {
    return {
      ...withAnswer,
      status: "encerrado",
      entries: [
        ...withAnswer.entries,
        {
          id: `run_${state.steps}_${node.id}_semdestino`,
          role: "sistema",
          nodeId: node.id,
          kind: node.kind,
          text: `A saída "${chosenPort.label}" não tem destino. A execução para aqui.`,
          tone: "alerta",
        },
      ],
    };
  }

  return runFlowFrom(target, withAnswer, nodes, edges, options);
}
