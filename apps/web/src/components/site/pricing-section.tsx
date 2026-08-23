"use client";

import Link from "next/link";
import * as React from "react";
import {
  MONTHLY_PREMIUM_PCT,
  PLANS,
  WHATSAPP_PRICE_BY_CATEGORY,
  formatCurrencyCents,
  formatNumber,
  formatRateMicros,
  startingPriceCents,
  type BillingCycle,
} from "@elora/core";
import { Badge, Button, Card, CardContent, Reveal, RollingNumber, cn } from "@elora/ui";
import { ArrowRight, Check, Database, MessagesSquare, Minus, Users } from "lucide-react";

/**
 * A seção de preço da página inicial.
 *
 * ## O que mudou em relação ao componente de referência
 *
 * A forma é a mesma — alternador de ciclo, três colunas, preço que se move,
 * lista de recursos e lista do que já vem incluído. O que mudou é tudo que
 * tocava em cor, em número ou em discurso comercial:
 *
 * **Cor sai de token.** A referência trazia `bg-blue-500`, `text-gray-900`,
 * `bg-neutral-100` e um `radial-gradient` com `#206ce8` cravado. A marca aqui é
 * índigo com âmbar, e a paleta troca por organização — uma peça com azul
 * literal ficaria azul enquanto o resto da página muda de cor, e sumiria no
 * tema escuro.
 *
 * **Os planos são os reais.** Starter/Business/Enterprise a US$ 12/48/96 viram
 * as quatro edições de `catalog.ts`. Preço na página inicial que não sai da
 * mesma função que alimenta `/precos` e o simulador diverge no primeiro
 * reajuste, com o cliente e o vendedor olhando telas diferentes.
 *
 * **O alternador não diz "economize 20%".** Diz o prêmio do mensal. A ordem da
 * comunicação é decisão registrada: anunciar o mensal e dar desconto no anual
 * treina o cliente a pedir desconto; anunciar o anual e cobrar prêmio pela
 * flexibilidade precifica o que ela custa de verdade em previsibilidade. O
 * número — {@link MONTHLY_PREMIUM_PCT} — vem da tabela, não do texto.
 *
 * **O indicador desliza por `transform`, sem biblioteca de animação.** As duas
 * opções ocupam colunas iguais, então o indicador tem metade da largura e anda
 * `translateX(100%)`. Um `layoutId` de biblioteca daria o mesmo efeito e
 * custaria ~50 KB numa página que hoje não carrega nenhuma.
 */

const CYCLES: Array<{ value: BillingCycle; label: string; note?: string }> = [
  { value: "anual", label: "Compromisso anual" },
  { value: "mensal", label: "Mensal", note: `+${MONTHLY_PREMIUM_PCT}%` },
];

