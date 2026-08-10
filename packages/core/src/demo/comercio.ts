/**
 * Catálogo comercial e propostas de demonstração, por vertical.
 *
 * ## Por que as propostas são geradas, e não escritas à mão
 *
 * Escrever proposta literal por vertical significaria escrever `totalCents`,
 * `discountCents` e o endereço de pagamento à mão — quatro vezes. E dado
 * literal **não sabe da regra**: bastaria alguém mudar o arredondamento em
 * `lineTotalCents` para a demonstração passar a mostrar um total que o produto
 * não calcula mais. O erro apareceria na frente do cliente, num número que
 * ninguém confere de cabeça.
 *
 * Aqui as propostas saem de `buildProposalItem`, `computeTotals` e
 * `buildCheckoutUrl` — exatamente as funções que a aplicação chama. A base de
 * demonstração deixa de ser uma segunda fonte da verdade e passa a ser um
 * **exercício** das regras.
 *
 * ## O que a geração cobre de propósito
 *
 * Uma proposta por estado que tem tela: rascunho, aguardando o gestor, enviada,
 * aceita com link e paga. É o mínimo para conferir o fluxo inteiro sem clicar,
 * e é o que faltava para responder "como isso aparece quando o cliente aceita?"
 * sem montar o caso na hora.
 *
 * A que fica **aguardando o gestor** carrega desconto acima do teto de
 * propósito, e o teto vem do produto — então ela continua acima mesmo se alguém
 * reescrever os catálogos abaixo, porque o desconto é calculado a partir do
 * teto, não fixado num número.
 *
 * ## Nada aqui é real
 *
 * Empresas, preços e endereços de pagamento são fictícios. Os domínios
 * (`pagar.*.com.br`) não existem e não devem existir: o link é montado para ser
 * visto, e clicar nele em demonstração precisa dar em nada, não em cobrança de
 * verdade.
 */

import type { Contact } from "../types/crm";
import type { Conversation } from "../types/inbox";
import type { Product, Proposal, ProposalStatus } from "../types/commerce";
import type { User } from "../types/organization";
import type { DemoVerticalId } from "./types";
import { buildCheckoutUrl, buildProposalItem, computeTotals } from "../utils/commerce";
import { offsetIso } from "../utils/datetime";

/* Catálogos ------------------------------------------------------------------- */

interface CatalogSeed {
  key: string;
  name: string;
  kind: Product["kind"];
  summary: string;
  description: string;
  priceCents: number;
  recurrence: Product["recurrence"];
  maxDiscountPct: number;
  includes: string[];
  salesNotes: string;
  /** Ausente significa cobrança integrada — que ainda não tem provedor. */
  baseUrl?: string;
}

function buildProducts(orgId: string, seeds: CatalogSeed[]): Product[] {
  const createdAt = offsetIso({ days: -180 });
  const updatedAt = offsetIso({ days: -12 });

  return seeds.map((seed, index) => ({
    id: `prod_${seed.key}`,
    organizationId: orgId,
    createdAt,
    updatedAt,
    key: seed.key,
    name: seed.name,
    kind: seed.kind,
    summary: seed.summary,
    description: seed.description,
    priceCents: seed.priceCents,
    recurrence: seed.recurrence,
    maxDiscountPct: seed.maxDiscountPct,
    includes: [...seed.includes],
    salesNotes: seed.salesNotes,
    checkout: seed.baseUrl
      ? { mode: "link" as const, baseUrl: seed.baseUrl }
      : { mode: "integrado" as const },
    // O último de cada catálogo nasce inativo: é o que torna demonstrável a
    // regra de que inativo some da montagem e continua no histórico.
    active: index < seeds.length - 1,
  }));
}

