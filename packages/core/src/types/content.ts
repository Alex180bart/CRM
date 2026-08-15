/**
 * Conteúdo editável do site público.
 *
 * ## Por que existe
 *
 * Até aqui, cada frase da landing page era um literal dentro do JSX. Trocar o
 * título do herói exigia editar `page.tsx`, e acrescentar um módulo exigia
 * escrever um objeto num arranjo — o que na prática significa que só quem
 * programa escreve o texto de marketing. Este modelo separa **o que a página
 * diz** de **como a página é desenhada**: o layout continua em JSX, o conteúdo
 * vira dado.
 *
 * ## O que NÃO entra aqui, e por quê
 *
 * **Número de preço.** Franquia, excedente, tarifa da Meta e valor de assento
 * continuam vindo de `pricing/catalog.ts`, que é a fonte da verdade e alimenta o
 * simulador. Duplicá-los aqui criaria a divergência clássica: alguém reajusta a
 * tabela, esquece do texto, e o site passa a anunciar um preço que a proposta
 * não confirma. Onde o texto precisa citar um número, ele usa **marcador**
 * (`{precoUtilidade}`), resolvido na renderização contra o catálogo.
 *
 * **Ícone como componente.** O que se guarda é o **nome** (`"Inbox"`), validado
 * contra `CONTENT_ICONS`. Guardar o componente exigiria serializar função, e
 * guardar nome livre deixaria a página quebrar por erro de digitação de quem
 * edita — um ícone inexistente derruba a renderização inteira da seção.
 *
 * ## Ênfase é Markdown mínimo, não HTML
 *
 * Campos marcados como `Markdown` aceitam `**negrito**`, `*itálico*` e
 * `[texto](/link)`, e nada mais. O renderizador monta elementos React a partir
 * do texto — não existe `dangerouslySetInnerHTML` em lugar nenhum deste caminho.
 * A distinção é de segurança, não de estilo: o painel que escreve esse texto é
 * autenticado, mas a página que o exibe é pública, e um `<script>` colado por
 * engano num campo de texto não deveria ter como virar script.
 */

/**
 * Ícones que o editor oferece.
 *
 * Lista fechada, e é o ponto principal deste arquivo. O mapa nome → componente
 * vive na aplicação (`lib/site/icons.tsx`), porque o pacote `core` não conhece
 * React nem `lucide-react`; o que viaja no dado é sempre esta string.
 *
 * Ao acrescentar um nome aqui, acrescente o par no mapa da aplicação — o teste
 * de cobertura do mapa reprova a ausência, justamente para que o esquecimento
 * apareça no `pnpm test` e não como quadrado vazio no meio da página.
 */
export const CONTENT_ICONS = [
  "ArrowRight",
  "BarChart3",
  "Bot",
  "Building2",
  "Calculator",
  "CalendarClock",
  "Check",
  "Clock",
  "Fingerprint",
  "GitBranch",
  "Globe",
  "Inbox",
  "Layers",
  "LifeBuoy",
  "Lock",
  "Mail",
  "MessagesSquare",
  "PlugZap",
  "Receipt",
  "Route",
  "Rocket",
  "ScrollText",
  "Search",
  "ShieldCheck",
  "Sparkles",
  "Star",
  "Target",
  "Timer",
  "TrendingUp",
  "Users",
  "Workflow",
  "Zap",
] as const;

export type ContentIcon = (typeof CONTENT_ICONS)[number];

export function isContentIcon(value: unknown): value is ContentIcon {
  return typeof value === "string" && (CONTENT_ICONS as readonly string[]).includes(value);
}

/* Peças reaproveitadas -------------------------------------------------------------- */

/**
 * Identificador de item de lista.
 *
 * Não é chave de negócio: é o que permite reordenar e remover sem que o React
 * remonte a lista inteira a cada tecla digitada. Usar o índice como chave, num
 * editor onde a pessoa reordena, faz o foco pular de campo no meio da digitação.
 */
export interface ContentItem {
  id: string;
}

export interface ContentLink extends ContentItem {
  label: string;
  href: string;
}

export interface IconCard extends ContentItem {
  icon: ContentIcon;
  title: string;
  /** Markdown mínimo. */
  body: string;
}

export interface StepCard extends IconCard {
  /** Linha de prazo no rodapé do cartão — "1 a 3 dias". */
  detail: string;
}

export interface HeroStat extends ContentItem {
  value: number;
  /** Sufixo colado no número: " h", "%", "x". Vazio na maioria. */
  suffix: string;
  label: string;
}

export interface TraceStep extends ContentItem {
  title: string;
  detail: string;
  /** Passo pendente sai em âmbar — é o que ilustra "a escrita espera gente". */
  pending: boolean;
}

/** Cabeçalho de seção: sobrelinha, título e chamada opcional. */
export interface SectionHeading {
  eyebrow: string;
  title: string;
  /** Markdown mínimo. Vazio esconde o parágrafo. */
  body: string;
}

export interface PageMeta {
  title: string;
  description: string;
}

/* Cabeçalho e rodapé ---------------------------------------------------------------- */

export interface HeaderContent {
  links: ContentLink[];
  signInLabel: string;
  accountLabel: string;
  cta: ContentLink;
}

export interface FooterColumn extends ContentItem {
  title: string;
  links: ContentLink[];
}

