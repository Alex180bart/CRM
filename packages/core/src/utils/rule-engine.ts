import type { Id, IsoDateTime } from "../types/common";
import type {
  AutomationRule,
  RuleAction,
  RuleCondition,
  RuleOperator,
  RuleRun,
} from "../types/rules";
import { RULE_TRIGGER_EVENT } from "../types/rules";

/**
 * O motor de automações — a decisão, não o efeito.
 *
 * ## Por que é função pura
 *
 * Automação é a regra mais difícil de depurar de um CRM depois do roteamento, e
 * pelo mesmo motivo: o defeito não vira erro. Vira "o cliente recebeu duas
 * vezes", "não disparou para aquele contato", "disparou fora de hora" — meses
 * depois, sem passo a passo. Recebendo tudo por parâmetro, sem relógio e sem
 * sorteio, a pergunta "por que esta regra rodou para este contato?" tem resposta
 * reproduzível em vez de palpite. É a mesma disciplina de `decideAssignment`.
 *
 * Quem grava mensagem, cria tarefa e chama webhook é a camada de escrita. Aqui
 * só se decide **o quê** e **quando** — e, quando nada acontece, **por quê**.
 *
 * ## A ordem das guardas é parte da regra
 *
 * Elas não são intercambiáveis. O gatilho é conferido antes do limite de
 * frequência porque um evento que não é desta regra não pode consumir a cota do
 * contato; e as condições vêm depois do limite porque avaliar condição contra
 * cadastro é a parte cara quando isso roda para milhares de eventos.
 */

/* Entrada ------------------------------------------------------------------- */

export interface RuleEvent {
  /** Nome do evento de domínio, como em `RULE_TRIGGER_EVENT`. */
  name: string;
  occurredAt: IsoDateTime;
  /**
   * Dados do evento.
   *
   * Chaves livres de propósito: cada gatilho lê o que precisa, e acrescentar um
   * gatilho novo não deve exigir mudar este tipo. O custo é a leitura defensiva
   * em `gatilhoCasa`, que é onde ela deve estar.
   */
  payload: Record<string, unknown>;
}

export interface RuleSubject {
  contactId: Id;
  /**
   * Campos do contato e do contexto, achatados por caminho — `contato.cidade`,
   * `negocio.etapa`, `formulario.faturamento`.
   *
   * Achatado, e não aninhado, porque é assim que `RuleCondition.field` nomeia o
   * que compara: a condição guarda o caminho como texto, e casar isso contra
   * objeto aninhado exigiria um resolvedor de caminho que ninguém pediu.
   */
  fields: Record<string, string | number | boolean | null | undefined>;
}

export interface RuleEvaluationInput {
  rule: AutomationRule;
  event: RuleEvent;
  subject: RuleSubject;
  /**
   * Execuções anteriores desta regra para este contato.
   *
   * Só `sucesso` conta para o limite de frequência — ver `dentroDoLimite`.
   */
  previousRuns: Array<Pick<RuleRun, "occurredAt" | "status">>;
  nowIso: IsoDateTime;
}

/* Saída --------------------------------------------------------------------- */

export type RuleOutcome = "executar" | "ignorado";

/** Motivo estruturado, para o histórico não depender de comparar frases. */
export type RuleSkipReason =
  | "regra_desativada"
  | "evento_diferente"
  | "gatilho_nao_casa"
  | "limite_por_contato"
  | "condicao_falsa"
  | "sem_acoes";

export interface PlannedAction {
  action: RuleAction;
  /** Instante em que a ação deve rodar, já com o atraso aplicado. */
  runAt: IsoDateTime;
}

export interface RuleDecision {
  outcome: RuleOutcome;
  /** Ausente quando `outcome` é "executar". */
  skipReason?: RuleSkipReason;
  /** Frase para o histórico, sempre preenchida. */
  detail: string;
  actions: PlannedAction[];
}

/* Normalização de texto ------------------------------------------------------ */

/**
 * Compara texto sem acento e sem caixa.
 *
 * A palavra-chave é digitada por quem monta a regra e a mensagem é digitada pelo
 * cliente no celular — esperar que coincidam byte a byte é esperar que ninguém
 * escreva "CANCELAR" ou "cancelar" sem acento. Sem isto, a regra de descadastro
 * falha justamente no caso que ela existe para tratar, e o sintoma é a empresa
 * continuar mandando mensagem para quem pediu para parar.
 */
function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : typeof valor === "number" ? String(valor) : "";
}

/**
 * A palavra aparece no texto como palavra, não como pedaço de outra.
 *
 * `contem` cru casaria "sair" dentro de "saindo", e "parar" dentro de "preparar"
 * — exatamente o falso positivo capaz de descadastrar um cliente que escreveu
 * "estou preparando os documentos".
 */
