/**
 * Catálogo de demonstração: habilidades, motivos de encerramento e campos.
 *
 * As habilidades espelham a divisão real de um escritório contábil — é o que faz
 * a distribuição por competência ser demonstrável sem inventar vocabulário
 * genérico do tipo "nível 1" e "nível 2", que não decide nada.
 */

import type { ClosingReason, CustomFieldDefinition, SkillDefinition } from "../types/catalog";
import { offsetIso } from "../utils/datetime";
import { ORG_ID } from "./organization";

const CREATED = offsetIso({ days: -200 });
const UPDATED = offsetIso({ days: -20 });

function base(id: string) {
  return { id, organizationId: ORG_ID, createdAt: CREATED, updatedAt: UPDATED };
}

export const skills: SkillDefinition[] = [
  {
    ...base("skill_fiscal"),
    key: "fiscal",
    label: "Fiscal",
    description: "Apuração, guias, obrigações acessórias e prazos.",
    hue: 218,
    active: true,
  },
  {
    ...base("skill_contabil"),
    key: "contabil",
    label: "Contábil",
    description: "Balancetes, DRE, encerramento e conciliação.",
    hue: 200,
    active: true,
  },
  {
    ...base("skill_dp"),
    key: "departamento_pessoal",
    label: "Departamento pessoal",
    description: "Folha, admissão, rescisão, eSocial e férias.",
    hue: 160,
    active: true,
  },
  {
    ...base("skill_societario"),
    key: "societario",
    label: "Societário",
    description: "Abertura, alteração contratual, certidões e baixa.",
    hue: 280,
    active: true,
  },
  {
    ...base("skill_simples"),
    key: "simples_nacional",
    label: "Simples Nacional",
    description: "Enquadramento, DAS, sublimite e desenquadramento.",
    hue: 30,
    active: true,
  },
  {
    ...base("skill_cursos"),
    key: "cursos",
    label: "Cursos e matrículas",
    description: "Inscrição, acesso à plataforma, certificado e renovação.",
    hue: 45,
    active: true,
  },
];

export const closingReasons: ClosingReason[] = [
  {
    ...base("close_resolvido"),
    key: "resolvido",
    label: "Resolvido no atendimento",
    description: "A dúvida foi respondida e o cliente confirmou.",
    resolved: true,
    requiresNote: false,
    active: true,
    order: 1,
  },
  {
    ...base("close_encaminhado"),
    key: "encaminhado_area",
    label: "Encaminhado à área interna",
    description: "Depende de outro setor e saiu do atendimento com prazo combinado.",
    resolved: true,
    requiresNote: true,
    active: true,
    order: 2,
  },
  {
    ...base("close_sem_resposta"),
    key: "sem_resposta",
    label: "Cliente não respondeu",
    description: "Ficou aguardando o cliente e o prazo de espera venceu.",
    resolved: false,
    requiresNote: false,
    active: true,
    order: 3,
  },
  {
    ...base("close_duplicada"),
    key: "duplicada",
    label: "Conversa duplicada",
    description: "O mesmo assunto já estava sendo tratado em outra conversa.",
    resolved: false,
    requiresNote: true,
    active: true,
    order: 4,
  },
  {
    ...base("close_engano"),
    key: "engano",
    label: "Contato por engano",
    description: "Não é cliente nem interessado — número ou endereço errado.",
    resolved: false,
    requiresNote: false,
    active: true,
    order: 5,
  },
  {
    ...base("close_perdido"),
    key: "oportunidade_perdida",
    label: "Oportunidade perdida",
    description: "Lead comercial que declinou. O motivo detalhado vai na nota.",
    resolved: false,
    requiresNote: true,
    active: true,
    order: 6,
  },
];

export const customFields: CustomFieldDefinition[] = [
  {
    ...base("cf_regime"),
    key: "regime_tributario",
    label: "Regime tributário",
    description: "Enquadramento atual da empresa. Decide fila, prazo e material enviado.",
    entity: "empresa",
    type: "selecao",
    options: ["Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI", "Não se aplica"],
    required: true,
    derived: false,
    sensitive: false,
    active: true,
  },
  {
    ...base("cf_origem"),
    key: "origem_detalhada",
    label: "Origem detalhada",
    description: "De onde veio o lead, no nível que a campanha informa.",
    entity: "contato",
    type: "texto",
    options: [],
    required: false,
    derived: false,
    sensitive: false,
    active: true,
  },
  {
    ...base("cf_cpf"),
    key: "documento",
    label: "CPF / CNPJ",
    description: "Documento usado na resolução de identidade (seção 9.3).",
    entity: "contato",
    type: "documento",
    options: [],
    required: false,
    derived: false,
    sensitive: true,
    active: true,
  },
  {
    ...base("cf_abertura"),
    key: "data_abertura",
    label: "Data de abertura",
    description: "Constituição da empresa, usada para prazos societários.",
    entity: "empresa",
    type: "data",
    options: [],
    required: false,
    derived: false,
    sensitive: false,
    active: true,
  },
  {
    ...base("cf_tempo_casa"),
    key: "meses_de_casa",
    label: "Meses de casa",
    description: "Calculado a partir da data de entrada. Não é editável à mão.",
    entity: "empresa",
    type: "numero",
    options: [],
    required: false,
    derived: true,
    sensitive: false,
    active: true,
  },
  {
    ...base("cf_inadimplente"),
    key: "inadimplente",
    label: "Em atraso financeiro",
    description: "Vem da integração financeira e trava campanha de upsell.",
    entity: "empresa",
    type: "booleano",
    options: [],
    required: false,
    derived: true,
    sensitive: false,
    active: true,
  },
];
