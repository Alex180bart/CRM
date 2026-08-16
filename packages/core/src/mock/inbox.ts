/**
 * Base de demonstração — conversas, mensagens e notas internas.
 *
 * Os prazos de SLA são derivados da política da fila (seção 10 do plano):
 * `createdAt + firstResponseSlaMinutes` e `createdAt + resolutionSlaMinutes`.
 */

import type { ChannelKind } from "../types/common";
import type {
  Attachment,
  CannedResponse,
  Conversation,
  ConversationState,
  InternalNote,
  Message,
  MessageAuthorKind,
  MessageDeliveryStatus,
  MessageQuote,
} from "../types/inbox";
import { offsetIso } from "../utils/datetime";
import { resolveSlaStatus } from "../utils/sla";
import { ORG_ID, queues } from "./organization";

/**
 * Captura de tela desenhada em SVG.
 *
 * A base é local e não pode depender de arquivo binário nem de host externo —
 * mas um anexo de imagem sem imagem não exercita a galeria, o mosaico nem o
 * lightbox. Um SVG em data URI resolve: é texto, versiona junto com o código e
 * se parece o bastante com o print que um aluno mandaria.
 */
const BLOCKED_MODULE_SCREENSHOT =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400' viewBox='0 0 640 400'>" +
  "<rect width='640' height='400' fill='%23f1f5f9'/>" +
  "<rect width='640' height='44' fill='%23102850'/>" +
  "<circle cx='24' cy='22' r='6' fill='%23ff9933'/>" +
  "<rect x='40' y='16' width='120' height='12' rx='6' fill='%23ffffff' opacity='.85'/>" +
  "<rect x='520' y='14' width='96' height='16' rx='8' fill='%23ffffff' opacity='.25'/>" +
  "<rect x='24' y='68' width='210' height='14' rx='7' fill='%23334155'/>" +
  "<rect x='24' y='94' width='300' height='10' rx='5' fill='%2394a3b8'/>" +
  "<g>" +
  "<rect x='24' y='128' width='592' height='56' rx='10' fill='%23ffffff'/>" +
  "<circle cx='56' cy='156' r='14' fill='%2316a34a' opacity='.15'/><path d='M50 156l4 4 8-8' stroke='%2316a34a' stroke-width='2.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/>" +
  "<rect x='84' y='142' width='190' height='11' rx='5' fill='%23334155'/><rect x='84' y='161' width='120' height='9' rx='4' fill='%23cbd5e1'/>" +
  "<rect x='520' y='148' width='72' height='16' rx='8' fill='%2316a34a' opacity='.15'/>" +
  "</g><g>" +
  "<rect x='24' y='192' width='592' height='56' rx='10' fill='%23ffffff'/>" +
  "<circle cx='56' cy='220' r='14' fill='%2316a34a' opacity='.15'/><path d='M50 220l4 4 8-8' stroke='%2316a34a' stroke-width='2.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/>" +
  "<rect x='84' y='206' width='210' height='11' rx='5' fill='%23334155'/><rect x='84' y='225' width='104' height='9' rx='4' fill='%23cbd5e1'/>" +
  "<rect x='520' y='212' width='72' height='16' rx='8' fill='%2316a34a' opacity='.15'/>" +
  "</g><g>" +
  "<rect x='24' y='256' width='592' height='56' rx='10' fill='%23fef2f2' stroke='%23dc2626' stroke-width='1.5'/>" +
  "<rect x='45' y='217' width='22' height='16' rx='3' transform='translate(0 44)' fill='none' stroke='%23dc2626' stroke-width='2'/>" +
  "<path d='M50 261v-4a6 6 0 0112 0v4' transform='translate(0 14)' fill='none' stroke='%23dc2626' stroke-width='2'/>" +
  "<rect x='84' y='270' width='236' height='11' rx='5' fill='%23991b1b'/>" +
  "<rect x='84' y='289' width='168' height='9' rx='4' fill='%23dc2626' opacity='.5'/>" +
  "<rect x='500' y='276' width='92' height='16' rx='8' fill='%23dc2626' opacity='.18'/>" +
  "</g>" +
  "<rect x='24' y='336' width='340' height='9' rx='4' fill='%23cbd5e1'/>" +
  "<rect x='24' y='356' width='240' height='9' rx='4' fill='%23e2e8f0'/>" +
  "</svg>";