const ECOMMERCE: CatalogSeed[] = [
  {
    key: "kit_luminarias",
    name: "Kit 3 luminárias pendentes",
    kind: "produto",
    summary: "Trio de pendentes em vidro fosco, cúpula de 20 cm, bivolt.",
    description:
      "Kit com três pendentes de vidro fosco e estrutura em metal preto fosco. Altura de cabo regulável até 1,2 m, soquete E27, bivolt. Acompanha canopla e kit de instalação.",
    priceCents: 47_900,
    recurrence: "unico",
    maxDiscountPct: 15,
    includes: ["3 pendentes", "Kit de instalação", "Garantia de 12 meses", "Frete grátis Sudeste"],
    salesNotes:
      "Item de maior giro no fim de semana. Objeção mais comum é altura do pé-direito — pergunte antes de fechar. Combina com o trilho eletrificado, e o kit fechado converte melhor que os dois separados.",
    baseUrl: "https://pagar.luminicasa.com.br/kit-pendentes",
  },
  {
    key: "trilho_eletrificado",
    name: "Trilho eletrificado 1,5 m",
    kind: "produto",
    summary: "Trilho com quatro spots direcionáveis, instalação em teto ou parede.",
    description:
      "Trilho de alumínio anodizado de 1,5 m com quatro spots direcionáveis GU10, bivolt, com conector de emenda incluso.",
    priceCents: 32_900,
    recurrence: "unico",
    maxDiscountPct: 12,
    includes: ["Trilho de 1,5 m", "4 spots GU10", "Conector de emenda"],
    salesNotes:
      "Venda casada natural com o kit de pendentes em sala integrada. Não prometa lâmpada inclusa — o spot vem sem.",
    baseUrl: "https://pagar.luminicasa.com.br/trilho-eletrificado",
  },
  {
    key: "montagem_domiciliar",
    name: "Montagem em domicílio",
    kind: "servico",
    summary: "Instalação por técnico parceiro, capitais e região metropolitana.",
    description:
      "Instalação feita por técnico parceiro credenciado, com agendamento em até quatro dias úteis. Cobre capitais e região metropolitana.",
    priceCents: 18_900,
    recurrence: "unico",
    maxDiscountPct: 30,
    includes: ["Visita agendada", "Instalação de até 4 pontos", "Teste e limpeza do local"],
    salesNotes:
      "Margem alta e é o que reduz devolução por 'não consegui instalar'. Ofereça sempre que o pedido tiver pendente ou trilho.",
    baseUrl: "https://pagar.luminicasa.com.br/montagem",
  },
  {
    key: "clube_lumini",
    name: "Clube Lumini",
    kind: "servico",
    summary: "Assinatura com frete grátis ilimitado e 10% em toda a loja.",
    description:
      "Assinatura mensal com frete grátis ilimitado para todo o Brasil, 10% de desconto em toda a loja e acesso antecipado a lançamentos.",
    priceCents: 2_990,
    recurrence: "mensal",
    maxDiscountPct: 0,
    includes: ["Frete grátis ilimitado", "10% em toda a loja", "Acesso antecipado"],
    salesNotes:
      "Teto zero: o desconto do clube já é a margem. Se o cliente pedir desconto na assinatura, ofereça o primeiro mês na compra, não abatimento recorrente.",
  },
  {
    key: "cupula_avulsa",
    name: "Cúpula avulsa de reposição",
    kind: "produto",
    summary: "Peça de reposição — descontinuada, mantida para histórico.",
    description: "Cúpula de vidro fosco de 20 cm para reposição em pendentes da linha anterior.",
    priceCents: 8_900,
    recurrence: "unico",
    maxDiscountPct: 20,
    includes: ["1 cúpula", "Anel de fixação"],
    salesNotes: "Linha descontinuada. Não ofereça: estoque zerado.",
    baseUrl: "https://pagar.luminicasa.com.br/cupula",
  },
];

