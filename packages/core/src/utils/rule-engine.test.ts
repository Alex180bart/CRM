import { describe, expect, it } from "vitest";

import type { AutomationRule, RuleAction, RuleCondition } from "../types/rules";
import { decideRule, type RuleEvaluationInput } from "./rule-engine";

const AGORA = "2026-08-16T12:00:00.000Z";

function acao(overrides: Partial<RuleAction> = {}): RuleAction {
  return {
    id: "a1",
    kind: "criar_tarefa",
    config: { titulo: "Responder" },
    delayMinutes: 0,
    ...overrides,
  };
}

function regra(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: "rule_1",
    organizationId: "org_1",
    createdAt: AGORA,
    updatedAt: AGORA,
    name: "Palavra-chave de cancelamento",
    description: "",
    enabled: true,
    trigger: { kind: "whatsapp_palavra_chave", config: { palavras: "cancelar, sair, parar" } },
    conditionMatch: "todas",
    conditions: [],
    actions: [acao()],
    maxPerContactPerDays: 0,
    ownerId: "usr_1",
    stats: { runs30d: 0, success: 0, errors: 0, conversions: 0 },
    ...overrides,
  } as AutomationRule;
}

function entrada(overrides: Partial<RuleEvaluationInput> = {}): RuleEvaluationInput {
  return {
    rule: regra(),
    event: {
      name: "message.received",
      occurredAt: AGORA,
      payload: { text: "quero cancelar meu plano" },
      ...overrides.event,
    },
    subject: { contactId: "ct_1", fields: {}, ...overrides.subject },
    previousRuns: [],
    nowIso: AGORA,
    ...overrides,
  };
}

describe("o gatilho precisa ser do evento certo", () => {
  it("executa quando evento e parâmetros casam", () => {
    const decisao = decideRule(entrada());

    expect(decisao.outcome).toBe("executar");
    expect(decisao.actions).toHaveLength(1);
  });

  it("ignora evento de outro tipo, nomeando os dois lados", () => {
    const decisao = decideRule(entrada({ event: { name: "email.opened", occurredAt: AGORA, payload: {} } }));

    expect(decisao.skipReason).toBe("evento_diferente");
    // O motivo cita o esperado e o recebido: sem isso, depurar exige abrir o
    // mapa de gatilhos para descobrir o que a regra escutava.
    expect(decisao.detail).toContain("message.received");
    expect(decisao.detail).toContain("email.opened");
  });

  it("ignora regra desativada antes de qualquer outra conta", () => {
    const decisao = decideRule(entrada({ rule: regra({ enabled: false }) }));
    expect(decisao.skipReason).toBe("regra_desativada");
  });
});

describe("palavra-chave", () => {
  it("casa sem acento e sem caixa", () => {
    for (const texto of ["CANCELAR", "Cancelar agora", "quero sair", "PARAR"]) {
      const decisao = decideRule(
        entrada({ event: { name: "message.received", occurredAt: AGORA, payload: { text: texto } } }),
      );
      expect(decisao.outcome, texto).toBe("executar");
    }
  });

  /**
   * O falso positivo que este teste existe para impedir: descadastrar quem
   * escreveu "estou preparando os documentos" porque "parar" está dentro de
   * "preparando".
   */
  it("não casa palavra dentro de outra palavra", () => {
    for (const texto of [
      "estou preparando os documentos",
      // "saindo" contém "sair" como pedaço, mas não como palavra.
      "já estou saindo para a reunião",
      "o cancelamento é do meu concorrente",
    ]) {
      const decisao = decideRule(
        entrada({ event: { name: "message.received", occurredAt: AGORA, payload: { text: texto } } }),
      );
      expect(decisao.skipReason, texto).toBe("gatilho_nao_casa");
    }
  });

  it("lê o corpo de text, body ou message", () => {
    for (const payload of [{ text: "cancelar" }, { body: "cancelar" }, { message: "cancelar" }]) {
      const decisao = decideRule(
        entrada({ event: { name: "message.received", occurredAt: AGORA, payload } }),
      );
      expect(decisao.outcome).toBe("executar");
    }
  });

  /**
   * Lista vazia significa "qualquer mensagem", e não "nenhuma".
   *
   * O contrário produz a regra criada pela metade que nunca dispara e não diz
   * por quê — o pior estado possível para quem está montando automação.
   */
  it("sem lista de palavras, qualquer mensagem serve", () => {
    const decisao = decideRule(
      entrada({
        rule: regra({ trigger: { kind: "whatsapp_palavra_chave", config: {} } }),
        event: { name: "message.received", occurredAt: AGORA, payload: { text: "bom dia" } },
      }),
    );
    expect(decisao.outcome).toBe("executar");
  });
});

