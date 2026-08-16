/**
 * Base de demonstração — widgets de webchat.
 *
 * Dois widgets porque a diferença entre eles é o que ensina o módulo: o do site
 * institucional captura lead e por isso pede telefone antes de conversar; o da
 * área do aluno atende quem já é cliente e portanto não pede nada — atrito ali é
 * puro custo, o visitante já está identificado pela sessão.
 */

import type { PrechatField, WebchatWidget, WidgetSchedule } from "../types/webchat";
import { offsetIso } from "../utils/datetime";
import { ORG_ID } from "./organization";

/** Segunda a sexta comercial, sábado meio período, domingo fechado. */
const COMMERCIAL_HOURS: WidgetSchedule[] = [
  { weekday: 0, from: null, to: null },
  { weekday: 1, from: "09:00", to: "18:00" },
  { weekday: 2, from: "09:00", to: "18:00" },
  { weekday: 3, from: "09:00", to: "18:00" },
  { weekday: 4, from: "09:00", to: "18:00" },
  { weekday: 5, from: "09:00", to: "18:00" },
  { weekday: 6, from: "09:00", to: "13:00" },
];

const STUDENT_HOURS: WidgetSchedule[] = [
  { weekday: 0, from: null, to: null },
  { weekday: 1, from: "08:00", to: "20:00" },
  { weekday: 2, from: "08:00", to: "20:00" },
  { weekday: 3, from: "08:00", to: "20:00" },
  { weekday: 4, from: "08:00", to: "20:00" },
  { weekday: 5, from: "08:00", to: "20:00" },
  { weekday: 6, from: null, to: null },
];

const SITE_PRECHAT: PrechatField[] = [
  {
    id: "pf_nome",
    kind: "texto",
    label: "Seu nome",
    placeholder: "Como podemos te chamar?",
    required: true,
    mapsTo: "contato.nome",
  },
  {
    id: "pf_telefone",
    kind: "telefone",
    label: "WhatsApp",
    placeholder: "(11) 90000-0000",
    required: true,
    mapsTo: "contato.telefone",
  },
  {
    id: "pf_assunto",
    kind: "selecao",
    label: "Sobre o que você quer falar?",
    required: true,
    options: [
      "Abrir empresa",
      "Trocar de contador",
      "Dúvida sobre imposto",
      "Cursos",
      "Outro assunto",
    ],
    mapsTo: "campo.origem_detalhada",
  },
];