interface MessageSeed {
  from: MessageAuthorKind;
  authorId?: string;
  authorLabel: string;
  body: string;
  minutesAgo: number;
  status?: MessageDeliveryStatus;
  templateName?: string;
  attachments?: Attachment[];
  quote?: MessageQuote;
  failureCode?: string;
  failureReason?: string;
}

interface NoteSeed {
  authorId: string;
  authorLabel: string;
  body: string;
  minutesAgo: number;
  mentions?: string[];
}

interface ConversationSeed {
  id: string;
  contactId: string;
  channel: ChannelKind;
  channelAccountId: string;
  queueId: string;
  assigneeId?: string;
  observerIds?: string[];
  state: ConversationState;
  subject: string;
  priority: Conversation["priority"];
  tagIds: string[];
  unreadCount: number;
  /** Minutos desde a abertura da conversa. */
  openedMinutesAgo: number;
  /** Minutos desde a primeira resposta do time; ausente = ainda sem resposta. */
  firstRespondedMinutesAgo?: number;
  handoffSummary?: string;
  botSessionId?: string;
  satisfactionScore?: number;
  messages: MessageSeed[];
  notes?: NoteSeed[];
}

const CONVERSATION_SEEDS: ConversationSeed[] = [
  {
    id: "cnv_001",
    contactId: "cnt_005",
    channel: "whatsapp",
    channelAccountId: "chan_wa_atendimento",
    queueId: "queue_fiscal",
    state: "nova",
    subject: "DAS de julho com valor divergente",
    priority: "urgente",
    tagIds: ["tag_urgente", "tag_simples"],
    unreadCount: 3,
    openedMinutesAgo: 12,
    messages: [
      {
        from: "contato",
        authorLabel: "Simone Vieira",
        body: "Bom dia! O DAS que veio hoje está com valor bem acima do mês passado. Podem verificar?",
        minutesAgo: 12,
      },
      {
        from: "contato",
        authorLabel: "Simone Vieira",
        body: "Nosso faturamento até caiu em julho, então não faz sentido.",
        minutesAgo: 11,
      },
      {
        from: "bot",
        authorLabel: "Bot — Triagem fiscal",
        body: "Olá, Simone! Identifiquei que sua dúvida é sobre apuração. Já estou direcionando para o time fiscal.",
        minutesAgo: 11,
        status: "entregue",
      },
      {
        from: "contato",
        authorLabel: "Simone Vieira",
        body: "Preciso pagar até sexta, por favor me retornem hoje.",
        minutesAgo: 9,
      },
      {
        from: "contato",
        authorLabel: "Simone Vieira",
        // Áudio sem URL e com transcrição: é o estado real logo depois do
        // recebimento — o registro já existe, a mídia ainda está em
        // processamento (seção 11), e a transcrição é o que salva o atendente
        // de ouvir um minuto de gravação.
        body: "",
        minutesAgo: 8,
        attachments: [
          {
            id: "att_004",
            fileName: "audio-simone.ogg",
            mimeType: "audio/ogg",
            sizeBytes: 96_000,
            kind: "audio",
            durationSeconds: 47,
            transcript:
              "Ó, é que o mês passado deu mil e duzentos e agora veio mil e novecentos, e o faturamento de junho foi menor, uns cento e dez mil contra cento e trinta. Então eu não entendi de onde saiu essa diferença. Se puderem olhar hoje eu agradeço, porque sexta é o vencimento.",
          },
        ],
      },
    ],
  },
  {
    id: "cnv_002",
    contactId: "cnt_001",
    channel: "whatsapp",
    channelAccountId: "chan_wa_atendimento",
    queueId: "queue_fiscal",
    assigneeId: "usr_rafael",
    observerIds: ["usr_marina"],
    state: "em_atendimento",
    subject: "Retenção de INSS na nota do prestador",
    priority: "alta",
    tagIds: ["tag_vip", "tag_simples"],
    unreadCount: 1,
    openedMinutesAgo: 96,
    firstRespondedMinutesAgo: 88,
    messages: [
      {
        from: "contato",
        authorLabel: "Helena Ribeiro",
        body: "Rafael, recebemos uma nota de prestador com retenção de INSS. Precisamos recolher em separado?",
        minutesAgo: 96,
      },
      {
        from: "agente",
        authorId: "usr_rafael",
        authorLabel: "Rafael Coelho",
        body: "Oi, Helena! Sim, a retenção precisa ser recolhida em GPS própria. Vou confirmar o código e já te retorno.",
        minutesAgo: 88,
        status: "lida",
      },
      {
        from: "agente",
        authorId: "usr_rafael",
        authorLabel: "Rafael Coelho",
        body: "Confirmado: código 2631, vencimento no dia 20. Estou anexando o comprovante de cálculo.",
        minutesAgo: 42,
        status: "lida",
        attachments: [
          {
            id: "att_001",
            fileName: "calculo-retencao-inss.pdf",
            mimeType: "application/pdf",
            sizeBytes: 184320,
            kind: "documento",
          },
        ],
      },
      {
        from: "contato",
        authorLabel: "Helena Ribeiro",
        body: "Perfeito. E se o prestador for MEI, muda alguma coisa?",
        minutesAgo: 6,
        // Cliente respondendo a uma mensagem específica: o WhatsApp materializa
        // o trecho citado, e não uma referência — a original pode ter sido
        // apagada e a citação continua legível.
        quote: {
          messageId: "cnv_002_msg_03",
          authorLabel: "Rafael Coelho",
          preview: "Confirmado: código 2631, vencimento no dia 20.",
        },
      },
    ],
    notes: [
      {
        authorId: "usr_rafael",
        authorLabel: "Rafael Coelho",
        body: "Cliente VIP. Se virar recorrente, vale abrir tarefa para revisar o contrato de prestação.",
        minutesAgo: 40,
        mentions: ["usr_marina"],
      },
    ],
  },
  {
    id: "cnv_003",
    contactId: "cnt_020",
    channel: "email",
    channelAccountId: "chan_email_atendimento",
    queueId: "queue_fiscal",
    assigneeId: "usr_marina",
    state: "em_atendimento",
    subject: "Proposta de migração do grupo TechMart",
    priority: "alta",
    tagIds: ["tag_vip", "tag_urgente"],
    unreadCount: 0,
    openedMinutesAgo: 260,
    firstRespondedMinutesAgo: 230,
    messages: [
      {
        from: "contato",
        authorLabel: "Sérgio Antunes",
        body: "Marina, conforme conversamos, gostaria da proposta consolidada para as três empresas do grupo.",
        minutesAgo: 260,
      },
      {
        from: "agente",
        authorId: "usr_marina",
        authorLabel: "Marina Duarte",
        body: "Sérgio, bom dia! Estou consolidando com o comercial. Envio ainda hoje com o comparativo de regime.",
        minutesAgo: 230,
        status: "entregue",
      },
      {
        from: "contato",
        authorLabel: "Sérgio Antunes",
        body: "Ótimo. Preciso levar ao conselho na quinta-feira.",
        minutesAgo: 120,
      },
    ],
    notes: [
      {
        authorId: "usr_marina",
        authorLabel: "Marina Duarte",
        body: "Bruno está montando o comparativo. Prazo interno: hoje até 17h.",
        minutesAgo: 118,
        mentions: ["usr_bruno"],
      },
    ],
  },
  {
    id: "cnv_004",
    contactId: "cnt_004",
    channel: "instagram",
    channelAccountId: "chan_instagram",
    queueId: "queue_comercial",
    assigneeId: "usr_bruno",
    state: "aguardando_cliente",
    subject: "Interesse em trocar de contador",
    priority: "normal",
    tagIds: ["tag_migracao"],
    unreadCount: 0,
    openedMinutesAgo: 1500,
    firstRespondedMinutesAgo: 1480,
    handoffSummary:
      "Bot qualificou: clínica em Curitiba, Lucro Presumido, insatisfeito com prazo do contador atual. Quer proposta.",
    botSessionId: "bots_014",
    messages: [
      {
        from: "contato",
        authorLabel: "Fernando Castro",
        body: "Vi o post sobre Simples x Presumido. Nossa clínica hoje está no Presumido e acho que pagamos demais.",
        minutesAgo: 1500,
      },
      {
        from: "bot",
        authorLabel: "Bot — Qualificação comercial",
        body: "Que bom te ver por aqui! Para simular, me confirma o faturamento médio mensal e a folha atual.",
        minutesAgo: 1499,
        status: "lida",
      },
      {
        from: "contato",
        authorLabel: "Fernando Castro",
        body: "Faturamento em torno de 180 mil e folha de 42 mil.",
        minutesAgo: 1492,
      },
      {
        from: "agente",
        authorId: "usr_bruno",
        authorLabel: "Bruno Tavares",
        body: "Fernando, com esse fator R o Simples tende a ser vantajoso. Posso te enviar a simulação detalhada?",
        minutesAgo: 1480,
        status: "lida",
      },
      {
        from: "contato",
        authorLabel: "Fernando Castro",
        body: "Pode sim, obrigado!",
        minutesAgo: 1470,
      },
      {
        from: "agente",
        authorId: "usr_bruno",
        authorLabel: "Bruno Tavares",
        body: "Enviado. Fico no aguardo do seu retorno para agendarmos a conversa.",
        minutesAgo: 1465,
        status: "entregue",
        attachments: [
          {
            id: "att_002",
            fileName: "simulacao-regime-tributario.xlsx",
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            sizeBytes: 45120,
            kind: "documento",
          },
        ],
      },
    ],
  },
  {
    id: "cnv_005",
    contactId: "cnt_007",
    channel: "whatsapp",
    channelAccountId: "chan_wa_atendimento",
    queueId: "queue_matriculas",
    assigneeId: "usr_juliana",
    state: "em_atendimento",
    subject: "Sem acesso ao módulo 3 do curso",
    priority: "normal",
    tagIds: ["tag_aluno"],
    unreadCount: 2,
    openedMinutesAgo: 34,
    firstRespondedMinutesAgo: 28,
    messages: [
      {
        from: "contato",
        authorLabel: "Larissa Fonseca",
        body: "Oi! O módulo 3 aparece bloqueado para mim, mesmo eu tendo concluído o 2.",
        minutesAgo: 34,
      },
      {
        from: "agente",
        authorId: "usr_juliana",
        authorLabel: "Juliana Prado",
        body: "Oi, Larissa! Vou verificar seu progresso na plataforma agora mesmo.",
        minutesAgo: 28,
        status: "lida",
      },
      {
        from: "contato",
        authorLabel: "Larissa Fonseca",
        body: "Obrigada! Preciso terminar até o fim da semana por causa da prova.",
        minutesAgo: 4,
      },
      {
        from: "contato",
        authorLabel: "Larissa Fonseca",
        body: "Segue o print da tela bloqueada.",
        minutesAgo: 3,
        attachments: [
          {
            id: "att_003",
            fileName: "modulo-bloqueado.png",
            mimeType: "image/png",
            sizeBytes: 342000,
            kind: "imagem",
            url: BLOCKED_MODULE_SCREENSHOT,
            previewUrl: BLOCKED_MODULE_SCREENSHOT,
            width: 640,
            height: 400,
          },
        ],
      },
      {
        from: "agente",
        authorId: "usr_juliana",
        authorLabel: "Juliana Prado",
        body: "Achei o problema: a conclusão do módulo 2 não sincronizou. Já liberei. Enquanto isso, este vídeo cobre o começo do módulo 3.",
        minutesAgo: 1,
        status: "entregue",
        // Vídeo por link: sem bytes nossos, com capa e título do provedor. É o
        // caso que a interface precisa distinguir de um arquivo de vídeo.
        attachments: [
          {
            id: "att_005",
            fileName: "Fechamento da folha: o que conferir antes de transmitir",
            title: "Fechamento da folha: o que conferir antes de transmitir",
            mimeType: "text/html",
            kind: "video",
            source: "link",
            provider: "youtube",
            previewUrl: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg",
            externalUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
          },
        ],
      },
    ],
  },
  {
    id: "cnv_006",
    contactId: "cnt_016",
    channel: "whatsapp",
    channelAccountId: "chan_wa_atendimento",
    queueId: "queue_regularizacao",
    state: "em_triagem",
    subject: "Certidão negativa vencida",
    priority: "alta",
    tagIds: ["tag_inadimplente", "tag_mei"],
    unreadCount: 1,
    openedMinutesAgo: 41,
    messages: [
      {
        from: "contato",
        authorLabel: "Thiago Ramalho",
        body: "Preciso da certidão negativa para participar de uma licitação, mas consta pendência.",
        minutesAgo: 41,
      },
      {
        from: "bot",
        authorLabel: "Bot — Triagem fiscal",
        body: "Entendi. Vou direcionar para o time de regularização documental.",
        minutesAgo: 40,
        status: "entregue",
      },
    ],
    notes: [
      {
        authorId: "usr_marina",
        authorLabel: "Marina Duarte",
        body: "Cliente com duas parcelas em aberto. Verificar antes de prometer prazo.",
        minutesAgo: 30,
      },
    ],
  },
  {
    id: "cnv_007",
    contactId: "cnt_010",
    channel: "webchat",
    channelAccountId: "chan_wgt_site",
    queueId: "queue_comercial",
    state: "nova",
    subject: "Simulação de abertura de empresa",
    priority: "normal",
    tagIds: [],
    unreadCount: 3,
    openedMinutesAgo: 14,
    firstRespondedMinutesAgo: 11,
    /**
     * Conversa de referência da tabulação: o lead entrega CPF, regime pretendido
     * e pedido de retorno com hora — três dados que o cadastro não tem e que,
     * sem o copiloto, ficariam só aqui dentro. Serve para exercitar lacuna,
     * campo personalizado e tarefa com prazo numa análise só.
     */
    messages: [
      {
        from: "contato",
        authorLabel: "Anderson Melo",
        body: "Olá, quero abrir uma empresa de desenvolvimento de software. Quanto custa a abertura com vocês?",
        minutesAgo: 14,
      },
      {
        from: "agente",
        authorLabel: "Bruno Tavares",
        body: "Olá, Anderson. A abertura sai por R$ 890 e leva de 10 a 15 dias úteis. Para montar a simulação certinha, me passa seu CPF e me diz se você já pensou em algum regime.",
        minutesAgo: 11,
      },
      {
        from: "contato",
        authorLabel: "Anderson Melo",
        body: "Meu CPF é 529.982.247-25. Pelo que li, o Simples Nacional é o melhor para o meu caso — faturamento previsto de uns 25 mil por mês.",
        minutesAgo: 6,
      },
      {
        from: "contato",
        authorLabel: "Anderson Melo",
        body: "Agora preciso sair. Me liga amanhã de manhã que a gente fecha isso, pode ser? Sou CTO na empresa que estou saindo, então de manhã cedo é melhor.",
        minutesAgo: 2,
      },
    ],
  },
  {
    id: "cnv_008",
    contactId: "cnt_003",
    channel: "email",
    channelAccountId: "chan_email_atendimento",
    queueId: "queue_fiscal",
    assigneeId: "usr_alex",
    state: "aguardando_interno",
    subject: "Divergência no SPED Fiscal de junho",
    priority: "alta",
    tagIds: ["tag_lucro_presumido", "tag_vip"],
    unreadCount: 0,
    openedMinutesAgo: 720,
    firstRespondedMinutesAgo: 700,
    messages: [
      {
        from: "contato",
        authorLabel: "Patrícia Lopes",
        body: "A validação do SPED apontou divergência de CFOP em 14 notas. Podem revisar?",
        minutesAgo: 720,
      },
      {
        from: "agente",
        authorId: "usr_alex",
        authorLabel: "André Fontes",
        body: "Patrícia, recebido. Vou levantar as notas e retorno com o plano de correção.",
        minutesAgo: 700,
        status: "lida",
      },
      {
        from: "agente",
        authorId: "usr_alex",
        authorLabel: "André Fontes",
        body: "Encaminhei ao time fiscal para reprocessamento. Assim que tiver o retorno, aviso por aqui.",
        minutesAgo: 300,
        status: "entregue",
      },
    ],
    notes: [
      {
        authorId: "usr_alex",
        authorLabel: "André Fontes",
        body: "Aguardando o time fiscal reprocessar o arquivo. Prazo combinado: amanhã até 12h.",
        minutesAgo: 298,
      },
    ],
  },
  {
    id: "cnv_009",
    contactId: "cnt_022",
    channel: "whatsapp",
    channelAccountId: "chan_wa_comercial",
    queueId: "queue_comercial",
    assigneeId: "usr_bruno",
    state: "em_atendimento",
    subject: "Desenquadramento de MEI",
    priority: "normal",
    tagIds: ["tag_mei"],
    unreadCount: 0,
    openedMinutesAgo: 180,
    firstRespondedMinutesAgo: 172,
    messages: [
      {
        from: "contato",
        authorLabel: "Rodrigo Baptista",
        body: "Estourei o limite do MEI esse ano. O que preciso fazer?",
        minutesAgo: 180,
      },
      {
        from: "agente",
        authorId: "usr_bruno",
        authorLabel: "Bruno Tavares",
        body: "Rodrigo, o desenquadramento é obrigatório. Te explico o passo a passo e os custos envolvidos.",
        minutesAgo: 172,
        status: "lida",
      },
      {
        from: "agente",
        authorId: "usr_bruno",
        authorLabel: "Bruno Tavares",
        body: "Te enviei nossa proposta para conduzir a transição para ME.",
        minutesAgo: 90,
        status: "entregue",
      },
    ],
  },
  {
    id: "cnv_010",
    contactId: "cnt_023",
    channel: "whatsapp",
    channelAccountId: "chan_wa_atendimento",
    queueId: "queue_matriculas",
    assigneeId: "usr_juliana",
    state: "aguardando_cliente",
    subject: "Renovação do curso de Departamento Pessoal",
    priority: "baixa",
    tagIds: ["tag_aluno", "tag_renovacao"],
    unreadCount: 0,
    openedMinutesAgo: 2880,
    firstRespondedMinutesAgo: 2870,
    messages: [
      {
        from: "agente",
        authorId: "usr_juliana",
        authorLabel: "Juliana Prado",
        body: "Aline, seu acesso vence em 15 dias. Quer renovar com o desconto de aluno?",
        minutesAgo: 2880,
        status: "lida",
        templateName: "renovacao_curso_v3",
      },
      {
        from: "contato",
        authorLabel: "Aline Cardoso",
        body: "Vou conversar com o RH e te retorno.",
        minutesAgo: 2870,
      },
    ],
  },
  {
    id: "cnv_011",
    contactId: "cnt_013",
    channel: "instagram",
    channelAccountId: "chan_instagram",
    queueId: "queue_comercial",
    state: "em_triagem",
    subject: "Dúvida sobre pró-labore",
    priority: "normal",
    tagIds: ["tag_migracao"],
    unreadCount: 2,
    openedMinutesAgo: 22,
    messages: [
      {
        from: "contato",
        authorLabel: "Camila Rezende",
        body: "Vocês atendem clínicas? Queria entender melhor a questão do pró-labore dos sócios.",
        minutesAgo: 22,
      },
      {
        from: "contato",
        authorLabel: "Camila Rezende",
        body: "Somos 3 sócios e hoje retiramos valores diferentes todo mês.",
        minutesAgo: 20,
      },
    ],
  },
  {
    id: "cnv_012",
    contactId: "cnt_012",
    channel: "whatsapp",
    channelAccountId: "chan_wa_comercial",
    queueId: "queue_comercial",
    assigneeId: "usr_bruno",
    state: "resolvida",
    subject: "Contrato de folha para 40 motoristas",
    priority: "alta",
    tagIds: ["tag_indicacao"],
    unreadCount: 0,
    openedMinutesAgo: 5760,
    firstRespondedMinutesAgo: 5750,
    satisfactionScore: 5,
    messages: [
      {
        from: "contato",
        authorLabel: "Eduardo Barreto",
        body: "Bruno, fechamos. Pode enviar o contrato para assinatura.",
        minutesAgo: 5760,
      },
      {
        from: "agente",
        authorId: "usr_bruno",
        authorLabel: "Bruno Tavares",
        body: "Excelente notícia, Eduardo! Contrato enviado para o e-mail da Simone.",
        minutesAgo: 5750,
        status: "lida",
      },
    ],
  },
  {
    id: "cnv_013",
    contactId: "cnt_009",
    channel: "email",
    channelAccountId: "chan_email_atendimento",
    queueId: "queue_fiscal",
    assigneeId: "usr_rafael",
    state: "em_atendimento",
    subject: "Falha no envio do informe de rendimentos",
    priority: "normal",
    tagIds: ["tag_lucro_presumido"],
    unreadCount: 0,
    openedMinutesAgo: 210,
    firstRespondedMinutesAgo: 200,
    messages: [
      {
        from: "contato",
        authorLabel: "Beatriz Nogueira",
        body: "O informe não chegou no e-mail dos colaboradores. Podem reenviar?",
        minutesAgo: 210,
      },
      {
        from: "agente",
        authorId: "usr_rafael",
        authorLabel: "Rafael Coelho",
        body: "Beatriz, verifiquei: 3 envios retornaram como bounce. Vou corrigir os endereços e reenviar.",
        minutesAgo: 200,
        status: "entregue",
      },
      {
        from: "agente",
        authorId: "usr_rafael",
        authorLabel: "Rafael Coelho",
        body: "Reenvio concluído para os 3 endereços corrigidos.",
        minutesAgo: 150,
        status: "falhou",
        failureCode: "550-5.1.1",
        failureReason: "Caixa postal do destinatário inexistente",
      },
    ],
  },
  {
    id: "cnv_014",
    contactId: "cnt_015",
    channel: "whatsapp",
    channelAccountId: "chan_wa_atendimento",
    queueId: "queue_matriculas",
    state: "nova",
    subject: "Certificado do curso não emitido",
    priority: "normal",
    tagIds: ["tag_aluno", "tag_vip"],
    unreadCount: 1,
    openedMinutesAgo: 7,
    messages: [
      {
        from: "contato",
        authorLabel: "Renata Aguiar",
        body: "Terminei o curso na semana passada e o certificado ainda não foi liberado.",
        minutesAgo: 7,
      },
    ],
  },
  {
    id: "cnv_015",
    contactId: "cnt_002",
    channel: "whatsapp",
    channelAccountId: "chan_wa_atendimento",
    queueId: "queue_fiscal",
    assigneeId: "usr_rafael",
    state: "encerrada",
    subject: "Emissão de nota para cliente do exterior",
    priority: "normal",
    tagIds: ["tag_lucro_presumido"],
    unreadCount: 0,
    openedMinutesAgo: 10080,
    firstRespondedMinutesAgo: 10070,
    satisfactionScore: 4,
    messages: [
      {
        from: "contato",
        authorLabel: "Gustavo Almeida",
        body: "Preciso emitir nota para um cliente em Portugal. Tem tratamento diferente?",
        minutesAgo: 10080,
      },
      {
        from: "agente",
        authorId: "usr_rafael",
        authorLabel: "Rafael Coelho",
        body: "Tem sim, Gustavo. Exportação de serviço tem isenção de ISS. Te enviei o guia completo.",
        minutesAgo: 10070,
        status: "lida",
      },
    ],
  },
  {
    id: "cnv_016",
    contactId: "cnt_011",
    channel: "whatsapp",
    channelAccountId: "chan_wa_atendimento",
    queueId: "queue_fiscal",
    state: "nova",
    subject: "Boleto do mês não recebido",
    priority: "normal",
    tagIds: ["tag_simples"],
    unreadCount: 1,
    openedMinutesAgo: 26,
    messages: [
      {
        from: "contato",
        authorLabel: "Tatiane Moura",
        body: "Não recebemos o boleto dos honorários deste mês. Podem reenviar?",
        minutesAgo: 26,
      },
    ],
  },
];