describe("condições", () => {
  const condicao = (overrides: Partial<RuleCondition> = {}): RuleCondition => ({
    id: "c1",
    field: "contato.cidade",
    fieldLabel: "Cidade",
    operator: "igual_a",
    value: "São Paulo",
    ...overrides,
  });

  it("compara texto sem acento e sem caixa", () => {
    const decisao = decideRule(
      entrada({
        rule: regra({ conditions: [condicao()] }),
        subject: { contactId: "ct_1", fields: { "contato.cidade": "sao paulo" } },
      }),
    );
    expect(decisao.outcome).toBe("executar");
  });

  it("nomeia a condição que reprovou", () => {
    const decisao = decideRule(
      entrada({
        rule: regra({ conditions: [condicao()] }),
        subject: { contactId: "ct_1", fields: { "contato.cidade": "Curitiba" } },
      }),
    );

    expect(decisao.skipReason).toBe("condicao_falsa");
    expect(decisao.detail).toContain("Cidade");
  });

  it("todas exige todas; qualquer basta uma", () => {
    const duas = [
      condicao(),
      condicao({ id: "c2", field: "contato.porte", fieldLabel: "Porte", value: "Médio" }),
    ];
    const fields = { "contato.cidade": "São Paulo", "contato.porte": "Grande" };

    expect(
      decideRule(entrada({ rule: regra({ conditionMatch: "todas", conditions: duas }), subject: { contactId: "ct_1", fields } })).outcome,
    ).toBe("ignorado");

    expect(
      decideRule(entrada({ rule: regra({ conditionMatch: "qualquer", conditions: duas }), subject: { contactId: "ct_1", fields } })).outcome,
    ).toBe("executar");
  });

  /**
   * `"200" > "1000"` é `true` em JavaScript, porque compara texto. Um
   * faturamento gravado como string passaria a satisfazer "maior que mil" com
   * duzentos — e a automação dispararia para o contato errado sem nada acusar.
   */
  it("compara número como número, inclusive com R$ e separador de milhar", () => {
    const maior = condicao({ field: "form.faturamento", fieldLabel: "Faturamento", operator: "maior_que", value: "1000" });

    expect(
      decideRule(entrada({ rule: regra({ conditions: [maior] }), subject: { contactId: "ct_1", fields: { "form.faturamento": "200" } } })).outcome,
    ).toBe("ignorado");

    expect(
      decideRule(entrada({ rule: regra({ conditions: [maior] }), subject: { contactId: "ct_1", fields: { "form.faturamento": "R$ 1.500,00" } } })).outcome,
    ).toBe("executar");
  });

  it("valor não numérico reprova em vez de casar por engano", () => {
    const maior = condicao({ field: "form.faturamento", fieldLabel: "Faturamento", operator: "maior_que", value: "1000" });
    const decisao = decideRule(
      entrada({ rule: regra({ conditions: [maior] }), subject: { contactId: "ct_1", fields: { "form.faturamento": "não informado" } } }),
    );
    expect(decisao.skipReason).toBe("condicao_falsa");
  });

  it("existe e nao_existe tratam vazio como ausência", () => {
    const existe = condicao({ field: "contato.email", fieldLabel: "E-mail", operator: "existe", value: "" });

    expect(
      decideRule(entrada({ rule: regra({ conditions: [existe] }), subject: { contactId: "ct_1", fields: { "contato.email": "" } } })).outcome,
    ).toBe("ignorado");

    expect(
      decideRule(entrada({ rule: regra({ conditions: [existe] }), subject: { contactId: "ct_1", fields: { "contato.email": "a@b.com" } } })).outcome,
    ).toBe("executar");
  });
});

