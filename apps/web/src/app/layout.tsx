import type { Metadata, Viewport } from "next";
import { repositories } from "@elora/core";

import { Providers } from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Elora",
    template: "%s · Elora",
  },
  description:
    "Elora — plataforma omnichannel da Contabilidade Facilitada: atendimento, CRM 360º, automação e inteligência artificial.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1E1B4B" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0c1a" },
  ],
};

/**
 * Preferência da pessoa, aplicada antes da primeira pintura.
 *
 * ## Por que só o modo e a densidade estão aqui
 *
 * A **paleta** não passa por este script: ela vem da organização, é lida no
 * servidor e sai no atributo `data-palette` do `<html>` já no HTML. Resolver
 * paleta no cliente significaria pintar a página inteira com a paleta padrão e
 * repintá-la no primeiro quadro — o flash mais caro possível, porque atinge
 * todos os tokens ao mesmo tempo.
 *
 * Modo e densidade não têm essa saída: dependem do `localStorage` e do
 * `prefers-color-scheme`, que só existem no navegador. Daí o script, que
 * continua sendo o único inline da aplicação.
 *
 * ## `allowPersonalOverride` é conferido aqui também
 *
 * A tela esconde os controles quando a organização bloqueia a escolha
 * individual, mas quem já tinha um valor gravado no `localStorage` continuaria
 * com ele para sempre — esconder o botão não apaga o que foi gravado antes. Por
 * isso a permissão viaja para dentro do script e o valor guardado é ignorado
 * quando ela está desligada.
 */
function appearanceScript(input: { mode: string; density: string; allow: boolean }): string {
  return `
(function () {
  var org = ${JSON.stringify(input)};
  var root = document.documentElement;
  try {
    var mode = org.mode;
    var density = org.density;

    if (org.allow) {
      mode = localStorage.getItem("elora-theme") || mode;
      density = localStorage.getItem("elora-density") || density;
    }

    if (mode === "sistema") {
      mode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
    }

    root.classList.toggle("dark", mode === "escuro");
    root.setAttribute("data-density", density);
  } catch (error) {
    /* Sem localStorage: ficam os padrões que o servidor já escreveu. */
    root.setAttribute("data-density", org.density);
  }
})();
`;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const appearance = await repositories.directory.getAppearance();

  return (
    <html
      lang="pt-BR"
      data-palette={appearance.palette}
      /**
       * O servidor já escreve a densidade padrão, e o script pode trocá-la em
       * seguida. Escrever aqui evita que a página nasça sem o atributo e pule de
       * tamanho quando ele chega.
       */
      data-density={appearance.defaultDensity}
      className={appearance.defaultMode === "escuro" ? "dark" : undefined}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: appearanceScript({
              mode: appearance.defaultMode,
              density: appearance.defaultDensity,
              allow: appearance.allowPersonalOverride,
            }),
          }}
        />
      </head>
      <body className="h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
