/**
 * Base de demonstração — E-mail Studio e entregabilidade.
 * Referência: Plano Completo, seção 14.
 */

import type {
  BrandKit,
  EmailBlock,
  EmailDeliveryStats,
  EmailDesignTemplate,
  EmailDomain,
  EmailModule,
  SuppressionEntry,
} from "../types/email";
import { offsetIso } from "../utils/datetime";
import { ORG_ID } from "./organization";

/* Marca ------------------------------------------------------------------- */

export const brandKits: BrandKit[] = [
  {
    id: "brand_cf",
    organizationId: ORG_ID,
    name: "Contabilidade Facilitada",
    description: "Identidade principal — usada em campanhas, jornadas e comunicados.",
    primaryColor: "#102850",
    accentColor: "#FF9933",
    textColor: "#1B2B45",
    backgroundColor: "#F4F6FA",
    fontStack: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    logoText: "Contabilidade Facilitada",
    footerAddress: "Rua das Palmeiras, 480 · Campinas/SP · CEP 13010-000 · CNPJ 11.222.333/0001-44",
    footerLegal:
      "Você recebe este e-mail porque autorizou comunicações da Contabilidade Facilitada. Pode sair quando quiser.",
    isDefault: true,
    createdAt: offsetIso({ days: -300 }),
    updatedAt: offsetIso({ days: -18 }),
  },
  {
    id: "brand_escola",
    organizationId: ORG_ID,
    name: "Escola CF",
    description: "Identidade dos cursos — tom mais próximo, usada com alunos.",
    primaryColor: "#212D51",
    accentColor: "#12A094",
    textColor: "#1B2B45",
    backgroundColor: "#F2F7F6",
    fontStack: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    logoText: "Escola CF",
    footerAddress: "Rua das Palmeiras, 480 · Campinas/SP · CEP 13010-000",
    footerLegal: "Você recebe este e-mail porque é aluno de um curso da Escola CF.",
    isDefault: false,
    createdAt: offsetIso({ days: -180 }),
    updatedAt: offsetIso({ days: -40 }),
  },
];

/* Módulos reutilizáveis --------------------------------------------------- */

const headerBlocks: EmailBlock[] = [
  {
    id: "mb_header_logo",
    kind: "texto",
    content: "Contabilidade Facilitada",
    align: "centro",
    scale: "subtitulo",
    locked: true,
  },
  {
    id: "mb_header_menu",
    kind: "menu",
    items: [
      {
        id: "mi_1",
        label: "Portal do cliente",
        href: "https://contabilidadefacilitada.com/portal",
      },
      { id: "mi_2", label: "Conteúdos", href: "https://contabilidadefacilitada.com/blog" },
      {
        id: "mi_3",
        label: "Falar com o time",
        href: "https://contabilidadefacilitada.com/contato",
      },
    ],
    locked: true,
  },
  { id: "mb_header_divider", kind: "divisor" },
];

const footerBlocks: EmailBlock[] = [
  { id: "mb_footer_divider", kind: "divisor" },
  {
    id: "mb_footer_social",
    kind: "social",
    networks: ["instagram", "linkedin", "youtube"],
    locked: true,
  },
  {
    id: "mb_footer_legal",
    kind: "rodape",
    address: "Rua das Palmeiras, 480 · Campinas/SP · CEP 13010-000 · CNPJ 11.222.333/0001-44",
    legal:
      "Você recebe este e-mail porque autorizou comunicações da Contabilidade Facilitada. Pode sair quando quiser.",
    unsubscribeLabel: "Cancelar inscrição",
    locked: true,
  },
];

