/**
 * Normalização do conteúdo do site.
 *
 * ## O que este arquivo protege
 *
 * O conteúdo vem de um **arquivo JSON em disco**, e um arquivo em disco é
 * editável por qualquer um com acesso ao repositório — inclusive por engano, num
 * `git merge` mal resolvido. Sem normalização, um campo que virou `null` derruba
 * a landing page inteira com "cannot read properties of null", e o sintoma chega
 * como "o site caiu", não como "o JSON está torto".
 *
 * A regra é uma só: **campo ausente ou de tipo errado cai no padrão**, e o
 * restante do documento continua valendo. Um título esquisito é um problema
 * visível e corrigível em trinta segundos; uma página que não renderiza é um
 * incidente.
 *
 * ## Por que não é uma biblioteca de schema
 *
 * Zod ou similar daria a validação de graça e devolveria **erro** — que é o
 * comportamento errado aqui. Não interessa recusar o documento inteiro porque um
 * ícone foi digitado errado; interessa desenhar a página com o ícone padrão. A
 * recusa tem lugar, e é a **escrita** pelo editor: lá a mensagem volta para quem
 * pode consertar. Na leitura, tolerar é o que mantém o site no ar.
 */

import type {
  AiSectionContent,
  ContentLink,
  CtaSectionContent,
  FaqItem,
  FooterColumn,
  FooterContent,
  HeaderContent,
  HeroContent,
  HeroStat,
  IconCard,
  LandingContent,
  PageMeta,
  PlansSectionContent,
  PricingContent,
  SectionHeading,
  SiteContent,
  StepCard,
  TraceStep,
} from "../types/content";
import { SITE_CONTENT_VERSION, isContentIcon } from "../types/content";
import { DEFAULT_SITE_CONTENT } from "./defaults";

/* Primitivas ------------------------------------------------------------------------ */

type Raw = Record<string, unknown>;

function obj(value: unknown): Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Raw) : {};
}

/**
 * Texto, com o padrão como rede.
 *
 * String vazia é aceita e **não** cai no padrão: apagar a chamada de uma seção é
 * uma edição legítima — várias seções têm `body` vazio de fábrica. Cair no
 * padrão aqui produziria o defeito mais irritante de um editor: o campo que
 * volta a se preencher sozinho depois de salvo.
 */
function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function icon(value: unknown, fallback: IconCard["icon"]): IconCard["icon"] {
  return isContentIcon(value) ? value : fallback;
}

/**
 * Normaliza uma lista.
 *
 * Três decisões:
 *
 * 1. **Não é arranjo → padrão.** É o caso do JSON torto.
 * 2. **Arranjo vazio → vazio.** Remover todos os cartões de uma seção é edição
 *    legítima, e a página trata lista vazia escondendo a seção.
 * 3. **Item sem identificador ganha um.** O identificador só serve de chave de
 *    render; inventá-lo é melhor que descartar o item que alguém escreveu.
 */
function list<T>(value: unknown, fallback: T[], item: (raw: Raw, index: number) => T): T[] {
  if (!Array.isArray(value)) return fallback;
  return value.map((entry, index) => item(obj(entry), index));
}

function strings(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((entry): entry is string => typeof entry === "string");
}

function id(raw: Raw, prefix: string, index: number): string {
  const value = raw.id;
  return typeof value === "string" && value.trim().length > 0 ? value : `${prefix}-${index + 1}`;
}

/* Peças ----------------------------------------------------------------------------- */

function link(raw: Raw, fallback: ContentLink, prefix: string, index = 0): ContentLink {
  return {
    id: id(raw, prefix, index),
    label: str(raw.label, fallback.label),
    href: str(raw.href, fallback.href),
  };
}

function iconCard(raw: Raw, fallback: IconCard, index: number): IconCard {
  return {
    id: id(raw, "cartao", index),
    icon: icon(raw.icon, fallback.icon),
    title: str(raw.title, fallback.title),
    body: str(raw.body, fallback.body),
  };
}

function stepCard(raw: Raw, fallback: StepCard, index: number): StepCard {
  return { ...iconCard(raw, fallback, index), detail: str(raw.detail, fallback.detail) };
}

function heading(raw: Raw, fallback: SectionHeading): SectionHeading {
  return {
    eyebrow: str(raw.eyebrow, fallback.eyebrow),
    title: str(raw.title, fallback.title),
    body: str(raw.body, fallback.body),
  };
}

function meta(raw: Raw, fallback: PageMeta): PageMeta {
  return {
    title: str(raw.title, fallback.title),
    description: str(raw.description, fallback.description),
  };
}

