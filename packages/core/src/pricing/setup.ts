/**
 * Implantação assistida, composta por porte.
 *
 * ## Por que deixou de ser um número redondo
 *
 * Antes a implantação era um valor fixo por edição — R$ 1.900 no Essencial,
 * R$ 28.000 no Corporativo. Funciona para publicar na página de preços e falha
 * nas duas pontas da negociação: quem tem um número de WhatsApp e nenhuma
 * integração acha caro e tem razão; quem tem cinco números, ERP para integrar e
 * quarenta pessoas para treinar acha barato — e aí quem perde somos nós, porque
 * o projeto consome o dobro das horas orçadas.
 *
 * O valor agora é uma soma de parcelas que o cliente consegue ler. Isso muda a
 * conversa: "por que R$ 12 mil?" passa a ter resposta em vez de silêncio, e
 * cortar escopo vira uma alternativa concreta ao desconto.
 *
 * ## A base por edição continua existindo
 *
 * `plan.setupCents` vira o **piso**: é o custo de colocar a plataforma de pé
 * naquela edição, com o que ela liberou de recurso. As parcelas abaixo somam a
 * partir dele. Manter a base preserva a coerência com a página de preços, que
 * anuncia "a partir de" — e evita que uma implantação mínima saia por um valor
 * que não paga a hora de quem a executa.
 *
 * ## Nada aqui é hora vendida por hora
 *
 * Cada parcela é um pacote com escopo declarado, não uma estimativa de esforço.
 * Orçar por hora transfere ao cliente o risco da nossa imprecisão, e a primeira
 * reunião que atrasa vira discussão de fatura.
 */

import type { PlanKey } from "./catalog";
import { PLAN_BY_KEY } from "./catalog";

export interface SetupRates {
  /** Conexão, verificação e migração de um número de WhatsApp além do primeiro. */
  perWhatsappNumberCents: number;
  /** Integração com sistema do cliente — ERP, sistema acadêmico, gateway. */
  perIntegrationCents: number;
  /** Treinamento da operação, por turma de até 12 pessoas. */
  perTrainingGroupCents: number;
  /** Tamanho da turma. Acima disso, a atenção por pessoa cai e o treino não pega. */
  trainingGroupSize: number;
  /** Importação e deduplicação da base atual, por 10 mil contatos. */
  perTenThousandContactsCents: number;
  /** Desenho e publicação de um fluxo de chatbot ou jornada. */
  perFlowCents: number;
}

export const SETUP_RATES: SetupRates = {
  perWhatsappNumberCents: 45_000,
  perIntegrationCents: 320_000,
  perTrainingGroupCents: 180_000,
  trainingGroupSize: 12,
  perTenThousandContactsCents: 60_000,
  perFlowCents: 140_000,
};

export interface SetupInput {
  planKey: PlanKey;
  /** Números a conectar. O primeiro já está na base. */
  whatsappNumbers: number;
  /** Sistemas do cliente a integrar. */
  integrations: number;
  /** Pessoas a treinar — vira turmas. */
  peopleToTrain: number;
  /** Contatos da base atual a importar. */
  contactsToMigrate: number;
  /** Fluxos de chatbot ou jornada a desenhar junto. */
  flows: number;
}

export const DEFAULT_SETUP_INPUT: Omit<SetupInput, "planKey"> = {
  whatsappNumbers: 1,
  integrations: 0,
  peopleToTrain: 8,
  contactsToMigrate: 10_000,
  flows: 2,
};

export interface SetupLine {
  key: string;
  label: string;
  detail: string;
  quantity: number;
  totalCents: number;
}

export interface SetupResult {
  lines: SetupLine[];
  totalCents: number;
  /** Turmas de treinamento, para a tela explicar o arredondamento. */
  trainingGroups: number;
}

/**
 * Compõe o valor da implantação.
 *
 * Parcela zerada **não vira linha**. Um orçamento com "Integrações: R$ 0" ensina
 * o cliente a perguntar por que ele está pagando por algo que não tem, e a
 * resposta consome os cinco minutos que deviam ser sobre o que ele tem.
 */
export function calculateSetup(input: SetupInput, rates: SetupRates = SETUP_RATES): SetupResult {
  const plan = PLAN_BY_KEY[input.planKey] ?? PLAN_BY_KEY.profissional;
  const lines: SetupLine[] = [];

  lines.push({
    key: "base",
    label: `Implantação base — ${plan.name}`,
    detail:
      "Configuração da conta, filas, escalas, perfis e o primeiro número de WhatsApp verificado.",
    quantity: 1,
    totalCents: plan.setupCents,
  });

  /** O primeiro número está na base; a partir do segundo, cada um é trabalho novo. */
  const extraNumbers = Math.max(0, Math.round(input.whatsappNumbers) - 1);
  if (extraNumbers > 0) {
    lines.push({
      key: "numeros",
      label: "Números de WhatsApp adicionais",
      detail: "Verificação na Meta, fila própria, escala e template inicial de cada número.",
      quantity: extraNumbers,
      totalCents: extraNumbers * rates.perWhatsappNumberCents,
    });
  }

  const integrations = Math.max(0, Math.round(input.integrations));
  if (integrations > 0) {
    lines.push({
      key: "integracoes",
      label: "Integrações com sistemas do cliente",
      detail:
        "Mapeamento de campos, direção de sincronização, chave de idempotência e homologação.",
      quantity: integrations,
      totalCents: integrations * rates.perIntegrationCents,
    });
  }

  /**
   * Turmas, e não pessoas.
   *
   * Treinar 13 pessoas custa duas turmas porque a segunda sessão acontece de
   * qualquer jeito. Cobrar proporcional ao número de cabeças esconderia esse
   * degrau e produziria um orçamento que não paga a hora executada.
   */
  const trainingGroups = Math.ceil(
    Math.max(0, Math.round(input.peopleToTrain)) / rates.trainingGroupSize,
  );
  if (trainingGroups > 0) {
    lines.push({
      key: "treinamento",
      label: "Treinamento da operação",
      detail: `${trainingGroups} turma(s) de até ${rates.trainingGroupSize} pessoas, com gravação e material.`,
      quantity: trainingGroups,
      totalCents: trainingGroups * rates.perTrainingGroupCents,
    });
  }

  const migrationUnits = Math.ceil(Math.max(0, input.contactsToMigrate) / 10_000);
  if (migrationUnits > 0) {
    lines.push({
      key: "migracao",
      label: "Importação e deduplicação da base",
      detail: `${input.contactsToMigrate.toLocaleString("pt-BR")} contatos, com normalização de telefone e documento.`,
      quantity: migrationUnits,
      totalCents: migrationUnits * rates.perTenThousandContactsCents,
    });
  }

  const flows = Math.max(0, Math.round(input.flows));
  if (flows > 0) {
    lines.push({
      key: "fluxos",
      label: "Fluxos desenhados junto",
      detail: "Desenho, simulação e publicação de chatbot ou jornada com o time do cliente.",
      quantity: flows,
      totalCents: flows * rates.perFlowCents,
    });
  }

  return {
    lines,
    totalCents: lines.reduce((sum, line) => sum + line.totalCents, 0),
    trainingGroups,
  };
}
