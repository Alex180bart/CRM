import Link from "next/link";
import type { FooterContent } from "@elora/core";

import { LogoWordmark } from "@/components/shell/logo";
import { RichText } from "./rich-text";

/**
 * Rodapé do site.
 *
 * O bloco de status no fim não é decoração: o produto está em construção, e a
 * página inteira acaba de prometer bastante. Dizer o que já funciona e o que
 * ainda não, no lugar onde a pessoa termina de ler, é mais barato que descobrir
 * na primeira reunião — e é a mesma disciplina do painel de política de acesso,
 * que declara o que ainda não vale antes dos campos.
 *
 * Ele é editável como todo o resto, e continua sendo o parágrafo que menos
 * deveria ser apagado sem uma boa razão.
 */
export function SiteFooter({ content }: { content: FooterContent }) {
  return (
    <footer className="border-border bg-surface-sunken border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-5 md:py-14">
        {/*
          Duas colunas no celular, e a marca ocupa as duas.

          Em coluna única as três listas de links viravam uma escada de quinze
          linhas no fim de uma página que já é longa — e o rodapé aqui não é
          decoração: com a barra inferior segurando quatro destinos, é ele que
          guarda todo link que não coube. Um rodapé que ninguém rola até o fim
          deixa esses links inalcançáveis no celular.

          O alvo de toque tem 40 px de altura mesmo com texto de 14 px: o recuo
          vertical no link é o que separa "lista de links" de "parágrafo com
          palavras sublinhadas" quando o dedo mira.
        */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-10">
          <div className="col-span-2 md:col-span-1">
            <LogoWordmark height={26} />
            <RichText className="text-muted-foreground mt-3 max-w-xs text-sm leading-relaxed">
              {content.tagline}
            </RichText>
          </div>

          {content.columns.map((column) => (
            <div key={column.id}>
              <h3 className="text-xs font-semibold uppercase tracking-wide">{column.title}</h3>
              <ul className="mt-2 md:mt-3 md:space-y-2">
                {column.links.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground -mx-2 flex min-h-10 items-center rounded-lg px-2 text-sm transition-colors md:mx-0 md:min-h-0 md:px-0"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border mt-10 border-t pt-6 md:mt-12">
          <p className="text-muted-foreground text-xs leading-relaxed">
            {content.statusTitle ? (
              <strong className="text-foreground font-semibold">{content.statusTitle}</strong>
            ) : null}{" "}
            {content.statusBody}
          </p>
          <p className="text-muted-foreground mt-4 text-xs">{content.legal}</p>
        </div>
      </div>
    </footer>
  );
}
