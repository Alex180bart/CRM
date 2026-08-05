/**
 * Marcas dos canais.
 *
 * Ícone genérico não resolve o Inbox: o atendente varre a lista pelo canal, e
 * "um balão de fala" não distingue WhatsApp de Messenger. Aqui ficam os glifos
 * oficiais, para que o reconhecimento seja instantâneo.
 *
 * **Exceção documentada à regra de cor.** O restante do sistema proíbe
 * hexadecimal em componente (ver `docs/design-system.md`). Marcas de terceiros
 * são a única exceção: a cor faz parte do glifo e não pode ser tokenizada. Todos
 * os valores vivem neste arquivo, e em nenhum outro.
 *
 * Uso nominativo: as marcas identificam o canal de origem da conversa, que é
 * exatamente o que a diretriz de cada plataforma permite. Nada aqui sugere
 * endosso ou parceria.
 */

export interface BrandGlyphProps {
  className?: string;
}

export function WhatsAppGlyph({ className }: BrandGlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

export function InstagramGlyph({ className }: BrandGlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0Zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03Zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4Zm7.846-10.405a1.441 1.441 0 0 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z" />
    </svg>
  );
}

export function MessengerGlyph({ className }: BrandGlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.301 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0Zm1.191 14.963-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963Z" />
    </svg>
  );
}

/**
 * Botão de reprodução do YouTube.
 *
 * Não é canal de atendimento — é provedor de mídia, e aparece sobre a capa de um
 * vídeo anexado à conversa. Entra aqui porque a regra é a mesma: a cor faz parte
 * da marca, e todo hexadecimal de terceiro vive neste arquivo.
 *
 * O vermelho oficial (#FF0000) sobre o retângulo arredondado é o que faz o olho
 * reconhecer "isto é um vídeo do YouTube" antes de ler qualquer legenda.
 */
export function YouTubePlayGlyph({ className }: BrandGlyphProps) {
  return (
    <svg viewBox="0 0 48 34" className={className} aria-hidden focusable="false">
      <rect width="48" height="34" rx="8" fill="#FF0000" />
      <path d="M19.5 10.5 32 17l-12.5 6.5v-13Z" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * Fundos das marcas.
 *
 * WhatsApp e Messenger têm cor chapada; Instagram tem gradiente. Em todos, o
 * glifo é branco — é a única forma que garante contraste sobre a marca e é o que
 * as próprias diretrizes especificam.
 */
export const BRAND_SURFACE: Record<string, string> = {
  whatsapp: "#25D366",
  messenger: "linear-gradient(200deg, #00B2FF 0%, #006AFF 50%, #FF5E85 100%)",
  instagram:
    "radial-gradient(circle at 28% 108%, #FDF497 0%, #FDF497 5%, #FD5949 45%, #D6249F 60%, #285AEB 90%)",
};

/**
 * Tinta da marca para o glifo sem fundo, com degrau próprio por tema.
 * Os tons escuros são os oficiais de cada marca para uso monocromático.
 */
export const BRAND_INK: Record<string, string> = {
  whatsapp: "text-[#128C7E] dark:text-[#25D366]",
  instagram: "text-[#C13584] dark:text-[#E1306C]",
  messenger: "text-[#0074E4] dark:text-[#3FA2FF]",
};