export const emailModules: EmailModule[] = [
  {
    id: "mod_cabecalho",
    organizationId: ORG_ID,
    name: "Cabeçalho institucional",
    description: "Logo, menu de três itens e divisor. Travado pela marca.",
    category: "cabecalho",
    blocks: headerBlocks,
    locked: true,
    usageCount: 12,
    createdAt: offsetIso({ days: -240 }),
    updatedAt: offsetIso({ days: -18 }),
  },
  {
    id: "mod_rodape",
    organizationId: ORG_ID,
    name: "Rodapé legal",
    description:
      "Redes, endereço, base legal e descadastro em um clique. Obrigatório em marketing.",
    category: "rodape",
    blocks: footerBlocks,
    locked: true,
    usageCount: 14,
    createdAt: offsetIso({ days: -240 }),
    updatedAt: offsetIso({ days: -18 }),
  },
  {
    id: "mod_cta_consultor",
    organizationId: ORG_ID,
    name: "Chamada — falar com consultor",
    description: "Texto curto e botão para agendamento.",
    category: "chamada",
    blocks: [
      {
        id: "mb_cta_texto",
        kind: "texto",
        content:
          "Quer entender o impacto disso no seu caso? Agende 20 minutos com {{consultor.nome}} e saia com os números na mão.",
        align: "centro",
        scale: "corpo",
      },
      {
        id: "mb_cta_botao",
        kind: "botao",
        label: "Agendar conversa",
        href: "https://contabilidadefacilitada.com/agenda",
        align: "centro",
        variant: "primario",
      },
    ],
    locked: false,
    usageCount: 8,
    createdAt: offsetIso({ days: -120 }),
    updatedAt: offsetIso({ days: -30 }),
  },
  {
    id: "mod_beneficios",
    organizationId: ORG_ID,
    name: "Três benefícios",
    description: "Bloco de colunas para listar entregas ou diferenciais.",
    category: "conteudo",
    blocks: [
      {
        id: "mb_ben_colunas",
        kind: "colunas",
        columns: [
          {
            id: "c1",
            title: "Apuração revisada",
            body: "Conferência dupla antes de cada guia sair.",
          },
          {
            id: "c2",
            title: "Prazo garantido",
            body: "Obrigações entregues com folga, sem correria.",
          },
          {
            id: "c3",
            title: "Time por perto",
            body: "WhatsApp direto com quem cuida da sua empresa.",
          },
        ],
      },
    ],
    locked: false,
    usageCount: 5,
    createdAt: offsetIso({ days: -90 }),
    updatedAt: offsetIso({ days: -22 }),
  },
  {
    id: "mod_assinatura",
    organizationId: ORG_ID,
    name: "Assinatura do consultor",
    description: "Fecho pessoal para e-mails de relacionamento.",
    category: "conteudo",
    blocks: [
      {
        id: "mb_ass_texto",
        kind: "texto",
        content: "Um abraço,\n{{consultor.nome}}\nContabilidade Facilitada",
        align: "esquerda",
        scale: "corpo",
      },
    ],
    locked: false,
    usageCount: 9,
    createdAt: offsetIso({ days: -75 }),
    updatedAt: offsetIso({ days: -15 }),
  },
];

/* Templates --------------------------------------------------------------- */

const comparativoBlocks: EmailBlock[] = [
  ...headerBlocks,
  {
    id: "b_titulo",
    kind: "texto",
    content: "{{contato.primeiro_nome}}, sua empresa pode estar no regime errado",
    align: "esquerda",
    scale: "titulo",
  },
  {
    id: "b_intro",
    kind: "texto",
    content:
      "Analisamos mais de 900 empresas neste ano. Em quase um terço delas, a troca de regime devolveria de 8% a 22% do que se paga hoje em imposto — sem nenhuma mudança na operação.",
    align: "esquerda",
    scale: "corpo",
  },
  {
    id: "b_imagem",
    kind: "imagem",
    source: "comparativo-regimes.png",
    alt: "Gráfico comparando carga tributária no Simples Nacional e no Lucro Presumido",
    caption: "Simulação para uma prestadora de serviços com folha de 28% do faturamento.",
    ratio: "16:9",
  },
  {
    id: "b_colunas",
    kind: "colunas",
    columns: [
      { id: "c1", title: "Fator R", body: "Define em qual anexo do Simples sua empresa cai." },
      {
        id: "c2",
        title: "Folha real",
        body: "Pró-labore conta, e quase todo mundo esquece disso.",
      },
      { id: "c3", title: "Projeção 12m", body: "A escolha vale pelo ano inteiro, não pelo mês." },
    ],
  },
  {
    id: "b_cta_texto",
    kind: "texto",
    content:
      "Quer ver a conta com os números da {{empresa.nome}}? Levamos cerca de 20 minutos e você sai com o comparativo pronto.",
    align: "centro",
    scale: "corpo",
  },
  {
    id: "b_botao",
    kind: "botao",
    label: "Quero minha simulação",
    href: "https://contabilidadefacilitada.com/simulacao",
    align: "centro",
    variant: "primario",
  },
  { id: "b_espaco", kind: "espacador", height: 16 },
  ...footerBlocks,
];

