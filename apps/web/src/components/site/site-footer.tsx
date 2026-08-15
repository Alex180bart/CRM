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
      <div className="mx-auto w-full max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <LogoWordmark height={26} />
            <RichText className="text-muted-foreground mt-3 max-w-xs text-sm leading-relaxed">
              {content.tagline}
            </RichText>
          </div>

          {content.columns.map((column) => (
            <div key={column.id}>
              <h3 className="text-xs font-semibold uppercase tracking-wide">{column.title}</h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border mt-12 border-t pt-6">
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
