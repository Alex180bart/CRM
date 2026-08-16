"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import type { HeaderContent } from "@elora/core";
import { cn } from "@elora/ui";

import { LogoMark } from "@/components/shell/logo";
import { navIcon } from "@/lib/site/nav-icons";

/**
 * A barra de navegação inferior do celular e do tablet em retrato.
 *
 * ## Ela vale até `lg`, e o corte não é arbitrário
 *
 * O cabeçalho completo — cinco links, "Entrar" e o botão de ação — precisa de
 * 827 px só para o conteúdo. Ligado em `md`, ele estourava a largura de uma
 * janela de 768 e dava 59 px de rolagem horizontal à página inteira. Então a
 * troca acontece em `lg`: abaixo disso manda a barra, acima manda o cabeçalho, e
 * não existe faixa em que os dois disputem o mesmo espaço.
 *
 * ## Por que ela substitui o menu sanfonado
 *
 * O menu anterior custava dois toques e uma leitura para chegar a qualquer
 * lugar: abrir o painel, procurar o item, tocar. E ficava no canto superior
 * direito — a região mais distante do polegar de quem segura o telefone com uma
 * mão. A barra inverte as duas coisas: um toque, e no alcance natural.
 *
 * O custo é real e vale enunciar: cabem **quatro** destinos, não cinco. O que
 * sobra continua no rodapé, e no desktop o cabeçalho segue mostrando a lista
 * inteira.
 *
 * ## Como os itens são escolhidos
 *
 * Os três primeiros links do conteúdo, descartando o que aponta para o mesmo
 * lugar do botão de ação do cabeçalho — sem isso, "Falar com o comercial" e
 * "Solicitar orçamento" ocupariam dois alvos para o mesmo destino, num lugar
 * onde há quatro. O quarto é sempre conta ou entrada: é o único item que muda de
 * significado conforme quem está olhando, e por isso não pode depender de
 * alguém ter se lembrado de cadastrá-lo no editor.
 *
 * ## O centro é a marca, e é um botão de verdade
 *
 * Elevado, redondo e maior que os demais, com um anel da cor do fundo que o
 * "recorta" da barra. Ele leva para a raiz do site — o gesto mais previsível que
 * uma marca pode ter, e o que permite sair de `/precos` ou `/orcamento` sem
 * procurar nada.
 *
 * ## O item ativo é resolvido em dois regimes, porque são duas coisas diferentes
 *
 * Endereço de página (`/precos`) sai de `usePathname`, e é verdade assim que a
 * rota troca. Âncora da mesma página (`/#produto`) não: a URL não muda ao rolar,
 * então quem responde é a **seção visível**, por `IntersectionObserver`.
 *
 * Sem o segundo regime, rolar a landing page inteira deixaria a barra marcando
 * o mesmo item o tempo todo — e um indicador que nunca se move é lido, com
 * razão, como quebrado. O observador olha uma faixa estreita no meio da tela
 * (`-45% 0px -45% 0px`): com a faixa larga, duas seções ficam visíveis ao mesmo
 * tempo em telas altas e o item ativo oscila entre elas durante a rolagem.
 */

interface TabItem {
  key: string;
  label: string;
  href: string;
  /** Fragmento sem `#`, quando o destino é uma seção desta página. */
  anchor?: string;
}

const MAX_LINKS = 3;

