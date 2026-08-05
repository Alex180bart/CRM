/**
 * Base de demonstração — automações reativas.
 * Referência: Plano Completo, seções 8 (eventos) e 15 (automação).
 */

import type { AutomationRule, RuleRun } from "../types/rules";
import { offsetIso } from "../utils/datetime";
import { ORG_ID } from "./organization";

export const automationRules: AutomationRule[] = [
  {
    id: "rule_botao_simulacao",
    organizationId: ORG_ID,
    name: "Clicou em “Quero a simulação”",
    description:
      "O lead tocou no botão da campanha de migração. Cria a tarefa e avisa o consultor antes que ele esfrie.",
    enabled: true,
    trigger: {
      kind: "whatsapp_botao",
      config: { template: "comparativo_regime_v4", botao: "Quero a simulação" },
    },
    conditionMatch: "todas",
    conditions: [
      {
        id: "c1",
        field: "contato.ciclo_de_vida",
        fieldLabel: "Ciclo de vida",
        operator: "diferente_de",
        value: "Cliente",
      },
    ],
    actions: [
      {
        id: "a1",
        kind: "adicionar_tag",
        config: { tag: "Pediu simulação" },
        delayMinutes: 0,
      },
      {
        id: "a2",
        kind: "criar_tarefa",
        config: {
          titulo: "Ligar para quem pediu simulação",
          prazoHoras: 4,
          responsavel: "proprietario_do_contato",
        },
        delayMinutes: 0,
      },
      {
        id: "a3",
        kind: "notificar_equipe",
        config: { time: "Comercial", prioridade: "alta" },
        delayMinutes: 0,
      },
      {
        id: "a4",
        kind: "enviar_whatsapp",
        config: { template: "confirmacao_simulacao_v1" },
        delayMinutes: 2,
      },
    ],
    maxPerContactPerDays: 7,
    ownerId: "usr_bruno",
    stats: {
      runs30d: 148,
      success: 145,
      errors: 3,
      conversions: 41,
      lastRunAt: offsetIso({ minutes: -18 }),
    },
    createdAt: offsetIso({ days: -62 }),
    updatedAt: offsetIso({ days: -9 }),
  },
  {
    id: "rule_email_clicado",
    organizationId: ORG_ID,
    name: "Clicou no comparativo de regime",
    description:
      "Quem clica no link do e-mail está pesquisando. Sobe o score e entra na jornada de nutrição.",
    enabled: true,
    trigger: {
      kind: "email_clicado",
      config: { template: "comparativo_regime_v4", link: "qualquer" },
    },
    conditionMatch: "todas",
    conditions: [
      {
        id: "c1",
        field: "contato.score",
        fieldLabel: "Score de engajamento",
        operator: "maior_que",
        value: "30",
      },
    ],
    actions: [
      {
        id: "a1",
        kind: "atualizar_campo",
        config: { campo: "score", operacao: "+15" },
        delayMinutes: 0,
      },
      {
        id: "a2",
        kind: "iniciar_jornada",
        config: { jornada: "Nutrição de leads de migração" },
        delayMinutes: 0,
      },
    ],
    maxPerContactPerDays: 30,
    ownerId: "usr_carla",
    stats: {
      runs30d: 312,
      success: 308,
      errors: 4,
      conversions: 27,
      lastRunAt: offsetIso({ hours: -2 }),
    },
    createdAt: offsetIso({ days: -80 }),
    updatedAt: offsetIso({ days: -21 }),
  },
  {
    id: "rule_palavra_cancelar",
    organizationId: ORG_ID,
    name: "Escreveu “cancelar” ou “sair”",
    description:
      "Descadastro por palavra-chave. Entra na supressão imediatamente e confirma para o contato.",
    enabled: true,
    trigger: {
      kind: "whatsapp_palavra_chave",
      config: { palavras: "cancelar, sair, parar, descadastrar" },
    },
    conditionMatch: "todas",
    conditions: [],
    actions: [
      {
        id: "a1",
        kind: "atualizar_campo",
        config: { campo: "consentimento.marketing", valor: "revogado" },
        delayMinutes: 0,
      },
      { id: "a2", kind: "adicionar_tag", config: { tag: "Descadastrado" }, delayMinutes: 0 },
      {
        id: "a3",
        kind: "enviar_whatsapp",
        config: { template: "confirmacao_descadastro_v1" },
        delayMinutes: 0,
      },
    ],
    maxPerContactPerDays: 1,
    ownerId: "usr_marina",
    stats: {
      runs30d: 34,
      success: 34,
      errors: 0,
      conversions: 0,
      lastRunAt: offsetIso({ hours: -6 }),
    },
    createdAt: offsetIso({ days: -140 }),
    updatedAt: offsetIso({ days: -140 }),
  },
  {
    id: "rule_sem_resposta",
    organizationId: ORG_ID,
    name: "Proposta sem resposta há 3 dias",
    description:
      "O negócio parou em “Proposta enviada” e o contato sumiu. Lembra o consultor e sugere retomada.",
    enabled: true,
    trigger: { kind: "sem_resposta", config: { dias: 3, etapa: "Proposta enviada" } },
    conditionMatch: "todas",
    conditions: [
      {
        id: "c1",
        field: "negocio.etapa",
        fieldLabel: "Etapa do negócio",
        operator: "igual_a",
        value: "Proposta enviada",
      },
      {
        id: "c2",
        field: "negocio.valor",
        fieldLabel: "Valor do negócio",
        operator: "maior_que",
        value: "50000",
      },
    ],
    actions: [
      {
        id: "a1",
        kind: "criar_tarefa",
        config: {
          titulo: "Retomar proposta sem resposta",
          prazoHoras: 24,
          responsavel: "proprietario_do_contato",
        },
        delayMinutes: 0,
      },
      { id: "a2", kind: "adicionar_tag", config: { tag: "Retomada" }, delayMinutes: 0 },
    ],
    maxPerContactPerDays: 7,
    ownerId: "usr_bruno",
    stats: {
      runs30d: 46,
      success: 46,
      errors: 0,
      conversions: 11,
      lastRunAt: offsetIso({ hours: -20 }),
    },
    createdAt: offsetIso({ days: -45 }),
    updatedAt: offsetIso({ days: -12 }),
  },
  {
    id: "rule_formulario_site",
    organizationId: ORG_ID,
    name: "Respondeu o simulador do site",
    description:
      "Formulário do site vira lead com dono definido pela regra de distribuição da equipe.",
    enabled: true,
    trigger: { kind: "formulario_respondido", config: { formulario: "Simulador de impostos" } },
    conditionMatch: "qualquer",
    conditions: [
      {
        id: "c1",
        field: "formulario.faturamento",
        fieldLabel: "Faturamento informado",
        operator: "maior_que",
        value: "30000",
      },
    ],
    actions: [
      {
        id: "a1",
        kind: "atribuir_dono",
        config: { regra: "menor_carga", time: "Comercial" },
        delayMinutes: 0,
      },
      {
        id: "a2",
        kind: "mover_etapa",
        config: { funil: "Vendas — contabilidade", etapa: "Qualificação" },
        delayMinutes: 0,
      },
      {
        id: "a3",
        kind: "enviar_whatsapp",
        config: { template: "primeiro_contato_simulador_v2" },
        delayMinutes: 5,
      },
    ],
    maxPerContactPerDays: 1,
    ownerId: "usr_bruno",
    stats: {
      runs30d: 89,
      success: 84,
      errors: 5,
      conversions: 23,
      lastRunAt: offsetIso({ hours: -1 }),
    },
    createdAt: offsetIso({ days: -95 }),
    updatedAt: offsetIso({ days: -30 }),
  },
  {
    id: "rule_aluno_certificado",
    organizationId: ORG_ID,
    name: "Aluno concluiu o curso",
    description:
      "Emite certificado, pede avaliação e oferece a turma avançada — nesta ordem, com respiro entre elas.",
    enabled: false,
    trigger: { kind: "tag_adicionada", config: { tag: "Curso concluído" } },
    conditionMatch: "todas",
    conditions: [],
    actions: [
      { id: "a1", kind: "enviar_email", config: { template: "certificado_v2" }, delayMinutes: 0 },
      {
        id: "a2",
        kind: "enviar_whatsapp",
        config: { template: "pedido_avaliacao_v1" },
        delayMinutes: 2880,
      },
      {
        id: "a3",
        kind: "iniciar_jornada",
        config: { jornada: "Oferta turma avançada" },
        delayMinutes: 10080,
      },
    ],
    maxPerContactPerDays: 1,
    ownerId: "usr_diego",
    stats: { runs30d: 0, success: 0, errors: 0, conversions: 0 },
    createdAt: offsetIso({ days: -8 }),
    updatedAt: offsetIso({ days: -2 }),
  },
];

