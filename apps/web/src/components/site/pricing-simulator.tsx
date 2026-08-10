"use client";

import Link from "next/link";
import * as React from "react";
import {
  ADDONS,
  DEFAULT_QUOTE_INPUT,
  MAX_SELF_SERVICE_DISCOUNT_PCT,
  MONTHLY_PREMIUM_PCT,
  PLANS,
  PLAN_BY_KEY,
  WHATSAPP_PRICES,
  calculateQuote,
  formatCurrencyCents,
  recommendPlan,
  type AddonKey,
  type PlanKey,
  type QuoteInput,
  type QuoteLine,
  type WhatsappCategory,
} from "@elora/core";
import { Badge, Button, Callout, Card, CardContent, Switch, cn } from "@elora/ui";
import { AlertTriangle, ArrowRight, Info, Lightbulb, Users } from "lucide-react";

import { serializeQuoteInput } from "@/lib/site/quote-params";

/**
 * Simulador de custo.
 *
 * ## O cálculo roda no navegador, e isso é decisão de produto
 *
 * `calculateQuote` é função pura sem dependência de ambiente, então poderia
 * rodar nos dois lados. Roda aqui porque o simulador é uma ferramenta de
 * exploração: a pessoa arrasta o volume de conversas para cima e para baixo umas
 * vinte vezes procurando o ponto em que a edição vira. Cada ida ao servidor
 * acrescentaria latência a um gesto que precisa ser instantâneo, e a conta é
 * barata demais para justificar a viagem.
 *
 * O pedido de orçamento **recalcula no servidor** — ver `actions.ts`. Aceitar o
 * total que o navegador enviou permitiria pedir proposta de R$ 1.
 *
 * ## Por que campo numérico e faixa juntos
 *
 * A faixa dá a exploração; o campo dá a precisão. Só faixa impede alguém de
 * digitar os 47.312 contatos que ele tem de verdade; só campo transforma
 * "quanto muda se eu dobrar?" em três tentativas de digitação. Os dois
 * compartilham o mesmo estado, então nunca divergem.
 */

const CURRENCY = (cents: number) => formatCurrencyCents(cents);

interface FieldProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function NumberField({ label, hint, value, min, max, step, suffix, onChange }: FieldProps) {
  const id = React.useId();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <div className="flex items-baseline gap-1">
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            value={value}
            onChange={(event) => onChange(Math.max(min, Number(event.target.value) || 0))}
            className="border-input bg-surface focus-visible:ring-ring figure h-8 w-28 rounded-md border px-2 text-right text-sm focus-visible:outline-none focus-visible:ring-2"
          />
          {suffix ? <span className="text-muted-foreground text-xs">{suffix}</span> : null}
        </div>
      </div>

      <input
        type="range"
        aria-label={`${label} — controle deslizante`}
        min={min}
        max={max}
        step={step}
        value={Math.min(value, max)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-accent mt-2 w-full"
      />

      {hint ? <p className="text-muted-foreground mt-1 text-xs leading-snug">{hint}</p> : null}
    </div>
  );
}

function LineRow({ line, maxCents }: { line: QuoteLine; maxCents: number }) {
  const share = maxCents > 0 ? Math.max(0.02, line.totalCents / maxCents) : 0;

  return (
    <li className="py-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium">{line.label}</span>
        <span
          className={cn(
            "figure shrink-0 text-sm",
            line.included ? "text-muted-foreground" : "font-semibold",
          )}
        >
          {line.included && line.totalCents === 0 ? "incluído" : CURRENCY(line.totalCents)}
        </span>
      </div>
      <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{line.detail}</p>
      <div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full">
        <div
          className={cn(
            "bar-grow h-full rounded-full",
            line.kind === "repasse"
              ? "bg-info"
              : line.kind === "unico"
                ? "bg-muted-foreground"
                : "bg-accent",
          )}
          style={{ transform: `scaleX(${share})`, width: "100%" }}
        />
      </div>
    </li>
  );
}