/**
 * O molde de item novo.
 *
 * Quando a lista gravada é maior que a padrão, os itens excedentes não têm um
 * par de onde herdar. O molde é o **primeiro** item do padrão, e não um literal
 * escrito aqui: quando a forma do cartão crescer, o preenchimento acompanha
 * sozinho — a mesma disciplina do preenchimento de registro incompleto em
 * `repositories/store.ts`.
 */
function at<T>(items: T[], index: number): T {
  return items[index] ?? items[0];
}

/* Seções ---------------------------------------------------------------------------- */

function header(raw: Raw): HeaderContent {
  const base = DEFAULT_SITE_CONTENT.header;
  return {
    links: list(raw.links, base.links, (entry, index) =>
      link(entry, at(base.links, index), "nav", index),
    ),
    signInLabel: str(raw.signInLabel, base.signInLabel),
    accountLabel: str(raw.accountLabel, base.accountLabel),
    cta: link(obj(raw.cta), base.cta, "header-cta"),
  };
}

function hero(raw: Raw): HeroContent {
  const base = DEFAULT_SITE_CONTENT.landing.hero;
  return {
    eyebrow: str(raw.eyebrow, base.eyebrow),
    titleLead: str(raw.titleLead, base.titleLead),
    titleRoll: strings(raw.titleRoll, base.titleRoll),
    titleAccent: str(raw.titleAccent, base.titleAccent),
    subtitle: str(raw.subtitle, base.subtitle),
    primary: link(obj(raw.primary), base.primary, "hero-primario"),
    secondary: link(obj(raw.secondary), base.secondary, "hero-secundario"),
    tertiary: link(obj(raw.tertiary), base.tertiary, "hero-terciario"),
    stats: list(raw.stats, base.stats, (entry, index): HeroStat => {
      const fallback = at(base.stats, index);
      return {
        id: id(entry, "stat", index),
        value: num(entry.value, fallback.value),
        suffix: str(entry.suffix, fallback.suffix),
        label: str(entry.label, fallback.label),
      };
    }),
  };
}

function ai(raw: Raw): AiSectionContent {
  const base = DEFAULT_SITE_CONTENT.landing.ai;
  return {
    badge: str(raw.badge, base.badge),
    title: str(raw.title, base.title),
    body: str(raw.body, base.body),
    bullets: strings(raw.bullets, base.bullets),
    traceTitle: str(raw.traceTitle, base.traceTitle),
    trace: list(raw.trace, base.trace, (entry, index): TraceStep => {
      const fallback = at(base.trace, index);
      return {
        id: id(entry, "trace", index),
        title: str(entry.title, fallback.title),
        detail: str(entry.detail, fallback.detail),
        pending: bool(entry.pending, fallback.pending),
      };
    }),
    traceFootnote: str(raw.traceFootnote, base.traceFootnote),
  };
}

function plans(raw: Raw): PlansSectionContent {
  const base = DEFAULT_SITE_CONTENT.landing.plans;
  return {
    ...heading(raw, base),
    notes: list(raw.notes, base.notes, (entry, index) =>
      iconCard(entry, at(base.notes, index), index),
    ),
    footnote: str(raw.footnote, base.footnote),
  };
}

function cta(raw: Raw): CtaSectionContent {
  const base = DEFAULT_SITE_CONTENT.landing.cta;
  return {
    icon: icon(raw.icon, base.icon),
    title: str(raw.title, base.title),
    body: str(raw.body, base.body),
    primary: link(obj(raw.primary), base.primary, "cta-primario"),
    secondary: link(obj(raw.secondary), base.secondary, "cta-secundario"),
  };
}

function landing(raw: Raw): LandingContent {
  const base = DEFAULT_SITE_CONTENT.landing;
  return {
    meta: meta(obj(raw.meta), base.meta),
    hero: hero(obj(raw.hero)),
    segmentsLabel: str(raw.segmentsLabel, base.segmentsLabel),
    segments: strings(raw.segments, base.segments),
    problem: heading(obj(raw.problem), base.problem),
    problems: list(raw.problems, base.problems, (entry, index) =>
      iconCard(entry, at(base.problems, index), index),
    ),
    showcase: heading(obj(raw.showcase), base.showcase),
    modules: heading(obj(raw.modules), base.modules),
    moduleCards: list(raw.moduleCards, base.moduleCards, (entry, index) =>
      iconCard(entry, at(base.moduleCards, index), index),
    ),
    plans: plans(obj(raw.plans)),
    ai: ai(obj(raw.ai)),
    steps: heading(obj(raw.steps), base.steps),
    stepCards: list(raw.stepCards, base.stepCards, (entry, index) =>
      stepCard(entry, at(base.stepCards, index), index),
    ),
    security: heading(obj(raw.security), base.security),
    securityCards: list(raw.securityCards, base.securityCards, (entry, index) =>
      iconCard(entry, at(base.securityCards, index), index),
    ),
    faqTitle: str(raw.faqTitle, base.faqTitle),
    cta: cta(obj(raw.cta)),
  };
}

