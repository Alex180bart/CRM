/**
 * A vertical base — a contabilidade que o protótipo sempre teve.
 *
 * Não há conteúdo novo aqui: este arquivo só empacota o que `mock/` já exportava
 * no formato `DemoDataset`. É o que permite às outras verticais serem overlays
 * parciais, herdando desta o que não reescrevem.
 */

import type { DemoDataset, DemoVerticalMeta } from "./types";
import { organization, teams, users, queues, channelAccounts, tags } from "../mock/organization";
import { cannedResponses, conversations, internalNotes, messages } from "../mock/inbox";
import { closingReasons, customFields, skills } from "../mock/catalog";
import { companies, contacts } from "../mock/contacts";
import { deals, pipelines, tasks } from "../mock/pipeline";
import { campaigns, messageTemplates, segments } from "../mock/campaigns";
import { timeline } from "../mock/timeline";
import { products } from "../mock/commerce";
import { buildDemoProposals } from "./comercio";

export const CONTABILIDADE_META: DemoVerticalMeta = {
  id: "contabilidade",
  name: "Contabilidade",
  company: "Contabilidade Facilitada",
  tagline: "Escritório contábil com escola de negócios",
  description:
    "Rotina de escritório contábil: apuração, obrigações acessórias, regularização documental e " +
    "matrícula em cursos. É a base onde a exigência de prazo é mais dura — SLA fiscal conta em " +
    "minutos e o vencimento não negocia.",
  hue: 218,
  highlights: [
    "Filas por competência: só quem declarou fiscal recebe conversa de apuração.",
    "Dois funis simultâneos — venda de honorários e matrícula em curso.",
    "Régua de obrigações com janela silenciosa e limite de frequência.",
  ],
  channels: ["whatsapp", "email", "instagram", "webchat"],
  stats: [
    { label: "Conversas / mês", value: "8,4 mil" },
    { label: "Primeira resposta", value: "3 min" },
    { label: "Resolução por IA", value: "38%" },
  ],
};

export const baseDataset: DemoDataset = {
  meta: CONTABILIDADE_META,
  organization,
  teams,
  users,
  queues,
  channelAccounts,
  tags,
  skills,
  closingReasons,
  customFields,
  cannedResponses,
  companies,
  contacts,
  timeline,
  conversations,
  messages,
  internalNotes,
  pipelines,
  deals,
  tasks,
  segments,
  campaigns,
  messageTemplates,
  products,
  proposals: buildDemoProposals({
    orgId: organization.id,
    products,
    conversations,
    contacts,
    users,
  }),
};
