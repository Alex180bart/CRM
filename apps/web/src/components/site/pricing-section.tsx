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

export function PricingSection() {
  const [billing, setBilling] = React.useState<BillingCycle>("anual");

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

      <div className="mt-8 grid gap-4 lg:grid-cols-4">
        {PLANS.map((plan, index) => {
          const featured = plan.key === "profissional";
          const unlimitedSeats = plan.seatPriceCents === 0;

          return (
            <Reveal key={plan.key} index={index + 1}>
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
                    {unlimitedSeats
                      ? "Assinatura fechada, colaboradores ilimitados"
                      : `${formatCurrencyCents(plan.platformFeeCents)} de assinatura + ${plan.minSeats} × ${formatCurrencyCents(plan.seatPriceCents)} por pessoa/mês`}
                  </p>

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
                    <Button
                      asChild
                      variant={featured ? "accent" : "outline"}
                      className="w-full"
                    >
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
