"use client";

import * as React from "react";

import { cn } from "../lib/cn";

/**
 * Uma orquestração já rodou nesta região?
 *
 * Fora de um `RevealScope` o valor é `false` para sempre, que é o comportamento
 * histórico: toda montagem anima. É o padrão certo para quem não tem abas.
 */
const RevealSettled = React.createContext(false);

/**
 * Delimita **uma** orquestração de entrada.
 *
 * ## O problema que isto resolve
 *
 * `Reveal` anima na montagem, e o Radix desmonta o painel de aba inativo. O
 * resultado é que trocar de aba reexecuta a orquestração inteira: o conteúdo já
 * está em memória e mesmo assim fica escondido em `opacity: 0` por até 910 ms
 * (`6 × 60 ms` de escalonamento mais `550 ms` de duração).
 *
 * Medido em build de produção, a troca de aba custa **menos de 2 ms de script** —
 * ou seja, a lentidão percebida ali é inteiramente animação, não trabalho. E ela
 * contradiz a regra que este próprio arquivo enuncia: uma orquestração **por
 * página**. Trocar de aba não é entrar numa página nova.
 *
 * ## Por que um relógio, e não "animar só na primeira montagem"
 *
 * Contar montagens exigiria identidade estável por elemento — e `Reveal` é usado
 * dentro de listas cujo conteúdo muda. O relógio pergunta a coisa certa: *a
 * entrada da página já terminou?* Depois disso, qualquer montagem é navegação
 * interna e deve mostrar o conteúdo na hora.
 *
 * `settleMs` cobre o pior caso com folga. Encurtá-lo demais faria a última
 * seção da primeira orquestração perder a animação no meio; alongá-lo faria a
 * primeira troca de aba ainda animar.
 */
export function RevealScope({
  settleMs = 1_200,
  children,
}: {
  settleMs?: number;
  children: React.ReactNode;
}) {
  const [settled, setSettled] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setSettled(true), settleMs);
    return () => window.clearTimeout(timer);
  }, [settleMs]);

  return <RevealSettled.Provider value={settled}>{children}</RevealSettled.Provider>;
}

/**
 * Entrada em sequência.
 *
 * A página inteira usa **uma** orquestração: cada seção sobe 10 px e aparece,
 * com 60 ms de atraso por índice. Nada pisca, nada repete em laço. Sob
 * `prefers-reduced-motion` o efeito é anulado no CSS.
 *
 * Dentro de um `RevealScope` já assentado, o elemento nasce sem a classe — sem
 * `opacity: 0`, sem animação, visível no primeiro quadro. A troca de classe não
 * produz salto porque `.reveal` termina em `opacity: 1` (a animação é
 * `forwards`), que é o mesmo estado do elemento sem a classe.
 */
export function Reveal({
  index = 0,
  onView = false,
  as: Component = "div",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  index?: number;
  /**
   * Amarra a entrada à **rolagem** em vez da montagem.
   *
   * Para o que nasce abaixo da dobra numa página longa. Sem isto, a seção sete
   * termina de animar enquanto a pessoa ainda lê a primeira, e quem chega lá
   * encontra tudo parado: o efeito roda, ninguém vê.
   *
   * É acréscimo puro. Onde o navegador não tem linha do tempo de rolagem, a
   * classe extra não casa com regra nenhuma e o comportamento é o de sempre —
   * animar na montagem. Nunca existe estado em que o conteúdo fique invisível
   * esperando um gatilho.
   */
  onView?: boolean;
  as?: React.ElementType;
}) {
  const settled = React.useContext(RevealSettled);

  return (
    <Component
      className={cn(!settled && "reveal", !settled && onView && "reveal-on-view", className)}
      style={settled ? undefined : ({ "--reveal-index": index } as React.CSSProperties)}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * Número que interpola **do valor anterior**, não do zero.
 *
 * É o par de `AnimatedNumber`, e a diferença decide qual usar. `AnimatedNumber`
 * conta a partir de zero, o que é certo numa entrada de página — dá para
 * perceber a ordem de grandeza. Aqui o valor **muda** com o gesto de quem está
 * na tela: alternar entre anual e mensal, somar um item ao carrinho. Contar do
 * zero a cada mudança faria o número piscar até o novo total, e o piscar é lido
 * como recarregamento.
 *
 * Existia como cópia privada no montador de proposta do Inbox. Subiu para cá no
 * segundo consumidor, que é o momento em que duas cópias começam a divergir.
 */
export function RollingNumber({
  value,
  format,
  className,
  durationMs = 420,
}: {
  value: number;
  format: (value: number) => string;
  className?: string;
  durationMs?: number;
}) {
  const [display, setDisplay] = React.useState(value);
  const fromRef = React.useRef(value);
  const frameRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs]);

  return <span className={className}>{format(display)}</span>;
}

/**
 * Número que conta até o valor final na montagem.
 *
 * Serve à leitura, não ao enfeite: a contagem dura 700 ms e usa easing de
 * desaceleração, o que dá tempo de perceber a ordem de grandeza antes de o
 * valor assentar. Quem prefere menos movimento vê o valor final direto.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  durationMs = 700,
}: {
  value: number;
  format?: (value: number) => string;
  className?: string;
  durationMs?: number;
}) {
  const [display, setDisplay] = React.useState(value);
  const frameRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setDisplay(value);
      return;
    }

    const from = 0;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      // easeOutCubic: rápido no começo, assenta no fim.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs]);

  const rounded = Number.isInteger(value) ? Math.round(display) : Number(display.toFixed(1));

  return (
    <span className={className}>{format ? format(rounded) : rounded.toLocaleString("pt-BR")}</span>
  );
}
