import { productArt, type Product, type ProductMotif } from "@elora/core";
import { cn } from "@elora/ui";

/**
 * A miniatura do produto.
 *
 * ## Por que SVG desenhado, e não `<img>`
 *
 * O catálogo não tem foto: o caminho de mídia da seção 11 — upload, antivírus,
 * armazenamento, URL assinada — ainda não existe. Um `<img>` hoje apontaria para
 * binário versionado ou para host externo, e a base de demonstração deixaria de
 * funcionar offline.
 *
 * Desenhado, o ícone herda cor de token e matiz do dado, funciona nos dois temas
 * sem segundo arquivo e escala de 32 a 200 px sem borrar. É o mesmo raciocínio do
 * avatar com iniciais — e, como ele, vira **fallback** no dia em que a foto real
 * existir.
 *
 * ## A cor segue a exceção documentada
 *
 * Componente não escreve hexadecimal, mas **cor derivada de dado** é a primeira
 * exceção da regra: o componente informa só a matiz e lê saturação, luminosidade
 * e opacidade de `--hue-bg-l`, `--hue-bg-a` e `--hue-fg-l`. É o que faz o tema
 * escuro funcionar sem duplicar nada — igual a tag, avatar e bloco de fluxo.
 *
 * ## Traço, não preenchimento
 *
 * Os motivos são desenhados a traço com `currentColor`, e a cor entra no
 * contêiner. Preenchimento sólido exigiria uma segunda decisão de contraste por
 * motivo; com traço, a mesma regra de cor serve para os doze.
 */

const PATHS: Record<ProductMotif, React.ReactNode> = {
  documento: (
    <>
      <path d="M6 3h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M13 3v5h5" />
      <path d="M8.5 13h7M8.5 17h4" />
    </>
  ),
  caixa: (
    <>
      <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
      <path d="M3 8.5v7L12 20l9-4.5v-7" />
      <path d="M12 13v7" />
    </>
  ),
  luminaria: (
    <>
      <path d="M12 3v3" />
      <path d="M5 13a7 7 0 0 1 14 0Z" />
      <path d="M9.5 17h5" />
      <path d="M10.5 20.5h3" />
    </>
  ),
  casa: (
    <>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  chave: (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="M11 11l9 9" />
      <path d="M17 17l2-2" />
      <path d="M14.5 14.5l2-2" />
    </>
  ),
  sorriso: (
    <>
      <path d="M4.5 9c0-2.5 3-4 7.5-4s7.5 1.5 7.5 4c0 4-2 10-4 10-1.5 0-2-2-3.5-2s-2 2-3.5 2c-2 0-4-6-4-10Z" />
      <path d="M9 9.5h6" />
    </>
  ),
  estetoscopio: (
    <>
      <path d="M5 3v6a4 4 0 0 0 8 0V3" />
      <path d="M5 3H3.5M13 3h1.5" />
      <path d="M9 13v2a5 5 0 0 0 10 0v-1" />
      <circle cx="19" cy="11" r="2" />
    </>
  ),
  curso: (
    <>
      <path d="M3 8.5 12 4.5l9 4-9 4-9-4Z" />
      <path d="M7 10.5V16c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-5.5" />
      <path d="M21 8.5V14" />
    </>
  ),
  assinatura: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 14.5h4" />
    </>
  ),
  ferramenta: (
    <>
      <path d="M14.5 4.5a4.5 4.5 0 0 0-6 5.9L4 15v4h4l4.6-4.6a4.5 4.5 0 0 0 5.9-6l-2.9 2.9-2.4-2.4 2.9-2.9Z" />
    </>
  ),
  grafico: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 16.5v-4M12.5 16.5V8M17 16.5v-6" />
    </>
  ),
  escudo: (
    <>
      <path d="M12 3.5 19 6v6c0 4.2-3 7.4-7 8.5-4-1.1-7-4.3-7-8.5V6l7-2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
};

const SIZES = {
  sm: { box: "size-9 rounded-lg", stroke: 1.9, icon: 18 },
  md: { box: "size-12 rounded-xl", stroke: 1.8, icon: 24 },
  lg: { box: "size-16 rounded-2xl", stroke: 1.6, icon: 32 },
} as const;

export function ProductArt({
  product,
  size = "md",
  className,
}: {
  product: Pick<Product, "key" | "name" | "kind" | "recurrence" | "summary">;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const art = productArt(product);
  const spec = SIZES[size];

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", spec.box, className)}
      style={{
        backgroundColor: `hsl(${art.hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
        color: `hsl(${art.hue} 52% var(--hue-fg-l))`,
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        width={spec.icon}
        height={spec.icon}
        fill="none"
        stroke="currentColor"
        strokeWidth={spec.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[art.motif]}
      </svg>
    </span>
  );
}