const queueById = new Map(queues.map((queue) => [queue.id, queue]));

/**
 * Prévia da conversa na lista.
 *
 * Mensagem de mídia costuma vir sem texto. Cair para string vazia deixaria a
 * linha da lista com um buraco justamente na conversa mais recente — então a
 * prévia descreve o anexo, como fazem os aplicativos de mensagem.
 */
const ATTACHMENT_PREVIEW = {
  imagem: "Imagem",
  documento: "Documento",
  audio: "Mensagem de voz",
  video: "Vídeo",
} as const;

function previewOf(message: MessageSeed | undefined): string {
  if (!message) return "";
  if (message.body.trim()) return message.body;

  const attachment = message.attachments?.[0];
  if (!attachment) return "";

  const label = ATTACHMENT_PREVIEW[attachment.kind];
  return attachment.kind === "documento" ? `${label}: ${attachment.fileName}` : label;
}

export const conversations: Conversation[] = CONVERSATION_SEEDS.map((seed) => {
  const queue = queueById.get(seed.queueId);
  const firstResponseSla = queue?.firstResponseSlaMinutes ?? 30;
  const resolutionSla = queue?.resolutionSlaMinutes ?? 480;
  const lastMessage = seed.messages[seed.messages.length - 1];

  const base: Conversation = {
    id: seed.id,
    organizationId: ORG_ID,
    contactId: seed.contactId,
    channel: seed.channel,
    channelAccountId: seed.channelAccountId,
    queueId: seed.queueId,
    assigneeId: seed.assigneeId,
    observerIds: seed.observerIds ?? [],
    state: seed.state,
    subject: seed.subject,
    priority: seed.priority,
    unreadCount: seed.unreadCount,
    lastMessagePreview: previewOf(lastMessage),
    lastMessageAt: offsetIso({ minutes: -(lastMessage?.minutesAgo ?? seed.openedMinutesAgo) }),
    firstResponseDueAt: offsetIso({ minutes: -seed.openedMinutesAgo + firstResponseSla }),
    firstRespondedAt:
      seed.firstRespondedMinutesAgo === undefined
        ? undefined
        : offsetIso({ minutes: -seed.firstRespondedMinutesAgo }),
    resolutionDueAt: offsetIso({ minutes: -seed.openedMinutesAgo + resolutionSla }),
    slaStatus: "dentro",
    tagIds: seed.tagIds,
    handoffSummary: seed.handoffSummary,
    botSessionId: seed.botSessionId,
    satisfactionScore: seed.satisfactionScore,
    createdAt: offsetIso({ minutes: -seed.openedMinutesAgo }),
    updatedAt: offsetIso({ minutes: -(lastMessage?.minutesAgo ?? seed.openedMinutesAgo) }),
  };

  return { ...base, slaStatus: resolveSlaStatus(base) };
});

