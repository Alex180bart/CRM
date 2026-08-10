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

const HIGHLIGHT: string = "profissional";

export function PlanCards({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      {PLANS.map((plan) => {
        const featured = plan.key === HIGHLIGHT;

        return (
          <Card
            key={plan.key}
            className={cn(
              "lift flex h-full flex-col",
              featured && "ring-accent shadow-overlay ring-2",
            )}
          >
            <CardContent className="flex flex-1 flex-col p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                {featured ? <Badge variant="accent">mais contratada</Badge> : null}
                {plan.seatPriceCents === 0 ? <Badge variant="primary">ilimitado</Badge> : null}
              </div>

              <p className="text-muted-foreground mt-1 text-sm leading-snug">{plan.tagline}</p>

              <p className="mt-4">
                <span className="text-muted-foreground text-xs">a partir de</span>
                <br />
                <span className="figure text-3xl font-semibold">
                  {formatCurrencyCents(startingPriceCents(plan.key))}
                </span>
                <span className="text-muted-foreground text-sm"> / mês</span>
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-snug">
                {plan.seatPriceCents === 0
                  ? "Assinatura fechada, colaboradores ilimitados"
                  : `Assinatura + ${plan.minSeats} assentos · ${formatCurrencyCents(plan.seatPriceCents)} por pessoa/mês`}
              </p>

              <dl className="border-border mt-4 space-y-1.5 border-t pt-4 text-xs">
                {[
                  ["Contatos", formatNumber(plan.includedContacts)],
                  ["Conversas / mês", formatNumber(plan.includedConversations)],
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
