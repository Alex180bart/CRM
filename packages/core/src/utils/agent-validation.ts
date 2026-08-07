/**
 * Checagem do agente antes de publicar.
 *
 * Mesma disciplina de `flow-validation.ts`, `email-validation.ts` e
 * `webchat.ts`: roda antes da publicação, separa erro de alerta, e erro
 * **bloqueia**. O critério para bloquear é sempre o mesmo — o defeito só
 * apareceria na frente do contato, e nesse momento já custou a conversa.
 *
 * O que é alerta e não erro merece explicação, porque a tentação é bloquear
 * tudo: escrita sem confirmação é decisão legítima de quem opera (seção 16.4
 * pede confirmação para ação de impacto, não para toda escrita), e conjunto de
 * avaliação vazio impede comparar revisões mas não impede o agente funcionar.
 * Bloquear os dois transformaria a validação em obstáculo, e obstáculo se
 * contorna — normalmente desligando a validação inteira.
 */

import {
  AGENT_TOOLS,
  agentTool,
  type AgentKnowledgeSource,
  type AgentValidationIssue,
  type AiAgentVersion,
} from "../types/agents";

export function validateAgentVersion(
  version: AiAgentVersion,
  /**
   * Fontes cadastradas, para conferir o **estado** das escolhidas.
   *
   * Opcional porque a validação precisa rodar em lugares que não têm a lista à
   * mão — a lista de agentes, por exemplo. Sem ela a checagem de estado é
   * pulada; com ela, o alerta aparece antes de alguém publicar um agente que
   * aponta para três PDFs que ninguém extraiu.
   */
  sources?: AgentKnowledgeSource[],
): AgentValidationIssue[] {
  const issues: AgentValidationIssue[] = [];
  const { identity, mission, knowledge, tools, handoff, limits, guards, evaluation } = version;

  const enabled = new Set(tools.filter((tool) => tool.enabled).map((tool) => tool.toolId));

  /* Identidade -------------------------------------------------------------- */

  if (!identity.displayName.trim()) {
    issues.push({
      id: "sem_nome",
      rule: "identidade_sem_nome",
      severity: "erro",
      message: "O agente não tem nome de apresentação — ele abriria a conversa sem se identificar.",
    });
  }

  if (!identity.role.trim()) {
    issues.push({
      id: "sem_papel",
      rule: "identidade_sem_papel",
      severity: "alerta",
      message:
        "Sem papel declarado, o agente responde sobre qualquer coisa com a mesma autoridade — inclusive o que não é dele.",
    });
  }

  /* Missão ------------------------------------------------------------------ */

  if (mission.scope.length === 0) {
    issues.push({
      id: "sem_escopo",
      rule: "missao_sem_escopo",
      severity: "erro",
      message:
        "Sem escopo, não há como o agente saber o que está fora dele — e um agente que nunca se declara fora do escopo nunca transfere.",
    });
  }

  if (!mission.successCriteria.trim()) {
    issues.push({
      id: "sem_criterio",
      rule: "missao_sem_criterio",
      severity: "alerta",
      message:
        "Sem critério de sucesso, o agente não sabe quando parar e tende a alongar a conversa.",
    });
  }

  /* Conhecimento ------------------------------------------------------------ */

  if (knowledge.mode === "somente_base" && knowledge.sourceIds.length === 0) {
    issues.push({
      id: "sem_fonte",
      rule: "conhecimento_sem_fonte",
      severity: "erro",
      message:
        "O modo é responder só pela base, mas nenhuma fonte foi escolhida: o agente não teria o que responder.",
    });
  }

  if (sources) {
    const chosen = sources.filter((source) => knowledge.sourceIds.includes(source.id));
    const notReady = chosen.filter((source) => source.status !== "pronto");

    if (notReady.length > 0) {
      issues.push({
        id: "fonte_nao_pronta",
        rule: "conhecimento_fonte_nao_pronta",
        severity: notReady.length === chosen.length ? "erro" : "alerta",
        message: `${notReady.length} fonte(s) escolhida(s) ainda não têm texto extraído (${notReady
          .map((source) => source.title)
          .join("; ")}). O agente não vai encontrá-las na busca.`,
      });
    }

    /**
     * Link envelhece em silêncio.
     *
     * O artigo escrito aqui só muda quando alguém edita; a página da web muda
     * sozinha, e o agente segue respondendo pelo texto que foi lido meses atrás.
     * Sem este alerta, o sintoma aparece como "a IA está dando informação
     * velha" — e ninguém liga ao cadastro de fontes.
     */
    const stale = chosen.filter(
      (source) =>
        source.kind === "link" &&
        source.fetchedAt &&
        Date.parse(source.fetchedAt) < Date.now() - 90 * 24 * 60 * 60 * 1000,
    );

    if (stale.length > 0) {
      issues.push({
        id: "link_velho",
        rule: "conhecimento_link_velho",
        severity: "alerta",
        message: `${stale.length} página(s) da web não são relidas há mais de 90 dias. Página muda sozinha; o agente segue respondendo pelo texto antigo.`,
      });
    }
  }

  if (knowledge.mode === "somente_base" && !enabled.has("buscar_conhecimento")) {
    issues.push({
      id: "busca_desligada",
      rule: "conhecimento_sem_busca",
      severity: "erro",
      message:
        "O modo é responder só pela base, mas a ferramenta de busca está desligada — o agente não alcança nenhum artigo.",
    });
  }

  /* Ferramentas ------------------------------------------------------------- */

  for (const policy of tools) {
    if (!agentTool(policy.toolId)) {
      issues.push({
        id: `ferramenta_${policy.toolId}`,
        rule: "ferramenta_desconhecida",
        severity: "erro",
        message: `A ferramenta "${policy.toolId}" não existe no catálogo. Ela seria recusada em execução.`,
      });
    }
  }

  const unconfirmed = AGENT_TOOLS.filter(
    (tool) =>
      tool.impact === "escrita" &&
      tools.some(
        (policy) => policy.toolId === tool.id && policy.enabled && !policy.requiresConfirmation,
      ),
  );

  if (unconfirmed.length > 0) {
    issues.push({
      id: "escrita_sem_confirmacao",
      rule: "escrita_sem_confirmacao",
      severity: "alerta",
      message: `Estas ações gravam sem ninguém conferir: ${unconfirmed
        .map((tool) => tool.label.toLowerCase())
        .join(", ")}. A seção 16.4 pede confirmação humana para ação de impacto.`,
    });
  }

  /* Transferência ----------------------------------------------------------- */

  if (!handoff.defaultQueueId) {
    issues.push({
      id: "sem_fila",
      rule: "handoff_sem_fila",
      severity: "erro",
      message:
        "Sem fila padrão, o contato que o agente não resolver fica preso na conversa sem saída para uma pessoa.",
    });
  }

  for (const rule of handoff.rules) {
    if (!rule.when.trim() || !rule.queueId) {
      issues.push({
        id: `regra_${rule.id}`,
        rule: "handoff_regra_incompleta",
        severity: "erro",
        message: "Uma regra de transferência está sem condição ou sem fila de destino.",
      });
    }
  }

  /**
   * Modo `regras` sem nenhuma regra é o pior dos mundos: tudo cai na fila
   * padrão, e a operação acha que configurou roteamento. É erro e não alerta
   * porque o sintoma — uma fila só recebendo tudo — é lido como problema de
   * volume, não de configuração.
   */
  if (handoff.routing === "regras" && handoff.rules.length === 0) {
    issues.push({
      id: "sem_regra",
      rule: "handoff_sem_regra",
      severity: "erro",
      message:
        "O roteamento é só por regras, mas não há nenhuma escrita: toda conversa cairia na fila padrão.",
    });
  }

  if (handoff.routing !== "regras" && handoff.queueIds.length === 1) {
    issues.push({
      id: "uma_fila",
      rule: "handoff_uma_fila",
      severity: "alerta",
      message:
        "A IA escolhe o setor, mas só uma fila está liberada — não há escolha a fazer. Libere mais filas ou volte ao modo por regras.",
    });
  }

  if (!handoff.transferOnRequest) {
    issues.push({
      id: "pedido_ignorado",
      rule: "handoff_ignora_pedido",
      severity: "alerta",
      message:
        "O agente não transfere quando o contato pede uma pessoa. É a reclamação número um de quem conversa com bot.",
    });
  }

  if (!handoff.summarize) {
    issues.push({
      id: "sem_resumo",
      rule: "handoff_sem_resumo",
      severity: "alerta",
      message:
        "A transferência vai sem resumo: quem assumir relê a conversa inteira, que é o custo que o agente deveria poupar.",
    });
  }

  /* Limites ----------------------------------------------------------------- */

  if (limits.channels.length === 0) {
    issues.push({
      id: "sem_canal",
      rule: "limite_sem_canal",
      severity: "erro",
      message: "Nenhum canal habilitado: o agente não seria acionado em lugar nenhum.",
    });
  }

  if (limits.maxTurns < 2) {
    issues.push({
      id: "poucos_turnos",
      rule: "limite_turnos",
      severity: "erro",
      message:
        "Com menos de dois turnos o agente responde uma vez e encerra — não chega a ser um atendimento.",
    });
  }

  if (limits.costCeilingCents <= 0) {
    issues.push({
      id: "sem_teto",
      rule: "limite_sem_teto",
      severity: "erro",
      message: "Sem teto de custo, uma conversa em laço gasta sem limite.",
    });
  }

  /* Guardas ----------------------------------------------------------------- */

  if (!guards.fallbackMessage.trim()) {
    issues.push({
      id: "sem_fallback",
      rule: "guarda_sem_fallback",
      severity: "erro",
      message:
        "Sem mensagem de desconhecimento, o agente que não sabe responder fica em silêncio ou improvisa.",
    });
  }

  if (guards.confidenceFloor < 40 && handoff.transferOnUncertainty) {
    issues.push({
      id: "piso_baixo",
      rule: "guarda_piso_baixo",
      severity: "alerta",
      message:
        "O piso de confiança está tão baixo que a transferência por incerteza praticamente nunca dispara.",
    });
  }

  /* Avaliação --------------------------------------------------------------- */

  if (evaluation.length === 0) {
    issues.push({
      id: "sem_avaliacao",
      rule: "sem_conjunto_avaliacao",
      severity: "alerta",
      message:
        "Sem casos de avaliação, não há como saber se a próxima versão do prompt melhorou ou piorou (seção 16.4).",
    });
  }

  return issues;
}

export function hasBlockingAgentIssue(issues: AgentValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === "erro");
}