const CLINICA: CatalogSeed[] = [
  {
    key: "avaliacao_inicial",
    name: "Avaliação inicial",
    kind: "servico",
    summary: "Consulta de avaliação com plano de tratamento por escrito.",
    description:
      "Primeira consulta com anamnese completa, exame clínico, registro fotográfico e plano de tratamento entregue por escrito, com alternativas e prazos.",
    priceCents: 25_000,
    recurrence: "unico",
    maxDiscountPct: 100,
    includes: ["Anamnese e exame clínico", "Registro fotográfico", "Plano de tratamento escrito"],
    salesNotes:
      "Teto de 100% porque a avaliação é frequentemente cortesia em campanha — é a porta de entrada, não a receita. O que fecha é o plano entregue por escrito na hora.",
    baseUrl: "https://pagar.clinicavertice.com.br/avaliacao",
  },
  {
    key: "clareamento",
    name: "Clareamento supervisionado",
    kind: "servico",
    summary: "Quatro sessões em consultório, com moldeira para manutenção.",
    description:
      "Protocolo de quatro sessões em consultório com gel de peróxido de hidrogênio, mais moldeira personalizada e gel de manutenção domiciliar por 15 dias.",
    priceCents: 129_000,
    recurrence: "unico",
    maxDiscountPct: 15,
    includes: ["4 sessões em consultório", "Moldeira personalizada", "Gel de manutenção 15 dias"],
    salesNotes:
      "Não prometa tom específico — resultado varia com a cor de base. Objeção comum é sensibilidade: o protocolo já inclui dessensibilizante, diga isso antes de perguntarem.",
    baseUrl: "https://pagar.clinicavertice.com.br/clareamento",
  },
  {
    key: "alinhadores",
    name: "Alinhadores invisíveis",
    kind: "servico",
    summary: "Tratamento completo com acompanhamento mensal.",
    description:
      "Planejamento digital, jogo completo de alinhadores, acompanhamento mensal presencial e contenção final. Duração média de 14 meses.",
    priceCents: 890_000,
    recurrence: "unico",
    maxDiscountPct: 10,
    includes: [
      "Planejamento digital 3D",
      "Jogo completo de alinhadores",
      "Consultas mensais",
      "Contenção final",
    ],
    salesNotes:
      "Ticket mais alto da clínica e o que mais pede parcelamento — encaminhe ao financeiro em vez de dar desconto. O planejamento 3D apresentado na tela é o que converte.",
  },
  {
    key: "plano_manutencao",
    name: "Plano de manutenção",
    kind: "servico",
    summary: "Duas limpezas por ano e urgência sem fila.",
    description:
      "Assinatura com duas profilaxias anuais, radiografia de controle e atendimento de urgência sem fila de espera.",
    priceCents: 8_900,
    recurrence: "mensal",
    maxDiscountPct: 8,
    includes: ["2 profilaxias por ano", "Radiografia de controle", "Urgência sem fila"],
    salesNotes:
      "É o que segura o paciente entre tratamentos. Margem fina — o teto de 8% existe porque o custo de cadeira é mensal e não cai com desconto.",
    baseUrl: "https://pagar.clinicavertice.com.br/manutencao",
  },
  {
    key: "raspagem",
    name: "Raspagem por quadrante",
    kind: "servico",
    summary: "Procedimento avulso — substituído pelo plano periodontal.",
    description: "Raspagem e alisamento radicular por quadrante, com anestesia local.",
    priceCents: 32_000,
    recurrence: "unico",
    maxDiscountPct: 10,
    includes: ["Raspagem de 1 quadrante", "Anestesia local"],
    salesNotes: "Descontinuado como item avulso.",
    baseUrl: "https://pagar.clinicavertice.com.br/raspagem",
  },
];

