/**
 * O conteúdo que o site publica quando ninguém editou nada.
 *
 * ## Este arquivo é o texto original, não uma amostra
 *
 * Cada frase aqui saiu do JSX das páginas, palavra por palavra. É o que garante
 * que extrair o conteúdo não tenha mudado o site: sem arquivo gravado, a página
 * renderiza exatamente o que renderizava antes.
 *
 * É também o alvo do botão "restaurar padrão" do editor. Por isso o conteúdo
 * mora em código e não num JSON semeado — um padrão gravado em disco pode ser
 * editado por engano, e aí "restaurar" devolveria a versão quebrada.
 *
 * ## Ao escrever texto novo aqui
 *
 * A disciplina é a mesma do resto do repositório: nada de número de resultado
 * que nenhum cliente sustenta, nada de recurso que o produto não tem. A landing
 * page é a primeira coisa que sobrevive à venda.
 */

import type { SiteContent } from "../types/content";
import { SITE_CONTENT_VERSION } from "../types/content";

/**
 * O carimbo do conteúdo padrão.
 *
 * Fixo, e não `now()`: este valor entra na comparação que decide se o arquivo em
 * disco ficou para trás. Um carimbo calculado na carga do módulo mudaria a cada
 * reinício e faria toda edição gravada parecer desatualizada.
 */
const DEFAULT_STAMP = "2026-01-01T00:00:00.000Z";