function contemPalavra(alvo: string, palavra: string): boolean {
  const procurada = normalizar(palavra);
  if (!procurada) return false;

  const escapada = procurada.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escapada}($|[^a-z0-9])`).test(normalizar(alvo));
}

/* Gatilho -------------------------------------------------------------------- */

/**
 * Os parâmetros do gatilho casam com o evento?
 *
 * Cada gatilho lê do payload o que lhe interessa e **ignora o que não conhece**.
 * Parâmetro ausente na regra significa "qualquer" — é o que permite uma regra de
 * palavra-chave sem lista casar toda mensagem, em vez de nenhuma. O contrário
 * produziria regra criada pela metade que nunca dispara e não diz por quê.
 */
function gatilhoCasa(rule: AutomationRule, event: RuleEvent): boolean {
  const config = rule.trigger.config;

  switch (rule.trigger.kind) {
    case "whatsapp_palavra_chave": {
      const lista = texto(config.palavras ?? config.palavra);
      if (!lista) return true;

      const corpo = texto(event.payload.text ?? event.payload.body ?? event.payload.message);
      return lista
        .split(",")
        .map((palavra) => palavra.trim())
        .filter(Boolean)
        .some((palavra) => contemPalavra(corpo, palavra));
    }

    case "whatsapp_botao": {
      const botao = texto(config.botao);
      const template = texto(config.template);
      const casaBotao = !botao || normalizar(texto(event.payload.button)) === normalizar(botao);
      const casaTemplate =
        !template || normalizar(texto(event.payload.template)) === normalizar(template);
      return casaBotao && casaTemplate;
    }

    case "email_aberto":
    case "email_clicado":
    case "campanha_entregue": {
      const template = texto(config.template);
      if (!template) return true;
      return normalizar(texto(event.payload.template)) === normalizar(template);
    }

    case "formulario_respondido": {
      const formulario = texto(config.formulario);
      if (!formulario) return true;
      return normalizar(texto(event.payload.form)) === normalizar(formulario);
    }

    case "tag_adicionada": {
      const tag = texto(config.tag);
      if (!tag) return true;
      return normalizar(texto(event.payload.tag)) === normalizar(tag);
    }

    case "etapa_alterada": {
      const etapa = texto(config.etapa);
      if (!etapa) return true;
      return normalizar(texto(event.payload.stage ?? event.payload.etapa)) === normalizar(etapa);
    }

    case "sem_resposta": {
      /**
       * O gatilho de tempo confia no publicador, e isso é deliberado.
       *
       * Quem decide que uma conversa está parada há três dias é o agendador que
       * varre conversas e publica `conversation.idle` — ele tem a lista e o
       * relógio. Recalcular aqui exigiria receber a conversa inteira só para
       * refazer uma conta já feita, e as duas contas divergiriam no primeiro fuso
       * mal resolvido. O que se confere é o **piso**: evento com menos dias
       * parados do que a regra pede não serve.
       */
      const exigido = Number(config.dias ?? 0);
      if (!Number.isFinite(exigido) || exigido <= 0) return true;

      const informado = Number(event.payload.idleDays ?? event.payload.dias ?? 0);
      return Number.isFinite(informado) && informado >= exigido;
    }

    default:
      // `contato_criado`, `proposta_aceita`, `compra_aprovada`: o evento é o
      // gatilho inteiro, não há parâmetro a conferir.
      return true;
  }
}

/* Condições ------------------------------------------------------------------ */

function numero(valor: string): number {
  return Number(
    valor
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3}\b)/g, "")
      .replace(",", "."),
  );
}

function comparar(operador: RuleOperator, atual: unknown, esperado: string): boolean {
  switch (operador) {
    case "existe":
      return atual !== undefined && atual !== null && texto(atual) !== "";
    case "nao_existe":
      return atual === undefined || atual === null || texto(atual) === "";
    case "igual_a":
      return normalizar(texto(atual)) === normalizar(esperado);
    case "diferente_de":
      return normalizar(texto(atual)) !== normalizar(esperado);
    case "contem":
      return contemPalavra(texto(atual), esperado);
    case "maior_que":
    case "menor_que": {
      /**
       * Comparação numérica exige dois números, e a falta de um é **falso**.
       *
       * Em JavaScript, `"200" > "1000"` é `true` — comparação de texto, não de
       * valor. Um faturamento gravado como texto passaria a satisfazer "maior que
       * mil" com duzentos, e a regra dispararia para o contato errado sem nada
       * indicar isso. Melhor não casar do que casar errado: condição falsa
       * aparece no histórico com motivo, disparo indevido chega ao cliente.
       */
      const a = numero(texto(atual));
      const b = numero(esperado);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      return operador === "maior_que" ? a > b : a < b;
    }
    default:
      return false;
  }
}

function condicaoVale(condicao: RuleCondition, subject: RuleSubject): boolean {
  return comparar(condicao.operator, subject.fields[condicao.field], condicao.value);
}

/* Limite por contato --------------------------------------------------------- */

/**
 * O limite conta **sucesso**, não tentativa.
 *
 * Contar execução ignorada faria uma regra que recusou cinco eventos por
 * condição falsa bloquear o sexto, que era legítimo — o limite existe para não
 * repetir o mesmo efeito no mesmo contato, e efeito ignorado não produziu efeito
 * nenhum. Erro também não conta: falha de envio que consumisse a cota
 * transformaria uma indisponibilidade de canal em silêncio permanente.
 */
function dentroDoLimite(input: RuleEvaluationInput): boolean {
  const dias = input.rule.maxPerContactPerDays;
  if (!Number.isFinite(dias) || dias <= 0) return true;

  const limite = new Date(input.nowIso).getTime() - dias * 86_400_000;

  return !input.previousRuns.some(
    (run) => run.status === "sucesso" && new Date(run.occurredAt).getTime() >= limite,
  );
}

/* Decisão -------------------------------------------------------------------- */

function somarMinutos(iso: IsoDateTime, minutos: number): IsoDateTime {
  const base = new Date(iso).getTime();
  const seguro = Number.isFinite(minutos) && minutos > 0 ? minutos : 0;
  return new Date(base + seguro * 60_000).toISOString();
}

export function decideRule(input: RuleEvaluationInput): RuleDecision {
  const { rule, event } = input;
  const semAcao: PlannedAction[] = [];

  if (!rule.enabled) {
    return {
      outcome: "ignorado",
      skipReason: "regra_desativada",
      detail: "Regra desativada.",
      actions: semAcao,
    };
  }

  const esperado = RULE_TRIGGER_EVENT[rule.trigger.kind];
  if (esperado !== event.name) {
    return {
      outcome: "ignorado",
      skipReason: "evento_diferente",
      detail: `O gatilho escuta ${esperado} e o evento é ${event.name}.`,
      actions: semAcao,
    };
  }

  if (!gatilhoCasa(rule, event)) {
    return {
      outcome: "ignorado",
      skipReason: "gatilho_nao_casa",
      detail: "O evento é do tipo certo, mas não bate com os parâmetros do gatilho.",
      actions: semAcao,
    };
  }

  if (!dentroDoLimite(input)) {
    return {
      outcome: "ignorado",
      skipReason: "limite_por_contato",
      detail: `Já executou para este contato nos últimos ${rule.maxPerContactPerDays} dias.`,
      actions: semAcao,
    };
  }

  if (rule.conditions.length > 0) {
    const resultados = rule.conditions.map((condicao) => condicaoVale(condicao, input.subject));
    const passou =
      rule.conditionMatch === "todas" ? resultados.every(Boolean) : resultados.some(Boolean);

    if (!passou) {
      const reprovadas = rule.conditions
        .filter((_condicao, indice) => !resultados[indice])
        .map((condicao) => condicao.fieldLabel)
        .join(", ");

      return {
        outcome: "ignorado",
        skipReason: "condicao_falsa",
        // O histórico nomeia **qual** condição reprovou: "condição falsa" sem
        // isso obriga quem depura a reavaliar a regra à mão.
        detail: `Condição não satisfeita (${rule.conditionMatch}): ${reprovadas}.`,
        actions: semAcao,
      };
    }
  }

  if (rule.actions.length === 0) {
    return {
      outcome: "ignorado",
      skipReason: "sem_acoes",
      detail: "A regra casou, mas não tem ação configurada.",
      actions: semAcao,
    };
  }

  return {
    outcome: "executar",
    detail: `${rule.actions.length} ${rule.actions.length === 1 ? "ação" : "ações"} planejadas.`,
    /**
     * O atraso é contado do **instante do evento**, não de agora.
     *
     * Se a fila atrasar dez minutos, uma ação com "esperar 30" tem de rodar 30
     * minutos após o que aconteceu — não 40. Contar de `nowIso` faria todo
     * acúmulo de fila empurrar o agendamento para frente, e o cliente receberia
     * a mensagem de acompanhamento cada vez mais tarde conforme o sistema ficasse
     * mais ocupado.
     */
    actions: rule.actions.map((action) => ({
      action,
      runAt: somarMinutos(event.occurredAt, action.delayMinutes),
    })),
  };
}
