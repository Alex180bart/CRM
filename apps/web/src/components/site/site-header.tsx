"use client";

import Link from "next/link";
import * as React from "react";
import type { HeaderContent } from "@elora/core";
import { Button, cn } from "@elora/ui";

import { LogoWordmark } from "@/components/shell/logo";

/**
 * Cabeçalho do site público.
 *
 * ## Por que é cliente
 *
 * Uma interação que não existe sem JavaScript: a troca de borda no scroll.
 * Poderia ser CSS puro com `scroll-timeline`, mas ele ainda não está em todos os
 * navegadores que este site precisa atender — e aqui, ao contrário do parallax
 * do herói, a borda não é enfeite: é o que separa o cabeçalho do conteúdo claro
 * quando os dois ficam da mesma cor.
 *
 * ## No celular ele tem duas coisas, e o resto desceu
 *
 * Marca à esquerda, ação primária à direita. O menu sanfonado saiu inteiro
 * quando a navegação virou barra inferior (`mobile-tab-bar.tsx`): manter os dois
 * significaria a mesma lista em dois lugares, com o de cima custando dois toques
 * e ficando fora do alcance do polegar.
 *
 * A consequência de escopo vale registrar: com quatro alvos embaixo e o botão de
 * ação aqui, um link do cabeçalho não cabe em lugar nenhum no celular — e é o
 * rodapé que o segura. Por isso o rodapé não é opcional nesta página.
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
 * ## Os links chegam por propriedade, e o componente continua sendo cliente
 *
 * O menu é editável em `/admin`, mas quem lê o conteúdo é o layout — Server
 * Component. Buscar aqui exigiria efeito, estado de carregamento e um cabeçalho
 * que nasce vazio e preenche depois: pulo de layout na primeira coisa que o
 * visitante vê.
 *
 * A navegação pública não tem "Demonstrações", e a ausência é deliberada — vale
 * lembrar antes de acrescentá-la pelo editor. As bases de demonstração são
 * material de venda: carregá-las troca os dados da instância inteira. Anunciá-las
 * no menu convidaria o visitante a abrir uma sozinho — e, sem back-end, ele
 * trocaria a base debaixo de uma apresentação em andamento. O caminho fica em
 * `/entrar`, para quem tem conta de administrador.
 */
export function SiteHeader({
  accountName,
  content,
}: {
  accountName?: string;
  content: HeaderContent;
}) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "site-header sticky top-0 z-50 border-b transition-colors",
        scrolled ? "border-border" : "border-transparent",
      )}
    >
      {/*
        A altura encolhe no celular — 3,5 rem contra 4. São 8 px que não parecem
        nada numa tela de 1440 e valem meia linha de título numa de 844, onde a
        primeira dobra é o único lugar que a maioria vê.
      */}
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 lg:h-16 lg:px-5">
        <Link href="/" className="press shrink-0" aria-label="Elora — início">
          <LogoWordmark height={24} className="lg:hidden" />
          <LogoWordmark height={26} className="hidden lg:inline-flex" />
        </Link>

        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {content.links.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {accountName ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/conta">{accountName.split(" ")[0]}</Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/entrar">{content.signInLabel}</Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link href={content.cta.href}>{content.cta.label}</Link>
          </Button>
        </div>

        {/*
          O rótulo do botão vem do editor e pode ser longo — "Solicitar
          orçamento" já tem 20 caracteres. `truncate` com largura máxima é o que
          impede que um texto maior empurre a marca para fora da tela: o botão
          encolhe, a marca fica.
        */}
        <Button asChild size="sm" className="ml-auto max-w-[55vw] lg:hidden">
          <Link href={content.cta.href} className="truncate">
            {content.cta.label}
          </Link>
        </Button>
      </div>
    </header>
  );
}
