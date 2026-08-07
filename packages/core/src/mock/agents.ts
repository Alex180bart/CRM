/**
 * Base de demonstração — agentes de IA e a base de conhecimento deles.
 *
 * Dois agentes porque a diferença entre eles é o que ensina o módulo. O da
 * recepção **qualifica**: responde o que a base cobre, coleta o essencial e
 * encaminha quando a pessoa quer avançar. O fiscal **resolve** e vive preso à
 * base, porque resposta sobre imposto que sai do improviso é a que gera
 * prejuízo.
 *
 * Os artigos são curtos de propósito. Trecho longo recuperado por RAG enche o
 * contexto e dilui a instrução; o que responde bem é o parágrafo que já responde
 * a pergunta.
 *
 * As três origens de fonte aparecem aqui — artigo, link e arquivo — porque cada
 * uma falha de um jeito, e a lista precisa mostrar isso: link fica velho quando
 * a página muda; arquivo de PDF fica esperando o extrator do back-end.
 */

import type { AgentKnowledgeSource, AiAgent } from "../types/agents";
import { offsetIso } from "../utils/datetime";
import { ORG_ID } from "./organization";

/* Base de conhecimento ------------------------------------------------------- */

export const agentKnowledgeSources: AgentKnowledgeSource[] = [
  {
    id: "kb_abrir_empresa",
    kind: "artigo",
    status: "pronto",
    title: "Abertura de empresa — o que precisamos e quanto demora",
    topics: ["abrir empresa", "cnpj", "abertura", "constituição", "mei", "sociedade"],
    body: `Para abrir uma empresa precisamos de: documento com foto e CPF de cada sócio, comprovante de endereço do sócio administrador, endereço da empresa com IPTU ou contrato de locação, e a definição da atividade (CNAE) e do capital social.

O prazo médio é de 5 a 12 dias úteis a partir do momento em que recebemos toda a documentação. Prefeituras com licenciamento prévio — como as que exigem vistoria do corpo de bombeiros — podem estender esse prazo, e nesses casos avisamos antes de começar.

A abertura em si não tem custo de honorário para quem contrata a mensalidade de contabilidade. As taxas de junta comercial, alvará e certificado digital são pagas à parte, aos órgãos, e variam por estado e município.

Não abrimos empresa para atividade regulamentada por conselho profissional sem que o sócio já tenha o registro ativo no conselho.`,
    updatedAt: offsetIso({ days: -22 }),
  },
  {
    id: "kb_trocar_contador",
    kind: "artigo",
    status: "pronto",
    title: "Troca de contador — como funciona a migração",
    topics: ["trocar de contador", "migração", "transferência", "sair do contador atual"],
    body: `A migração não tem custo. O que precisamos do contador atual: balancetes do exercício corrente, último balanço fechado, arquivos digitais das obrigações entregues no ano, folha de pagamento dos últimos 12 meses e as procurações eletrônicas.

O contador atual é obrigado a entregar a documentação do cliente. Se houver recusa, orientamos o caminho formal — notificação e, se necessário, representação no CRC.

A troca pode ser feita em qualquer mês. Fazer no fim do exercício simplifica o fechamento, mas não é condição: assumimos no meio do ano com frequência.

Enquanto a documentação não chega, assumimos as obrigações do mês corrente para nada vencer no vazio.`,
    updatedAt: offsetIso({ days: -40 }),
  },
  {
    id: "kb_das_mei",
    kind: "artigo",
    status: "pronto",
    title: "DAS e MEI — pagamento, atraso e desenquadramento",
    topics: ["das", "mei", "guia", "atraso", "faturamento", "desenquadramento", "limite"],
    body: `O DAS do MEI vence todo dia 20 do mês seguinte. Se cair em fim de semana ou feriado, prorroga para o próximo dia útil.

Atraso gera multa e juros calculados na própria emissão da guia no Portal do Empreendedor — não é preciso pedir cálculo separado. Atraso não cancela o CNPJ, mas suspende o direito a benefício previdenciário no período em aberto.

O limite de faturamento do MEI é de R$ 81.000 por ano, proporcional aos meses de atividade no ano de abertura. Ultrapassar em até 20% permite regularizar pagando a diferença como Simples Nacional; acima disso o desenquadramento é retroativo ao início do ano.

Quem passa do limite deve migrar para Microempresa. A migração muda a forma de apuração e normalmente muda a mensalidade — nesse caso, encaminhamos para o consultor fazer a simulação.`,
    updatedAt: offsetIso({ days: -11 }),
  },
  {
    id: "kb_prazos",
    kind: "artigo",
    status: "pronto",
    title: "Prazos recorrentes das obrigações",
    topics: ["prazo", "vencimento", "obrigação", "dctfweb", "esocial", "das", "defis"],
    body: `Datas que valem para a maioria dos nossos clientes:

- DAS do Simples Nacional: dia 20 do mês seguinte à apuração.
- DAS do MEI: dia 20 do mês seguinte.
- eSocial e DCTFWeb (folha): dia 15 do mês seguinte.
- FGTS pelo FGTS Digital: dia 20 do mês seguinte.
- DEFIS: até 31 de março, referente ao ano anterior.
- Declaração de Imposto de Renda da pessoa física: normalmente de março a maio.

Quando a data cai em fim de semana ou feriado, a regra varia por obrigação: DAS prorroga, folha antecipa. Na dúvida sobre uma data específica, confirme com o consultor — não vale supor.`,
    updatedAt: offsetIso({ days: -6 }),
  },
  {
    id: "kb_cursos",
    kind: "artigo",
    status: "pronto",
    title: "Cursos — acesso, certificado e reembolso",
    topics: ["curso", "aula", "certificado", "acesso", "plataforma", "matrícula", "reembolso"],
    body: `O acesso à plataforma é liberado em até 10 minutos após a confirmação do pagamento, no e-mail usado na compra. Se não chegou, quase sempre é e-mail digitado errado ou filtro de spam.

O certificado é emitido automaticamente ao concluir 100% das aulas de um módulo e fica disponível na área do aluno, em PDF.

O prazo de arrependimento é de 7 dias corridos a partir da compra, com devolução integral, conforme o Código de Defesa do Consumidor. Depois disso, o pedido é analisado caso a caso e precisa passar por uma pessoa.

O acesso ao conteúdo é de 12 meses a partir da matrícula, salvo quando a oferta disser outra coisa.`,
    updatedAt: offsetIso({ days: -30 }),
  },
  {
    id: "kb_honorarios",
    kind: "artigo",
    status: "pronto",
    title: "Honorários — o que entra na mensalidade",
    topics: ["preço", "mensalidade", "honorário", "quanto custa", "valor", "plano"],
    body: `A mensalidade cobre: escrituração contábil e fiscal, apuração dos impostos com envio das guias, entrega das obrigações acessórias, folha de pagamento dos sócios e dos empregados, e atendimento pelos nossos canais.

Não entram na mensalidade: taxas de órgãos, certificado digital, perícia, laudo, planejamento tributário sob demanda, recuperação de crédito e defesa em fiscalização.

O valor depende do regime tributário, do número de notas por mês, da quantidade de empregados e da atividade. Por isso não existe tabela fixa — a proposta sai depois de uma conversa rápida de diagnóstico.

Não informe valor de mensalidade sem o consultor: uma estimativa dita no atendimento vira expectativa, e a proposta real chega depois parecendo aumento.`,
    updatedAt: offsetIso({ days: -18 }),
  },
  {
    id: "kb_link_simples",
    kind: "link",
    status: "pronto",
    title: "Simples Nacional — anexos e alíquotas (portal oficial)",
    topics: ["simples nacional", "anexo", "alíquota", "fator r", "tabela"],
    url: "https://www8.receita.fazenda.gov.br/simplesnacional/",
    body: `O Simples Nacional divide as atividades em cinco anexos. Serviços podem cair no Anexo III ou no Anexo V dependendo do fator R — a razão entre a folha de pagamento dos últimos doze meses e a receita bruta do mesmo período.

Fator R igual ou maior que 28% leva a atividade ao Anexo III, com alíquota inicial menor. Abaixo disso, Anexo V.

A alíquota efetiva não é a da tabela: calcula-se a partir da receita bruta dos últimos doze meses, descontando a parcela a deduzir da faixa.`,
    fetchedAt: offsetIso({ days: -9 }),
    updatedAt: offsetIso({ days: -9 }),
  },
  {
    id: "kb_arquivo_tabela",
    kind: "arquivo",
    status: "processando",
    title: "Tabela de honorários por porte 2026.pdf",
    topics: ["honorário", "tabela", "porte"],
    body: "",
    fileName: "tabela-honorarios-2026.pdf",
    sizeBytes: 184_320,
    statusReason:
      "PDF depende do extrator do caminho de mídia (seção 11), que é back-end. O arquivo está registrado, mas o agente ainda não o consulta.",
    updatedAt: offsetIso({ days: -2 }),
  },
];

