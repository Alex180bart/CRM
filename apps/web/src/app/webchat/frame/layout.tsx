/**
 * Layout do quadro do widget.
 *
 * Existe por uma razão concreta e não estética: o `body` do CRM pinta
 * `hsl(var(--background))`, e dentro de um `iframe` transparente isso vira um
 * retângulo opaco sobre o site do cliente. O widget deve flutuar; o quadro em
 * volta dele não pode existir visualmente.
 *
 * `color-scheme: normal` também é necessário: sem ele, o navegador do visitante
 * em tema escuro pinta o fundo do `iframe` de preto por conta própria, e a
 * transparência declarada aqui não adianta.
 */
export default function WebchatFrameLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          background: transparent !important;
          color-scheme: normal;
          margin: 0;
          overflow: hidden;
        }
      `}</style>
      {children}
    </>
  );
}