export function PricingSimulator({ initial }: { initial?: QuoteInput }) {
  const [input, setInput] = React.useState<QuoteInput>(initial ?? DEFAULT_QUOTE_INPUT);

  const patch = React.useCallback((value: Partial<QuoteInput>) => {
    setInput((current) => ({ ...current, ...value }));
  }, []);

  const patchWhatsapp = React.useCallback((category: WhatsappCategory, value: number) => {
    setInput((current) => ({ ...current, whatsapp: { ...current.whatsapp, [category]: value } }));
  }, []);

  const toggleAddon = React.useCallback((key: AddonKey, on: boolean) => {
    setInput((current) => ({
      ...current,
      addons: on
        ? [...current.addons.filter((addon) => addon.key !== key), { key, quantity: 1 }]
        : current.addons.filter((addon) => addon.key !== key),
    }));
  }, []);

  const setAddonQuantity = React.useCallback((key: AddonKey, quantity: number) => {
    setInput((current) => ({
      ...current,
      addons: current.addons.map((addon) =>
        addon.key === key ? { ...addon, quantity: Math.max(1, quantity) } : addon,
      ),
    }));
  }, []);

  const result = React.useMemo(() => calculateQuote(input), [input]);
  const suggestion = React.useMemo(() => recommendPlan(input), [input]);
  const quoteHref = `/orcamento?${serializeQuoteInput(input)}`;

  const maxLineCents = Math.max(...result.lines.map((line) => line.totalCents), 1);
  const recurringLines = result.lines.filter((line) => line.kind !== "unico");
  const oneTimeLines = result.lines.filter((line) => line.kind === "unico");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
      {/* Entradas ------------------------------------------------------------ */}
      {/*
        `min-w-0` não é enfeite: item de grade nasce com `min-width: auto`, então
        o campo numérico de largura fixa e os rótulos longos empurravam a coluna
        para 401 px dentro de uma tela de 390 — e o texto era cortado no celular
        sem que a página rolasse na horizontal, que é o defeito mais fácil de não
        ver numa captura de tela larga.
      */}
      <div className="min-w-0 space-y-6">
        <div>
          <h3 className="font-display text-base font-semibold">1. Escolha a edição</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Ou dimensione primeiro e deixe o simulador apontar a mais barata para o seu caso.
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {PLANS.map((plan) => {
              const active = plan.key === input.planKey;
              return (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() => patch({ planKey: plan.key })}
                  aria-pressed={active}
                  className={cn(
                    "press rounded-xl border p-3 text-left transition-colors",
                    active
                      ? "border-accent bg-accent-soft"
                      : "border-border bg-surface hover:border-muted-foreground/40",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{plan.name}</span>
                    {plan.seatPriceCents === 0 ? (
                      <Badge variant="accent" size="sm">
                        ilimitado
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs leading-snug">
                    {plan.tagline}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-border bg-surface mt-3 flex items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <p className="text-sm font-medium">Compromisso anual</p>
              <p className="text-muted-foreground text-xs">
                Sem fidelidade, a assinatura e os assentos custam {MONTHLY_PREMIUM_PCT}% a mais.
              </p>
            </div>
            <Switch
              checked={input.billing === "anual"}
              onCheckedChange={(checked) => patch({ billing: checked ? "anual" : "mensal" })}
              aria-label="Alternar compromisso anual"
            />
          </div>
        </div>

        <div className="space-y-5">
          <h3 className="font-display text-base font-semibold">2. Dimensione a operação</h3>

          <NumberField
            label="Colaboradores com acesso"
            hint={
              PLAN_BY_KEY[input.planKey].seatPriceCents === 0
                ? "Nesta edição o assento não é cobrado — cadastre a operação inteira."
                : `A edição ${PLAN_BY_KEY[input.planKey].name} vai de ${PLAN_BY_KEY[input.planKey].minSeats} a ${PLAN_BY_KEY[input.planKey].maxSeats} pessoas.`
            }
            value={input.seats}
            min={1}
            max={300}
            step={1}
            suffix="pessoas"
            onChange={(value) => patch({ seats: value })}
          />

          <NumberField
            label="Contatos na base"
            hint="Contatos ativos, não histórico arquivado. A cobrança extra é progressiva por faixa."
            value={input.contacts}
            min={0}
            max={500_000}
            step={1_000}
            suffix="contatos"
            onChange={(value) => patch({ contacts: value })}
          />

          <NumberField
            label="Conversas tratadas por mês"
            hint="Uma conversa é um atendimento, não uma mensagem — some todos os canais."
            value={input.conversations}
            min={0}
            max={200_000}
            step={500}
            suffix="/ mês"
            onChange={(value) => patch({ conversations: value })}
          />

          <NumberField
            label="E-mails enviados por mês"
            hint="Campanha e transacional somados."
            value={input.emails}
            min={0}
            max={1_000_000}
            step={5_000}
            suffix="/ mês"
            onChange={(value) => patch({ emails: value })}
          />

          <NumberField
            label="Respostas geradas por IA por mês"
            hint="Copiloto do atendente, agente autônomo e redação de e-mail."
            value={input.aiReplies}
            min={0}
            max={200_000}
            step={500}
            suffix="/ mês"
            onChange={(value) => patch({ aiReplies: value })}
          />
        </div>

        <div>
          <h3 className="font-display text-base font-semibold">3. Mensagens de WhatsApp</h3>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            A Meta cobra por mensagem, por categoria, e nós repassamos sem margem. Resposta dentro
            da janela de 24 h aberta pelo cliente é gratuita — em atendimento, costuma ser a maior
            fatia.
          </p>

          <div className="mt-3 space-y-4">
            {WHATSAPP_PRICES.map((price) => (
              <NumberField
                key={price.category}
                label={`${price.label} — ${price.metaCostCents === 0 ? "grátis" : `${CURRENCY(price.metaCostCents)} / msg`}`}
                hint={price.description}
                value={input.whatsapp[price.category]}
                min={0}
                max={200_000}
                step={500}
                suffix="/ mês"
                onChange={(value) => patchWhatsapp(price.category, value)}
              />
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-display text-base font-semibold">4. Complementos</h3>
          <div className="mt-3 space-y-2">
            {ADDONS.map((addon) => {
              const selected = input.addons.find((item) => item.key === addon.key);
              const included = PLAN_BY_KEY[input.planKey].includedAddons.includes(addon.key);
              const blocked = addon.unavailableFor?.includes(input.planKey) ?? false;

              return (
                <div
                  key={addon.key}
                  className={cn(
                    "border-border bg-surface flex items-start gap-3 rounded-xl border p-3",
                    blocked && "opacity-55",
                  )}
                >
                  <Switch
                    checked={included || Boolean(selected)}
                    disabled={included || blocked}
                    onCheckedChange={(checked) => toggleAddon(addon.key, checked)}
                    aria-label={addon.name}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{addon.name}</p>
                    <p className="text-muted-foreground text-xs leading-snug">
                      {addon.description}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {included
                        ? `Incluído na edição ${PLAN_BY_KEY[input.planKey].name}`
                        : blocked
                          ? "Indisponível nesta edição"
                          : `${CURRENCY(addon.priceCents)}${addon.oneTime ? " — cobrança única" : " / mês"}`}
                    </p>
                  </div>

                  {addon.quantifiable && selected && !included ? (
                    <input
                      type="number"
                      min={1}
                      value={selected.quantity}
                      onChange={(event) =>
                        setAddonQuantity(addon.key, Number(event.target.value) || 1)
                      }
                      aria-label={`Quantidade de ${addon.name}`}
                      className="border-input bg-surface figure h-8 w-16 shrink-0 rounded-md border px-2 text-right text-sm"
                    />
                  ) : null}
                </div>
              );
            })}

            <div className="border-border bg-surface flex items-start gap-3 rounded-xl border p-3">
              <Switch
                checked={input.includeSetup}
                onCheckedChange={(checked) => patch({ includeSetup: checked })}
                aria-label="Implantação assistida"
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Implantação assistida</p>
                <p className="text-muted-foreground text-xs leading-snug">
                  Filas, canais, catálogo e a primeira automação configurados com o time, até o
                  primeiro mês em produção.
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {CURRENCY(PLAN_BY_KEY[input.planKey].setupCents)} — cobrança única
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resultado ------------------------------------------------------------ */}
      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <Card className="overflow-hidden">
          <div className="brand-surface text-primary-foreground p-5">
            <p className="text-primary-foreground/60 text-[11px] uppercase tracking-wide">
              Edição {result.plan.name} · {result.billing === "anual" ? "anual" : "mensal"}
            </p>
            <p className="figure mt-1 text-4xl font-semibold">
              {CURRENCY(result.monthlyTotalCents)}
              <span className="text-primary-foreground/60 ml-1 text-base font-normal">/ mês</span>
            </p>
            <p className="text-primary-foreground/70 mt-1 text-sm">
              {CURRENCY(result.annualTotalCents)} em doze meses
              {result.oneTimeCents > 0
                ? ` · ${CURRENCY(result.firstInvoiceCents)} na primeira fatura`
                : ""}
            </p>

            <dl className="mt-4 grid grid-cols-3 gap-2">
              <div className="glass-card p-2.5">
                <dt className="text-primary-foreground/60 text-[10px] uppercase leading-tight">
                  Por pessoa
                </dt>
                <dd className="figure mt-0.5 text-sm font-semibold">
                  {CURRENCY(result.costPerSeatCents)}
                </dd>
              </div>
              <div className="glass-card p-2.5">
                <dt className="text-primary-foreground/60 text-[10px] uppercase leading-tight">
                  Por conversa
                </dt>
                <dd className="figure mt-0.5 text-sm font-semibold">
                  {result.costPerConversationCents > 0
                    ? formatCurrencyCents(result.costPerConversationCents, true)
                    : "—"}
                </dd>
              </div>
              <div className="glass-card p-2.5">
                <dt className="text-primary-foreground/60 text-[10px] uppercase leading-tight">
                  Repasse Meta
                </dt>
                <dd className="figure mt-0.5 text-sm font-semibold">
                  {CURRENCY(result.passthroughCents)}
                </dd>
              </div>
            </dl>
          </div>

          <CardContent className="p-5">
            {result.warnings.map((warning) => (
              <Callout
                key={warning.message}
                variant={
                  warning.severity === "erro"
                    ? "danger"
                    : warning.severity === "alerta"
                      ? "warning"
                      : "neutral"
                }
                icon={warning.severity === "informacao" ? <Info /> : <AlertTriangle />}
                className="mb-3"
              >
                {warning.message}
              </Callout>
            ))}

            {suggestion.planKey !== input.planKey && suggestion.savingsAgainstCurrentCents > 0 ? (
              <Callout variant="info" icon={<Lightbulb />} className="mb-3">
                Com este dimensionamento, a edição{" "}
                <strong>{PLAN_BY_KEY[suggestion.planKey].name}</strong> sai{" "}
                {CURRENCY(suggestion.savingsAgainstCurrentCents)} por mês mais barata.{" "}
                <button
                  type="button"
                  className="text-primary font-medium underline underline-offset-4"
                  onClick={() => patch({ planKey: suggestion.planKey as PlanKey })}
                >
                  Trocar para ela
                </button>
              </Callout>
            ) : null}

            <ul className="divide-border divide-y">
              {recurringLines.map((line) => (
                <LineRow key={line.key} line={line} maxCents={maxLineCents} />
              ))}
            </ul>

            <div className="border-border mt-4 space-y-1.5 border-t pt-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Recorrente mensal</span>
                <span className="figure">{CURRENCY(result.monthlySubtotalCents)}</span>
              </div>

              {result.discountCents > 0 ? (
                <div className="text-success flex items-baseline justify-between text-sm">
                  <span>Desconto comercial ({result.discountPct}%)</span>
                  <span className="figure">− {CURRENCY(result.discountCents)}</span>
                </div>
              ) : null}

              {oneTimeLines.length > 0 ? (
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Cobrança única</span>
                  <span className="figure">{CURRENCY(result.oneTimeCents)}</span>
                </div>
              ) : null}

              <div className="flex items-baseline justify-between pt-1.5 text-base font-semibold">
                <span>Primeira fatura</span>
                <span className="figure">{CURRENCY(result.firstInvoiceCents)}</span>
              </div>
            </div>

            <div className="border-border mt-4 border-t pt-4">
              <label htmlFor="desconto" className="text-sm font-medium">
                Desconto comercial
              </label>
              <div className="mt-2 flex items-center gap-3">
                <input
                  id="desconto"
                  type="range"
                  min={0}
                  max={MAX_SELF_SERVICE_DISCOUNT_PCT}
                  step={1}
                  value={input.discountPct}
                  onChange={(event) => patch({ discountPct: Number(event.target.value) })}
                  className="accent-accent flex-1"
                />
                <span className="figure w-12 text-right text-sm">{input.discountPct}%</span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs leading-snug">
                Até {MAX_SELF_SERVICE_DISCOUNT_PCT}% sem aprovação. O desconto não incide sobre o
                repasse da Meta — descontar o que o provedor cobra sairia do nosso bolso a cada
                mensagem.
              </p>
            </div>

            <Button asChild size="lg" className="mt-5 w-full">
              <Link href={quoteHref}>
                Solicitar orçamento com este cenário
                <ArrowRight />
              </Link>
            </Button>

            <p className="text-muted-foreground mt-3 flex items-start gap-1.5 text-xs leading-snug">
              <Users className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Valores de referência para dimensionamento. A proposta final é emitida pelo time
              comercial e considera prazo de contrato, migração e integrações.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