describe("limite por contato", () => {
  it("bloqueia quando já houve sucesso na janela", () => {
    const decisao = decideRule(
      entrada({
        rule: regra({ maxPerContactPerDays: 7 }),
        previousRuns: [{ occurredAt: "2026-08-14T12:00:00.000Z", status: "sucesso" }],
      }),
    );

    expect(decisao.skipReason).toBe("limite_por_contato");
    expect(decisao.detail).toContain("7 dias");
  });

  it("libera quando o sucesso anterior está fora da janela", () => {
    const decisao = decideRule(
      entrada({
        rule: regra({ maxPerContactPerDays: 7 }),
        previousRuns: [{ occurredAt: "2026-08-01T12:00:00.000Z", status: "sucesso" }],
      }),
    );
    expect(decisao.outcome).toBe("executar");
  });

  /**
   * Execução ignorada e erro **não** consomem a cota.
   *
   * Contá-las faria uma regra que recusou cinco eventos por condição falsa
   * bloquear o sexto, que era legítimo; e faria uma indisponibilidade de canal
   * virar silêncio permanente para aquele contato.
   */
  it("ignorado e erro não consomem a cota", () => {
    const decisao = decideRule(
      entrada({
        rule: regra({ maxPerContactPerDays: 7 }),
        previousRuns: [
          { occurredAt: "2026-08-15T12:00:00.000Z", status: "ignorado" },
          { occurredAt: "2026-08-15T13:00:00.000Z", status: "erro" },
        ],
      }),
    );
    expect(decisao.outcome).toBe("executar");
  });

  it("zero significa sem limite", () => {
    const decisao = decideRule(
      entrada({
        rule: regra({ maxPerContactPerDays: 0 }),
        previousRuns: [{ occurredAt: AGORA, status: "sucesso" }],
      }),
    );
    expect(decisao.outcome).toBe("executar");
  });

  /**
   * A ordem das guardas importa: um evento que não é desta regra não pode
   * consumir a cota do contato. Aqui o gatilho não casa **e** existe execução
   * recente — o motivo tem de ser o gatilho.
   */
  it("gatilho é conferido antes do limite", () => {
    const decisao = decideRule(
      entrada({
        rule: regra({ maxPerContactPerDays: 7 }),
        event: { name: "message.received", occurredAt: AGORA, payload: { text: "bom dia" } },
        previousRuns: [{ occurredAt: AGORA, status: "sucesso" }],
      }),
    );
    expect(decisao.skipReason).toBe("gatilho_nao_casa");
  });
});

describe("agendamento das ações", () => {
  /**
   * O atraso conta do instante do **evento**, não de agora. Com fila atrasada,
   * contar de `nowIso` empurraria a ação para frente conforme o sistema ficasse
   * mais ocupado — e a mensagem de acompanhamento chegaria cada vez mais tarde.
   */
  it("soma o atraso ao instante do evento, não ao relógio", () => {
    const decisao = decideRule(
      entrada({
        rule: regra({ actions: [acao({ delayMinutes: 30 })] }),
        event: { name: "message.received", occurredAt: "2026-08-16T12:00:00.000Z", payload: { text: "cancelar" } },
        // A fila atrasou dez minutos: o agendamento não muda por isso.
        nowIso: "2026-08-16T12:10:00.000Z",
      }),
    );

    expect(decisao.actions[0]?.runAt).toBe("2026-08-16T12:30:00.000Z");
  });

  it("atraso zero agenda para o próprio instante do evento", () => {
    const decisao = decideRule(entrada());
    expect(decisao.actions[0]?.runAt).toBe(AGORA);
  });

  it("regra sem ação é ignorada com motivo próprio", () => {
    const decisao = decideRule(entrada({ rule: regra({ actions: [] }) }));
    expect(decisao.skipReason).toBe("sem_acoes");
  });

  it("preserva a ordem das ações", () => {
    const decisao = decideRule(
      entrada({
        rule: regra({
          actions: [
            acao({ id: "a1", kind: "enviar_whatsapp" }),
            acao({ id: "a2", kind: "criar_tarefa", delayMinutes: 5 }),
            acao({ id: "a3", kind: "adicionar_tag" }),
          ],
        }),
      }),
    );

    expect(decisao.actions.map((planejada) => planejada.action.id)).toEqual(["a1", "a2", "a3"]);
  });
});

describe("gatilho de tempo", () => {
  it("exige o mínimo de dias parados que a regra pede", () => {
    const semResposta = regra({
      trigger: { kind: "sem_resposta", config: { dias: 3 } },
      actions: [acao()],
    });

    expect(
      decideRule(entrada({ rule: semResposta, event: { name: "conversation.idle", occurredAt: AGORA, payload: { idleDays: 1 } } })).skipReason,
    ).toBe("gatilho_nao_casa");

    expect(
      decideRule(entrada({ rule: semResposta, event: { name: "conversation.idle", occurredAt: AGORA, payload: { idleDays: 4 } } })).outcome,
    ).toBe("executar");
  });
});
