/**
 * Quem recebe a próxima conversa da fila.
 * Referência: Plano Completo, seção 10, linha "Roteamento".
 *
 * ## Função pura, e isso não é preferência de estilo
 *
 * Roteamento é a regra mais difícil de depurar de um CRM de atendimento, porque
 * o defeito nunca se apresenta como erro: se apresenta como "às vezes cai para
 * a pessoa errada", meses depois, sem passo a passo para reproduzir. Uma função
 * que recebe tudo por parâmetro e não lê relógio nem sorteia é a única forma de
 * responder "por que foi para o Rafael?" com uma resposta e não com um palpite.
 *
 * Duas consequências diretas no desenho:
 *
 * 1. **Nada de `Math.random()` no desempate.** Empate resolve por identificador,
 *    que é estável. Com sorteio, o mesmo estado produz respostas diferentes e o
 *    simulador da Administração deixaria de valer como prova.
 * 2. **A decisão carrega `excluded`** — quem foi descartado e por quê. É o que
 *    transforma "a fila está parada" numa frase completa: "está parada porque as
 *    quatro pessoas do time estão acima da capacidade". Sem isso, o gestor abre
 *    um chamado e alguém lê código para responder.
 *
 * ## O que esta função não faz
 *
 * Não atribui nada. Ela **decide** e devolve; quem grava é a camada de escrita,
 * que ainda não existe para conversas. O relógio da oferta e a passagem para o
 * próximo da lista também são de quem executa — aqui sai a ordem completa da
 * tentativa, calculada de uma vez, justamente para que o executor não precise
 * chamar de novo a cada recusa e obter uma resposta diferente no meio do laço.
 */

import type {
  DistributionModel,
  DistributionTiebreak,
  Queue,
  User,
  UserPresence,
} from "../types/organization";
import type { Id } from "../types/common";

/* Entrada -------------------------------------------------------------------- */

export interface DistributionCandidate {
  user: User;
  /** Conversas abertas hoje com esta pessoa como responsável principal. */
  openConversations: number;
}

export interface DistributionInput {
  queue: Queue;
  /** Todo mundo que poderia atender — a filtragem por time acontece aqui dentro. */
  candidates: DistributionCandidate[];
  /** Responsável pelo contato no CRM, quando houver. */
  contactOwnerId?: Id;
  /**
   * Competências que **esta** conversa exige, somadas às da fila.
   *
   * Vem da triagem, da tag ou do formulário anterior à conversa. Somar em vez
   * de substituir é o ponto: a fila diz o piso ("aqui é fiscal"), a conversa
   * refina ("e é Simples Nacional"). Substituir faria uma conversa sem
   * marcação nenhuma escapar da exigência da fila.
   */
  requiredSkills?: string[];
  /** Último a receber nesta fila — o cursor da roleta. */
  lastUserId?: Id;
  /** A escala da fila está aberta agora? Ausente assume aberta. */
  scheduleOpen?: boolean;
}

/* Saída ---------------------------------------------------------------------- */

export type DistributionOutcome = "atribuir" | "oferecer" | "reter";

export interface DistributionExclusion {
  userId: Id;
  name: string;
  reason: string;
}

export interface DistributionDecision {
  outcome: DistributionOutcome;
  /** Quem recebe (ou a quem se oferece primeiro). Ausente quando `reter`. */
  userId?: Id;
  /**
   * Ordem completa da tentativa, já limitada por `maxOffers`.
   *
   * Em `atribuir` tem um elemento só. Em `oferecer`, é a sequência inteira —
   * calculada de uma vez para que a recusa não dispare uma nova decisão com
   * estado diferente no meio do caminho.
   */
  order: Id[];
  /** Qual modelo produziu a escolha. Pode ser o desempate. */
  decidedBy: DistributionModel | DistributionTiebreak;
  reason: string;
  excluded: DistributionExclusion[];
  /** Para onde vai o que ninguém pegar. */
  overflowQueueId?: Id;
}

/* Elegibilidade -------------------------------------------------------------- */

const PRESENCE_REASON: Record<UserPresence, string> = {
  disponivel: "",
  ausente: "está ausente",
  ocupado: "está ocupado",
  offline: "está offline",
};

/**
 * `offline` é excluído em qualquer configuração.
 *
 * Não há chave para afrouxar isto de propósito. Atribuir a quem não está
 * conectado deixa a conversa parada com a aparência de atendida — que é pior
 * que deixá-la visivelmente na fila, porque some do painel de quem cobraria.
 */