function toTabs(content: HeaderContent, accountName?: string): TabItem[] {
  const ctaHref = content.cta.href.trim().toLowerCase();

  const links = content.links
    .filter((link) => link.href.trim().toLowerCase() !== ctaHref)
    .slice(0, MAX_LINKS)
    .map((link) => {
      /*
        Só conta como âncora desta página o que aponta para a raiz: `#produto`
        ou `/#produto`. `/precos#tabela` tem fragmento e **não** é âncora daqui —
        tratá-lo como tal poria "tabela" na lista que o observador vigia na home,
        onde esse identificador não existe, e o item nunca acenderia em lugar
        nenhum: nem na home, por não haver seção, nem em `/precos`, por estar
        sendo resolvido pela regra errada.
      */
      const href = link.href.trim();
      const ehDaRaiz = href.startsWith("#") || href.startsWith("/#");
      return {
        key: link.id,
        label: link.label,
        href,
        anchor: ehDaRaiz ? href.split("#")[1] || undefined : undefined,
      };
    });

  /*
    Os dois rótulos do editor, e não o primeiro nome de quem entrou.

    O nome cabe no cabeçalho do desktop, onde há largura. Aqui o alvo tem 68 px:
    "Bernadete" trunca do mesmo jeito que "Minha conta" e diz menos — o que a
    pessoa precisa saber ao olhar a barra é para onde aquele item leva, não como
    ela se chama.
  */
  return [
    ...links,
    {
      key: "conta",
      label: accountName ? content.accountLabel : content.signInLabel,
      href: accountName ? "/conta" : "/entrar",
    },
  ];
}

/**
 * Qual seção desta página está no meio da tela.
 *
 * Devolve `undefined` quando nenhuma está — no topo da landing page, acima da
 * primeira seção observada, nenhum item deve aparecer aceso. Marcar o primeiro
 * por padrão diria "você está em Produto" a quem ainda está lendo o herói.
 */
function useSecaoVisivel(anchors: string[]): string | undefined {
  const [ativa, setAtiva] = React.useState<string | undefined>(undefined);
  const chave = anchors.join("|");

  React.useEffect(() => {
    const ids = chave ? chave.split("|") : [];
    const alvos = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);

    if (alvos.length === 0) {
      setAtiva(undefined);
      return;
    }

    const visiveis = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visiveis.add(entry.target.id);
          else visiveis.delete(entry.target.id);
        }
        // A ordem da lista decide o desempate, e é a ordem em que as seções
        // aparecem na página: rolando para baixo, a que entrou por último ganha.
        const atual = [...ids].reverse().find((id) => visiveis.has(id));
        setAtiva(atual);
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );

    for (const alvo of alvos) observer.observe(alvo);
    return () => observer.disconnect();
  }, [chave]);

  return ativa;
}