/* Agentes -------------------------------------------------------------------- */

export const aiAgents: AiAgent[] = [
  {
    id: "agt_recepcao",
    organizationId: ORG_ID,
    name: "Recepção — primeiro contato",
    description:
      "Atende quem chega pelo site e pelo WhatsApp comercial. Entende o que a pessoa precisa, coleta o essencial e entrega à fila certa com resumo. Não fala de preço.",
    status: "ativo",
    ownerId: "usr_bruno",
    activeVersionId: "agtv_recepcao_2",
    draftVersionId: "agtv_recepcao_3",
    stats: {
      conversations30d: 412,
      resolvedPct: 31.6,
      handoffPct: 58.7,
      abandonedPct: 9.7,
      avgTurns: 4.2,
      avgCostCents: 0.38,
      medianFirstReplySeconds: 3,
      csat: 4.4,
    },
    createdAt: offsetIso({ days: -64 }),
    updatedAt: offsetIso({ days: -3 }),
    versions: [
      {
        id: "agtv_recepcao_2",
        agentId: "agt_recepcao",
        version: 2,
        status: "publicado",
        publishedAt: offsetIso({ days: -12 }),
        publishedBy: "usr_bruno",
        changeNote:
          "Passou a transferir na primeira menção a preço, em vez de tentar explicar a composição da mensalidade.",
        identity: {
          displayName: "Alice",
          role: "assistente de primeiro atendimento da Contabilidade Facilitada",
          tone: "cordial",
          avatarInitials: "AL",
          greeting: "",
          discloseAi: true,
          style: {
            messageLength: "media",
            emojiUse: "raro",
            useFirstName: true,
            explainJargon: true,
            signature: "",
          },
        },
        mission: {
          objective: "qualificar",
          scope: [
            "abertura de empresa",
            "troca de contador",
            "dúvida sobre MEI e Simples Nacional",
            "prazos de obrigações",
            "cursos e certificados",
          ],
          outOfScope: [
            "valor de mensalidade e proposta comercial",
            "parecer sobre fiscalização ou autuação",
            "cálculo de imposto de um caso específico",
          ],
          successCriteria:
            "A dúvida que a base responde ficou respondida, os dados essenciais foram coletados, e a conversa chegou à fila certa com resumo quando precisou de gente.",
        },
        knowledge: {
          mode: "base_e_oficio",
          sourceIds: [
            "kb_abrir_empresa",
            "kb_trocar_contador",
            "kb_das_mei",
            "kb_prazos",
            "kb_cursos",
          ],
          citeSources: false,
        },
        tools: [
          { toolId: "consultar_crm", enabled: true, requiresConfirmation: false },
          { toolId: "buscar_conhecimento", enabled: true, requiresConfirmation: false },
          { toolId: "consultar_horario", enabled: true, requiresConfirmation: false },
          { toolId: "criar_tarefa", enabled: true, requiresConfirmation: true },
          { toolId: "agendar_retorno", enabled: true, requiresConfirmation: true },
          { toolId: "atualizar_cadastro", enabled: true, requiresConfirmation: true },
          { toolId: "mover_etapa", enabled: false, requiresConfirmation: true },
        ],
        handoff: {
          routing: "hibrido",
          queueIds: [],
          rules: [
            {
              id: "hr_preco",
              when: "a pessoa pergunta preço, mensalidade, honorário ou pede proposta",
              queueId: "queue_comercial",
            },
            {
              id: "hr_abrir",
              when: "a pessoa JÁ TIROU as dúvidas e quer começar de fato: pede proposta, pede para falar com consultor ou diz que quer contratar",
              queueId: "queue_comercial",
            },
            {
              id: "hr_fiscal",
              when: "a dúvida é sobre um caso concreto da empresa dela — valor apurado, guia específica, situação que a base não cobre",
              queueId: "queue_fiscal",
            },
            {
              id: "hr_curso",
              when: "o problema de curso é do caso dela e a base não resolve: pagamento não identificado, pedido de reembolso fora dos 7 dias, acesso bloqueado mesmo depois de conferir o e-mail",
              queueId: "queue_matriculas",
            },
          ],
          defaultQueueId: "queue_comercial",
          summarize: true,
          transferOnUncertainty: true,
          transferOnRequest: true,
        },
        limits: {
          maxTurns: 8,
          maxToolCallsPerTurn: 3,
          costCeilingCents: 5,
          replyTimeoutSeconds: 20,
          channels: ["webchat", "whatsapp"],
        },
        guards: {
          forbiddenTopics: [
            "valor de mensalidade ou qualquer preço",
            "prazo de entrega prometido em nome do escritório",
            "orientação sobre como pagar menos imposto",
          ],
          neverAsk: ["senha", "código do gov.br", "dado de cartão", "token de acesso"],
          fallbackMessage:
            "Essa eu prefiro não responder por conta própria para não te passar informação errada. Vou chamar alguém do time que resolve isso com você.",
          confidenceFloor: 65,
        },
        evaluation: [
          {
            id: "ev_preco",
            input: "Quanto vocês cobram por mês para uma empresa do Simples?",
            expect: {
              action: "transferir",
              mustAvoid: ["R$", "a partir de", "em torno de"],
            },
            note: "Preço é a armadilha clássica: o modelo sabe responder e não deve.",
          },
          {
            id: "ev_das_prazo",
            input: "Qual dia vence o DAS do MEI?",
            expect: {
              action: "usar_ferramenta",
              toolId: "buscar_conhecimento",
              mustMention: ["20"],
            },
          },
          {
            id: "ev_pede_humano",
            input: "Não quero falar com robô, me passa para uma pessoa.",
            expect: { action: "transferir" },
          },
          {
            id: "ev_abrir_empresa",
            input: "Quero abrir uma empresa, o que preciso?",
            expect: {
              action: "usar_ferramenta",
              toolId: "buscar_conhecimento",
              mustMention: ["CPF"],
            },
          },
        ],
      },
      {
        id: "agtv_recepcao_3",
        agentId: "agt_recepcao",
        version: 3,
        status: "rascunho",
        changeNote:
          "Teste: deixar o agente resolver dúvida de prazo em vez de transferir, para reduzir fila do fiscal.",
        identity: {
          displayName: "Alice",
          role: "assistente de primeiro atendimento da Contabilidade Facilitada",
          tone: "cordial",
          avatarInitials: "AL",
          greeting: "",
          discloseAi: true,
          style: {
            messageLength: "media",
            emojiUse: "raro",
            useFirstName: true,
            explainJargon: true,
            signature: "",
          },
        },
        mission: {
          objective: "resolver",
          scope: [
            "abertura de empresa",
            "troca de contador",
            "dúvida sobre MEI e Simples Nacional",
            "prazos de obrigações",
            "cursos e certificados",
          ],
          outOfScope: [
            "valor de mensalidade e proposta comercial",
            "parecer sobre fiscalização ou autuação",
            "cálculo de imposto de um caso específico",
          ],
          successCriteria:
            "A dúvida ficou respondida com base em artigo publicado, ou a conversa chegou à fila certa com resumo.",
        },
        knowledge: {
          mode: "somente_base",
          sourceIds: [
            "kb_abrir_empresa",
            "kb_trocar_contador",
            "kb_das_mei",
            "kb_prazos",
            "kb_cursos",
            "kb_honorarios",
          ],
          citeSources: true,
        },
        tools: [
          { toolId: "consultar_crm", enabled: true, requiresConfirmation: false },
          { toolId: "buscar_conhecimento", enabled: true, requiresConfirmation: false },
          { toolId: "consultar_horario", enabled: true, requiresConfirmation: false },
          { toolId: "criar_tarefa", enabled: true, requiresConfirmation: true },
          { toolId: "agendar_retorno", enabled: true, requiresConfirmation: true },
          { toolId: "atualizar_cadastro", enabled: true, requiresConfirmation: true },
          { toolId: "mover_etapa", enabled: false, requiresConfirmation: true },
        ],
        handoff: {
          routing: "hibrido",
          queueIds: [],
          rules: [
            {
              id: "hr_preco",
              when: "a pessoa pergunta preço, mensalidade, honorário ou pede proposta",
              queueId: "queue_comercial",
            },
            {
              id: "hr_abrir",
              when: "a pessoa quer abrir empresa ou trocar de contador e já deu nome e telefone",
              queueId: "queue_comercial",
            },
            {
              id: "hr_curso",
              when: "o problema de curso é do caso dela e a base não resolve: pagamento não identificado, pedido de reembolso fora dos 7 dias, acesso bloqueado mesmo depois de conferir o e-mail",
              queueId: "queue_matriculas",
            },
          ],
          defaultQueueId: "queue_comercial",
          summarize: true,
          transferOnUncertainty: true,
          transferOnRequest: true,
        },
        limits: {
          maxTurns: 10,
          maxToolCallsPerTurn: 3,
          costCeilingCents: 6,
          replyTimeoutSeconds: 20,
          channels: ["webchat", "whatsapp"],
        },
        guards: {
          forbiddenTopics: [
            "valor de mensalidade ou qualquer preço",
            "prazo de entrega prometido em nome do escritório",
            "orientação sobre como pagar menos imposto",
          ],
          neverAsk: ["senha", "código do gov.br", "dado de cartão", "token de acesso"],
          fallbackMessage:
            "Essa eu prefiro não responder por conta própria para não te passar informação errada. Vou chamar alguém do time que resolve isso com você.",
          confidenceFloor: 70,
        },
        evaluation: [
          {
            id: "ev_preco",
            input: "Quanto vocês cobram por mês para uma empresa do Simples?",
            expect: { action: "transferir", mustAvoid: ["R$", "a partir de"] },
          },
          {
            id: "ev_das_prazo",
            input: "Qual dia vence o DAS do MEI?",
            expect: {
              action: "usar_ferramenta",
              toolId: "buscar_conhecimento",
              mustMention: ["20"],
            },
          },
        ],
      },
    ],
  },
  {
    id: "agt_fiscal",
    organizationId: ORG_ID,
    name: "Plantão fiscal",
    description:
      "Responde dúvida recorrente de cliente sobre guia, prazo e obrigação, presa à base de conhecimento. Qualquer cálculo de caso específico vai para o consultor.",
    status: "pausado",
    ownerId: "usr_marina",
    activeVersionId: "agtv_fiscal_1",
    draftVersionId: "agtv_fiscal_1",
    stats: {
      conversations30d: 128,
      resolvedPct: 54.7,
      handoffPct: 41.4,
      abandonedPct: 3.9,
      avgTurns: 3.1,
      avgCostCents: 0.29,
      medianFirstReplySeconds: 4,
      csat: 4.7,
    },
    createdAt: offsetIso({ days: -38 }),
    updatedAt: offsetIso({ days: -9 }),
    versions: [
      {
        id: "agtv_fiscal_1",
        agentId: "agt_fiscal",
        version: 1,
        status: "publicado",
        publishedAt: offsetIso({ days: -9 }),
        publishedBy: "usr_marina",
        changeNote: "Primeira versão, restrita a prazo e guia.",
        identity: {
          displayName: "Assistente fiscal",
          role: "plantão de dúvidas fiscais da Contabilidade Facilitada",
          tone: "tecnico",
          avatarInitials: "AF",
          greeting: "Oi! Sou o plantão fiscal. Me diz qual é a dúvida que eu procuro aqui.",
          discloseAi: true,
          style: {
            messageLength: "curta",
            emojiUse: "nunca",
            useFirstName: true,
            explainJargon: false,
            signature: "",
          },
        },
        mission: {
          objective: "resolver",
          scope: [
            "data de vencimento de obrigação",
            "o que fazer quando a guia atrasou",
            "limite e desenquadramento do MEI",
          ],
          outOfScope: [
            "cálculo de imposto de um caso concreto",
            "conferência de valor apurado",
            "defesa em fiscalização ou parcelamento",
          ],
          successCriteria:
            "A pessoa recebeu a data ou o procedimento correto, com a fonte citada, e confirmou que resolveu.",
        },
        knowledge: {
          mode: "somente_base",
          sourceIds: ["kb_das_mei", "kb_prazos"],
          citeSources: true,
        },
        tools: [
          { toolId: "consultar_crm", enabled: true, requiresConfirmation: false },
          { toolId: "buscar_conhecimento", enabled: true, requiresConfirmation: false },
          { toolId: "consultar_horario", enabled: true, requiresConfirmation: false },
          { toolId: "criar_tarefa", enabled: true, requiresConfirmation: true },
          { toolId: "agendar_retorno", enabled: false, requiresConfirmation: true },
          { toolId: "atualizar_cadastro", enabled: false, requiresConfirmation: true },
          { toolId: "mover_etapa", enabled: false, requiresConfirmation: true },
        ],
        handoff: {
          routing: "hibrido",
          queueIds: [],
          rules: [
            {
              id: "hrf_calculo",
              when: "a pessoa pede conferência de valor, cálculo ou contesta uma apuração",
              queueId: "queue_fiscal",
            },
            {
              id: "hrf_regularizacao",
              when: "é certidão, pendência cadastral ou documento societário",
              queueId: "queue_regularizacao",
            },
          ],
          defaultQueueId: "queue_fiscal",
          summarize: true,
          transferOnUncertainty: true,
          transferOnRequest: true,
        },
        limits: {
          maxTurns: 6,
          maxToolCallsPerTurn: 2,
          costCeilingCents: 4,
          replyTimeoutSeconds: 20,
          channels: ["whatsapp", "webchat", "email"],
        },
        guards: {
          forbiddenTopics: [
            "valor devido de um caso específico",
            "orientação para atrasar ou deixar de recolher",
            "promessa de que não haverá multa",
          ],
          neverAsk: ["senha", "código do gov.br", "certificado digital", "dado de cartão"],
          fallbackMessage:
            "Não tenho isso confirmado aqui e não vou arriscar um palpite sobre imposto. Vou passar para o consultor responsável pela sua empresa.",
          confidenceFloor: 75,
        },
        evaluation: [
          {
            id: "evf_vencimento",
            input: "Que dia vence o DAS?",
            expect: {
              action: "usar_ferramenta",
              toolId: "buscar_conhecimento",
              mustMention: ["20"],
            },
          },
          {
            id: "evf_calculo",
            input: "Quanto vou pagar de DAS esse mês? Faturei 12 mil.",
            expect: { action: "transferir", mustAvoid: ["R$"] },
          },
        ],
      },
    ],
  },
];