const IMOBILIARIA: CatalogSeed[] = [
  {
    key: "assessoria_locacao",
    name: "Assessoria de locação",
    kind: "servico",
    summary: "Anúncio, visitas, análise de crédito e contrato assinado.",
    description:
      "Pacote completo para locar: produção do anúncio com fotos profissionais, agendamento e condução de visitas, análise de crédito do candidato e contrato assinado digitalmente.",
    priceCents: 149_000,
    recurrence: "unico",
    maxDiscountPct: 20,
    includes: [
      "Fotos profissionais e anúncio",
      "Visitas acompanhadas",
      "Análise de crédito",
      "Contrato com assinatura digital",
    ],
    salesNotes:
      "Cobrado do proprietário, equivalente a um aluguel. A objeção é sempre 'o vizinho alugou sozinho' — o argumento é a análise de crédito, que é o que evita inadimplência.",
    baseUrl: "https://pagar.horizonteimoveis.com.br/assessoria-locacao",
  },
  {
    key: "administracao_locacao",
    name: "Administração de locação",
    kind: "servico",
    summary: "Cobrança, repasse, vistoria e suporte durante o contrato.",
    description:
      "Administração mensal do contrato: emissão e cobrança do aluguel, repasse ao proprietário até o quinto dia útil, vistorias periódicas e intermediação de manutenção.",
    priceCents: 19_900,
    recurrence: "mensal",
    maxDiscountPct: 10,
    includes: ["Cobrança e repasse", "Vistoria semestral", "Intermediação de manutenção"],
    salesNotes:
      "Receita recorrente da imobiliária. Vale ceder na assessoria para garantir a administração — é o inverso do que o corretor tende a fazer por instinto.",
    baseUrl: "https://pagar.horizonteimoveis.com.br/administracao",
  },
  {
    key: "laudo_vistoria",
    name: "Laudo de vistoria",
    kind: "servico",
    summary: "Vistoria de entrada ou saída com laudo fotográfico.",
    description:
      "Vistoria presencial com laudo fotográfico detalhado por cômodo, assinado por vistoriador credenciado, aceito em juízo.",
    priceCents: 39_000,
    recurrence: "unico",
    maxDiscountPct: 15,
    includes: ["Vistoria presencial", "Laudo fotográfico por cômodo", "Assinatura de credenciado"],
    salesNotes:
      "Item que ninguém quer pagar e todo mundo lamenta não ter na saída. Venda pelo risco: sem laudo de entrada, a discussão de danos não tem base.",
    baseUrl: "https://pagar.horizonteimoveis.com.br/vistoria",
  },
  {
    key: "assessoria_venda",
    name: "Assessoria de venda",
    kind: "servico",
    summary: "Avaliação, documentação e acompanhamento até a escritura.",
    description:
      "Avaliação mercadológica do imóvel, conferência e regularização documental, divulgação em portais e acompanhamento até a lavratura da escritura.",
    priceCents: 0,
    recurrence: "unico",
    maxDiscountPct: 0,
    includes: [
      "Avaliação mercadológica",
      "Conferência documental",
      "Divulgação em portais",
      "Acompanhamento até a escritura",
    ],
    salesNotes:
      "Preço zero porque a remuneração é comissão sobre a venda, não valor fixo — o item existe no catálogo para entrar na proposta e explicar o que está incluso. Nunca some este item ao total: ele é R$ 0 de propósito.",
  },
  {
    key: "regularizacao_planta",
    name: "Regularização de planta",
    kind: "servico",
    summary: "Serviço terceirizado — descontinuado.",
    description: "Regularização de planta junto à prefeitura, por escritório parceiro.",
    priceCents: 280_000,
    recurrence: "unico",
    maxDiscountPct: 10,
    includes: ["Levantamento", "Protocolo na prefeitura"],
    salesNotes: "Parceria encerrada.",
  },
];

/* Contabilidade herda o catálogo que já existia em `mock/commerce.ts`. */
const CATALOG_SEEDS: Record<Exclude<DemoVerticalId, "contabilidade">, CatalogSeed[]> = {
  ecommerce: ECOMMERCE,
  clinica: CLINICA,
  imobiliaria: IMOBILIARIA,
};

export function catalogFor(id: Exclude<DemoVerticalId, "contabilidade">, orgId: string): Product[] {
  return buildProducts(orgId, CATALOG_SEEDS[id]);
}

/* Propostas -------------------------------------------------------------------- */

/**
 * Os cinco estados que têm tela, na ordem em que a operação os encontra.
 *
 * `reprovada_interna` e `expirada` ficam de fora: são desvios que a tela mostra
 * igual aos vizinhos e que ocupariam duas conversas sem acrescentar nada ao que
 * há para conferir.
 */
const DEMO_STATES: ProposalStatus[] = [
  "enviada",
  "aceita",
  "aguardando_aprovacao",
  "paga",
  "rascunho",
];

/**
 * Uma proposta por conversa, cobrindo os estados em rodízio.
 *
 * As conversas escolhidas são as **atribuídas**, porque proposta sem vendedor
 * não existe: o nome de quem vendeu vai no link de pagamento. Conversa na fila,
 * sem dono, é justamente o caso em que montar proposta não faria sentido.
 */