const boasVindasBlocks: EmailBlock[] = [
  ...headerBlocks,
  {
    id: "bv_titulo",
    kind: "texto",
    content: "Bem-vindo ao curso, {{contato.primeiro_nome}}",
    align: "esquerda",
    scale: "titulo",
  },
  {
    id: "bv_corpo",
    kind: "texto",
    content:
      "Seu acesso ao {{aluno.curso}} já está liberado. Comece pelo módulo 1 — são 40 minutos e ele destrava todo o resto da trilha.",
    align: "esquerda",
    scale: "corpo",
  },
  {
    id: "bv_botao",
    kind: "botao",
    label: "Começar o módulo 1",
    href: "https://escola.contabilidadefacilitada.com/entrar",
    align: "esquerda",
    variant: "primario",
  },
  { id: "bv_divisor", kind: "divisor" },
  {
    id: "bv_video",
    kind: "video",
    title: "Como aproveitar o curso em 4 semanas",
    href: "https://escola.contabilidadefacilitada.com/boas-vindas",
    fallbackText: "Assista ao vídeo de boas-vindas (3 min)",
  },
  {
    id: "bv_assinatura",
    kind: "texto",
    content: "Bons estudos,\nDiego Nunes\nSucesso do Aluno",
    align: "esquerda",
    scale: "corpo",
  },
  ...footerBlocks,
];

const obrigacoesBlocks: EmailBlock[] = [
  ...headerBlocks,
  {
    id: "ob_titulo",
    kind: "texto",
    content: "Obrigações de {{fiscal.competencia}}",
    align: "esquerda",
    scale: "titulo",
  },
  {
    id: "ob_corpo",
    kind: "texto",
    content:
      "{{contato.primeiro_nome}}, este é o resumo do que vence neste mês para a {{empresa.nome}}. Se algo já foi pago, é só ignorar a linha.",
    align: "esquerda",
    scale: "corpo",
  },
  {
    id: "ob_html",
    kind: "html",
    html: '<table role="presentation" width="100%"><tr><th align="left">Obrigação</th><th align="right">Vencimento</th></tr><tr><td>DAS</td><td align="right">20/08</td></tr><tr><td>FGTS</td><td align="right">07/08</td></tr></table>',
  },
  {
    id: "ob_botao",
    kind: "botao",
    label: "Abrir portal do cliente",
    href: "https://contabilidadefacilitada.com/portal",
    align: "esquerda",
    variant: "secundario",
  },
  ...footerBlocks,
];