function pricing(raw: Raw): PricingContent {
  const base = DEFAULT_SITE_CONTENT.pricing;
  const heroRaw = obj(raw.hero);
  const overageRaw = obj(raw.overage);
  const whatsappRaw = obj(raw.whatsapp);
  const addonsRaw = obj(raw.addons);
  const closeRaw = obj(raw.close);
  const faqRaw = obj(raw.faq);

  return {
    meta: meta(obj(raw.meta), base.meta),
    hero: {
      title: str(heroRaw.title, base.hero.title),
      subtitle: str(heroRaw.subtitle, base.hero.subtitle),
    },
    overage: {
      title: str(overageRaw.title, base.overage.title),
      body: str(overageRaw.body, base.overage.body),
      footnote: str(overageRaw.footnote, base.overage.footnote),
    },
    whatsapp: {
      title: str(whatsappRaw.title, base.whatsapp.title),
      body: str(whatsappRaw.body, base.whatsapp.body),
      footnote: str(whatsappRaw.footnote, base.whatsapp.footnote),
    },
    addons: {
      title: str(addonsRaw.title, base.addons.title),
      body: str(addonsRaw.body, base.addons.body),
    },
    included: { title: str(obj(raw.included).title, base.included.title) },
    close: {
      title: str(closeRaw.title, base.close.title),
      body: str(closeRaw.body, base.close.body),
      primary: link(obj(closeRaw.primary), base.close.primary, "precos-primario"),
      secondary: link(obj(closeRaw.secondary), base.close.secondary, "precos-secundario"),
    },
    faq: {
      title: str(faqRaw.title, base.faq.title),
      footnote: str(faqRaw.footnote, base.faq.footnote),
    },
  };
}

function faq(raw: unknown): FaqItem[] {
  const base = DEFAULT_SITE_CONTENT.faq;
  return list(raw, base, (entry, index): FaqItem => {
    const fallback = at(base, index);
    return {
      id: id(entry, "faq", index),
      question: str(entry.question, fallback.question),
      answer: str(entry.answer, fallback.answer),
    };
  });
}

function footer(raw: Raw): FooterContent {
  const base = DEFAULT_SITE_CONTENT.footer;
  return {
    tagline: str(raw.tagline, base.tagline),
    columns: list(raw.columns, base.columns, (entry, index): FooterColumn => {
      const fallback = at(base.columns, index);
      return {
        id: id(entry, "coluna", index),
        title: str(entry.title, fallback.title),
        links: list(entry.links, fallback.links, (child, position) =>
          link(child, at(fallback.links, position), "rodape", position),
        ),
      };
    }),
    statusTitle: str(raw.statusTitle, base.statusTitle),
    statusBody: str(raw.statusBody, base.statusBody),
    legal: str(raw.legal, base.legal),
  };
}

/* Entrada --------------------------------------------------------------------------- */

/**
 * Transforma qualquer coisa em conteúdo renderizável.
 *
 * Nunca lança e nunca devolve campo indefinido. É a única porta de entrada do
 * conteúdo vindo de fora — arquivo em disco, corpo de requisição do editor, JSON
 * colado à mão na importação.
 */
export function normalizeSiteContent(raw: unknown): SiteContent {
  const source = obj(raw);

  return {
    version: SITE_CONTENT_VERSION,
    updatedAt: str(source.updatedAt, DEFAULT_SITE_CONTENT.updatedAt),
    updatedBy: typeof source.updatedBy === "string" ? source.updatedBy : undefined,
    header: header(obj(source.header)),
    landing: landing(obj(source.landing)),
    pricing: pricing(obj(source.pricing)),
    faq: faq(source.faq),
    footer: footer(obj(source.footer)),
  };
}

/**
 * Identificador livre dentro de uma lista.
 *
 * Determinístico de propósito: `Math.random()` num editor que também renderiza
 * prévia produziria chave diferente entre servidor e cliente — o mesmo defeito
 * de hidratação que `datetime.ts` evita do lado do tempo.
 */
export function freeContentId(prefix: string, taken: readonly string[]): string {
  const used = new Set(taken);
  let index = taken.length + 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}