function CycleSwitch({
  value,
  onChange,
}: {
  value: BillingCycle;
  onChange: (value: BillingCycle) => void;
}) {
  const activeIndex = CYCLES.findIndex((cycle) => cycle.value === value);

  return (
    <div
      role="radiogroup"
      aria-label="Ciclo de contratação"
      className="border-input bg-surface relative mx-auto grid w-fit grid-cols-2 rounded-full border p-1"
    >
      {/*
        O indicador é irmão dos botões, não filho — dentro de um deles, ele
        herdaria o `overflow` do botão e seria cortado ao deslizar.
      */}
      <span
        aria-hidden
        className="bg-primary absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full transition-transform duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />

      {CYCLES.map((cycle) => {
        const active = cycle.value === value;
        return (
          <button
            key={cycle.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(cycle.value)}
            className={cn(
              "focus-visible:ring-ring relative z-10 flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {cycle.label}
            {cycle.note ? (
              <span
                className={cn(
                  "figure rounded-full px-1.5 py-0.5 text-[11px]",
                  active ? "bg-primary-foreground/15" : "bg-muted text-muted-foreground",
                )}
              >
                {cycle.note}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Em que cartão o carrossel parou.
 *
 * `IntersectionObserver` com o próprio trilho como raiz, e não um ouvinte de
 * `scroll`: rolagem por toque dispara dezenas de eventos por segundo, e calcular
 * posição em cada um deles põe trabalho de JavaScript exatamente no quadro em
 * que o dedo está arrastando — o lugar onde o custo aparece como travamento.
 * O observador só fala quando um cartão de fato cruza o limiar.
 *
 * O limiar é alto (0,6) de propósito: com um valor baixo, dois cartões contam
 * como visíveis durante metade do gesto e o indicador pisca entre os dois.
 */
function useCartaoVisivel(trilho: React.RefObject<HTMLDivElement | null>, total: number): number {
  const [indice, setIndice] = React.useState(0);

  React.useEffect(() => {
    const raiz = trilho.current;
    if (!raiz) return;

    const itens = Array.from(raiz.querySelectorAll<HTMLElement>("[data-plan-index]"));
    if (itens.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const valor = Number((entry.target as HTMLElement).dataset.planIndex);
          if (Number.isInteger(valor)) setIndice(valor);
        }
      },
      { root: raiz, threshold: 0.6 },
    );

    for (const item of itens) observer.observe(item);
    return () => observer.disconnect();
  }, [trilho, total]);

  return indice;
}

export function PricingSection() {
  const [billing, setBilling] = React.useState<BillingCycle>("anual");
  const trilhoRef = React.useRef<HTMLDivElement>(null);
  const visivel = useCartaoVisivel(trilhoRef, PLANS.length);

  return (
    <div>
      <Reveal index={0}>
        <CycleSwitch value={billing} onChange={setBilling} />
      </Reveal>

      <p className="text-muted-foreground mt-3 text-center text-xs">
        {billing === "anual"
          ? "Preço de tabela, com compromisso de doze meses."
          : `Sem fidelidade, a assinatura e os assentos custam ${MONTHLY_PREMIUM_PCT}% a mais.`}
      </p>

      {/*
        O indicador fica **antes** dos cartões, e a posição contraria a
        convenção de propósito.

        Cartão de plano tem mais de mil pixels de altura: pôr o indicador
        depois do trilho, como faz todo carrossel de imagem, o deixaria a duas
        telas de distância de quem está arrastando. Ele responde "onde estou, de
        quantos" — uma pergunta que só faz sentido enquanto o dedo está no
        trilho, ou seja, aqui em cima.

        Não é clicável, e a omissão também é escolha: ponto de carrossel tem 8 px
        e reprova a recomendação de 44 px de alvo de toque; cercá-lo de área
        invisível poria quatro alvos grandes bem onde o polegar descansa depois
        de arrastar. A navegação continua sendo o gesto, que já funciona.

        Escondido de leitor de tela: os quatro cartões estão no documento em
        ordem, e um leitor não rola horizontalmente. Anunciar "1 de 4" ali
        descreveria um recorte visual que, para quem ouve, não existe.
      */}
      <div aria-hidden className="mt-5 flex justify-center gap-1.5 lg:hidden">
        {PLANS.map((plan, index) => (
          <span
            key={plan.key}
            className={cn(
              "tab-dot size-1.5 rounded-full transition-colors",
              index === visivel ? "bg-primary scale-125" : "bg-border-strong",
            )}
          />
        ))}
      </div>

      {/*
        No celular as quatro edições viram carrossel; a partir de `lg`, grade.

        Empilhadas, elas somam mais de 2.400 px de rolagem — e a comparação, que
        é a única coisa que uma tabela de preço serve para fazer, exige lembrar
        de cabeça o que estava na tela anterior. Lado a lado com encaixe, o gesto
        de comparar é o mesmo de folhear.

        O cartão tem 82% da largura da tela para que o **seguinte apareça pela
        borda**. É o detalhe que transforma "uma coluna estranhamente estreita"
        em "há mais para o lado"; com 100%, o carrossel é indistinguível de uma
        pilha até alguém arrastar por acaso.
      */}
      <div
        ref={trilhoRef}
        className="rail rail-snap -mx-4 mt-4 w-[calc(100%+2rem)] gap-4 px-4 pb-2 lg:mx-0 lg:mt-8 lg:grid lg:w-full lg:snap-none lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {PLANS.map((plan, index) => {
          const featured = plan.key === "profissional";
          const unlimitedSeats = plan.seatPriceCents === 0;

          return (
            <Reveal
              key={plan.key}
              index={index + 1}
              data-plan-index={index}
              className="w-[82vw] max-w-[19rem] shrink-0 lg:w-auto lg:max-w-none"
            >
              <Card
                className={cn(
                  "lift flex h-full flex-col",
                  featured && "ring-accent shadow-overlay ring-2",
                )}
              >
                <CardContent className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
                    {featured ? <Badge variant="accent">mais indicada</Badge> : null}
                    {unlimitedSeats ? <Badge variant="primary">ilimitado</Badge> : null}
                  </div>

                  <p className="text-muted-foreground mt-1 text-sm leading-snug">{plan.tagline}</p>

                  {/*
                    O número interpola do valor anterior ao trocar de ciclo.
                    Contando do zero — que é o que `AnimatedNumber` faz —, cada
                    clique no alternador faria os quatro preços piscarem até o
                    novo valor, e piscar é lido como recarregamento.
                  */}
                  {/*
                    Duas correções moram aqui, e as duas vinham desta seção.

                    A primeira: a decomposição "R$ 149 de assinatura + 2 × R$ 79"
                    saiu. A palavra assinatura nomeia a parcela fixa da edição num
                    vocabulário interno, e a primeira reação de quem lê é perguntar
                    o que é aquilo além do que já vai pagar — abrir a conta cobrava
                    explicação em vez de dar confiança.

                    A segunda: a edição sem preço público mostra "sob medida". O
                    Corporativo anunciava um piso menor que o custo estimado de
                    servir a franquia que ele promete.
                  */}
                  {plan.priceOnRequest ? (
                    <>
                      <p className="mt-4 flex items-baseline gap-1">
                        <span className="text-muted-foreground text-xs">investimento</span>
                      </p>
                      <p className="flex items-baseline gap-1">
                        <span className="font-display text-3xl font-semibold">sob medida</span>
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs leading-snug">
                        Dimensionado por operação, com colaboradores ilimitados
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-4 flex items-baseline gap-1">
                        <span className="text-muted-foreground text-xs">a partir de</span>
                      </p>
                      <p className="flex items-baseline gap-1">
                        <RollingNumber
                          value={startingPriceCents(plan.key, billing)}
                          format={formatCurrencyCents}
                          className="figure text-3xl font-semibold"
                        />
                        <span className="text-muted-foreground text-sm">/ mês</span>
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs leading-snug">
                        {`Inclui ${plan.minSeats} ${plan.minSeats === 1 ? "pessoa" : "pessoas"}; cada pessoa a mais, ${formatCurrencyCents(plan.seatPriceCents)}/mês`}
                      </p>
                    </>
                  )}

                  <ul className="border-border mt-4 space-y-2 border-t pt-4">
                    {[
                      { icon: Users, text: `${formatNumber(plan.includedContacts)} contatos` },
                      {
                        icon: MessagesSquare,
                        text: `${formatNumber(plan.includedConversations)} conversas / mês`,
                      },
                      {
                        icon: Database,
                        text: `${formatNumber(plan.includedAiReplies)} respostas de IA / mês`,
                      },
                    ].map((item) => (
                      <li key={item.text} className="flex items-center gap-2.5">
                        <item.icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                        <span className="text-xs">{item.text}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="border-border mt-4 border-t pt-4">
                    <p className="text-xs font-medium">{plan.highlights[0]}</p>
                    <ul className="mt-2 space-y-1.5">
                      {plan.highlights.slice(1).map((item) => (
                        <li key={item} className="flex gap-2 text-xs leading-snug">
                          <span className="bg-accent-soft mt-px grid size-4 shrink-0 place-content-center rounded-full">
                            <Check className="text-accent-ink size-2.5" aria-hidden />
                          </span>
                          <span className="text-muted-foreground">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/*
                    A lista do que a edição **não** faz tem o mesmo peso da lista
                    de recursos, e é a diferença mais importante em relação ao
                    componente de referência. Descobrir na segunda semana que a
                    edição contratada não tem jornada custa mais caro para os
                    dois lados do que perder a venda hoje.
                  */}
                  <ul className="mt-3 space-y-1.5">
                    {plan.limits.map((item) => (
                      <li
                        key={item}
                        className="text-muted-foreground/80 flex gap-2 text-xs leading-snug"
                      >
                        <Minus className="mt-0.5 size-3 shrink-0" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-5">
                    <Button asChild variant={featured ? "accent" : "outline"} className="w-full">
                      <Link href={`/orcamento?plano=${plan.key}`}>
                        Pedir proposta
                        <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          );
        })}
      </div>

      <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
        Fora da assinatura: o que a Meta cobra por mensagem, repassado sem margem —{" "}
        <span className="figure">
          {formatRateMicros(WHATSAPP_PRICE_BY_CATEGORY.marketing.metaCostMicros)}
        </span>{" "}
        em marketing e{" "}
        <span className="figure">
          {formatRateMicros(WHATSAPP_PRICE_BY_CATEGORY.utilidade.metaCostMicros)}
        </span>{" "}
        em utilidade. Responder dentro da janela de 24 h é grátis.{" "}
        <Link href="/precos" className="text-primary underline underline-offset-4">
          Ver a tabela completa, linha a linha
        </Link>
        .
      </p>
    </div>
  );
}
