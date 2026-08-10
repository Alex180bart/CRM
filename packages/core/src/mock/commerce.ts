/**
 * Catálogo de demonstração: produtos e serviços de um escritório contábil.
 *
 * Os itens espelham a oferta real da Contabilidade Facilitada — abertura,
 * contabilidade recorrente por porte, regularização e curso — porque é o que
 * torna a montagem de proposta demonstrável. Um catálogo genérico do tipo "Plano
 * A / Plano B" não exercita nada do que importa aqui: mistura de recorrente com
 * avulso no mesmo carrinho, teto de desconto diferente por margem e os dois
 * modos de pagamento convivendo.
 *
 * Os tetos de desconto não são arbitrários. Serviço recorrente carrega margem
 * fina e custo mensal de entrega, então o teto é baixo; item avulso de alto
 * valor absorve mais. É essa diferença que faz o portão do gestor disparar em
 * uns e não em outros, que é justamente o comportamento a ser observado.
 */

import type { Product } from "../types/commerce";
import { offsetIso } from "../utils/datetime";
import { ORG_ID } from "./organization";

const CREATED = offsetIso({ days: -180 });
const UPDATED = offsetIso({ days: -12 });

function base(id: string) {
  return { id, organizationId: ORG_ID, createdAt: CREATED, updatedAt: UPDATED };
}