const webinarBlocks: EmailBlock[] = [
  ...headerBlocks,
  {
    id: "wb_titulo",
    kind: "texto",
    content: "Planejamento tributário 2027: o que muda para a sua empresa",
    align: "centro",
    scale: "titulo",
  },
  {
    id: "wb_sub",
    kind: "texto",
    content: "Quinta-feira, 14 de outubro · 19h · online e gratuito",
    align: "centro",
    scale: "legenda",
  },
  {
    id: "wb_imagem",
    kind: "imagem",
    source: "webinar-capa.png",
    alt: "",
    ratio: "16:9",
  },
  {
    id: "wb_corpo",
    kind: "texto",
    content:
      "Vamos abrir os cenários por regime, mostrar onde a reforma aperta e responder perguntas ao vivo. Traga o seu caso.",
    align: "centro",
    scale: "corpo",
  },
  {
    id: "wb_botao",
    kind: "botao",
    label: "Garantir minha vaga",
    href: "",
    align: "centro",
    variant: "primario",
  },
  ...footerBlocks,
];

export const emailTemplates: EmailDesignTemplate[] = [
  {
    id: "etpl_comparativo",
    organizationId: ORG_ID,
    name: "Comparativo de regime tributário",
    description: "E-mail de nutrição para leads de migração. Usado pela jornada e por campanha.",
    category: "campanha",
    brandKitId: "brand_cf",
    ownerId: "usr_carla",
    activeVersionId: "etv_comparativo_4",
    draftVersionId: "etv_comparativo_5",
    versions: [
      {
        id: "etv_comparativo_4",
        templateId: "etpl_comparativo",
        version: 4,
        status: "publicado",
        subject: "{{contato.primeiro_nome}}, você pode estar pagando imposto a mais",
        preheader: "Uma simulação de 20 minutos costuma devolver de 8% a 22% da carga atual.",
        blocks: comparativoBlocks,
        publishedAt: offsetIso({ days: -34 }),
        publishedBy: "usr_carla",
        changeNote: "Trocado o gráfico e encurtada a introdução.",
      },
      {
        id: "etv_comparativo_5",
        templateId: "etpl_comparativo",
        version: 5,
        status: "rascunho",
        subject: "{{contato.primeiro_nome}}, sua empresa pode estar no regime errado",
        preheader:
          "Em quase um terço dos casos que analisamos, a troca de regime devolve dinheiro.",
        blocks: comparativoBlocks,
        changeNote: "Em teste: assunto mais direto e chamada com nome do consultor.",
      },
    ],
    stats: {
      sends30d: 2184,
      deliveredPct: 98.2,
      openPct: 41.6,
      clickPct: 9.4,
      unsubscribePct: 0.28,
      bouncePct: 1.8,
    },
    createdAt: offsetIso({ days: -120 }),
    updatedAt: offsetIso({ days: -2 }),
  },
  {
    id: "etpl_boas_vindas",
    organizationId: ORG_ID,
    name: "Boas-vindas do aluno",
    description: "Primeiro e-mail da jornada de onboarding, disparado na matrícula.",
    category: "jornada",
    brandKitId: "brand_escola",
    ownerId: "usr_diego",
    activeVersionId: "etv_bv_3",
    draftVersionId: "etv_bv_3",
    versions: [
      {
        id: "etv_bv_3",
        templateId: "etpl_boas_vindas",
        version: 3,
        status: "publicado",
        subject: "Bem-vindo ao {{aluno.curso}}",
        preheader: "Seu acesso já está liberado. Comece pelo módulo 1.",
        blocks: boasVindasBlocks,
        publishedAt: offsetIso({ days: -58 }),
        publishedBy: "usr_diego",
        changeNote: "Adicionado vídeo de boas-vindas com texto alternativo.",
      },
    ],
    stats: {
      sends30d: 341,
      deliveredPct: 99.1,
      openPct: 68.3,
      clickPct: 24.7,
      unsubscribePct: 0.09,
      bouncePct: 0.9,
    },
    createdAt: offsetIso({ days: -140 }),
    updatedAt: offsetIso({ days: -58 }),
  },
  {
    id: "etpl_obrigacoes",
    organizationId: ORG_ID,
    name: "Obrigações do mês",
    description: "Comunicado transacional para a base ativa. Não é marketing.",
    category: "transacional",
    brandKitId: "brand_cf",
    ownerId: "usr_marina",
    activeVersionId: "etv_ob_7",
    draftVersionId: "etv_ob_7",
    versions: [
      {
        id: "etv_ob_7",
        templateId: "etpl_obrigacoes",
        version: 7,
        status: "publicado",
        subject: "Obrigações de {{fiscal.competencia}} — {{empresa.nome}}",
        preheader: "Resumo do que vence neste mês, com prazos e valores.",
        blocks: obrigacoesBlocks,
        publishedAt: offsetIso({ days: -20 }),
        publishedBy: "usr_marina",
        changeNote: "Tabela passou a usar HTML controlado para alinhar valores.",
      },
    ],
    stats: {
      sends30d: 3820,
      deliveredPct: 99.4,
      openPct: 72.1,
      clickPct: 18.2,
      unsubscribePct: 0.02,
      bouncePct: 0.6,
    },
    createdAt: offsetIso({ days: -260 }),
    updatedAt: offsetIso({ days: -20 }),
  },
  {
    id: "etpl_webinar",
    organizationId: ORG_ID,
    name: "Convite — webinar de planejamento",
    description: "Convite para o webinar de outubro. Ainda em construção.",
    category: "campanha",
    brandKitId: "brand_cf",
    ownerId: "usr_carla",
    draftVersionId: "etv_wb_1",
    versions: [
      {
        id: "etv_wb_1",
        templateId: "etpl_webinar",
        version: 1,
        status: "rascunho",
        subject: "",
        preheader: "",
        blocks: webinarBlocks,
        changeNote: "Primeira montagem. Falta assunto, link do botão e alternativo da capa.",
      },
    ],
    stats: {
      sends30d: 0,
      deliveredPct: 0,
      openPct: 0,
      clickPct: 0,
      unsubscribePct: 0,
      bouncePct: 0,
    },
    createdAt: offsetIso({ days: -4 }),
    updatedAt: offsetIso({ hours: -20 }),
  },
];

