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
 *
 * ## O porte da empresa entra, e entra como linha
 *
 * As parcelas técnicas contam o que se **instala**; nenhuma delas conta o que se
 * **negocia**. Implantar doze assentos numa empresa de trinta pessoas e numa de
 * três mil dá o mesmo trabalho técnico e trabalho de projeto completamente
 * diferente: comitê de segurança, homologação em janela, revisão do jurídico,
 * três reuniões para aprovar o que numa empresa pequena se decide no grupo do
 * WhatsApp. Era esse o buraco — e ele aparecia como projeto que estoura horas
 * sem ninguém saber explicar por quê.
 *
 * O porte vira **linha**, não multiplicador escondido. Um coeficiente aplicado
 * em silêncio sobre o total dá o mesmo número e destrói a conversa: "por que
 * R$ 18 mil?" volta a não ter resposta, que é justamente o que este arquivo
 * existe para evitar.
 *
 * ## Faturamento e colaboradores não se somam — vale o maior
 *
 * Uma distribuidora com R$ 80 milhões e vinte funcionários e uma rede de lojas
 * com R$ 12 milhões e quatrocentos são as duas complexas, por motivos
 * diferentes. Multiplicar os dois portes cobraria em dobro de quem é grande nas
 * duas pontas; somar diluiria quem é grande em uma só. O porte é o **maior** dos
 * dois, e a linha diz qual dos dois mandou.
 */

import type { PlanKey } from "./catalog";
import { PLAN_BY_KEY } from "./catalog";

/* Porte da empresa --------------------------------------------------------------- */

export type CompanySize = "micro" | "pequena" | "media" | "media_grande" | "grande";

export interface CompanySizeBand {
  key: CompanySize;
  label: string;
  /** Teto de faturamento anual da faixa, em centavos. `null` é a última. */
  revenueUpToCents: number | null;
  /** Teto de colaboradores da faixa. `null` é a última. */
  employeesUpTo: number | null;
  /**
   * Acréscimo sobre a base da edição, em pontos percentuais.
   *
   * Zero na micro de propósito: é o porte para o qual a base foi dimensionada,
   * e cobrar adicional dela seria admitir que a base está subdimensionada para
   * todo mundo.
   */
  surchargePct: number;
  /** O que justifica o acréscimo, escrito para aparecer no orçamento. */
  rationale: string;
}

/**
 * As faixas seguem os critérios de porte já usados no Brasil — o teto do
 * Simples em R$ 4,8 milhões, o corte de média empresa do BNDES em R$ 300
 * milhões — em vez de números redondos inventados. Quem recebe o orçamento
 * reconhece a régua, e reconhecer a régua encurta a discussão sobre ela.
 */
export const COMPANY_SIZE_BANDS: CompanySizeBand[] = [
  {
    key: "micro",
    label: "Microempresa",
    revenueUpToCents: 36_000_000,
    employeesUpTo: 19,
    surchargePct: 0,
    rationale: "Decisão concentrada, sem camada de aprovação — é o porte da base.",
  },
  {
    key: "pequena",
    label: "Pequena empresa",
    revenueUpToCents: 480_000_000,
    employeesUpTo: 99,
    surchargePct: 18,
    rationale: "Mais de um time envolvido e uma rodada de aprovação antes de publicar.",
  },
  {
    key: "media",
    label: "Média empresa",
    revenueUpToCents: 3_000_000_000,
    employeesUpTo: 499,
    surchargePct: 45,
    rationale: "Comitê de segurança, homologação em janela combinada e revisão de contrato.",
  },
  {
    key: "media_grande",
    label: "Média-grande empresa",
    revenueUpToCents: 30_000_000_000,
    employeesUpTo: 1_999,
    surchargePct: 85,
    rationale: "Time de TI próprio, ambiente de homologação e plano de corte reversível.",
  },
  {
    key: "grande",
    label: "Grande empresa",
    revenueUpToCents: null,
    employeesUpTo: null,
    surchargePct: 140,
    rationale: "Auditoria, parecer jurídico e implantação por onda, com marco formal em cada uma.",
  },
];

export const SIZE_BAND_BY_KEY: Record<CompanySize, CompanySizeBand> = Object.fromEntries(
  COMPANY_SIZE_BANDS.map((band) => [band.key, band]),
) as Record<CompanySize, CompanySizeBand>;

function bandByRevenue(revenueCents: number): CompanySizeBand {
  return (
    COMPANY_SIZE_BANDS.find(
      (band) => band.revenueUpToCents === null || revenueCents <= band.revenueUpToCents,
    ) ?? COMPANY_SIZE_BANDS[COMPANY_SIZE_BANDS.length - 1]!
  );
}

function bandByEmployees(employees: number): CompanySizeBand {
  return (
    COMPANY_SIZE_BANDS.find(
      (band) => band.employeesUpTo === null || employees <= band.employeesUpTo,
    ) ?? COMPANY_SIZE_BANDS[COMPANY_SIZE_BANDS.length - 1]!
  );
}

export interface ResolvedSize {
  band: CompanySizeBand;
  /** Qual dos dois critérios definiu o porte — é o que a linha do orçamento diz. */
  drivenBy: "faturamento" | "colaboradores" | "ambos";
}