export const messages: Message[] = CONVERSATION_SEEDS.flatMap((seed) =>
  seed.messages.map((message, index) => ({
    id: `${seed.id}_msg_${String(index + 1).padStart(2, "0")}`,
    organizationId: ORG_ID,
    conversationId: seed.id,
    direction: message.from === "contato" ? ("entrada" as const) : ("saida" as const),
    authorKind: message.from,
    authorId: message.authorId,
    authorLabel: message.authorLabel,
    channel: seed.channel,
    body: message.body,
    attachments: message.attachments,
    quote: message.quote,
    templateName: message.templateName,
    deliveryStatus: message.from === "contato" ? undefined : (message.status ?? "entregue"),
    failureCode: message.failureCode,
    failureReason: message.failureReason,
    occurredAt: offsetIso({ minutes: -message.minutesAgo }),
  })),
);

export const internalNotes: InternalNote[] = CONVERSATION_SEEDS.flatMap((seed) =>
  (seed.notes ?? []).map((note, index) => ({
    id: `${seed.id}_note_${index + 1}`,
    conversationId: seed.id,
    authorId: note.authorId,
    authorLabel: note.authorLabel,
    body: note.body,
    mentionedUserIds: note.mentions ?? [],
    occurredAt: offsetIso({ minutes: -note.minutesAgo }),
  })),
);