export const products: Product[] = [
  {
    ...base("prod_abertura_mei"),
    key: "abertura_mei",
    name: "Abertura de MEI",
    kind: "servico",
    summary: "Abertura completa do MEI, com CNPJ, alvará e primeiro DAS orientado.",
    description:
      "Cuidamos de todo o processo de formalização: consulta de viabilidade, registro no Portal do Empreendedor, emissão do CCMEI, orientação sobre alvará municipal e explicação do primeiro DAS. O prazo médio é de dois dias úteis após o envio dos documentos.",
    priceCents: 29_000,
    recurrence: "unico",
    maxDiscountPct: 20,
    includes: [
      "Consulta de viabilidade do CNAE",
      "Registro e emissão do CCMEI",
      "Orientação de alvará e inscrição municipal",
      "Explicação do primeiro DAS",
    ],
    salesNotes:
      "Serviço de entrada: quem abre MEI aqui costuma virar cliente de contabilidade mensal em até um ano. Vale oferecer junto do Contabilidade MEI Mensal — o desconto combinado fecha mais que o desconto isolado. Objeção comum: 'dá para fazer sozinho de graça'. Resposta honesta: dá, e o valor está em não errar o CNAE, que é o que obriga a migrar de regime depois.",
    checkout: {
      mode: "link",
      baseUrl: "https://pagar.contabilidadefacilitada.com.br/abertura-mei",
    },
    active: true,
  },
  {
    ...base("prod_contabilidade_mei"),
    key: "contabilidade_mei",
    name: "Contabilidade MEI mensal",
    kind: "servico",
    summary: "Rotina mensal do MEI: DAS, declaração anual e suporte por WhatsApp.",
    description:
      "Emissão e acompanhamento do DAS mensal, entrega da DASN-SIMEI no prazo, controle de limite de faturamento com aviso antes do estouro e suporte por WhatsApp em horário comercial.",
    priceCents: 9_900,
    recurrence: "mensal",
    maxDiscountPct: 10,
    includes: [
      "DAS mensal emitido e lembrado",
      "Declaração anual (DASN-SIMEI)",
      "Aviso de limite de faturamento",
      "Suporte por WhatsApp em horário comercial",
    ],
    salesNotes:
      "Margem fina: o teto de 10% existe porque o custo de entrega é mensal e não cai com desconto. O argumento que fecha não é preço, é o aviso de limite — quem estoura o teto do MEI sem saber paga muito mais caro depois.",
    checkout: {
      mode: "link",
      baseUrl: "https://pagar.contabilidadefacilitada.com.br/contabilidade-mei",
    },
    active: true,
  },
  {
    ...base("prod_contabilidade_simples"),
    key: "contabilidade_simples",
    name: "Contabilidade Simples Nacional",
    kind: "servico",
    summary: "Escrituração, folha, obrigações acessórias e apuração mensal.",
    description:
      "Contabilidade completa para empresa no Simples Nacional: escrituração contábil e fiscal, apuração e guia mensal, folha de pagamento de até cinco colaboradores, obrigações acessórias e balancete trimestral.",
    priceCents: 49_900,
    recurrence: "mensal",
    maxDiscountPct: 12,
    includes: [
      "Escrituração contábil e fiscal",
      "Apuração e guia mensal",
      "Folha de até 5 colaboradores",
      "Obrigações acessórias",
      "Balancete trimestral",
    ],
    salesNotes:
      "Serviço principal do escritório. Acima de cinco colaboradores há adicional por folha — não prometa 'ilimitado'. Quando o cliente compara com concorrente mais barato, o que diferencia é o balancete trimestral, que quase ninguém entrega sem cobrar à parte.",
    checkout: { mode: "integrado" },
    active: true,
  },
  {
    ...base("prod_regularizacao"),
    key: "regularizacao_cnpj",
    name: "Regularização de CNPJ",
    kind: "servico",
    summary: "Levantamento de pendências, parcelamento e reativação do CNPJ.",
    description:
      "Diagnóstico completo de pendências federais, estaduais e municipais, negociação e parcelamento de débitos, entrega de declarações em atraso e acompanhamento até a certidão negativa.",
    priceCents: 149_000,
    recurrence: "unico",
    maxDiscountPct: 25,
    includes: [
      "Diagnóstico de pendências nas três esferas",
      "Declarações em atraso",
      "Parcelamento negociado",
      "Acompanhamento até a certidão",
    ],
    salesNotes:
      "Ticket alto e urgência alta: quem procura já está com o CNPJ travado. O teto de 25% é o maior do catálogo porque o escopo varia muito — CNPJ com dois anos de atraso dá mais trabalho que um com seis meses, e o preço é uma média. Não feche sem entender há quanto tempo está parado.",
    checkout: { mode: "integrado" },
    active: true,
  },
  {
    ...base("prod_curso_mei"),
    key: "curso_mei_na_pratica",
    name: "Curso MEI na Prática",
    kind: "produto",
    summary: "Curso gravado de 6 horas sobre a rotina do MEI, com certificado.",
    description:
      "Seis horas de aulas gravadas cobrindo emissão de nota, controle de faturamento, quando migrar de regime e como não cair na malha. Acesso por doze meses e certificado de conclusão.",
    priceCents: 19_700,
    recurrence: "unico",
    maxDiscountPct: 40,
    includes: [
      "6 horas de aulas gravadas",
      "Planilha de controle de faturamento",
      "Certificado de conclusão",
      "Acesso por 12 meses",
    ],
    salesNotes:
      "Produto digital: custo marginal quase zero, por isso o teto de 40%. Serve como oferta de recuperação para quem recusou a contabilidade mensal por preço — sai da conversa com algo, e volta depois.",
    checkout: {
      mode: "link",
      baseUrl: "https://cursos.contabilidadefacilitada.com.br/mei-na-pratica",
    },
    active: true,
  },
  {
    ...base("prod_folha_adicional"),
    key: "folha_adicional",
    name: "Folha adicional por colaborador",
    kind: "servico",
    summary: "Colaborador além dos cinco inclusos na contabilidade mensal.",
    description:
      "Processamento de folha, encargos, férias e décimo terceiro para cada colaborador acima do limite incluso no plano de contabilidade mensal.",
    priceCents: 4_900,
    recurrence: "mensal",
    maxDiscountPct: 0,
    includes: ["Folha mensal", "Encargos e guias", "Férias e décimo terceiro"],
    salesNotes:
      "Teto zero: é preço de tabela, e dar desconto aqui corrói exatamente a margem que o plano principal já entrega no limite. Se precisar ceder, ceda no plano principal e mantenha este cheio.",
    checkout: { mode: "integrado" },
    active: true,
  },
  {
    ...base("prod_certificado_a3"),
    key: "certificado_a3",
    name: "Certificado digital A3 em cartão",
    kind: "produto",
    summary: "Descontinuado — o A1 em nuvem substituiu, sem leitora.",
    description:
      "Certificado digital A3 com validade de três anos, emitido em cartão com leitora USB. Exige comparecimento presencial para validação.",
    priceCents: 38_000,
    recurrence: "unico",
    maxDiscountPct: 10,
    includes: ["Certificado A3 válido por 3 anos", "Cartão e leitora USB", "Validação presencial"],
    salesNotes:
      "Não ofereça. Substituído pelo A1 em nuvem, que dispensa leitora e é renovado sem o cliente sair do lugar.",
    checkout: { mode: "integrado" },
    /**
     * O único inativo do catálogo, e ele existe por dois motivos.
     *
     * O primeiro é honestidade: escritório que vende há anos tem item que parou
     * de vender, e um catálogo em que tudo está ativo não se parece com nenhuma
     * operação real.
     *
     * O segundo é que ele torna **demonstrável** a regra que separa desativar de
     * excluir — inativo some da montagem de proposta e da resposta da IA, e
     * continua aparecendo nas propostas antigas que o citam. Sem um item nesse
     * estado, a regra existe no código e não aparece em lugar nenhum da tela.
     */
    active: false,
  },
];