export const DEFAULT_SITE_CONTENT: SiteContent = {
  version: SITE_CONTENT_VERSION,
  updatedAt: DEFAULT_STAMP,

  /* Cabeçalho ---------------------------------------------------------------------- */

  header: {
    /**
     * A navegação pública não tem "Demonstrações", e a ausência é deliberada.
     *
     * As bases de demonstração são material de venda: carregá-las troca os dados
     * da instância inteira. Anunciá-las no menu convidaria o visitante a abrir
     * uma sozinho — e, sem back-end, ele trocaria a base debaixo de uma
     * apresentação em andamento.
     */
    links: [
      { id: "nav-produto", label: "Produto", href: "/#produto" },
      { id: "nav-precos", label: "Preços", href: "/precos" },
      { id: "nav-ia", label: "Inteligência artificial", href: "/#ia" },
      { id: "nav-seguranca", label: "Segurança", href: "/#seguranca" },
      { id: "nav-comercial", label: "Falar com o comercial", href: "/orcamento" },
    ],
    signInLabel: "Entrar",
    accountLabel: "Minha conta",
    cta: { id: "header-cta", label: "Solicitar orçamento", href: "/orcamento" },
  },

  /* Landing page ------------------------------------------------------------------- */

  landing: {
    meta: {
      title: "Elora — atendimento, CRM e IA numa plataforma só",
      description:
        "Plataforma omnichannel brasileira: WhatsApp, e-mail, Instagram e webchat numa linha do tempo, " +
        "com CRM 360º, automação auditável, agentes de IA sob controle humano e tabela de preço aberta.",
    },

    hero: {
      eyebrow: "Plataforma brasileira · WhatsApp oficial · IA sob controle humano",
      titleLead: "O cliente fala no",
      /**
       * Os nomes de canal, e não um verbo genérico.
       *
       * A palavra que roda é a informação da frase: são cinco lugares diferentes
       * de onde o cliente fala, e uma conversa só do lado de cá. Um sinônimo
       * rolando ali seria enfeite; o nome do canal é o argumento da página em
       * movimento.
       *
       * Todos curtos de propósito. A caixa acompanha a palavra ativa, então o
       * texto seguinte desliza a cada troca — com palavras de tamanhos muito
       * diferentes o deslize vira solavanco, e o título inteiro se reacomoda.
       */
      titleRoll: ["WhatsApp", "Instagram", "Messenger", "e-mail", "webchat"],
      titleAccent: "Seu time vê uma conversa só.",
      subtitle:
        "WhatsApp, e-mail, Instagram, Messenger e o chat do seu site chegam na mesma fila, com o " +
        "histórico do contato ao lado. Somado a isso: CRM 360º, funil, automação auditável e agentes " +
        "de IA que propõem e não gravam sozinhos — no mesmo modelo de dados, sem integração para dar " +
        "manutenção.",
      /**
       * A ordem dos botões segue a tese da própria página, escrita no CTA final:
       * "comece pelo número, não pela reunião". Com o orçamento em primeiro e o
       * preço num link discreto, a peça dizia o contrário do texto — pedia a
       * reunião antes de mostrar a conta.
       */
      primary: { id: "hero-1", label: "Ver preço, franquia e excedente", href: "/precos" },
      secondary: { id: "hero-2", label: "Ver o produto por dentro", href: "#produto" },
      tertiary: { id: "hero-3", label: "ou fale com o time comercial", href: "/orcamento" },
      stats: [
        { id: "stat-canais", value: 5, suffix: "", label: "canais na mesma fila" },
        { id: "stat-modulos", value: 8, suffix: "", label: "módulos, um modelo de dados" },
        { id: "stat-janela", value: 24, suffix: " h", label: "janela em que responder é grátis" },
        { id: "stat-edicoes", value: 4, suffix: "", label: "edições com a tabela aberta" },
      ],
    },

    segmentsLabel: "Desenhada para operação brasileira, em qualquer setor de alto contato",
    segments: [
      "Contabilidade",
      "E-commerce",
      "Clínicas e saúde",
      "Imobiliárias",
      "Educação",
      "Serviços B2B",
      "Franquias",
      "Escritórios de advocacia",
    ],

    problem: {
      eyebrow: "O problema",
      title: "Não falta ferramenta. Falta a conversa inteira num lugar só.",
      body: "",
    },
    problems: [
      {
        id: "prob-ferramentas",
        icon: "Layers",
        title: "Cinco ferramentas, nenhuma conversa inteira",
        body: "O WhatsApp num aplicativo, o e-mail em outro, o funil numa planilha. Ninguém consegue responder 'o que já falamos com este cliente?' sem abrir quatro abas.",
      },
      {
        id: "prob-sla",
        icon: "Timer",
        title: "SLA que ninguém mede porque ninguém consegue",
        body: "Sem fila, sem distribuição e sem relógio, o atendimento bom depende de quem está de bom humor naquele dia — e o ruim só aparece na reclamação.",
      },
      {
        id: "prob-automacao",
        icon: "ScrollText",
        title: "Automação que ninguém audita",
        body: "A régua dispara, o cliente reclama, e a pergunta 'por que ele recebeu isso?' fica sem resposta. Sem rastro, ajustar automação vira adivinhação.",
      },
    ],

    showcase: {
      eyebrow: "Por dentro",
      title: "Oito telas que mostram como a operação funciona no dia a dia.",
      body: "Não é um pacote de produtos integrados por API: é um modelo de dados só. Quando o chatbot qualifica um lead, o funil sabe; quando a campanha é suprimida, a linha do tempo do contato registra o motivo.",
    },

    modules: {
      eyebrow: "A plataforma",
      title: "Oito módulos que compartilham o mesmo contato, o mesmo evento e o mesmo rastro.",
      body: "",
    },
    moduleCards: [
      {
        id: "mod-inbox",
        icon: "Inbox",
        title: "Inbox omnichannel",
        body: "WhatsApp, e-mail, Instagram, Messenger e webchat na mesma fila, com SLA por política, notas internas, respostas rápidas e transferência com contexto.",
      },
      {
        id: "mod-crm",
        icon: "Building2",
        title: "CRM 360º",
        body: "Uma linha do tempo por contato: mensagem, negócio, campanha, consentimento e automação. Resolução de identidade por telefone, e-mail e identificador de canal.",
      },
      {
        id: "mod-funil",
        icon: "Target",
        title: "Funis de venda",
        body: "Vários pipelines por processo, com etapa, probabilidade, tempo parado e motivo de perda. Tarefa vinculada a contato e a negócio.",
      },
      {
        id: "mod-automacoes",
        icon: "Workflow",
        title: "Automações",
        body: "Aconteceu isto, confira aquilo, faça isso. Gatilho por evento de domínio, com histórico de execução — não é caixa-preta.",
      },
      {
        id: "mod-jornadas",
        icon: "Route",
        title: "Jornadas",
        body: "Acompanhamento por dias ou meses, com estado próprio por participante, espera, ramificação e versão publicada imutável.",
      },
      {
        id: "mod-chatbot",
        icon: "GitBranch",
        title: "Chatbot Builder",
        body: "Fluxo visual com o mesmo motor no simulador e em produção. O que você aprovou no editor é o que o visitante vê.",
      },
      {
        id: "mod-campanhas",
        icon: "Mail",
        title: "Campanhas e E-mail Studio",
        body: "Segmentação dinâmica, limite de frequência, janela silenciosa, lote e aprovação por tamanho de público. Disparo em massa com freio.",
      },
      {
        id: "mod-analytics",
        icon: "BarChart3",
        title: "Analytics",
        body: "Dicionário de métricas, SLA por fila, custo por atendimento e volume por canal. Métrica com definição escrita, não número solto.",
      },
    ],

    plans: {
      eyebrow: "Edições",
      title: "Dois eixos de preço: quantas pessoas usam e quanto a operação consome.",
      body: "Quem cresce em time paga no assento. Quem cresce em volume paga no consumo. Ninguém paga pelo crescimento do outro — e, na edição de cima, o assento deixa de ser cobrado.",
      /**
       * As três notas são a resposta antecipada às três perguntas que todo
       * orçamento de plataforma de mensagem recebe **depois** de assinado.
       * Deixá-las para a fatura é o que produz a conversa sobre confiança.
       */
      notes: [
        {
          id: "nota-inclui",
          icon: "Receipt",
          title: "O que o número acima inclui",
          body: "Assinatura da plataforma mais o mínimo de assentos da edição. É o piso real de contratação — não a assinatura sozinha, que subiria assim que você somasse a primeira pessoa.",
        },
        {
          id: "nota-meta",
          icon: "MessagesSquare",
          title: "O que a Meta cobra vem à parte",
          body: "Mensagem de modelo tem o preço da Meta, repassado sem margem — {precoMarketing} em marketing e {precoUtilidade} em utilidade. Responder dentro da janela de 24 h é grátis, e em atendimento essa é a maior fatia.",
        },
        {
          id: "nota-franquia",
          icon: "Calculator",
          title: "O que passa da franquia",
          body: "Contato, conversa, e-mail, resposta de IA e envio de mensagem têm franquia por edição e preço de excedente publicado. Contato é cobrado em faixas progressivas — crescer a base nunca reduz a conta.",
        },
      ],
      footnote:
        "Valores no compromisso anual. Sem fidelidade, a assinatura e os assentos custam {premioMensal} a mais. [Ver a tabela completa, linha a linha](/precos).",
    },

    ai: {
      badge: "Inteligência artificial",
      title: "A IA propõe. A aplicação valida. A pessoa grava.",
      body: "É a mesma regra em todos os pontos onde há modelo: copiloto do atendente, agente de autoatendimento, redação de e-mail e extração de dados da conversa. O agente executa o que é leitura — consultar pedido, buscar na base, explicar política. O que é escrita vira pendência com um botão, e o botão é de gente.",
      bullets: [
        "Piso de confiança que transfere para humano, conferido pela aplicação — não pedido ao modelo.",
        "Teto de custo por conversa, verificado antes de gastar.",
        "Fila de transferência validada contra o catálogo: fila inventada cai na padrão.",
        "Rastro completo por passo: decisão, ferramenta, parâmetro, retorno, confiança e custo.",
        "Conjunto de avaliação executável, com nota por dimensão e versão do prompt.",
      ],
      traceTitle: "Rastro de uma execução",
      trace: [
        {
          id: "trace-1",
          title: "Classificou a intenção",
          detail: "rastreio_pedido · confiança 0,94 · 320 ms",
          pending: false,
        },
        {
          id: "trace-2",
          title: "Chamou a ferramenta consultar_pedido",
          detail: "leitura permitida na allowlist da versão · executada",
          pending: false,
        },
        {
          id: "trace-3",
          title: "Respondeu ao cliente",
          detail: "gemini-2.5-flash · 812 tokens · R$ 0,004 · prompt v7",
          pending: false,
        },
        {
          id: "trace-4",
          title: "Propôs alterar endereço de entrega",
          detail: "escrita — aguardando confirmação humana no Inbox",
          pending: true,
        },
      ],
      traceFootnote:
        "Sem esse rastro, depurar agente vira troca de adjetivos e o prompt passa a ser ajustado no escuro.",
    },

    steps: {
      eyebrow: "Implantação",
      title: 'No ar em três movimentos — e nenhum deles é "migrar tudo de uma vez".',
      body: "",
    },
    stepCards: [
      {
        id: "passo-canais",
        icon: "PlugZap",
        title: "Conecte os canais",
        body: "Número de WhatsApp oficial, caixa de e-mail, Instagram e o widget de webchat no seu site. A configuração é guiada, etapa por etapa, com o que é seu e o que é nosso separado.",
        detail: "1 a 3 dias",
      },
      {
        id: "passo-filas",
        icon: "Layers",
        title: "Desenhe filas e regras",
        body: "Times, escalas, habilidades e a política de distribuição de cada fila. A prévia mostra quem receberia a próxima conversa e por quê — antes de valer para o cliente.",
        detail: "1 a 2 semanas",
      },
      {
        id: "passo-ia",
        icon: "Rocket",
        title: "Ligue a automação e a IA",
        body: "Chatbot no site, régua de campanha e o agente de IA com base de conhecimento. Começa em leitura, e a escrita entra quando o time confia no rastro.",
        detail: "a partir da 3ª semana",
      },
    ],

    security: {
      eyebrow: "Segurança e LGPD",
      title: "Governança que aparece no tipo, não só na política de privacidade.",
      body: "",
    },
    securityCards: [
      {
        id: "seg-multiempresa",
        icon: "Fingerprint",
        title: "Multiempresa desde o tipo",
        body: "Toda entidade carrega a organização a que pertence. Não é filtro na consulta: é a chave que a política de acesso valida em cada linha.",
      },
      {
        id: "seg-segredo",
        icon: "Lock",
        title: "Segredo não volta pela API",
        body: "Token de canal é gravado no cofre do servidor e nunca devolvido. A tela pergunta se o segredo existe, por nome — nunca o valor.",
      },
      {
        id: "seg-consentimento",
        icon: "ShieldCheck",
        title: "Consentimento por finalidade",
        body: "Atendimento, marketing e cobrança são consentimentos distintos, com base legal, versão do texto e data. Revogação para o disparo, não a conversa.",
      },
      {
        id: "seg-retencao",
        icon: "CalendarClock",
        title: "Retenção com prazo escrito",
        body: "Cada categoria de dado tem política de retenção e anonimização declarada, e toda escrita administrativa deixa registro de auditoria.",
      },
    ],

    faqTitle: "Perguntas que sempre aparecem",

    cta: {
      icon: "MessagesSquare",
      title: "Comece pelo número, não pela reunião.",
      body: "Veja a tabela inteira e, se fizer sentido, peça a proposta. O time comercial responde em até um dia útil, com a conta já dimensionada para o seu volume — e leva a demonstração do seu setor para a conversa.",
      primary: { id: "cta-1", label: "Solicitar orçamento", href: "/orcamento" },
      secondary: { id: "cta-2", label: "Criar conta e salvar cenários", href: "/cadastrar" },
    },
  },

  /* Preços ------------------------------------------------------------------------- */

  pricing: {
    meta: {
      title: "Preços",
      description:
        "Edições, franquias, preço por excedente e o repasse da Meta — a tabela inteira, aberta, " +
        "antes de falar com vendedor.",
    },
    hero: {
      title: "Preço em dois eixos: quantas pessoas usam e quanto a operação consome.",
      subtitle:
        "Assinatura da plataforma, assento e consumo medido — separados, para que o crescimento de " +
        "um não pague pelo do outro. O que o provedor cobra viaja como repasse, sem margem e em " +
        "linha própria.",
    },
    overage: {
      title: "O que custa passar da franquia",
      body: "Contato é cobrado em faixas **progressivas**: cada fatia paga o preço da própria faixa. Aplicar o preço da faixa final ao total produziria o salto em que cadastrar mil contatos a mais reduz a fatura.",
      footnote:
        "A seta indica a progressão entre faixas — a franquia da edição vale até o teto declarado, e o excedente cai na faixa seguinte, pelo preço dela.",
    },
    whatsapp: {
      title: "Mensagem de WhatsApp",
      body: "O que a Meta cobra é repassado sem margem, e o desconto comercial não incide sobre ele. A taxa de envio da plataforma é nossa, e só aparece acima da franquia da edição.",
      footnote:
        "Tabela do Brasil vigente desde {vigencia}, conferida em {conferencia} na página oficial da Meta. Utilidade e autenticação têm desconto por volume da própria Meta, aplicado a partir de 250 mil e 500 mil mensagens por mês.",
    },
    addons: {
      title: "Complementos",
      body: "Contratáveis por edição. Alguns já vêm inclusos nas edições superiores.",
    },
    included: { title: "O que está incluído" },
    close: {
      title: "A conta do seu caso, feita com você",
      body:
        "Tudo o que entra no preço está nesta página: assinatura, assento, franquia, preço do " +
        "excedente e o repasse da Meta linha a linha. O que falta é o seu volume — e aí a conversa " +
        "vale mais que um formulário, porque metade das operações descobre no meio dela que precisa " +
        "de menos do que imaginava.\n\n" +
        "O time comercial monta o cenário com os seus números na primeira ligação e manda a planilha " +
        "aberta, com cada linha separada. Resposta em até um dia útil.",
      primary: { id: "precos-1", label: "Solicitar proposta", href: "/orcamento" },
      secondary: { id: "precos-2", label: "Criar conta e acompanhar", href: "/cadastrar" },
    },
    faq: {
      title: "Dúvidas de preço",
      footnote:
        "Ficou algo de fora? [Peça um orçamento](/orcamento) e escreva a pergunta no campo aberto — ela vai junto com o cenário.",
    },
  },

  /* FAQ ---------------------------------------------------------------------------- */

  /**
   * As respostas são deliberadamente específicas. FAQ genérica ("sim, é
   * seguro!") não responde nada e transfere a pergunta para a reunião — que é
   * justamente o que ela deveria evitar.
   */
  faq: [
    {
      id: "faq-whatsapp",
      question: "Como funciona a cobrança de WhatsApp?",
      answer:
        "Em duas linhas separadas. A Meta cobra por mensagem, por categoria — marketing, utilidade e " +
        "autenticação têm preços diferentes, e a resposta dentro da janela de 24 horas aberta pelo " +
        "cliente é **gratuita**. Isso é repasse: entra no seu orçamento pelo mesmo valor que a Meta " +
        "cobra de nós, sem margem.\n\n" +
        "A Elora cobra por **conversa tratada**, com uma franquia mensal por edição. As duas linhas " +
        "ficam separadas na proposta e na fatura de propósito: quando a Meta reajusta, você consegue " +
        "ver exatamente o que mudou.",
    },
    {
      id: "faq-ilimitado",
      question: "Colaboradores ilimitados é ilimitado mesmo?",
      answer:
        "Na edição Corporativo, sim — o assento não é cobrado e não há teto. Nas demais, o preço é " +
        "por pessoa, com mínimo e máximo declarados no cartão. Não anunciamos ilimitado nas edições " +
        "de entrada porque isso costuma ser um preço por assento escondido dentro de um número " +
        "redondo, que quebra no dia em que a empresa cadastra a operação inteira.",
    },
    {
      id: "faq-franquia",
      question: "O que acontece se eu passar da franquia?",
      answer:
        "Nada para. O excedente é cobrado na fatura seguinte, com preço unitário declarado por " +
        "edição — e, no caso de contatos, em faixas progressivas: cada fatia paga o preço da própria " +
        "faixa, nunca o preço da faixa final aplicado a tudo. Todos esses números estão na tabela " +
        "acima, antes de você assinar.",
    },
    {
      id: "faq-migracao",
      question: "Preciso migrar tudo de uma vez?",
      answer:
        "Não, e não recomendamos. A migração é por domínio — atendimento primeiro, depois funil, " +
        "depois campanhas —, com o sistema antigo continuando dono dos dados que ainda não migraram. " +
        "Para quem vem do Salesforce, existe um trabalho específico de matriz de propriedade de " +
        "campos, para que os dois lados não sobrescrevam um ao outro durante a coexistência.",
    },
    {
      id: "faq-ia",
      question: "A inteligência artificial responde sozinha aos meus clientes?",
      answer:
        "Responde, dentro de um limite que você configura — e a fronteira é sempre a mesma: " +
        "**leitura o agente executa, escrita espera confirmação humana**. Consultar um pedido, " +
        "explicar uma política, buscar na base de conhecimento: o agente faz. Emitir cobrança, " +
        "cancelar, agendar: ele propõe, e alguém do time clica.\n\n" +
        "Três guardas ficam na aplicação, não no texto do prompt: piso de confiança que transfere " +
        "para humano, fila de destino validada contra o catálogo, e teto de custo por conversa " +
        "conferido antes de gastar.",
    },
    {
      id: "faq-treino",
      question: "Vocês usam meus dados para treinar modelo?",
      answer:
        "Não. O contexto enviado ao modelo é decidido num único ponto do código e leva o mínimo " +
        "necessário — campo marcado como sensível viaja como *presença*, não como conteúdo: a IA " +
        "sabe que o documento está vazio, nunca qual documento estaria lá. Cada execução registra " +
        "modelo, tokens, latência, custo e versão do prompt, e esse rastro fica disponível para " +
        "auditoria.",
    },
    {
      id: "faq-prazo",
      question: "Qual o prazo de implantação?",
      answer:
        "De duas a seis semanas, conforme a edição e o número de canais. A implantação assistida " +
        "cobre filas, escalas, catálogo, conexão dos canais e a primeira automação, com " +
        "acompanhamento até o fim do primeiro mês em produção. É cobrança única e aparece separada " +
        "do recorrente no orçamento.",
    },
    {
      id: "faq-demo",
      question: "Consigo testar com dados parecidos com os meus?",
      answer:
        "Sim — é para isso que existem as demonstrações por segmento. Cada uma carrega uma operação " +
        "completa e fictícia do ramo: contatos, conversas, funis, campanhas e automações coerentes " +
        "com o vocabulário daquele negócio. Você entra no produto de verdade, não num vídeo.",
    },
  ],

  /* Rodapé ------------------------------------------------------------------------- */

  footer: {
    tagline:
      "Atendimento, CRM 360º, automação e inteligência artificial numa plataforma só — construída " +
      "para operação brasileira, com WhatsApp de verdade e LGPD desde o tipo.",
    columns: [
      {
        id: "col-produto",
        title: "Produto",
        links: [
          { id: "fl-inbox", href: "/#produto", label: "Inbox omnichannel" },
          { id: "fl-crm", href: "/#produto", label: "CRM 360º e funis" },
          { id: "fl-bot", href: "/#produto", label: "Chatbot e jornadas" },
          { id: "fl-campanhas", href: "/#produto", label: "Campanhas e e-mail" },
          { id: "fl-ia", href: "/#ia", label: "Agentes de IA" },
        ],
      },
      {
        id: "col-comercial",
        title: "Comercial",
        links: [
          { id: "fl-planos", href: "/precos", label: "Planos e preços" },
          { id: "fl-duvidas", href: "/precos#faq", label: "Dúvidas de preço" },
          { id: "fl-proposta", href: "/orcamento", label: "Solicitar proposta" },
          { id: "fl-conta", href: "/cadastrar", label: "Criar conta" },
        ],
      },
      {
        id: "col-confianca",
        title: "Confiança",
        links: [
          { id: "fl-seguranca", href: "/#seguranca", label: "Segurança e LGPD" },
          { id: "fl-implantacao", href: "/#produto", label: "Como é a implantação" },
          { id: "fl-faq", href: "/precos#faq", label: "Perguntas frequentes" },
          { id: "fl-area", href: "/entrar", label: "Área do cliente" },
        ],
      },
    ],
    statusTitle: "Estado da plataforma.",
    statusBody:
      "As telas são reais e navegáveis, e as bases de demonstração são abertas pela equipe comercial " +
      "durante a apresentação. A camada de escrita persistente, a autenticação corporativa e a " +
      "conexão com os canais estão em construção — contas criadas aqui vivem na memória do servidor " +
      "e são apagadas no reinício. Preferimos dizer isso na primeira página a explicar na primeira " +
      "reunião.",
    legal: "© 2026 Elora · Contabilidade Facilitada · Dados de demonstração são fictícios.",
  },
};