export interface FooterContent {
  /** Markdown mínimo. Parágrafo ao lado do logotipo. */
  tagline: string;
  columns: FooterColumn[];
  /**
   * O bloco de estado da plataforma.
   *
   * Não é decoração e não deveria ser apagado sem pensar: a página promete
   * bastante, e dizer o que ainda não funciona no lugar onde a pessoa termina de
   * ler é mais barato que explicar na primeira reunião.
   */
  statusTitle: string;
  statusBody: string;
  legal: string;
}

/* Landing page ---------------------------------------------------------------------- */

export interface HeroContent {
  eyebrow: string;
  /** O título quebra em duas partes: a segunda sai em âmbar. */
  titleLead: string;
  /**
   * Palavras que se alternam entre as duas partes do título.
   *
   * **Lista vazia devolve o título de duas partes, sem rolagem** — e é por isso
   * que ela é uma lista e não um par de campos: quem não quer o efeito apaga os
   * itens e a peça volta ao que era, sem sobrar pontuação órfã no meio da frase.
   *
   * Com itens, o título vira "lead + palavra que rola." e a parte em âmbar
   * **flui logo depois**, na mesma linha enquanto couber. O ponto final é
   * desenho e mora no JSX — é a mesma divisão do resto desta página: o texto sai
   * daqui, a composição fica lá.
   *
   * A caixa da palavra acompanha a que está ativa, e o texto seguinte desliza a
   * cada troca. Itens de tamanhos muito diferentes transformam o deslize em
   * solavanco: nomes de canal cabem, frases não.
   */
  titleRoll: string[];
  titleAccent: string;
  subtitle: string;
  primary: ContentLink;
  secondary: ContentLink;
  /** Link discreto abaixo dos botões. Rótulo vazio esconde. */
  tertiary: ContentLink;
  /**
   * Os números do herói.
   *
   * Descrevem o **produto** — canais, módulos, edições —, e não resultado de
   * operação. Antes traziam "61% resolvido pela IA" e "40 s de primeira
   * resposta": métrica de resultado apresentada como fato, sem um único cliente
   * em produção para sustentá-la. Número de resultado inventado é a peça mais
   * cara de uma landing page, porque sobrevive à venda e reaparece na revisão de
   * contrato.
   */
  stats: HeroStat[];
}

export interface AiSectionContent {
  badge: string;
  title: string;
  body: string;
  bullets: string[];
  traceTitle: string;
  trace: TraceStep[];
  traceFootnote: string;
}

export interface PlansSectionContent extends SectionHeading {
  notes: IconCard[];
  /**
   * Markdown mínimo. Aceita `{descontoAnual}` — o acréscimo de quem não assume
   * compromisso anual, lido do catálogo.
   */
  footnote: string;
}

export interface CtaSectionContent {
  icon: ContentIcon;
  title: string;
  body: string;
  primary: ContentLink;
  secondary: ContentLink;
}

export interface LandingContent {
  meta: PageMeta;
  hero: HeroContent;
  /** Marquise de segmentos: a chamada e os nomes que deslizam. */
  segmentsLabel: string;
  segments: string[];
  problem: SectionHeading;
  problems: IconCard[];
  showcase: SectionHeading;
  modules: SectionHeading;
  moduleCards: IconCard[];
  plans: PlansSectionContent;
  ai: AiSectionContent;
  steps: SectionHeading;
  stepCards: StepCard[];
  security: SectionHeading;
  securityCards: IconCard[];
  faqTitle: string;
  cta: CtaSectionContent;
}

/* Preços ---------------------------------------------------------------------------- */

/**
 * Textos da página de preços.
 *
 * Só texto. As sete tabelas continuam sendo geradas a partir de `PLANS`,
 * `ADDONS` e `WHATSAPP_PRICES` — é o que mantém a página e o simulador contando
 * a mesma história depois de um reajuste.
 */
export interface PricingContent {
  meta: PageMeta;
  hero: { title: string; subtitle: string };
  overage: { title: string; body: string; footnote: string };
  /** `footnote` aceita `{vigencia}` e `{conferencia}` — datas da tabela da Meta. */
  whatsapp: { title: string; body: string; footnote: string };
  addons: { title: string; body: string };
  included: { title: string };
  close: { title: string; body: string; primary: ContentLink; secondary: ContentLink };
  faq: { title: string; footnote: string };
}

/* FAQ ------------------------------------------------------------------------------- */

export interface FaqItem extends ContentItem {
  question: string;
  /** Markdown mínimo. Linha em branco separa parágrafos. */
  answer: string;
}

/* Documento ------------------------------------------------------------------------- */

/**
 * Versão do formato.
 *
 * Gravada no arquivo. Serve para que uma mudança de forma incompatível possa
 * ser detectada em vez de produzir seção em branco: a normalização preenche o
 * que falta a partir do padrão, e a tela avisa quando o arquivo é de um formato
 * anterior. Suba este número ao remover ou renomear campo — acrescentar campo
 * novo não exige, porque a mescla com o padrão já cobre.
 */
export const SITE_CONTENT_VERSION = 1;

export interface SiteContent {
  version: number;
  /** ISO. Quando o arquivo foi gravado pela última vez. */
  updatedAt: string;
  /** Quem gravou, para a tela dizer. Ausente no conteúdo padrão. */
  updatedBy?: string;
  header: HeaderContent;
  landing: LandingContent;
  pricing: PricingContent;
  faq: FaqItem[];
  footer: FooterContent;
}
