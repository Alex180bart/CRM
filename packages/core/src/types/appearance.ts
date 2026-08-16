/**
 * Aparência: paleta da organização e preferência da pessoa.
 *
 * ## Duas perguntas diferentes, dois donos diferentes
 *
 * "Qual é a cor desta instalação?" é decisão **da organização**: numa plataforma
 * multiempresa a paleta é identidade, e deixá-la por pessoa produziria uma
 * captura de tela por atendente na hora de reportar um problema.
 *
 * "Claro ou escuro? Denso ou espaçado?" é decisão **da pessoa**: depende do
 * monitor, da luz da sala e da vista de quem olha oito horas por dia. Um
 * administrador não tem como acertar isso para os outros.
 *
 * Por isso `OrganizationAppearance` guarda as duas coisas em campos distintos —
 * a paleta, que vale para todos, e os **padrões** de modo e densidade, que valem
 * só para quem ainda não escolheu. `allowPersonalOverride` é a chave que decide
 * se a escolha individual é permitida; desligada, o padrão da organização vira
 * imposição, o que é legítimo em quiosque e loja, e ruim em escritório.
 *
 * ## Por que as cores aparecem em hexadecimal aqui
 *
 * A regra do repositório é que componente não escreve hexadecimal — a cor sai de
 * token. Esta é a terceira exceção documentada, ao lado das marcas de terceiros
 * em `brand-icons.tsx`, e pelo mesmo motivo: o seletor precisa mostrar a amostra
 * de **todas** as paletas, inclusive as que não estão ativas, e os tokens CSS só
 * conhecem a que está. Um seletor pintado com `bg-primary` mostraria quatro
 * quadrados idênticos.
 *
 * O antídoto é o mesmo de lá: um dono único. Estes valores existem aqui e em
 * `tokens.css`, e em nenhum outro lugar. Ao mudar um, mude o outro — o catálogo
 * é a vitrine, `tokens.css` é o que pinta de verdade.
 */

/** Chave da paleta. Espelha os blocos `[data-palette]` de `tokens.css`. */
export type PaletteKey = "indigo" | "petroleo" | "grafite" | "arena";

/** `sistema` acompanha a preferência declarada no sistema operacional. */
export type AppearanceMode = "claro" | "escuro" | "sistema";

/** Densidade escala a raiz tipográfica, e com ela todo espaçamento em `rem`. */
export type DensityKey = "compacto" | "padrao" | "amplo";

export interface OrganizationAppearance {
  /** Vale para todo mundo da organização. */
  palette: PaletteKey;
  /** Modo de quem ainda não escolheu. */
  defaultMode: AppearanceMode;
  /** Densidade de quem ainda não escolheu. */
  defaultDensity: DensityKey;
  /** Desligado, o padrão acima deixa de ser padrão e passa a ser regra. */
  allowPersonalOverride: boolean;
}

export interface PaletteDefinition {
  key: PaletteKey;
  label: string;
  description: string;
  /** Amostra: fundo profundo, tom intermediário e acento. */
  swatch: [string, string, string];
  /**
   * Razão de contraste do acento contra branco, medida — não estimada.
   *
   * Nenhuma delas alcança 3:1, e isso é esperado: acento preenche peça, e quem
   * desenha traço fino é `--focus-ring`, que tem valor próprio em cada paleta
   * justamente por isso. O número está aqui para que a escolha seja informada,
   * não para reprovar paleta.
   */
  accentContrast: number;
}

export const PALETTE_CATALOG: PaletteDefinition[] = [
  {
    key: "indigo",
    label: "Índigo",
    description: "A paleta da Elora: índigo profundo com âmbar. Séria sem ser fria.",
    swatch: ["#1E1B4B", "#312E81", "#DC8F09"],
    accentContrast: 2.63,
  },
  {
    key: "petroleo",
    label: "Petróleo",
    description: "Verde-azulado escuro com coral quente. A mais distintiva do mercado.",
    swatch: ["#134E4A", "#136B65", "#F97362"],
    accentContrast: 2.74,
  },
  {
    key: "grafite",
    label: "Grafite",
    description:
      "Neutro premium: base quase preta e violeta saturado. O acento também serve a texto.",
    swatch: ["#18181B", "#33333A", "#7C3AED"],
    accentContrast: 5.71,
  },
  {
    key: "arena",
    label: "Arena clássica",
    description: "O azul e a laranja originais do produto, preservados.",
    swatch: ["#102850", "#212D51", "#FF9933"],
    accentContrast: 2.13,
  },
];

export const MODE_LABEL: Record<AppearanceMode, string> = {
  claro: "Claro",
  escuro: "Escuro",
  sistema: "Seguir o sistema",
};

export const DENSITY_LABEL: Record<DensityKey, string> = {
  compacto: "Compacto",
  padrao: "Padrão",
  amplo: "Amplo",
};

/** Quanto cada densidade vale na raiz, para a tela poder explicar o efeito. */
export const DENSITY_ROOT_PX: Record<DensityKey, number> = {
  compacto: 15,
  padrao: 16,
  amplo: 17,
};

export const DEFAULT_APPEARANCE: OrganizationAppearance = {
  palette: "indigo",
  defaultMode: "sistema",
  defaultDensity: "padrao",
  allowPersonalOverride: true,
};

export function isPaletteKey(value: unknown): value is PaletteKey {
  return PALETTE_CATALOG.some((item) => item.key === value);
}

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === "claro" || value === "escuro" || value === "sistema";
}

export function isDensityKey(value: unknown): value is DensityKey {
  return value === "compacto" || value === "padrao" || value === "amplo";
}