function presenceAllows(presence: UserPresence, requireAvailable: boolean): boolean {
  if (presence === "offline") return false;
  return requireAvailable ? presence === "disponivel" : true;
}

/* Decisão -------------------------------------------------------------------- */

export function decideAssignment(input: DistributionInput): DistributionDecision {
  const { distribution } = input.queue;
  const excluded: DistributionExclusion[] = [];

  const base = {
    order: [] as Id[],
    excluded,
    overflowQueueId: distribution.overflowQueueId,
  };

  if (distribution.model === "manual") {
    return {
      ...base,
      outcome: "reter",
      decidedBy: "manual",
      reason: "A fila está em modo manual: a conversa aguarda alguém puxar.",
    };
  }

  if (distribution.pauseOutsideSchedule && input.scheduleOpen === false) {
    return {
      ...base,
      outcome: "reter",
      decidedBy: distribution.model,
      reason:
        "Fora do horário da escala. A distribuição está suspensa e a conversa aguarda a abertura.",
    };
  }

  /* Filtro comum ------------------------------------------------------------ */

  const eligible: DistributionCandidate[] = [];

  for (const candidate of input.candidates) {
    const { user } = candidate;
    const drop = (reason: string) => excluded.push({ userId: user.id, name: user.name, reason });

    if (!user.teamIds.includes(input.queue.teamId)) {
      drop("não está no time responsável pela fila");
      continue;
    }

    if (!presenceAllows(user.presence, distribution.requireAvailable)) {
      drop(PRESENCE_REASON[user.presence] || "não está disponível");
      continue;
    }

    if (!user.acceptingNew) {
      drop("pausou o recebimento de conversas novas");
      continue;
    }

    if (distribution.respectCapacity && candidate.openConversations >= user.capacity) {
      drop(`está no teto de capacidade (${candidate.openConversations}/${user.capacity})`);
      continue;
    }

    eligible.push(candidate);
  }

  /* Restrição por habilidade ------------------------------------------------ */

  const required = dedupe([...distribution.requiredSkills, ...(input.requiredSkills ?? [])]);

  let pool = eligible;

  if (distribution.model === "habilidade" && required.length > 0) {
    pool = [];
    for (const candidate of eligible) {
      const missing = required.filter((skill) => !candidate.user.skills.includes(skill));
      if (missing.length > 0) {
        excluded.push({
          userId: candidate.user.id,
          name: candidate.user.name,
          reason: `não tem a habilidade ${missing.join(", ")}`,
        });
        continue;
      }
      pool.push(candidate);
    }
  }

  if (pool.length === 0) {
    return {
      ...base,
      outcome: "reter",
      decidedBy: distribution.model,
      reason:
        excluded.length > 0
          ? "Ninguém elegível agora. A conversa fica na fila até alguém liberar capacidade ou ficar disponível."
          : "A fila não tem ninguém no time responsável.",
    };
  }

  /* Preferência pelo proprietário ------------------------------------------- */

  if (distribution.model === "proprietario" && input.contactOwnerId) {
    const owner = pool.find((candidate) => candidate.user.id === input.contactOwnerId);
    if (owner) {
      return finish(input, base, [owner, ...withoutUser(pool, owner.user.id)], {
        decidedBy: "proprietario",
        reason: `${owner.user.name} já é responsável por este contato.`,
      });
    }
  }

  /* Desempate --------------------------------------------------------------- */

  const picker: DistributionTiebreak =
    distribution.model === "roleta"
      ? "roleta"
      : distribution.model === "menor_carga"
        ? "menor_carga"
        : distribution.tiebreak;

  const ordered = picker === "roleta" ? rotate(pool, input.lastUserId) : byLoad(pool);
  const first = ordered[0]!;

  const reason =
    picker === "roleta"
      ? input.lastUserId
        ? `Rodízio: a última conversa foi para outra pessoa, e ${first.user.name} é a seguinte na ordem.`
        : `Rodízio: primeira distribuição desta fila, começando por ${first.user.name}.`
      : `Menor carga: ${first.user.name} está com ${first.openConversations} de ${first.user.capacity} conversas.`;

  const prefix =
    distribution.model === "habilidade" && required.length > 0
      ? `Habilidade ${required.join(", ")}. `
      : distribution.model === "proprietario"
        ? "O contato não tem responsável elegível. "
        : "";

  return finish(input, base, ordered, { decidedBy: picker, reason: prefix + reason });
}