export function MobileTabBar({
  accountName,
  content,
}: {
  accountName?: string;
  content: HeaderContent;
}) {
  const pathname = usePathname();
  const tabs = React.useMemo(() => toTabs(content, accountName), [content, accountName]);

  const anchors = React.useMemo(
    () => tabs.map((tab) => tab.anchor).filter((value): value is string => Boolean(value)),
    [tabs],
  );
  // Âncora só vale na página que a contém. Em `/precos`, `#produto` não existe —
  // e observar identificadores ausentes marcaria a barra com base em nada.
  const secao = useSecaoVisivel(pathname === "/" ? anchors : []);

  function ativo(tab: TabItem): boolean {
    if (tab.anchor) return pathname === "/" && secao === tab.anchor;
    const alvo = tab.href.split("#")[0] || "/";
    if (alvo === "/") return pathname === "/" && secao === undefined;
    return pathname === alvo || pathname.startsWith(`${alvo}/`);
  }

  const naHome = pathname === "/";
  /*
    A divisão é calculada, não fixa em dois e dois.

    Os itens vêm do editor, e alguém pode deixar dois links em vez de três. Com
    `slice(0, 2)` e uma grade de cinco colunas cravada, o resultado seria a marca
    fora do centro e duas colunas vazias à direita — sem erro, e sem nada na tela
    que explique por quê. Com a conta o total nunca é zero, então não há caso de
    barra vazia.
  */
  const metade = Math.ceil(tabs.length / 2);
  const esquerda = tabs.slice(0, metade);
  const direita = tabs.slice(metade);

  return (
    <nav
      aria-label="Navegação principal"
      className="tab-bar border-border fixed inset-x-0 bottom-0 z-50 border-t lg:hidden"
    >
      <ul
        className="mx-auto grid h-[4.25rem] max-w-md items-center px-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
      >
        {esquerda.map((tab) => (
          <TabLink key={tab.key} tab={tab} active={ativo(tab)} />
        ))}

        {/*
          O botão da marca fica no fluxo da grade e sobe por `translate`, em vez
          de sair para `position: absolute`. Absoluto, ele deixaria de reservar a
          própria coluna e os quatro itens se redistribuiriam por baixo dele —
          alvos de toque sobrepostos, que é o defeito que ninguém vê e todo mundo
          sente.
        */}
        <li className="flex justify-center">
          <Link
            href="/"
            aria-label="Elora — início"
            aria-current={naHome && !secao ? "page" : undefined}
            /*
              Sem `.press` aqui, de propósito.

              `.press:active` aplica `transform: scale(0.985)` — uma transform
              **inteira**, que substitui a deste botão em vez de compor com ela.
              O efeito seria o botão largar os 16 px de elevação e cair para
              dentro da barra a cada toque. As classes `active:` abaixo fazem o
              mesmo afundamento compondo pelas variáveis do Tailwind, que é o que
              mantém a elevação enquanto ele responde.
            */
            className={cn(
              "bg-primary text-primary-foreground ring-background shadow-overlay",
              "flex size-[3.25rem] -translate-y-4 items-center justify-center rounded-full ring-4",
              "transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
              "active:-translate-y-3.5 active:scale-95",
            )}
          >
            <LogoMark size={26} />
          </Link>
        </li>

        {direita.map((tab) => (
          <TabLink key={tab.key} tab={tab} active={ativo(tab)} />
        ))}
      </ul>
    </nav>
  );
}

/**
 * Um destino da barra.
 *
 * ## O rótulo tem duas linhas, e a altura é reservada
 *
 * A primeira versão truncava numa linha, e "Inteligência artificial" virava
 * "Inteligência ..." — reticências que não informam nada e ainda ocupam o
 * espaço de duas letras. Em duas linhas o nome cabe inteiro.
 *
 * A altura do bloco de texto é **fixa**, e é o que mantém os cinco itens
 * alinhados: sem ela, um rótulo de uma linha e outro de duas centralizariam em
 * eixos diferentes e os ícones ficariam em alturas distintas. O corte em duas
 * linhas continua existindo para o caso de alguém escrever uma frase no editor.
 *
 * ## O alvo é a coluna inteira
 *
 * Altura cheia e largura da coluna, mesmo com o conteúdo desenhado num bloco
 * menor. Área de toque de 64 px é a recomendação da própria Apple; desenhar só
 * o ícone deixaria um alvo de 20 px cercado de espaço morto que não responde a
 * nada — o tipo de erro que só aparece quando alguém tenta usar o site andando.
 */
function TabLink({ tab, active }: { tab: TabItem; active: boolean }) {
  const Icon = navIcon(tab.href);

  return (
    <li className="h-full">
      <Link
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "press flex h-full flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2",
          "transition-colors",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Icon
          className={cn("size-[1.15rem] shrink-0 transition-transform", active && "scale-110")}
          aria-hidden
        />
        <span className="line-clamp-2 h-[1.6rem] w-full text-center text-[9.5px] font-medium leading-[1.35]">
          {tab.label}
        </span>
        {/*
          O ponto é o que diferencia "ativo" de "cor um pouco mais escura" para
          quem não distingue as duas tintas. Ele ocupa o espaço em repouso e só
          cresce — reservar a altura evita que a linha inteira se mexa 3 px a
          cada troca de seção durante a rolagem.
        */}
        <span
          aria-hidden
          className={cn("tab-dot bg-primary size-1 rounded-full", active ? "scale-100" : "scale-0")}
        />
      </Link>
    </li>
  );
}
