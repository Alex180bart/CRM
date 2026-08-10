"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Button, cn } from "@elora/ui";
import { Menu, X } from "lucide-react";

import { LogoWordmark } from "@/components/shell/logo";

/**
 * Cabeçalho do site público.
 *
 * ## Por que é cliente
 *
 * Duas interações que não existem sem JavaScript: o menu de celular e a troca de
 * borda no scroll. Poderiam ser CSS puro — `:target` para o menu, `position:
 * sticky` com `scroll-timeline` para a borda —, mas `scroll-timeline` ainda não
 * está em todos os navegadores que este site precisa atender, e `:target` deixa
 * um `#menu` no histórico que o botão "voltar" do celular passa a consumir.
 *
 * ## A barra é opaca sempre; a borda só aparece depois do primeiro scroll
 *
 * A primeira versão tentava ser transparente no topo, para o herói escuro subir
 * até a borda da janela. Não funcionou, e o motivo é estrutural: o cabeçalho é
 * `sticky`, então ocupa espaço no fluxo — o herói começa **abaixo** dele, e a
 * "transparência" só revelava o fundo claro do layout. Para o efeito valer, o
 * cabeçalho teria de sair do fluxo, e aí toda página sem herói escuro precisaria
 * compensar a altura à mão. Uma armadilha por página, para um degradê.
 *
 * A borda, essa sim, aparece só depois do scroll. No topo, cabeçalho e herói se
 * encontram por contraste de cor, e uma linha ali seria ruído; rolando, os dois
 * lados ficam claros e a divisão passa a ser o limite entre duas regiões — o caso
 * em que a regra do repositório manda usar hairline.
 */

/**
 * A navegação pública não tem "Demonstrações", e a ausência é deliberada.
 *
 * As bases de demonstração são material de venda: carregá-las troca os dados da
 * instância inteira. Anunciá-las no menu convidaria o visitante a abrir uma
 * sozinho — e, sem back-end, ele trocaria a base debaixo de uma apresentação em
 * andamento. O caminho fica em `/entrar`, para quem tem conta de administrador.
 */
const LINKS = [
  { href: "/#produto", label: "Produto" },
  { href: "/precos", label: "Preços" },
  { href: "/#ia", label: "Inteligência artificial" },
  { href: "/#seguranca", label: "Segurança" },
  { href: "/orcamento", label: "Falar com o comercial" },
];

export function SiteHeader({ accountName }: { accountName?: string }) {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Navegar fecha o menu. Sem isto, voltar para a home pelo menu deixaria o
  // painel aberto sobre a página nova.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header
      className={cn(
        "site-header sticky top-0 z-50 border-b transition-colors",
        scrolled ? "border-border" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-6 px-5">
        <Link href="/" className="press shrink-0" aria-label="Elora — início">
          <LogoWordmark height={26} />
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {accountName ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/conta">{accountName.split(" ")[0]}</Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/entrar">Entrar</Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link href="/orcamento">Solicitar orçamento</Link>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="border-input text-foreground ml-auto inline-flex size-9 items-center justify-center rounded-lg border md:hidden"
          aria-expanded={open}
          aria-label={open ? "Fechar menu" : "Abrir menu"}
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {open ? (
        <div className="site-header border-border border-t px-5 py-4 md:hidden">
          <nav className="grid gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:bg-muted rounded-lg px-3 py-2.5 text-sm font-medium"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 grid gap-2">
            <Button asChild variant="outline">
              <Link href={accountName ? "/conta" : "/entrar"}>
                {accountName ? "Minha conta" : "Entrar"}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/orcamento">Solicitar orçamento</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