/* Montagem final ------------------------------------------------------------- */

function finish(
  input: DistributionInput,
  base: { order: Id[]; excluded: DistributionExclusion[]; overflowQueueId?: Id },
  ordered: DistributionCandidate[],
  meta: { decidedBy: DistributionModel | DistributionTiebreak; reason: string },
): DistributionDecision {
  const { distribution } = input.queue;
  const direct = distribution.delivery === "direta";

  /**
   * A ordem tem tamanho 1 na atribuição direta.
   *
   * Devolver a lista inteira ali seria uma promessa falsa: sem aceite não há
   * recusa, então não existe "próximo" — a conversa já é de quem recebeu, e só
   * sai dali por transferência manual.
   */
  const order = direct
    ? [ordered[0]!.user.id]
    : ordered.slice(0, Math.max(1, distribution.maxOffers)).map((item) => item.user.id);

  return {
    ...base,
    outcome: direct ? "atribuir" : "oferecer",
    userId: order[0],
    order,
    decidedBy: meta.decidedBy,
    reason: direct
      ? meta.reason
      : `${meta.reason} Tem ${distribution.offerTimeoutSeconds}s para aceitar; depois passa ao próximo (${order.length} tentativa(s)).`,
  };
}

/* Ordenações ----------------------------------------------------------------- */

/**
 * Rodízio circular, ancorado em quem recebeu por último.
 *
 * A lista base é ordenada por identificador — não por nome, que muda quando
 * alguém casa, nem por ordem de cadastro, que muda quando alguém é reativado.
 * Qualquer uma dessas duas faria a roleta pular pessoas silenciosamente ao
 * reordenar.
 *
 * Quem recebeu por último pode não estar mais no arranjo (ficou offline, saiu do
 * time). Nesse caso o cursor cai em -1 e a volta recomeça do início, que é o
 * comportamento correto: a alternativa seria travar a roleta num ausente.
 */
function rotate(pool: DistributionCandidate[], lastUserId?: Id): DistributionCandidate[] {
  const sorted = [...pool].sort((a, b) => a.user.id.localeCompare(b.user.id));
  if (!lastUserId) return sorted;

  const index = sorted.findIndex((item) => item.user.id === lastUserId);
  if (index < 0) return sorted;

  return [...sorted.slice(index + 1), ...sorted.slice(0, index + 1)];
}

/**
 * Menor ocupação **relativa**, não menor número absoluto.
 *
 * Quem tem capacidade 10 e seis conversas está mais folgado que quem tem
 * capacidade 4 e cinco — e ordenar pelo número bruto entregaria a próxima ao
 * segundo. A capacidade existe justamente porque as pessoas não são
 * intercambiáveis; ignorá-la na conta a transformaria em enfeite.
 */
function byLoad(pool: DistributionCandidate[]): DistributionCandidate[] {
  return [...pool].sort((a, b) => {
    const ratioA = a.openConversations / Math.max(1, a.user.capacity);
    const ratioB = b.openConversations / Math.max(1, b.user.capacity);
    if (ratioA !== ratioB) return ratioA - ratioB;
    if (a.openConversations !== b.openConversations) {
      return a.openConversations - b.openConversations;
    }
    return a.user.id.localeCompare(b.user.id);
  });
}

function withoutUser(pool: DistributionCandidate[], userId: Id): DistributionCandidate[] {
  return byLoad(pool.filter((item) => item.user.id !== userId));
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

/* Leitura para a tela -------------------------------------------------------- */

/** Resumo de uma linha para o cartão da fila. */
export function summarizeDistribution(queue: Queue): string {
  const { distribution } = queue;
  if (distribution.model === "manual") return "Manual — ninguém recebe automaticamente";

  const model =
    distribution.model === "roleta"
      ? "Roleta"
      : distribution.model === "menor_carga"
        ? "Menor carga"
        : distribution.model === "proprietario"
          ? `Proprietário do contato, desempate por ${distribution.tiebreak === "roleta" ? "roleta" : "menor carga"}`
          : `Habilidade, desempate por ${distribution.tiebreak === "roleta" ? "roleta" : "menor carga"}`;

  const delivery =
    distribution.delivery === "oferta"
      ? `oferta de ${distribution.offerTimeoutSeconds}s (até ${distribution.maxOffers})`
      : "atribuição direta";

  return `${model} · ${delivery}`;
}
