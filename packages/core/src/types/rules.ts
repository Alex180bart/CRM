/**
 * Automações reativas.
 *
 * Não confundir com jornada. A jornada acompanha o contato por dias ou meses e
 * tem estado próprio por participante (seção 15 do plano). A automação aqui é
 * **uma regra**: aconteceu isto, confira aquilo, faça isso — e acabou. Ela
 * responde a interações que já aconteceram (abriu o e-mail, clicou no botão do
 * WhatsApp, respondeu o formulário) e reage na hora.
 *
 * Separar os dois evita o erro clássico: montar uma jornada de sete nós para
 * fazer o que era "quando clicar no botão, cria tarefa para o consultor".
 */

import type { BaseEntity, Id, IsoDateTime } from "./common";

/* Gatilhos ---------------------------------------------------------------- */

export type RuleTriggerKind =
  | "email_aberto"
  | "email_clicado"
  | "whatsapp_botao"
  | "whatsapp_palavra_chave"
  | "formulario_respondido"
  | "campanha_entregue"
  | "sem_resposta"
  | "tag_adicionada"
  | "etapa_alterada"
  | "contato_criado"
  | "proposta_aceita"
  | "compra_aprovada";

export const RULE_TRIGGER_LABEL: Record<RuleTriggerKind, string> = {
  email_aberto: "Abriu um e-mail",
  email_clicado: "Clicou em link do e-mail",
  whatsapp_botao: "Tocou em botão do WhatsApp",
  whatsapp_palavra_chave: "Escreveu uma palavra-chave",
  formulario_respondido: "Respondeu um formulário",
  campanha_entregue: "Recebeu uma campanha",
  sem_resposta: "Ficou sem responder",
  tag_adicionada: "Ganhou uma tag",
  etapa_alterada: "Mudou de etapa no funil",
  contato_criado: "Foi criado no CRM",
  proposta_aceita: "Aceitou uma proposta",
  compra_aprovada: "Teve a compra aprovada",
};

/** Evento de domínio que o motor escuta para cada gatilho (seção 8). */
export const RULE_TRIGGER_EVENT: Record<RuleTriggerKind, string> = {
  email_aberto: "email.opened",
  email_clicado: "email.clicked",
  whatsapp_botao: "message.button_clicked",
  whatsapp_palavra_chave: "message.received",
  formulario_respondido: "form.submitted",
  campanha_entregue: "campaign.delivered",
  sem_resposta: "conversation.idle",
  tag_adicionada: "contact.tagged",
  etapa_alterada: "deal.stage_changed",
  contato_criado: "contact.created",
  proposta_aceita: "proposal.accepted",
  /** A seção 15 nomeia este gatilho como "compra aprovada". */
  compra_aprovada: "proposal.paid",
};

export interface RuleTrigger {
  kind: RuleTriggerKind;
  /** Parâmetros do gatilho: qual template, qual botão, quantos dias sem resposta. */
  config: Record<string, string | number>;
}

/* Condições --------------------------------------------------------------- */

export type RuleOperator =
  "igual_a" | "diferente_de" | "contem" | "maior_que" | "menor_que" | "existe" | "nao_existe";

export const RULE_OPERATOR_LABEL: Record<RuleOperator, string> = {
  igual_a: "é igual a",
  diferente_de: "é diferente de",
  contem: "contém",
  maior_que: "é maior que",
  menor_que: "é menor que",
  existe: "existe",
  nao_existe: "não existe",
};

export interface RuleCondition {
  id: Id;
  field: string;
  fieldLabel: string;
  operator: RuleOperator;
  value: string;
}

/* Ações ------------------------------------------------------------------- */

export type RuleActionKind =
  | "enviar_whatsapp"
  | "enviar_email"
  | "criar_tarefa"
  | "adicionar_tag"
  | "remover_tag"
  | "mover_etapa"
  | "atribuir_dono"
  | "notificar_equipe"
  | "iniciar_jornada"
  | "webhook"
  | "atualizar_campo";

export const RULE_ACTION_LABEL: Record<RuleActionKind, string> = {
  enviar_whatsapp: "Enviar WhatsApp",
  enviar_email: "Enviar e-mail",
  criar_tarefa: "Criar tarefa",
  adicionar_tag: "Adicionar tag",
  remover_tag: "Remover tag",
  mover_etapa: "Mover etapa do funil",
  atribuir_dono: "Atribuir responsável",
  notificar_equipe: "Notificar equipe",
  iniciar_jornada: "Iniciar jornada",
  webhook: "Chamar webhook",
  atualizar_campo: "Atualizar campo",
};

export interface RuleAction {
  id: Id;
  kind: RuleActionKind;
  config: Record<string, string | number>;
  /** Atraso antes de executar, em minutos. Zero significa imediato. */
  delayMinutes: number;
}

/* Regra ------------------------------------------------------------------- */

export interface RuleStats {
  runs30d: number;
  success: number;
  errors: number;
  lastRunAt?: IsoDateTime;
  /** Conversões atribuídas à regra — negócio criado, reunião agendada. */
  conversions: number;
}

export interface AutomationRule extends BaseEntity {
  name: string;
  description: string;
  enabled: boolean;
  trigger: RuleTrigger;
  conditionMatch: "todas" | "qualquer";
  conditions: RuleCondition[];
  actions: RuleAction[];
  /**
   * Limite por contato: sem isto, um contato que clica cinco vezes no mesmo
   * botão recebe cinco vezes a mesma coisa.
   */
  maxPerContactPerDays: number;
  ownerId: Id;
  stats: RuleStats;
}

/** Execução registrada — alimenta a aba de histórico. */
export interface RuleRun {
  id: Id;
  ruleId: Id;
  contactId: Id;
  occurredAt: IsoDateTime;
  status: "sucesso" | "erro" | "ignorado";
  /** Motivo quando ignorado: limite de frequência, condição falsa, consentimento. */
  detail: string;
  correlationId?: string;
}