/* Entregabilidade --------------------------------------------------------- */

export const emailDomains: EmailDomain[] = [
  {
    id: "dom_principal",
    organizationId: ORG_ID,
    domain: "contabilidadefacilitada.com",
    purpose: "transacional",
    spf: "verificado",
    dkim: "verificado",
    dmarc: "verificado",
    dmarcPolicy: "quarantine",
    reputation: "alta",
    dailyLimit: 20000,
    sentToday: 3820,
    verifiedAt: offsetIso({ days: -240 }),
    createdAt: offsetIso({ days: -240 }),
    updatedAt: offsetIso({ days: -30 }),
    records: [
      {
        type: "TXT",
        host: "@",
        value: "v=spf1 include:_spf.provedor.com ~all",
        status: "verificado",
        purpose: "SPF",
      },
      {
        type: "CNAME",
        host: "cf1._domainkey",
        value: "cf1.dkim.provedor.com",
        status: "verificado",
        purpose: "DKIM",
      },
      {
        type: "TXT",
        host: "_dmarc",
        value: "v=DMARC1; p=quarantine; rua=mailto:dmarc@contabilidadefacilitada.com; pct=100",
        status: "verificado",
        purpose: "DMARC",
      },
    ],
  },
  {
    id: "dom_marketing",
    organizationId: ORG_ID,
    domain: "news.contabilidadefacilitada.com",
    purpose: "marketing",
    spf: "verificado",
    dkim: "verificado",
    dmarc: "pendente",
    dmarcPolicy: "none",
    reputation: "media",
    dailyLimit: 8000,
    sentToday: 2184,
    warmupDay: 12,
    warmupTotalDays: 30,
    verifiedAt: offsetIso({ days: -12 }),
    createdAt: offsetIso({ days: -14 }),
    updatedAt: offsetIso({ hours: -6 }),
    records: [
      {
        type: "TXT",
        host: "news",
        value: "v=spf1 include:_spf.provedor.com ~all",
        status: "verificado",
        purpose: "SPF",
      },
      {
        type: "CNAME",
        host: "cf1._domainkey.news",
        value: "cf1.dkim.provedor.com",
        status: "verificado",
        purpose: "DKIM",
      },
      {
        type: "TXT",
        host: "_dmarc.news",
        value: "v=DMARC1; p=none; rua=mailto:dmarc@contabilidadefacilitada.com",
        status: "pendente",
        purpose: "DMARC",
      },
      {
        type: "CNAME",
        host: "link.news",
        value: "rastreio.provedor.com",
        status: "falhou",
        purpose: "rastreamento",
      },
    ],
  },
];