export const cannedResponses: CannedResponse[] = [
  {
    id: "canned_saudacao",
    organizationId: ORG_ID,
    shortcut: "/ola",
    title: "Saudação inicial",
    body: "Olá, {{contato.primeiro_nome}}! Aqui é {{agente.nome}} da Contábil Aurora. Como posso ajudar?",
    channels: ["whatsapp", "webchat", "instagram"],
  },
  {
    id: "canned_prazo",
    organizationId: ORG_ID,
    shortcut: "/prazo",
    title: "Prazo de retorno",
    body: "Já estou verificando com o time responsável e retorno com a resposta ainda hoje, até as 18h.",
    channels: ["whatsapp", "email", "webchat"],
  },
  {
    id: "canned_documentos",
    organizationId: ORG_ID,
    shortcut: "/docs",
    title: "Solicitação de documentos",
    body: "Para dar andamento, preciso dos seguintes documentos: contrato social atualizado, cartão CNPJ e último balancete.",
    channels: ["whatsapp", "email"],
  },
  {
    id: "canned_boleto",
    organizationId: ORG_ID,
    shortcut: "/boleto",
    title: "Reenvio de boleto",
    body: "Acabei de reenviar o boleto para {{contato.email}}. Se não chegar em 10 minutos, verifique a caixa de spam.",
    channels: ["whatsapp", "email"],
  },
  {
    id: "canned_encerramento",
    organizationId: ORG_ID,
    shortcut: "/fim",
    title: "Encerramento",
    body: "Posso ajudar em mais alguma coisa? Se estiver tudo certo, vou encerrar este atendimento.",
    channels: ["whatsapp", "webchat", "instagram", "email"],
  },
];
