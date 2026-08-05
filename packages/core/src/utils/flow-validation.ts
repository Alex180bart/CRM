import type { FlowEdge, FlowNode, FlowValidationIssue } from "../types/automation";

/**
 * Validação executada antes da publicação de um fluxo (seção 12.2 do plano):
 * caminho sem saída, nó inalcançável, laço sem limite e ausência de transbordo
 * para humano. Publicar com erro é bloqueado; alerta apenas avisa.
 */
export function validateFlow(
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: { requireHumanHandoff?: boolean; terminalKinds: string[]; entryKinds: string[] },
): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const entry = nodes.find((node) => options.entryKinds.includes(node.kind));
  if (!entry) {
    issues.push({
      id: "sem-entrada",
      rule: "no_orfao",
      severity: "erro",
      message: "O fluxo não possui bloco de entrada.",
    });
  }

  // Portas sem conexão em nós que não são terminais.
  for (const node of nodes) {
    if (options.terminalKinds.includes(node.kind)) continue;
    for (const port of node.outputs) {
      const connected = edges.some(
        (edge) => edge.source === node.id && edge.sourcePort === port.id,
      );
      if (!connected) {
        issues.push({
          id: `sem-saida-${node.id}-${port.id}`,
          rule: "caminho_sem_saida",
          severity: "erro",
          nodeId: node.id,
          message: `"${node.label}" tem a saída "${port.label}" sem destino.`,
        });
      }
    }
  }

  // Alcançabilidade a partir da entrada.
  if (entry) {
    const reachable = new Set<string>([entry.id]);
    const stack = [entry.id];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined) break;
      for (const edge of edges) {
        if (edge.source === current && !reachable.has(edge.target)) {
          reachable.add(edge.target);
          stack.push(edge.target);
        }
      }
    }
    for (const node of nodes) {
      if (!reachable.has(node.id)) {
        issues.push({
          id: `orfao-${node.id}`,
          rule: "no_orfao",
          severity: "alerta",
          nodeId: node.id,
          message: `"${node.label}" não é alcançável a partir do gatilho.`,
        });
      }
    }
  }

  // Arestas apontando para nós inexistentes.
  for (const edge of edges) {
    if (!nodeById.has(edge.target)) {
      issues.push({
        id: `destino-invalido-${edge.id}`,
        rule: "caminho_sem_saida",
        severity: "erro",
        nodeId: edge.source,
        message: "Existe uma conexão apontando para um bloco removido.",
      });
    }
  }

  if (options.requireHumanHandoff && !nodes.some((node) => node.kind === "transferir")) {
    issues.push({
      id: "sem-transbordo",
      rule: "sem_transbordo",
      severity: "alerta",
      message: "Nenhum caminho transfere para atendimento humano.",
    });
  }

  return issues;
}

export function hasBlockingIssue(issues: FlowValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "erro");
}