export function buildDemoProposals(input: {
  orgId: string;
  products: Product[];
  conversations: Conversation[];
  contacts: Contact[];
  users: User[];
}): Proposal[] {
  const sellable = input.products.filter((product) => product.active && product.priceCents > 0);
  if (sellable.length === 0) return [];

  const userById = new Map(input.users.map((user) => [user.id, user]));
  const contactIds = new Set(input.contacts.map((contact) => contact.id));

  const candidates = input.conversations
    .filter((conversation) => conversation.assigneeId && contactIds.has(conversation.contactId))
    .slice(0, DEMO_STATES.length);

  return candidates.map((conversation, index) => {
    const status = DEMO_STATES[index % DEMO_STATES.length]!;
    const seller = userById.get(conversation.assigneeId!);

    /**
     * O item da vez percorre o catálogo, e a proposta que espera o gestor leva
     * **dois** itens — é o caso que mostra a regra sendo por item e não pela
     * média da proposta.
     */
    const first = sellable[index % sellable.length]!;
    const second = sellable[(index + 1) % sellable.length]!;

    /**
     * O desconto que estoura o teto é derivado do próprio teto, nunca fixado.
     * Escrever "40%" aqui faria a proposta voltar a caber dentro do limite no dia
     * em que alguém aumentasse a margem daquele produto — e o estado de
     * demonstração mudaria sozinho, sem ninguém ter mexido nele.
     */
    const overTheTop = status === "aguardando_aprovacao";
    const items = overTheTop
      ? [
          buildProposalItem(first, 1, Math.min(100, first.maxDiscountPct + 15)),
          buildProposalItem(second, 1, 0),
        ]
      : [buildProposalItem(first, 1, Math.min(first.maxDiscountPct, 5))];

    const totals = computeTotals(items);
    const id = `prop_demo_${index + 1}`;
    const createdMinutesAgo = 120 + index * 90;

    const proposal: Proposal = {
      id,
      organizationId: input.orgId,
      createdAt: offsetIso({ minutes: -createdMinutesAgo }),
      updatedAt: offsetIso({ minutes: -createdMinutesAgo + 30 }),
      conversationId: conversation.id,
      contactId: conversation.contactId,
      sellerId: conversation.assigneeId!,
      sellerName: seller?.name ?? "Consultor",
      items,
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      totalCents: totals.totalCents,
      status,
      message:
        status === "rascunho"
          ? "Segue o que conversamos. Confere se ficou do jeito que você precisa?"
          : "Combinado! Preparei conforme falamos — qualquer ajuste é só me dizer.",
      expiresAt: offsetIso({ days: 7 - index }),
      origin: index % 3 === 0 ? "agente_ia" : "atendente",
    };

    if (overTheTop) {
      proposal.approval = {
        requestedAt: offsetIso({ minutes: -createdMinutesAgo + 20 }),
        requestedBy: proposal.sellerId,
        reason: `Desconto acima do teto em um item — ${items[0]!.name}: ${items[0]!.discountPct}% pedido, teto de ${items[0]!.maxDiscountPct}%.`,
      };
      return proposal;
    }

    if (status === "rascunho") return proposal;

    proposal.sentAt = offsetIso({ minutes: -createdMinutesAgo + 25 });

    if (status === "enviada") return proposal;

    proposal.respondedAt = offsetIso({ minutes: -createdMinutesAgo + 60 });

    /**
     * O link só existe depois do aceite — a mesma ordem que o repositório impõe.
     * Semear `checkoutUrl` numa proposta apenas enviada contaria uma mentira
     * sobre o produto justamente na tela que existe para explicá-lo.
     */
    const link = buildCheckoutUrl({
      baseUrl: first.checkout.baseUrl ?? "",
      sellerName: proposal.sellerName,
      sellerId: proposal.sellerId,
      proposalId: id,
    });
    if (link.ok) proposal.checkoutUrl = link.url;

    if (status === "paga") {
      proposal.paidAt = offsetIso({ minutes: -createdMinutesAgo + 90 });
      proposal.paidConfirmedBy = proposal.sellerId;
    }

    return proposal;
  });
}
