import Link from "next/link";
import { PLANS, formatCurrencyCents, formatNumber, startingPriceCents } from "@elora/core";
import { Badge, Button, Card, CardContent, cn } from "@elora/ui";
import { ArrowRight, Check, Minus } from "lucide-react";

/**
 * Os cartões de edição.
 *
 * ## "A partir de" é o mínimo real, não o preço da assinatura
 *
 * O número mostrado soma a assinatura da plataforma com o **mínimo de assentos**
 * da edição, porque é impossível contratar a edição por menos que isso. Anunciar
 * só a assinatura produziria a decepção previsível: o cliente chega ao simulador
 * e o valor pula antes de ele mexer em qualquer coisa.
 *
 * ## O cartão diz o que a edição não faz
 *
 * A lista de limites tem o mesmo peso visual da lista de recursos. Descobrir na
 * segunda semana que a edição contratada não tem jornada custa mais caro para os
 * dois lados do que perder a venda hoje.
 */

/**
 * A edição em destaque.
 *
 * O selo diz "mais indicada", e não "mais contratada": não há base instalada
 * para sustentar a segunda frase, e prova social inventada é a única coisa numa
 * página de preço que continua valendo contra quem escreveu depois da venda.
 */
const HIGHLIGHT: string = "profissional";

export function PlanCards({ compact = false }: { compact?: boolean }) {
  return (
    /*
      No celular as quatro edições viram trilho, e no desktop voltam a ser grade.

      Empilhadas, elas somam mais de dois mil pixels de rolagem para uma
      comparação que exige lembrar do cartão anterior — o mesmo defeito que a
      seção de preço da landing page já resolveu assim. Cada cartão ocupa 82% da
      largura para o seguinte aparecer pela borda, que é a única affordance que
      diz "há mais para o lado".
    */
    <div className="rail rail-snap -mx-4 gap-4 px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
      {PLANS.map((plan) => {
        const featured = plan.key === HIGHLIGHT;

        return (
          <Card
            key={plan.key}
            className={cn(
              // `w-[82%] shrink-0` só vale dentro do trilho; a partir de `lg` o
              // item volta a ser célula de grade e a largura é a da coluna.
              "lift flex h-full w-[82%] shrink-0 flex-col lg:w-auto lg:shrink",
              featured && "ring-accent shadow-overlay ring-2",
            )}
          >
            <CardContent className="flex flex-1 flex-col p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                {featured ? <Badge variant="accent">mais indicada</Badge> : null}
                {plan.seatPriceCents === 0 ? <Badge variant="primary">ilimitado</Badge> : null}
              </div>

              <p className="text-muted-foreground mt-1 text-sm leading-snug">{plan.tagline}</p>

              {/*
                A edição sem preço público mostra "sob medida", não um piso.

                O Corporativo anunciava "a partir de R$ 3.900" — e o custo estimado
                de servir a franquia que ele promete passa esse valor. Um piso que a
                operação não honra é pior que nenhum piso: ele ancora a negociação
                num número que dá prejuízo, e quem sobe dele parece estar cobrando
                a mais.
              */}
              {plan.priceOnRequest ? (
                <p className="mt-4">
                  <span className="text-muted-foreground text-xs">investimento</span>
                  <br />
                  <span className="font-display text-3xl font-semibold">sob medida</span>
                </p>
              ) : (
                <p className="mt-4">
                  <span className="text-muted-foreground text-xs">a partir de</span>
                  <br />
                  <span className="figure text-3xl font-semibold">
                    {formatCurrencyCents(startingPriceCents(plan.key))}
                  </span>
                  <span className="text-muted-foreground text-sm"> / mês</span>
                </p>
              )}
              {/*
                A decomposição saiu, e a razão é o que ela provocava.

                O cartão dizia "R$ 149 de assinatura + 2 × R$ 79 por pessoa/mês",
                e a palavra **assinatura** não significa nada para quem chega: ela
                nomeia a parcela fixa da edição num vocabulário interno, e a
                primeira pergunta de quem lê passou a ser "o que é essa
                assinatura, além do que já estou pagando?". Abrir a conta era para
                dar confiança e cobrava explicação — o oposto.

                O que ficou responde à pergunta que o cliente realmente faz: quantas
                pessoas estão inclusas nesse valor, e o que mais entra na fatura.
              */}
              <p className="text-muted-foreground mt-1 text-xs leading-snug">
                {plan.priceOnRequest
                  ? "Dimensionado por operação, com colaboradores ilimitados"
                  : `Inclui ${plan.minSeats} ${plan.minSeats === 1 ? "pessoa" : "pessoas"}; cada pessoa a mais, ${formatCurrencyCents(plan.seatPriceCents)}/mês`}
              </p>
              <p className="text-muted-foreground/80 mt-1 text-[11px] leading-snug">
                Implantação sob medida, orçada por operação. À parte, o que a Meta cobra por
                mensagem — repassado sem margem.
              </p>

              <dl className="border-border mt-4 space-y-1.5 border-t pt-4 text-xs">
                {[
                  ["Contatos", formatNumber(plan.includedContacts)],
                  ["Conversas / mês", formatNumber(plan.includedConversations)],
                  ["Mensagens de modelo / mês", formatNumber(plan.includedWhatsappTemplates)],
                  ["E-mails / mês", formatNumber(plan.includedEmails)],
                  ["Respostas de IA / mês", formatNumber(plan.includedAiReplies)],
                  ["Números de WhatsApp", formatNumber(plan.includedWhatsappNumbers)],
                  [
                    "Colaboradores",
                    plan.maxSeats === null ? "ilimitados" : `${plan.minSeats} a ${plan.maxSeats}`,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="figure font-medium">{value}</dd>
                  </div>
                ))}
              </dl>

              {compact ? null : (
                <>
                  <ul className="mt-4 space-y-1.5">
                    {plan.highlights.map((item) => (
                      <li key={item} className="flex gap-2 text-xs leading-snug">
                        <Check className="text-success mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <ul className="mt-3 space-y-1.5">
                    {plan.limits.map((item) => (
                      <li
                        key={item}
                        className="text-muted-foreground flex gap-2 text-xs leading-snug"
                      >
                        <Minus className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="mt-auto pt-5">
                <Button asChild variant={featured ? "primary" : "outline"} className="w-full">
                  <Link href={`/orcamento?plano=${plan.key}`}>
                    Pedir proposta
                    <ArrowRight />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
