/**
 * Contraste calculado, não estimado.
 *
 * Existe por causa do webchat: o widget vive no site do cliente, com a cor da
 * marca **dele**, e é o único lugar do produto onde alguém digita um
 * hexadecimal. Um laranja claro bonito no seletor produz botão com texto branco
 * ilegível — e o custo cai sobre o visitante, que não pediu nada.
 *
 * A conta é a da WCAG 2.1 (luminância relativa, razão `(L1+0.05)/(L2+0.05)`).
 * Mesma disciplina dos tokens em `tokens.css`: piso declarado e verificado, não
 * ajustado a olho.
 *
 * Função pura, em `@crm/core`, porque a mesma verificação vale para a tela que
 * avisa e para o compilador do widget que decide a cor da tinta.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Aceita `#RGB`, `#RRGGBB` e as duas sem cerquilha. `null` quando não é cor. */
export function parseHex(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, "");

  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return {
      r: parseInt(hex[0]! + hex[0]!, 16),
      g: parseInt(hex[1]! + hex[1]!, 16),
      b: parseInt(hex[2]! + hex[2]!, 16),
    };
  }

  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }

  return null;
}

export function formatHex({ r, g, b }: Rgb): string {
  const part = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

/**
 * Luminância relativa da WCAG.
 *
 * A linearização por canal (o `pow(…, 2.4)`) não é detalhe acadêmico: sem ela um
 * amarelo saturado passaria por escuro, e a razão calculada aprovaria
 * combinações que ninguém consegue ler.
 */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Razão de contraste entre duas cores. 1 é igual; 21 é preto sobre branco. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
/** Não é preto puro: tinta escura de marca fica mais suave e rende quase o mesmo. */
const INK: Rgb = { r: 18, g: 35, b: 61 };

/**
 * Escolhe a tinta legível sobre um fundo.
 *
 * O widget não pergunta ao usuário qual a cor do texto do botão. Perguntar
 * transferiria a ele uma conta que a máquina faz melhor — e a resposta errada
 * aparece no site do cliente, não aqui.
 */
export function readableInk(background: string): { hex: string; ratio: number } {
  const rgb = parseHex(background);
  if (!rgb) return { hex: formatHex(WHITE), ratio: 1 };

  const onWhite = contrastRatio(rgb, WHITE);
  const onInk = contrastRatio(rgb, INK);

  return onWhite >= onInk
    ? { hex: formatHex(WHITE), ratio: onWhite }
    : { hex: formatHex(INK), ratio: onInk };
}

export type ContrastVerdict = "aprovado" | "limite" | "reprovado";

export interface ContrastCheck {
  /** Rótulo contra a cor do lançador. */
  labelRatio: number;
  /** Cor do lançador contra a página branca — é este que costuma reprovar. */
  surfaceRatio: number;
  verdict: ContrastVerdict;
  /** Tinta que será usada de fato, já escolhida pela melhor razão. */
  ink: string;
  message: string;
}

/**
 * Veredito sobre a cor escolhida para o widget.
 *
 * **São duas perguntas diferentes, e a primeira versão deste código fazia só a
 * errada.** Como a tinta do rótulo é escolhida pela máquina entre branco e
 * escuro, a razão do texto nunca cai abaixo de ~4,03:1 — o pior caso possível é
 * a cor exatamente equidistante das duas tintas. Verificar apenas o rótulo
 * produzia, portanto, um teste que aprovava tudo: inclusive um amarelo-claro que
 * o visitante não vê.
 *
 * O que reprova de verdade é a segunda pergunta: **a peça contra a página**. O
 * lançador é componente de interface sobre fundo branco, e a WCAG 1.4.11 pede
 * 3:1 aí. `#FFE9A8` rende 1,2:1 contra branco — o rótulo é perfeitamente
 * legível dentro de uma bolha que ninguém percebe existir.
 */
export function checkWidgetContrast(background: string): ContrastCheck {
  const rgb = parseHex(background);
  const { hex, ratio: labelRatio } = readableInk(background);

  // Página branca é o caso a proteger: fundo da esmagadora maioria dos sites e
  // o mais desfavorável para cor clara.
  const surfaceRatio = rgb ? contrastRatio(rgb, WHITE) : 1;

  const label = Math.round(labelRatio * 100) / 100;
  const surface = Math.round(surfaceRatio * 100) / 100;
  const base = { labelRatio: label, surfaceRatio: surface, ink: hex };

  if (surfaceRatio < 2) {
    return {
      ...base,
      verdict: "reprovado",
      message: `${surface.toFixed(2)}:1 contra uma página branca — o lançador some no fundo do site. Escolha um tom bem mais escuro ou mais saturado.`,
    };
  }

  if (surfaceRatio < 3) {
    return {
      ...base,
      verdict: "limite",
      /**
       * Alerta, não erro — e a diferença é a sombra.
       *
       * A WCAG 1.4.11 pede 3:1 contra a cor adjacente, mas admite que um
       * componente com limite visível próprio não dependa só do preenchimento. O
       * lançador é uma peça grande e elevada, com sombra marcada: nesta faixa ele
       * é encontrável, só não salta. Bloquear aqui reprovaria o laranja da própria
       * marca (2,13:1) numa situação em que ele funciona.
       */
      message: `${surface.toFixed(2)}:1 contra a página branca — abaixo dos 3:1 da WCAG 1.4.11. A sombra do lançador compensa em parte, mas num site claro ele não salta. Um tom mais escuro resolve.`,
    };
  }

  if (labelRatio < 4.5) {
    return {
      ...base,
      verdict: "limite",
      message: `A peça aparece bem (${surface.toFixed(2)}:1 contra a página), mas o rótulo rende só ${label.toFixed(2)}:1. Serve para ícone; para frase, ajuste o tom.`,
    };
  }

  return {
    ...base,
    verdict: "aprovado",
    message: `${surface.toFixed(2)}:1 contra a página e ${label.toFixed(2)}:1 no rótulo — o lançador se destaca e o texto se lê.`,
  };
}

/**
 * Versão mais escura da cor, para o estado pressionado e para a bolha do agente.
 *
 * Mistura com a tinta em vez de mexer em HSL: escurecer por luminosidade em HSL
 * desloca a percepção de matiz em cores saturadas, e o resultado deixa de
 * parecer a mesma marca.
 */
export function darken(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const mix = Math.max(0, Math.min(1, amount));
  return formatHex({
    r: rgb.r * (1 - mix) + INK.r * mix,
    g: rgb.g * (1 - mix) + INK.g * mix,
    b: rgb.b * (1 - mix) + INK.b * mix,
  });
}

/** Versão clara, para o plano da conversa e o realce de foco. */
export function lighten(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const mix = Math.max(0, Math.min(1, amount));
  return formatHex({
    r: rgb.r * (1 - mix) + 255 * mix,
    g: rgb.g * (1 - mix) + 255 * mix,
    b: rgb.b * (1 - mix) + 255 * mix,
  });
}