interface SuppressionSeed {
  address: string;
  reason: SuppressionEntry["reason"];
  source: string;
  detail?: string;
  hoursAgo: number;
  expiresInHours?: number;
}

const SUPPRESSION_SEEDS: SuppressionSeed[] = [
  {
    address: "financeiro@techmart.com.br",
    reason: "bounce_permanente",
    source: "Campanha — Obrigações de agosto",
    detail: "550-5.1.1 Caixa postal do destinatário inexistente",
    hoursAgo: 5,
  },
  {
    address: "contato@ateliefiodeouro.com.br",
    reason: "bounce_permanente",
    source: "Campanha — Obrigações de agosto",
    detail: "550 Domínio não encontrado",
    hoursAgo: 6,
  },
  {
    address: "paulo.dias@gmail.com",
    reason: "reclamacao",
    source: "Campanha — Migração de contador",
    detail: "Feedback loop do provedor: marcado como spam",
    hoursAgo: 26,
  },
  {
    address: "leandro.peixoto@gmail.com",
    reason: "descadastro",
    source: "Rodapé — cancelar inscrição",
    hoursAgo: 40,
  },
  {
    address: "vanessa.correa@gmail.com",
    reason: "descadastro",
    source: "Centro de preferências",
    detail: "Optou por receber apenas comunicados fiscais",
    hoursAgo: 52,
  },
  {
    address: "rh@rotanorte.com.br",
    reason: "bounce_temporario",
    source: "Jornada — Onboarding do aluno",
    detail: "452 Caixa postal cheia · nova tentativa em 24 h",
    hoursAgo: 8,
    expiresInHours: 16,
  },
  {
    address: "felipe.andrade@gmail.com",
    reason: "descadastro",
    source: "Rodapé — cancelar inscrição",
    hoursAgo: 96,
  },
  {
    address: "diretoria@bemviver.com.br",
    reason: "manual",
    source: "Marina Duarte",
    detail: "Cliente pediu por telefone para sair de qualquer envio de marketing",
    hoursAgo: 120,
  },
  {
    address: "antigo@paonosso.com.br",
    reason: "bounce_permanente",
    source: "Campanha — Webinar de julho",
    detail: "550-5.1.1 Endereço desativado",
    hoursAgo: 240,
  },
  {
    address: "isabela.martins@gmail.com",
    reason: "reclamacao",
    source: "Jornada — Onboarding do aluno",
    detail: "Feedback loop do provedor",
    hoursAgo: 300,
  },
];

export const suppressionEntries: SuppressionEntry[] = SUPPRESSION_SEEDS.map((seed, index) => ({
  id: `sup_${String(index + 1).padStart(3, "0")}`,
  organizationId: ORG_ID,
  address: seed.address,
  reason: seed.reason,
  source: seed.source,
  detail: seed.detail,
  occurredAt: offsetIso({ hours: -seed.hoursAgo }),
  expiresAt: seed.expiresInHours ? offsetIso({ hours: seed.expiresInHours }) : undefined,
}));

export const emailDeliveryStats: EmailDeliveryStats = {
  sent: 6345,
  delivered: 6242,
  opened: 3618,
  clicked: 842,
  bounced: 103,
  complained: 11,
  unsubscribed: 24,
};
