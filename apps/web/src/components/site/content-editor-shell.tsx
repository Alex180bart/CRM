"use client";

import * as React from "react";
import { cn } from "@elora/ui";
import type { LucideIcon } from "lucide-react";

/**
 * A navegação do editor de conteúdo: rail de seções à esquerda, painel à direita.
 *
 * ## Por que rail, e não acordeão empilhado
 *
 * A primeira versão empilhava dez seções dobráveis. Funciona, e tem dois
 * defeitos que só aparecem com o formulário cheio: para ir do Herói ao Rodapé é
 * preciso rolar por tudo o que está aberto no caminho, e não existe lugar nenhum
 * que responda "quantas seções são, e onde estou". Um rail responde as duas com
 * a mesma peça — e, por só montar a seção ativa, corta o custo de manter
 * centenas de campos controlados vivos ao mesmo tempo.
 *
 * ## As seções se registram sozinhas
 *
 * `SectionedEditor` lê os próprios filhos: cada `<SectionBox>` declara título,
 * descrição, ícone e contagem por propriedade, e o rail é montado a partir
 * disso. A alternativa seria um arranjo de descritores ao lado do JSX — duas
 * listas para manter em sincronia, e a que seria esquecida é sempre a do rail,
 * que é a que ninguém edita quando acrescenta uma seção.
 *
 * ## Movimento
 *
 * Trocar de seção remonta o painel (a `key` é o título), e `.rise-in` o traz
 * para cima 8 px em `transform` e `opacity`. Nada anima altura: o gargalo deste
 * front é recálculo de estilo e layout, e animar a abertura de um acordeão é
 * exatamente o trabalho que se paga em layout a cada quadro.
 */

export interface SectionBoxProps {
  title: string;
  description?: string;
  /** Quantos itens a seção tem. Só aparece quando faz sentido contar. */
  count?: number;
  icon: LucideIcon;
  children: React.ReactNode;
}

/**
 * O painel de uma seção.
 *
 * Deixou de ser dobrável: com o rail, só a seção ativa existe no DOM, então não
 * há o que dobrar. O componente continua com o mesmo nome e as mesmas
 * propriedades de antes — mais `icon` — porque quem o escreve são os arquivos de
 * seção, e trocar a forma deles por causa da navegação seria acoplar as duas
 * coisas sem ganho.
 */
export function SectionBox({ title, description, count, icon: Icon, children }: SectionBoxProps) {
  return (
    <section className="rise-in border-border shadow-card bg-card overflow-hidden rounded-xl border">
      <header className="border-border bg-surface-sunken flex items-center gap-3 border-b px-5 py-4">
        <span className="bg-accent-soft text-accent-ink flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-base font-semibold">{title}</h3>
          {description ? (
            <p className="text-muted-foreground truncate text-xs leading-snug">{description}</p>
          ) : null}
        </div>
        {typeof count === "number" ? (
          <span className="text-muted-foreground figure shrink-0 text-xs">
            {count} {count === 1 ? "item" : "itens"}
          </span>
        ) : null}
      </header>

      <div className="space-y-5 px-5 py-5">{children}</div>
    </section>
  );
}

/** Só para o teste de tipo: garante que o filho é um `SectionBox`. */
type SectionChild = React.ReactElement<SectionBoxProps>;

export function SectionedEditor({ children }: { children: React.ReactNode }) {
  /**
   * Filtra os filhos que são seções.
   *
   * A checagem é pela presença de `title`, e não por `child.type === SectionBox`:
   * comparar o tipo quebra assim que alguém envolve uma seção num componente
   * próprio, e o sintoma seria a seção sumir do rail sem erro nenhum.
   */
  const sections = React.Children.toArray(children).filter((child): child is SectionChild => {
    if (!React.isValidElement(child)) return false;
    const props = child.props as Partial<SectionBoxProps> | null;
    return typeof props?.title === "string";
  });

  const [active, setActive] = React.useState(0);
  const panel = React.useRef<HTMLDivElement>(null);

  /**
   * Trocar de seção traz o topo do painel de volta à vista — mas só quando ele
   * saiu dela.
   *
   * Sem isto, quem está no fim de uma seção longa e clica numa curta continua na
   * mesma altura de rolagem e cai **abaixo** do formulário inteiro, olhando o
   * rodapé da página. Com `scrollIntoView` incondicional, o oposto: a página
   * saltaria mesmo quando o painel já estava visível, e a leitura de layout
   * síncrona seria paga a cada clique — o mesmo cuidado que o Inbox tem ao rolar
   * só quando a seleção veio do teclado.
   *
   * O deslocamento de 152 px é a barra de ações grudada no topo. Sem ele, o
   * cabeçalho da seção nasce escondido atrás dela.
   */
  function focusPanel() {
    const node = panel.current;
    if (!node) return;

    const top = node.getBoundingClientRect().top;
    if (top >= 152 && top < window.innerHeight) return;

    window.scrollTo({ top: window.scrollY + top - 152, behavior: "smooth" });
  }

  /**
   * O índice é preso ao tamanho da lista a cada render, e não guardado corrigido
   * no estado.
   *
   * As seções são fixas hoje, mas o mesmo componente serve às quatro abas — e a
   * do rodapé tem duas. Guardar "estava na seção 7" e mudar de aba produziria
   * painel em branco; a poda no render resolve sem efeito e sem sincronização.
   */
  const index = Math.min(active, sections.length - 1);
  const current = sections[index];

  if (!current) return null;

  // Seção única não ganha rail: uma lista de um item é ruído, não navegação.
  if (sections.length === 1) return <div className="min-w-0">{current}</div>;

  return (
    /*
      `min-w-0` na coluna do painel não é enfeite: item de grade nasce com
      `min-width: auto`, e sem isto qualquer campo largo (uma `<textarea>` com
      texto longo, a tabela de marcadores) empurra a coluna e a página inteira
      passa a rolar na horizontal.
    */
    <div className="grid gap-5 lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start">
      <nav
        aria-label="Seções do conteúdo"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:sticky lg:top-40 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {sections.map((section, position) => {
          const selected = position === index;
          const Icon = section.props.icon;

          return (
            <button
              key={section.props.title}
              type="button"
              onClick={() => {
                setActive(position);
                focusPanel();
              }}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "press group flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors lg:w-full lg:shrink",
                selected
                  ? "bg-primary text-primary-foreground shadow-card"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 transition-transform duration-200",
                  !selected && "group-hover:scale-110",
                )}
                aria-hidden
              />
              <span className="truncate text-sm font-medium">{section.props.title}</span>
              {typeof section.props.count === "number" ? (
                <span
                  className={cn(
                    "figure ml-auto hidden shrink-0 rounded-full px-1.5 text-[10px] leading-5 lg:block",
                    selected ? "bg-primary-foreground/15" : "bg-muted",
                  )}
                >
                  {section.props.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/*
        A `key` força a remontagem ao trocar de seção, e é o que faz `.rise-in`
        rodar de novo. É a exceção consciente à regra de não remontar subárvore
        com `key`: aqui o conteúdo **é** outro — não se está zerando estado de um
        mesmo componente, está-se trocando de formulário.
      */}
      <div key={current.props.title} ref={panel} className="min-w-0">
        {current}
      </div>
    </div>
  );
}
