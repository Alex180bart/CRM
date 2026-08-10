"use client";

import { useMemo, useState } from "react";
import type { PlanKey, QuoteInput } from "@elora/core";
import {
  CURRENT_META_RATES,
  DEFAULT_QUOTE_INPUT,
  MARGIN_BY_PLAN,
  META_RATE_TABLES,
  PLANS,
  UNIT_COSTS,
  WHATSAPP_PRICES,
  calculateQuote,
  formatCurrencyCents,
  maxDiscountKeepingMargin,
  offsetIso,
  rateStaleness,
} from "@elora/core";
import { Badge, Button, Callout, Eyebrow, Reveal, cn } from "@elora/ui";
import { AlertTriangle, Info, ShieldAlert, TrendingUp } from "lucide-react";

/**
 * Precificação — a visão que **não** pode aparecer no site.
 *
 * `/precos` e `/orcamento` são páginas públicas. Custo unitário, margem alvo e
 * colchão de desconto são a estrutura de custo da empresa: publicá-los entrega
 * ao concorrente a régua dele e ao cliente o argumento de que "sobra muito".
 * Por isso esta tela vive na Administração, e o simulador público continua
 * mostrando só o preço.
 *
 * **O motor é o mesmo nos dois.** `calculateQuote` calcula preço e margem na
 * mesma passada; a diferença é apenas o que cada tela desenha. Dois cálculos
 * separados divergiriam no primeiro ajuste de tabela, e a divergência apareceria
 * como "o vendedor prometeu uma margem que o financeiro não reconhece".
 *
 * ## O número que importa não é a margem — é o quanto ainda dá para descontar
 *
 * Margem é diagnóstico; `discountAtFloorPct` é decisão. É a resposta para a
 * única pergunta que o vendedor faz na mesa, e é por isso que ela aparece em
 * corpo grande, e a margem, ao lado, em corpo menor.
 */

const CURRENCY = (cents: number) => formatCurrencyCents(cents);

