"use client";

import { useMemo, useState } from "react";
import type { PlanKey, QuoteInput } from "@elora/core";
import {
  CURRENT_META_RATES,
  DEFAULT_QUOTE_INPUT,
  DEFAULT_TAX_CONTEXT,
  FATOR_R_THRESHOLD_PCT,
  MARGIN_BY_PLAN,
  META_RATE_TABLES,
  PLANS,
  PLAN_BY_KEY,
  REGIME_LABEL,
  UNIT_COSTS,
  WHATSAPP_PRICES,
  calculateQuote,
  effectiveRate,
  fatorRPct,
  formatCurrencyCents,
  formatRateMicros,
  maxDiscountKeepingMargin,
  offsetIso,
  passthroughTaxDrag,
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
  const [rbt12Cents, setRbt12Cents] = useState(DEFAULT_TAX_CONTEXT.rbt12Cents);
  const [payrollCents, setPayrollCents] = useState(DEFAULT_TAX_CONTEXT.payroll12Cents);

  const input: QuoteInput = useMemo(
    () => ({
      ...DEFAULT_QUOTE_INPUT,
      planKey,
      seats,
      contacts,
      conversations,
      discountPct,
      includeSetup: true,
      taxContext: { rbt12Cents, payroll12Cents: payrollCents },
    }),
    [planKey, seats, contacts, conversations, discountPct, rbt12Cents, payrollCents],
  );

  const quote = useMemo(() => calculateQuote(input), [input]);
  const plan = PLAN_BY_KEY[planKey];
  const policy = MARGIN_BY_PLAN[planKey];
  const margin = quote.margin;
  const staleness = rateStaleness(CURRENT_META_RATES, offsetIso({}));

  const fator = fatorRPct(payrollCents, rbt12Cents);
  const rate = effectiveRate(rbt12Cents, quote.taxRegime);
  const dragCents = passthroughTaxDrag(quote.passthroughCents, rate.effectiveRatePct);

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
            <br />
            <strong>A taxa de envio da plataforma entra</strong> (
            {CURRENCY(quote.whatsappPlatformFeeCents)}, sobre{" "}
            {quote.whatsappTemplateMessages.toLocaleString("pt-BR")} mensagens de modelo): aquilo é
            preço nosso sobre custo nosso, e é justamente a margem que o repasse não tem. É por isso
            que as duas viajam em linhas separadas desde o cálculo — somadas, não haveria como tirar
            uma da margem sem tirar a outra.
          </Callout>
        </section>
      </Reveal>

      {/* ---------------------------------------------------------- Imposto */}
      <Reveal index={2}>
        <section className="panel space-y-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <Eyebrow>Imposto</Eyebrow>
              <h3 className="mt-1 text-base font-semibold">{REGIME_LABEL[quote.taxRegime]}</h3>
            </div>
            <p className="figure text-lg font-semibold">{CURRENCY(quote.tax.taxCents)} / mês</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Slider
              label="Receita acumulada (RBT12)"
              value={Math.round(rbt12Cents / 100_000)}
              min={1}
              max={5_000}
              step={50}
              suffix=" mil"
              onChange={(value) => setRbt12Cents(value * 100_000)}
            />
            <Slider
              label="Folha acumulada (12 meses)"
              value={Math.round(payrollCents / 100_000)}
              min={0}
              max={2_000}
              step={25}
              suffix=" mil"
              onChange={(value) => setPayrollCents(value * 100_000)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Figure
              tone={fator >= FATOR_R_THRESHOLD_PCT ? "saudavel" : "atencao"}
              label="Fator R"
              value={pct(fator)}
              hint={
                fator >= FATOR_R_THRESHOLD_PCT
                  ? `Acima de ${FATOR_R_THRESHOLD_PCT}% — Anexo III`
                  : `Abaixo de ${FATOR_R_THRESHOLD_PCT}% — cai no Anexo V`
              }
            />
            <Figure
              tone="saudavel"
              label="Alíquota efetiva"
              value={pct(quote.tax.effectiveRatePct)}
              hint={`Nominal ${pct(rate.nominalRatePct)} menos a parcela a deduzir`}
            />
            <Figure
              tone={dragCents >= 100_000 ? "atencao" : "saudavel"}
              label="Imposto sobre o repasse"
              value={CURRENCY(dragCents)}
              hint="Por ano, sobre dinheiro que não é nosso"
            />
          </div>

          {rate.issOutsideDasPct > 0 ? (
            <Callout variant="warning" icon={<AlertTriangle className="size-4" />}>
              <strong>Sexta faixa: o ISS saiu do DAS.</strong> O DAS caiu para{" "}
              {pct(rate.dasRatePct)} e parece que crescer barateou o imposto — não barateou. O ISS
              de {pct(rate.issOutsideDasPct)} passou a ser recolhido à parte, e a carga total é de{" "}
              {pct(rate.effectiveRatePct)}. A alíquota de ISS varia entre 2% e 5% conforme o
              município; a régua aqui usa o teto.
            </Callout>
          ) : null}

          <Callout variant="warning" icon={<ShieldAlert className="size-4" />}>
            <strong>O Simples tributa faturamento, não lucro.</strong> Cada real de repasse da Meta
            que passa pela nossa nota paga imposto sem gerar margem — e ainda empurra a RBT12 para
            cima, elevando a alíquota de toda a receita. Neste cenário isso custa{" "}
            {CURRENCY(dragCents)} por ano. As duas saídas conhecidas são a conta da Meta ficar no
            nome do cliente ou o imposto ser embutido na taxa de envio da plataforma.
          </Callout>

          <p className="text-muted-foreground text-xs leading-relaxed">
            O preço de tabela é com imposto embutido: o valor anunciado é o que sai na fatura, e o
            imposto sai de dentro dele. A transição da reforma não está modelada — em 2026 o
            optante pelo Simples recolhe IBS e CBS dentro do DAS, e a alíquota-teste de 1% não muda
            o que ele paga. O que muda de verdade é a opção de recolher por fora para gerar crédito
            cheio ao cliente em Lucro Real, e isso é decisão de nota, não de cálculo.
          </p>
        </section>
      </Reveal>

      {/* ------------------------------------------------------------ Custo */}
      <Reveal index={3}>
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
        <Reveal index={4}>
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
      <Reveal index={5}>
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
                  <th className="pb-2 text-right font-medium">Meta cobra</th>
                  <th className="pb-2 text-right font-medium">Nossa taxa ({plan.name})</th>
                  <th className="pb-2 text-right font-medium">Cliente paga</th>
                  {META_RATE_TABLES.slice(1).map((table) => (
                    <th key={table.effectiveFrom} className="pb-2 text-right font-medium">
                      {table.effectiveFrom.split("-").reverse().join("/")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {WHATSAPP_PRICES.map((price) => {
                  const fee = price.billableTemplate ? plan.whatsappTemplateFeeMicros : 0;
                  return (
                    <tr key={price.category}>
                      <td className="py-2">
                        <p className="font-medium">{price.label}</p>
                        <p className="text-muted-foreground text-xs">{price.description}</p>
                      </td>
                      <td className="figure py-2 text-right tabular-nums">
                        {formatRateMicros(price.metaCostMicros)}
                      </td>
                      <td className="figure py-2 text-right tabular-nums">
                        {fee === 0 ? "—" : formatRateMicros(fee)}
                      </td>
                      <td className="figure py-2 text-right font-semibold tabular-nums">
                        {formatRateMicros(price.metaCostMicros + fee)}
                      </td>
                      {META_RATE_TABLES.slice(1).map((table) => (
                        <td
                          key={table.effectiveFrom}
                          className="text-muted-foreground py-2 text-right tabular-nums"
                        >
                          {formatRateMicros(table.ratesMicros[price.category])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-muted-foreground text-xs leading-relaxed">
            Acima da franquia de {plan.includedWhatsappTemplates.toLocaleString("pt-BR")} mensagens
            de modelo desta edição. Dentro dela, a coluna do meio é zero e o cliente paga só o
            repasse. Utilidade e autenticação ainda têm a escada de volume da própria Meta, que
            reduz a primeira coluna a partir de 250 mil e 500 mil mensagens por mês.
          </p>

          <Callout icon={<TrendingUp className="size-4" />}>
            <strong>Não existe API pública de tabela de preços da Meta.</strong> O que há é a página
            de rate card — cujos valores só aparecem depois de escolher mercado e moeda num seletor
            que roda no navegador — e o <code className="font-mono">conversation_analytics</code>,
            que responde quanto uma conta já gastou e não serve para cotar venda nova. Raspar
            pareceria tempo real e falharia em silêncio, cotando com o preço da última leitura. Por
            isso a tabela é dado versionado, com a data em que passou a valer e a data em que alguém
            conferiu, as duas visíveis acima.
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