export const webchatWidgets: WebchatWidget[] = [
  {
    id: "wgt_site",
    organizationId: ORG_ID,
    name: "Site institucional",
    description:
      "Widget da home e das páginas de serviço. Captura lead com nome, WhatsApp e assunto antes de abrir a conversa.",
    channelAccountId: "chan_wgt_site",
    embedKey: "wck_live_7f3a91c4e8",
    allowedDomains: ["contabilaurora.com.br", "www.contabilaurora.com.br"],
    ownerId: "usr_bruno",
    activeVersionId: "wgtv_site_3",
    draftVersionId: "wgtv_site_4",
    stats: {
      opens30d: 1842,
      conversations30d: 396,
      conversionPct: 21.5,
      leads30d: 271,
      medianFirstReplySeconds: 74,
      csat: 4.6,
    },
    createdAt: offsetIso({ days: -210 }),
    updatedAt: offsetIso({ days: -4 }),
    versions: [
      {
        id: "wgtv_site_3",
        widgetId: "wgt_site",
        version: 3,
        status: "publicado",
        publishedAt: offsetIso({ days: -32 }),
        publishedBy: "usr_bruno",
        changeNote: "Assunto virou seleção com cinco opções em vez de texto livre.",
        appearance: {
          brandColor: "#102850",
          position: "direita",
          launcher: "bolha_rotulo",
          launcherLabel: "Falar com a gente",
          corner: "arredondado",
          headerTitle: "Contábil Aurora",
          headerSubtitle: "Respondemos em poucos minutos",
          avatarInitials: "CF",
          icon: "balao",
          showBranding: true,
        },
        messages: {
          greeting:
            "Oi! Aqui é o time da Contábil Aurora. Conta o que você precisa que a gente já começa a resolver.",
          greetingDelaySeconds: 4,
          prechatIntro: "Para direcionar você à pessoa certa, precisamos de três informações.",
          awayInside: "Recebemos sua mensagem. Um consultor entra na conversa em instantes.",
          awayOutside:
            "Nosso atendimento é de segunda a sexta, das 9h às 18h. Deixe sua mensagem que respondemos no próximo dia útil.",
          queueBusy:
            "A fila está mais cheia que o normal agora. Se preferir, deixe o recado que retornamos ainda hoje.",
          placeholder: "Escreva sua mensagem",
        },
        behavior: {
          prechatEnabled: true,
          prechatFields: SITE_PRECHAT,
          queueId: "queue_comercial",
          responder: "agente",
          agentId: "agt_recepcao",
          botFlowId: "bot_webchat_site",
          schedule: COMMERCIAL_HOURS,
          outsideHours: "recado",
          survey: {
            enabled: true,
            question: "Como foi o atendimento?",
            thanks: "Obrigado! A sua resposta ajuda a gente a melhorar.",
            askComment: true,
            commentBelowScore: 4,
          },
          idleTimeoutMinutes: 20,
          offerTranscript: true,
        },
        privacy: {
          consentText:
            "Ao continuar, você concorda que a Contábil Aurora use seus dados para responder este atendimento.",
          consentRequired: true,
          privacyUrl: "https://contabilaurora.com.br/privacidade",
          transcriptRetentionDays: 180,
        },
      },
      {
        id: "wgtv_site_4",
        widgetId: "wgt_site",
        version: 4,
        status: "rascunho",
        changeNote: "Teste de lançador em barra e saudação mais curta.",
        appearance: {
          brandColor: "#FF9933",
          position: "direita",
          launcher: "barra",
          launcherLabel: "Tire sua dúvida contábil agora",
          corner: "suave",
          headerTitle: "Contábil Aurora",
          headerSubtitle: "Respondemos em poucos minutos",
          avatarInitials: "CF",
          icon: "balao",
          showBranding: true,
        },
        messages: {
          greeting: "Oi! Como podemos ajudar?",
          greetingDelaySeconds: 2,
          prechatIntro: "Para direcionar você à pessoa certa, precisamos de três informações.",
          awayInside: "Recebemos sua mensagem. Um consultor entra na conversa em instantes.",
          awayOutside:
            "Nosso atendimento é de segunda a sexta, das 9h às 18h. Deixe sua mensagem que respondemos no próximo dia útil.",
          queueBusy:
            "A fila está mais cheia que o normal agora. Se preferir, deixe o recado que retornamos ainda hoje.",
          placeholder: "Escreva sua mensagem",
        },
        behavior: {
          prechatEnabled: true,
          prechatFields: SITE_PRECHAT,
          queueId: "queue_comercial",
          responder: "fluxo",
          agentId: "agt_recepcao",
          botFlowId: "bot_webchat_site",
          schedule: COMMERCIAL_HOURS,
          outsideHours: "recado",
          survey: {
            enabled: true,
            question: "Como foi o atendimento?",
            thanks: "Obrigado! A sua resposta ajuda a gente a melhorar.",
            askComment: true,
            commentBelowScore: 4,
          },
          idleTimeoutMinutes: 20,
          offerTranscript: true,
        },
        privacy: {
          consentText:
            "Ao continuar, você concorda que a Contábil Aurora use seus dados para responder este atendimento.",
          consentRequired: true,
          privacyUrl: "https://contabilaurora.com.br/privacidade",
          transcriptRetentionDays: 180,
        },
      },
    ],
  },
  {
    id: "wgt_aluno",
    organizationId: ORG_ID,
    name: "Área do aluno",
    description:
      "Widget dentro da plataforma de cursos. Sem formulário: quem está logado já está identificado.",
    channelAccountId: "chan_wgt_site",
    embedKey: "wck_live_2b8d40af11",
    allowedDomains: ["alunos.contabilaurora.com.br"],
    ownerId: "usr_diego",
    activeVersionId: "wgtv_aluno_1",
    draftVersionId: "wgtv_aluno_1",
    stats: {
      opens30d: 623,
      conversations30d: 288,
      conversionPct: 46.2,
      leads30d: 0,
      medianFirstReplySeconds: 41,
      csat: 4.8,
    },
    createdAt: offsetIso({ days: -95 }),
    updatedAt: offsetIso({ days: -18 }),
    versions: [
      {
        id: "wgtv_aluno_1",
        widgetId: "wgt_aluno",
        version: 1,
        status: "publicado",
        publishedAt: offsetIso({ days: -95 }),
        publishedBy: "usr_diego",
        changeNote: "Primeira publicação.",
        appearance: {
          brandColor: "#1E7A5F",
          position: "direita",
          launcher: "bolha",
          launcherLabel: "Ajuda",
          corner: "arredondado",
          headerTitle: "Suporte ao aluno",
          headerSubtitle: "Segunda a sexta, 8h às 20h",
          avatarInitials: "SA",
          icon: "suporte",
          showBranding: false,
        },
        messages: {
          greeting:
            "Oi! Travou em alguma aula ou não conseguiu emitir o certificado? Conta aqui que a gente resolve.",
          greetingDelaySeconds: 0,
          prechatIntro: "",
          awayInside: "Recebemos. Já estamos verificando na plataforma.",
          awayOutside:
            "O suporte responde de segunda a sexta, das 8h às 20h. Deixe sua mensagem que respondemos no próximo dia útil.",
          queueBusy: "Há algumas pessoas na frente. Sua mensagem já está na fila.",
          placeholder: "Descreva o problema",
        },
        behavior: {
          prechatEnabled: false,
          prechatFields: [],
          queueId: "queue_matriculas",
          responder: "ninguem",
          schedule: STUDENT_HOURS,
          outsideHours: "recado",
          survey: {
            enabled: true,
            question: "Como foi o atendimento?",
            thanks: "Obrigado! A sua resposta ajuda a gente a melhorar.",
            askComment: true,
            commentBelowScore: 4,
          },
          idleTimeoutMinutes: 30,
          offerTranscript: false,
        },
        privacy: {
          consentText: "",
          // O aluno já aceitou o tratamento na matrícula; pedir de novo a cada
          // conversa transformaria consentimento em ruído.
          consentRequired: false,
          privacyUrl: "https://contabilaurora.com.br/privacidade",
          transcriptRetentionDays: 365,
        },
      },
    ],
  },
];
