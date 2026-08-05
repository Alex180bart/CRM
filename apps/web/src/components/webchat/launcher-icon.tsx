import type { WidgetIcon } from "@crm/core";

/**
 * Glifo do lançador.
 *
 * SVG escrito à mão, não importado de biblioteca de ícone, por um motivo
 * concreto: este componente renderiza dentro do site de terceiro. Arrastar uma
 * dependência de ícones para lá aumenta o peso do widget e amarra o visual do
 * cliente à versão da nossa biblioteca.
 *
 * `currentColor` em tudo: a tinta é decidida pelo contraste, não aqui.
 */
export function LauncherIcon({
  icon,
  logoUrl,
  className = "size-6",
}: {
  icon: WidgetIcon;
  logoUrl?: string;
  className?: string;
}) {
  if (icon === "logo") {
    // Sem endereço, cai no balão: um quadrado vazio no canto do site do cliente
    // é pior que um ícone genérico.
    if (!logoUrl) return <LauncherIcon icon="balao" className={className} />;
    return (
      // O host da imagem é do cliente e desconhecido em tempo de build, então o
      // otimizador do Next não se aplica.
      <img
        src={logoUrl}
        alt=""
        className={`${className} rounded-full object-contain`}
        aria-hidden
      />
    );
  }

  const paths: Record<Exclude<WidgetIcon, "logo">, React.ReactNode> = {
    balao: (
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.6 3.7A.75.75 0 0 1 4 19.1V5.5Z"
        fill="currentColor"
      />
    ),
    mensagem: (
      <>
        <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z" fill="currentColor" />
        <path
          d="m4.5 7 7.5 5.5L19.5 7"
          stroke="var(--launcher-ink, #fff)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    ),
    suporte: (
      <>
        <path
          d="M5 13a7 7 0 0 1 14 0"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M3.5 13.5A1.5 1.5 0 0 1 5 12h1v6H5a1.5 1.5 0 0 1-1.5-1.5v-3ZM18 12h1a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 19 18h-1v-6Z"
          fill="currentColor"
        />
        <path
          d="M18 18v.5a2.5 2.5 0 0 1-2.5 2.5H13"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
    pergunta: (
      <>
        <circle cx="12" cy="12" r="9" fill="currentColor" />
        <path
          d="M9.6 9.4a2.4 2.4 0 1 1 3.3 2.2c-.6.3-.9.8-.9 1.4v.5"
          stroke="var(--launcher-ink, #fff)"
          strokeWidth="1.7"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="12" cy="16.6" r="1.1" fill="var(--launcher-ink, #fff)" />
      </>
    ),
    raio: <path d="M13.5 2 4 13.2h6.2L9.8 22l9.7-11.4h-6.4L13.5 2Z" fill="currentColor" />,
  };

  return (
    <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" aria-hidden>
      {paths[icon]}
    </svg>
  );
}