/**
 * O porte que vale: o maior entre o de faturamento e o de colaboradores.
 *
 * Devolve também **qual** dos dois mandou, porque a pergunta seguinte do cliente
 * é sempre essa. "Média empresa pelo número de colaboradores" é uma frase que
 * ele confere; "média empresa" sozinho é uma classificação que ele contesta.
 */
export function resolveCompanySize(revenueCents: number, employees: number): ResolvedSize {
  const byRevenue = bandByRevenue(Math.max(0, revenueCents));
  const byEmployees = bandByEmployees(Math.max(0, employees));

  const revenueIndex = COMPANY_SIZE_BANDS.indexOf(byRevenue);
  const employeesIndex = COMPANY_SIZE_BANDS.indexOf(byEmployees);

  if (revenueIndex === employeesIndex) return { band: byRevenue, drivenBy: "ambos" };
  return revenueIndex > employeesIndex
    ? { band: byRevenue, drivenBy: "faturamento" }
    : { band: byEmployees, drivenBy: "colaboradores" };
}

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
  /**
   * Cada unidade, filial ou CNPJ além do primeiro.
   *
   * É a parcela que mais consome hora em rede e franquia, e a que mais escapa
   * do orçamento: cada unidade quer fila própria, escala própria, responsável
   * próprio e quase sempre número próprio — e descobre isso depois do aceite.
   */
  perBusinessUnitCents: number;
  /**
   * Conformidade em setor regulado — saúde, financeiro, jurídico.
   *
   * Revisão de retenção por categoria de dado, consentimento por finalidade com
   * o texto que o jurídico do cliente aprova, e o parecer dele antes de publicar
   * qualquer fluxo. É valor fixo porque o trabalho é o mesmo: o que muda com o
   * porte já está na linha de porte.
   */
  regulatedSectorCents: number;
}

export const SETUP_RATES: SetupRates = {
  perWhatsappNumberCents: 45_000,
  perIntegrationCents: 320_000,
  perTrainingGroupCents: 180_000,
  trainingGroupSize: 12,
  perTenThousandContactsCents: 60_000,
  perFlowCents: 140_000,
  perBusinessUnitCents: 95_000,
  regulatedSectorCents: 380_000,
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
  /** Faturamento anual da empresa do cliente, em centavos. */
  annualRevenueCents: number;
  /**
   * Colaboradores da **empresa**, não assentos na plataforma.
   *
   * A distinção é o ponto: uma empresa de quatrocentas pessoas com doze no
   * atendimento tem governança de quatrocentas. Ler o número de assentos daria
   * porte de micro para um projeto que exige comitê.
   */
  employees: number;
  /** Unidades, filiais ou CNPJs a atender. O primeiro está na base. */
  businessUnits: number;
  /** Setor regulado — saúde, financeiro ou jurídico. */
  regulatedSector: boolean;
}

export const DEFAULT_SETUP_INPUT: Omit<SetupInput, "planKey"> = {
  whatsappNumbers: 1,
  integrations: 0,
  peopleToTrain: 8,
  contactsToMigrate: 10_000,
  flows: 2,
  annualRevenueCents: 300_000_000,
  employees: 40,
  businessUnits: 1,
  regulatedSector: false,
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
  /** O porte apurado e qual critério o definiu. */
  size: ResolvedSize;
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

  /** O primeiro CNPJ está na base; do segundo em diante, cada um é operação nova. */
  const extraUnits = Math.max(0, Math.round(input.businessUnits) - 1);
  if (extraUnits > 0) {
    lines.push({
      key: "unidades",
      label: "Unidades, filiais ou CNPJs adicionais",
      detail: "Fila, escala, responsável e catálogo de motivos próprios de cada unidade.",
      quantity: extraUnits,
      totalCents: extraUnits * rates.perBusinessUnitCents,
    });
  }

  if (input.regulatedSector) {
    lines.push({
      key: "conformidade",
      label: "Conformidade de setor regulado",
      detail:
        "Retenção por categoria de dado, consentimento por finalidade com o texto do jurídico do cliente e parecer dele antes de publicar.",
      quantity: 1,
      totalCents: rates.regulatedSectorCents,
    });
  }

  /**
   * O porte entra por último e incide **só sobre a base**.
   *
   * Aplicá-lo ao total cobraria porte em cima de migração de contatos, que é
   * trabalho de máquina e não muda com o tamanho da empresa — e produziria a
   * conta em que importar cem mil contatos numa empresa grande custa o dobro de
   * importar cem mil contatos numa pequena, o que não se sustenta em nenhuma
   * conversa.
   */
  const size = resolveCompanySize(input.annualRevenueCents, input.employees);
  const sizeSurchargeCents = Math.round((plan.setupCents * size.band.surchargePct) / 100);

  if (sizeSurchargeCents > 0) {
    lines.push({
      key: "porte",
      label: `Adequação ao porte — ${size.band.label}`,
      detail:
        size.drivenBy === "ambos"
          ? `${size.band.rationale} Enquadramento por faturamento e por número de colaboradores.`
          : `${size.band.rationale} Enquadramento por ${size.drivenBy}.`,
      quantity: 1,
      totalCents: sizeSurchargeCents,
    });
  }

  return {
    lines,
    totalCents: lines.reduce((sum, line) => sum + line.totalCents, 0),
    trainingGroups,
    size,
  };
}