function pct(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

export function PricingTab() {
  const [planKey, setPlanKey] = useState<PlanKey>("profissional");
  const [discountPct, setDiscountPct] = useState(0);
  const [seats, setSeats] = useState(DEFAULT_QUOTE_INPUT.seats);
  const [contacts, setContacts] = useState(DEFAULT_QUOTE_INPUT.contacts);
  const [conversations, setConversations] = useState(DEFAULT_QUOTE_INPUT.conversations);

  const input: QuoteInput = useMemo(
    () => ({
      ...DEFAULT_QUOTE_INPUT,
      planKey,
      seats,
      contacts,
      conversations,
      discountPct,
      includeSetup: true,
    }),
    [planKey, seats, contacts, conversations, discountPct],
  );

  const quote = useMemo(() => calculateQuote(input), [input]);
  const policy = MARGIN_BY_PLAN[planKey];
  const margin = quote.margin;
  const staleness = rateStaleness(CURRENT_META_RATES, offsetIso({}));

  return (
    <div className="space-y-4">
      <Reveal index={0}>
        <Callout variant="warning" icon={<ShieldAlert className="size-4" />}>
          <strong>Interno.</strong> Custo de servir, margem e colchão não aparecem em{" "}
          <code className="font-mono">/precos</code> nem em{" "}
          <code className="font-mono">/orcamento</code>, que são páginas abertas. Os números abaixo
          são estimativa de ordem de grandeza — não há telemetria de custo real enquanto não houver
          back-end.
        </Callout>
      </Reveal>

      {/* --------------------------------------------------------- Simulação */}
      <Reveal index={1}>
        <section className="panel space-y-4 p-5">
          <div>
            <Eyebrow>Simulação</Eyebrow>
            <h3 className="mt-1 text-base font-semibold">Margem desta venda</h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {PLANS.map((plan) => (
              <Button
                key={plan.key}
                size="sm"
                variant={plan.key === planKey ? "primary" : "outline"}
                className="press"
                onClick={() => setPlanKey(plan.key)}
              >
                {plan.name}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Slider label="Pessoas" value={seats} min={1} max={200} onChange={setSeats} />
            <Slider
              label="Contatos"
              value={contacts}
              min={0}
              max={200_000}
              step={1_000}
              onChange={setContacts}
            />
            <Slider
              label="Conversas / mês"
              value={conversations}
              min={0}
              max={80_000}
              step={500}
              onChange={setConversations}
            />
            <Slider
              label="Desconto"
              value={discountPct}
              min={0}
              max={40}
              suffix="%"
              onChange={setDiscountPct}
            />
          </div>

          {/* O número de decisão vem primeiro e maior. */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Figure
              tone={margin.status}
              label="Ainda dá para descontar"
              value={pct(Math.max(0, margin.discountAtFloorPct - discountPct))}
              hint={`Até o piso de ${policy.floorMarginPct}% desta edição`}
              large
            />
            <Figure
              tone={margin.status}
              label="Margem realizada"
              value={pct(margin.marginPct)}
              hint={`Alvo ${policy.targetMarginPct}% · piso ${policy.floorMarginPct}%`}
            />
            <Figure
              tone={margin.cushionUsedPct >= 100 ? "atencao" : "saudavel"}
              label="Colchão consumido"
              value={pct(Math.min(100, margin.cushionUsedPct))}
              hint={`Colchão de ${policy.discountCushionPct}% absorve ${pct(maxDiscountKeepingMargin(policy.discountCushionPct))} de desconto`}
            />
          </div>

          {margin.status !== "saudavel" ? (
            <Callout
              variant={margin.status === "prejuizo" ? "danger" : "warning"}
              icon={<AlertTriangle className="size-4" />}
            >
              {margin.status === "prejuizo"
                ? "Neste desconto a assinatura não cobre o custo de servir esta operação."
                : `Margem abaixo do piso da edição. Esta venda precisa de aprovação.`}
            </Callout>
          ) : null}

          <Callout icon={<Info className="size-4" />}>
            O repasse da Meta ({CURRENCY(quote.passthroughCents)}) fica fora desta conta. Ele é
            custo e receita pelo mesmo valor — somá-lo aos dois lados não muda o lucro em reais e
            derruba a margem percentual, fazendo uma operação com muito WhatsApp parecer menos
            rentável que uma idêntica sem.
          </Callout>
        </section>
      </Reveal>

      {/* ------------------------------------------------------------ Custo */}
      <Reveal index={2}>
        <section className="panel space-y-3 p-5">
          <div className="flex items-baseline justify-between">
            <div>
              <Eyebrow>Custo de servir</Eyebrow>
              <h3 className="mt-1 text-base font-semibold">Por mês, nesta operação</h3>
            </div>
            <p className="figure text-lg font-semibold">{CURRENCY(quote.cost.totalCents)}</p>
          </div>

          <ul className="divide-border divide-y">
            {quote.cost.lines.map((line) => {
              const share = quote.cost.totalCents > 0 ? line.totalCents / quote.cost.totalCents : 0;
              return (
                <li key={line.key} className="py-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm">{line.label}</span>
                    <span className="figure shrink-0 text-sm tabular-nums">
                      {CURRENCY(line.totalCents)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">{line.detail}</p>
                  <div className="bg-muted mt-1 h-1 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full transition-[width] duration-300"
                      style={{ width: `${Math.max(1, share * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="text-muted-foreground text-xs leading-relaxed">
            Custo unitário atual: {CURRENCY(UNIT_COSTS.perAccountCents)} por conta,{" "}
            {CURRENCY(UNIT_COSTS.perSeatCents)} por pessoa,{" "}
            {CURRENCY(UNIT_COSTS.perThousandAiRepliesCents)} por mil respostas de IA. O de IA é o
            mais volátil — muda a cada troca de modelo na fila do Gateway.
          </p>
        </section>
      </Reveal>

      {/* ------------------------------------------------------ Implantação */}
      {quote.setup ? (
        <Reveal index={3}>
          <section className="panel space-y-3 p-5">
            <div className="flex items-baseline justify-between">
              <div>
                <Eyebrow>Cobrança única</Eyebrow>
                <h3 className="mt-1 text-base font-semibold">Composição da implantação</h3>
              </div>
              <p className="figure text-lg font-semibold">{CURRENCY(quote.setup.totalCents)}</p>
            </div>

            <ul className="divide-border divide-y">
              {quote.setup.lines.map((line) => (
                <li key={line.key} className="flex items-baseline justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm">
                      {line.label}
                      {line.quantity > 1 ? (
                        <span className="text-muted-foreground"> × {line.quantity}</span>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground text-xs">{line.detail}</p>
                  </div>
                  <span className="figure shrink-0 text-sm tabular-nums">
                    {CURRENCY(line.totalCents)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      ) : null}

      {/* ------------------------------------------------------- Tabela Meta */}
      <Reveal index={4}>
        <section className="panel space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Eyebrow>Repasse</Eyebrow>
              <h3 className="mt-1 text-base font-semibold">Tabela da Meta</h3>
            </div>
            <Badge
              variant={
                staleness.status === "atual"
                  ? "success"
                  : staleness.status === "revisar"
                    ? "warning"
                    : "danger"
              }
            >
              {staleness.message}
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-left text-xs">
                  <th className="pb-2 font-medium">Categoria</th>
                  <th className="pb-2 text-right font-medium">Vigente</th>
                  {META_RATE_TABLES.slice(1).map((table) => (
                    <th key={table.effectiveFrom} className="pb-2 text-right font-medium">
                      {table.effectiveFrom.split("-").reverse().join("/")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {WHATSAPP_PRICES.map((price) => (
                  <tr key={price.category}>
                    <td className="py-2">
                      <p className="font-medium">{price.label}</p>
                      <p className="text-muted-foreground text-xs">{price.description}</p>
                    </td>
                    <td className="figure py-2 text-right tabular-nums">
                      {CURRENCY(price.metaCostCents)}
                    </td>
                    {META_RATE_TABLES.slice(1).map((table) => (
                      <td
                        key={table.effectiveFrom}
                        className="text-muted-foreground py-2 text-right tabular-nums"
                      >
                        {CURRENCY(table.ratesCents[price.category])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Callout icon={<TrendingUp className="size-4" />}>
            <strong>Não existe API pública de tabela de preços da Meta.</strong> O que há é a página
            de rate card e o <code className="font-mono">conversation_analytics</code>, que responde
            quanto uma conta já gastou — não serve para cotar venda nova. Raspar a página pareceria
            tempo real e falharia em silêncio, cotando com o preço da última leitura. Por isso a
            tabela é dado versionado, com a data em que passou a valer visível acima. O histórico
            fica para que orçamento antigo continue explicável.
          </Callout>
        </section>
      </Reveal>
    </div>
  );
}

/* Apoios ----------------------------------------------------------------------- */

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="figure text-sm tabular-nums">
          {value.toLocaleString("pt-BR")}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={Math.min(value, max)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-accent mt-2 w-full"
      />
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  tone,
  large,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "saudavel" | "atencao" | "prejuizo";
  large?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg p-3",
        tone === "prejuizo"
          ? "bg-destructive-soft"
          : tone === "atencao"
            ? "bg-warning-soft"
            : "bg-success-soft",
      )}
    >
      <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className={cn("figure font-semibold", large ? "text-3xl" : "text-xl")}>{value}</p>
      <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">{hint}</p>
    </div>
  );
}
