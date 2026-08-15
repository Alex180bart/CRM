"use client";

import * as React from "react";
import { cn } from "@elora/ui";

/**
 * Palavra que troca rolando, caractere a caractere.
 *
 * ## A largura acompanha a palavra, e é a segunda tentativa
 *
 * A primeira versão reservava a largura da **maior** palavra da lista e
 * empilhava todas na mesma célula de grade. A ideia era evitar animar `width` —
 * o gargalo medido deste front é recálculo de estilo e layout, e a regra da casa
 * é que todo efeito seja `transform` ou `opacity`.
 *
 * Só que no corpo do herói a maior palavra ("Instagram") mede 326 px, e o
 * resultado na tela foi pior que o problema que a decisão evitava: a caixa não
 * cabia na linha, a palavra caía sozinha para a linha seguinte, aparecia
 * centralizada — portanto indentada — e o ponto final ficava a duzentos pixels
 * dela, solto. Reservar espaço só é invisível quando o espaço é pequeno.
 *
 * Agora a caixa mede a palavra **ativa** e transiciona até a largura da
 * seguinte. O texto depois dela desliza em vez de saltar, que é o efeito que a
 * reserva de largura tentava comprar — e agora sem o custo visual.
 *
 * ## Por que animar `width` aqui é aceitável
 *
 * A regra do repositório não é "nunca anime largura": é que o caminho crítico
 * não pague por isso. Aqui é **um** elemento, numa seção estática, fora de
 * qualquer lista virtualizada, trocando a cada 2,2 s. O recálculo alcança uma
 * linha de título. **Não reutilize este componente dentro do Inbox.**
 *
 * ## O que continua fora
 *
 * `styled-components` e a biblioteca de animação do componente de referência.
 * A primeira é uma segunda camada de estilo sobre o Tailwind; a segunda entrava
 * só pelo hook de movimento reduzido, que aqui é a variante `motion-reduce:`.
 */

export function TextRoll({
  words,
  intervalMs = 2200,
  className,
  charClassName,
}: {
  /** As palavras que se alternam. */
  words: string[];
  intervalMs?: number;
  className?: string;
  /** Classe aplicada a cada caractere — é onde a cor de destaque entra. */
  charClassName?: string;
}) {
  /**
   * A anterior viaja junto com a atual, e é isso que faz a rolagem rolar.
   *
   * A primeira versão guardava só o índice ativo e mandava toda palavra inativa
   * para `-0.85em`. O efeito na tela era outro: a que saía **subia** e a que
   * entrava vinha de cima também, então as duas cruzavam o mesmo espaço e se
   * sobrepunham no meio do caminho — numa captura dava para ler "Mess" por cima
   * de "agram".
   *
   * Guardando qual era a anterior, ela sai **para baixo** enquanto a nova entra
   * por cima. Uma libera o espaço que a outra ocupa, que é a diferença entre uma
   * rolagem e um embaralhado.
   */
  const [roll, setRoll] = React.useState({ current: 0, previous: -1 });
  const wordRefs = React.useRef<Array<HTMLSpanElement | null>>([]);
  const [widths, setWidths] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (words.length < 2) return;
    const id = window.setInterval(() => {
      setRoll((state) => ({
        current: (state.current + 1) % words.length,
        previous: state.current,
      }));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [words.length, intervalMs]);

  const index = roll.current;

  /**
   * Mede todas as palavras uma vez, e de novo quando a janela muda.
   *
   * `useLayoutEffect` e não `useEffect`: a medição precisa acontecer antes da
   * pintura, senão o primeiro quadro sai com a caixa na largura automática — que
   * é a da maior palavra, já que todas estão no DOM — e encolhe visivelmente no
   * quadro seguinte.
   *
   * A remedição por `resize` existe porque o corpo do título muda de tamanho no
   * ponto de corte `md`: sem ela, quem abre no celular e gira o aparelho fica
   * com a caixa medida na tipografia anterior.
   */
  React.useLayoutEffect(() => {
    function measure() {
      setWidths(wordRefs.current.map((element) => element?.scrollWidth ?? 0));
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [words]);

  const measured = widths[index];

  return (
    /*
      A largura sai do estado quando já foi medida; antes disso fica automática,
      que no servidor e no primeiro quadro é a da maior palavra. É o único
      instante em que a caixa fica larga, e ele dura um quadro.

      `aria-live` fica de fora e o rótulo acessível é fixo: um leitor de tela
      anunciando a troca a cada dois segundos torna o título impossível de ouvir.
    */
    <span
      className={cn(
        "relative inline-grid overflow-y-clip align-bottom transition-[width] duration-500 ease-[cubic-bezier(0.34,1.3,0.64,1)] motion-reduce:transition-none",
        className,
      )}
      style={measured ? { width: `${measured}px` } : undefined}
      role="img"
      aria-label={words.join(", ")}
    >
      {words.map((word, wordIndex) => {
        const active = wordIndex === index;
        const leaving = wordIndex === roll.previous;

        /*
          Três posições, e não duas: a ativa no lugar, a que acabou de sair
          abaixo da linha, e todas as outras estacionadas acima — prontas para
          entrar quando for a vez delas.
        */
        const offset = active ? "0" : leaving ? "0.95em" : "-0.95em";

        return (
          <span
            key={word}
            aria-hidden
            ref={(element) => {
              wordRefs.current[wordIndex] = element;
            }}
            /*
              `w-max` e `justify-self-start` não são enfeite: item de grade
              estica até a largura do contêiner por padrão, e o contêiner tem a
              largura que sai desta medição. Sem eles, `scrollWidth` devolvia a
              largura já aplicada em vez da largura da palavra — todas mediam
              igual, e a caixa nunca mudava de tamanho.
            */
            className="[grid-area:1/1] inline-flex w-max justify-self-start whitespace-pre py-[0.12em]"
          >
            {Array.from(word).map((char, charIndex) => (
              <span
                key={`${word}-${charIndex}`}
                className={cn(
                  "inline-block transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] will-change-transform",
                  "motion-reduce:transition-none",
                  charClassName,
                )}
                style={{
                  /*
                    Escalonamento por índice de caractere, e a palavra que sai
                    escalona junto — sem isso, a saída acontece de uma vez e a
                    entrada em cascata, o que lê como duas animações diferentes
                    acontecendo na mesma peça.
                  */
                  transitionDelay: `${charIndex * 38}ms`,
                  transform: `translateY(${offset})`,
                  opacity: active ? 1 : 0,
                  /*
                    A palavra estacionada não transiciona: ela precisa estar em
                    cima **antes** de entrar, e animar até lá a faria descer pela
                    tela no meio da vez de outra palavra.
                  */
                  transitionDuration: active || leaving ? undefined : "0ms",
                }}
              >
                {char === " " ? " " : char}
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
}