export const ruleRuns: RuleRun[] = [
  {
    id: "run_001",
    ruleId: "rule_botao_simulacao",
    contactId: "cnt_013",
    occurredAt: offsetIso({ minutes: -18 }),
    status: "sucesso",
    detail: "Tarefa criada para Bruno Tavares · WhatsApp de confirmação agendado para 2 min.",
    correlationId: "corr_rule_8821",
  },
  {
    id: "run_002",
    ruleId: "rule_email_clicado",
    contactId: "cnt_003",
    occurredAt: offsetIso({ hours: -2 }),
    status: "sucesso",
    detail: "Score subiu 15 pontos · entrou na jornada de nutrição.",
    correlationId: "corr_rule_8790",
  },
  {
    id: "run_003",
    ruleId: "rule_botao_simulacao",
    contactId: "cnt_004",
    occurredAt: offsetIso({ hours: -3 }),
    status: "ignorado",
    detail: "Limite de frequência: o contato já disparou esta regra há 2 dias.",
  },
  {
    id: "run_004",
    ruleId: "rule_formulario_site",
    contactId: "cnt_010",
    occurredAt: offsetIso({ hours: -1 }),
    status: "sucesso",
    detail: "Atribuído a Bruno Tavares (menor carga) · movido para Qualificação.",
    correlationId: "corr_rule_8834",
  },
  {
    id: "run_005",
    ruleId: "rule_formulario_site",
    contactId: "cnt_017",
    occurredAt: offsetIso({ hours: -5 }),
    status: "erro",
    detail: "Template primeiro_contato_simulador_v2 fora da janela de 24 h. Enviado para a DLQ.",
    correlationId: "corr_rule_8801",
  },
  {
    id: "run_006",
    ruleId: "rule_palavra_cancelar",
    contactId: "cnt_026",
    occurredAt: offsetIso({ hours: -6 }),
    status: "sucesso",
    detail: "Consentimento revogado e endereço enviado à supressão.",
    correlationId: "corr_rule_8756",
  },
  {
    id: "run_007",
    ruleId: "rule_sem_resposta",
    contactId: "cnt_020",
    occurredAt: offsetIso({ hours: -20 }),
    status: "sucesso",
    detail: "Tarefa de retomada criada com prazo de 24 h.",
  },
  {
    id: "run_008",
    ruleId: "rule_email_clicado",
    contactId: "cnt_018",
    occurredAt: offsetIso({ days: -1 }),
    status: "ignorado",
    detail: "Condição falsa: score do contato estava em 28, abaixo do mínimo de 30.",
  },
];
