"use client";

import * as React from "react";
import {
  ADDONS,
  DEFAULT_QUOTE_INPUT,
  DEFAULT_SETUP_INPUT,
  MAX_SELF_SERVICE_DISCOUNT_PCT,
  MONTHLY_PREMIUM_PCT,
  PLANS,
  PLAN_BY_KEY,
  WHATSAPP_PRICES,
  calculateQuote,
  formatCurrencyCents,
  formatRateMicros,
  recommendPlan,
  type AddonKey,
  type PlanKey,
  type QuoteInput,
  type QuoteLine,
  type WhatsappCategory,
} from "@elora/core";
import { Badge, Callout, Card, CardContent, Switch, cn } from "@elora/ui";
import { AlertTriangle, Info, Lightbulb, Users } from "lucide-react";

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
const units = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

/**
 * Faixas de faturamento, e não campo aberto.
 *
 * Ninguém do outro lado da mesa sabe o faturamento exato da empresa dele de
 * cabeça, e um campo aberto pede exatamente isso — o resultado é o vendedor
 * chutando um número redondo que cai na faixa errada. A faixa é o que ele sabe
 * responder, e é tudo que o cálculo precisa.
 *
 * Os cortes acompanham os de `COMPANY_SIZE_BANDS`: cada opção é um valor
 * representativo **dentro** da faixa, não o teto dela — o teto na fronteira
 * enquadraria por um centavo de diferença.
 */
const REVENUE_OPTIONS = [
  { value: 20_000_000, label: "Até R$ 360 mil" },
  { value: 300_000_000, label: "R$ 360 mil a R$ 4,8 mi" },
  { value: 2_000_000_000, label: "R$ 4,8 mi a R$ 30 mi" },
  { value: 20_000_000_000, label: "R$ 30 mi a R$ 300 mi" },
  { value: 50_000_000_000, label: "Acima de R$ 300 mi" },
];

interface FieldProps {
  label: string;
  hint?: string;
  /**
   * A franquia da edição e o preço de quem passa dela.
   *
   * Existe porque a versão anterior só anotava preço nos campos de WhatsApp: em
   * "Respostas geradas por IA por mês" não havia valor nenhum, e o campo parecia
   * ser só um dimensionador sem custo. Num simulador de preço, campo sem preço é
   * lido como campo grátis — e a linha correspondente só aparecia lá embaixo, no
   * resultado, depois que a pessoa já tinha escolhido o número.
   */
  price?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function NumberField({ label, hint, price, value, min, max, step, suffix, onChange }: FieldProps) {
  const id = React.useId();

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="min-w-0 text-sm font-medium">
          {label}
          {price ? (
            <span className="text-accent-ink block text-[11px] font-normal leading-tight">
              {price}
            </span>
          ) : null}
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

/**
 * Campo compacto da implantação.
 *
 * Sem faixa deslizante, ao contrário dos campos de volume acima. A diferença não
 * é estética: volume é exploração — a pessoa arrasta procurando o ponto em que a
 * edição vira. Quantidade de integração é um número que ela **já sabe**, e
 * oferecer uma faixa para escolher entre 0 e 10 transforma um dado conhecido num
 * gesto de mira.
 */
function SetupField({
  label,
  value,
  min,
  max,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  hint?: string;
  onChange: (value: number) => void;
}) {
  const id = React.useId();

  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="min-w-0 text-xs">
        {label}
        {hint ? <span className="text-muted-foreground block text-[11px]">{hint}</span> : null}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) =>
          onChange(Math.min(max, Math.max(min, Number(event.target.value) || 0)))
        }
        className="border-input bg-surface focus-visible:ring-ring figure h-8 w-24 shrink-0 rounded-md border px-2 text-right text-sm focus-visible:outline-none focus-visible:ring-2"
      />
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

  /**
   * Dimensionamento da implantação, com o padrão quando ausente.
   *
   * `QuoteInput.setup` é opcional para não quebrar quem monta a entrada sem ele
   * — a URL do orçamento, por exemplo, que é montada em outro lugar. Resolver o
   * padrão aqui, e não em cada campo, evita o `?? DEFAULT` repetido cinco vezes
   * e a divergência que aparece quando alguém esquece um.
   */
  const setup = input.setup ?? DEFAULT_SETUP_INPUT;

  const patchSetup = React.useCallback((value: Partial<typeof DEFAULT_SETUP_INPUT>) => {
    setInput((current) => ({
      ...current,
      setup: { ...(current.setup ?? DEFAULT_SETUP_INPUT), ...value },
    }));
  }, []);

  const plan = PLAN_BY_KEY[input.planKey];
  const result = React.useMemo(() => calculateQuote(input), [input]);
  const suggestion = React.useMemo(() => recommendPlan(input), [input]);
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
            price={
              plan.seatPriceCents === 0
                ? "Sem cobrança por assento nesta edição"
                : `${CURRENCY(plan.seatPriceCents)} por pessoa/mês · mínimo de ${plan.minSeats}`
            }
            hint={
              plan.seatPriceCents === 0
                ? "Nesta edição o assento não é cobrado — cadastre a operação inteira."
                : `A edição ${plan.name} vai de ${plan.minSeats} a ${plan.maxSeats} pessoas.`
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
            price={`${units(plan.includedContacts)} inclusos · depois ${CURRENCY(plan.contactTiers[0]!.pricePerThousandCents)} por mil, em faixas progressivas`}
            hint="Contatos ativos, não histórico arquivado. Cada fatia paga o preço da própria faixa."
            value={input.contacts}
            min={0}
            max={500_000}
            step={1_000}
            suffix="contatos"
            onChange={(value) => patch({ contacts: value })}
          />

          <NumberField
            label="Conversas tratadas por mês"
            price={`${units(plan.includedConversations)} inclusas · depois ${formatCurrencyCents(plan.conversationOverageCents, true)} cada`}
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
            price={`${units(plan.includedEmails)} inclusos · depois ${CURRENCY(plan.emailOveragePerThousandCents)} por mil`}
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
            price={`${units(plan.includedAiReplies)} inclusas · depois ${CURRENCY(plan.aiOveragePerThousandCents)} por mil`}
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
            Cada mensagem de modelo tem dois preços: o que a Meta cobra, repassado sem margem, e a
            taxa de envio da plataforma, que só aparece acima das{" "}
            {new Intl.NumberFormat("pt-BR").format(plan.includedWhatsappTemplates)} inclusas nesta
            edição. Resposta dentro da janela de 24 h é gratuita nos dois — em atendimento, costuma
            ser a maior fatia.
          </p>

          {/*
            A tarifa aparece com quatro casas porque é assim que a Meta publica.
            Com o formatador de moeda padrão, `R$ 0,0350` virava `R$ 0` e o
            simulador dava a impressão de não cobrar WhatsApp nenhum — que é
            exatamente o defeito que este bloco existia para não ter.
          */}
          <div className="mt-3 space-y-4">
            {WHATSAPP_PRICES.map((price) => (
              <NumberField
                key={price.category}
                label={price.label}
                price={
                  price.metaCostMicros === 0
                    ? "Não é cobrada — nem pela Meta, nem por nós"
                    : `${formatRateMicros(price.metaCostMicros)} de repasse da Meta + ${formatRateMicros(plan.whatsappTemplateFeeMicros)} de taxa da plataforma acima da franquia`
                }
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

            {/**
             * Implantação deixou de ser um número fixo por edição.
             *
             * Enquanto era, este bloco mostrava `plan.setupCents` — e passou a
             * mentir no instante em que o valor virou composição. O texto agora
             * sai de `result.setup`, que é o mesmo objeto que compõe a fatura:
             * não há como a explicação divergir do total.
             *
             * Os controles só aparecem com a implantação ligada. Cinco campos
             * permanentemente visíveis num painel que já tem doze afundariam o
             * que importa — e quem não vai contratar implantação não precisa
             * responder quantas integrações tem.
             */}
            <div className="border-border bg-surface rounded-xl border p-3">
              <div className="flex items-start gap-3">
                <Switch
                  checked={input.includeSetup}
                  onCheckedChange={(checked) => patch({ includeSetup: checked })}
                  aria-label="Implantação assistida"
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Implantação assistida</p>
                  <p className="text-muted-foreground text-xs leading-snug">
                    Configuração com o time, treinamento e migração da base, até o primeiro mês em
                    produção.
                  </p>
                  {result.setup ? (
                    <p className="text-accent-ink mt-1 text-xs font-medium">
                      {CURRENCY(result.setup.totalCents)} — cobrança única, em{" "}
                      {result.setup.lines.length} parcela(s)
                    </p>
                  ) : (
                    <p className="text-muted-foreground mt-1 text-xs">
                      A partir de {CURRENCY(PLAN_BY_KEY[input.planKey].setupCents)}
                    </p>
                  )}
                </div>
              </div>

              {input.includeSetup ? (
                <div className="border-border mt-3 space-y-3 border-t pt-3">
                  {/*
                    O porte vem primeiro, e não junto das parcelas técnicas.

                    As parcelas contam o que se instala; o porte conta o que se
                    negocia — comitê, homologação em janela, parecer jurídico.
                    Eram esses os projetos que estouravam hora sem ninguém saber
                    explicar por quê, e agora eles têm campo e linha.
                  */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="faturamento" className="min-w-0 text-xs">
                        Faturamento anual
                        <span className="text-muted-foreground block text-[11px]">
                          Da empresa do cliente
                        </span>
                      </label>
                      <select
                        id="faturamento"
                        value={setup.annualRevenueCents}
                        onChange={(event) =>
                          patchSetup({ annualRevenueCents: Number(event.target.value) })
                        }
                        className="border-input bg-surface focus-visible:ring-ring h-8 w-36 shrink-0 rounded-md border px-2 text-xs focus-visible:outline-none focus-visible:ring-2"
                      >
                        {REVENUE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <SetupField
                      label="Colaboradores da empresa"
                      hint="Total, não só o time de atendimento"
                      value={setup.employees}
                      min={1}
                      max={20_000}
                      onChange={(value) => patchSetup({ employees: value })}
                    />
                    <SetupField
                      label="Unidades, filiais ou CNPJs"
                      value={setup.businessUnits}
                      min={1}
                      max={200}
                      onChange={(value) => patchSetup({ businessUnits: value })}
                    />

                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="regulado" className="min-w-0 text-xs">
                        Setor regulado
                        <span className="text-muted-foreground block text-[11px]">
                          Saúde, financeiro ou jurídico
                        </span>
                      </label>
                      <Switch
                        id="regulado"
                        checked={setup.regulatedSector}
                        onCheckedChange={(checked) => patchSetup({ regulatedSector: checked })}
                        aria-label="Setor regulado"
                      />
                    </div>
                  </div>

                  {result.setup ? (
                    <p className="text-muted-foreground border-border border-t pt-3 text-[11px] leading-snug">
                      Enquadrada como <strong>{result.setup.size.band.label}</strong>
                      {result.setup.size.drivenBy === "ambos"
                        ? " por faturamento e por colaboradores"
                        : ` por ${result.setup.size.drivenBy}`}
                      . {result.setup.size.band.rationale}
                    </p>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <SetupField
                      label="Números de WhatsApp"
                      value={setup.whatsappNumbers}
                      min={1}
                      max={20}
                      onChange={(value) => patchSetup({ whatsappNumbers: value })}
                    />
                    <SetupField
                      label="Sistemas a integrar"
                      value={setup.integrations}
                      min={0}
                      max={10}
                      onChange={(value) => patchSetup({ integrations: value })}
                    />
                    <SetupField
                      label="Pessoas a treinar"
                      value={setup.peopleToTrain}
                      min={0}
                      max={300}
                      onChange={(value) => patchSetup({ peopleToTrain: value })}
                      hint={
                        result.setup && result.setup.trainingGroups > 0
                          ? `${result.setup.trainingGroups} turma(s) de até 12`
                          : undefined
                      }
                    />
                    <SetupField
                      label="Fluxos desenhados junto"
                      value={setup.flows}
                      min={0}
                      max={20}
                      onChange={(value) => patchSetup({ flows: value })}
                    />
                  </div>

                  {result.setup ? (
                    <ul className="divide-border divide-y text-xs">
                      {result.setup.lines.map((line) => (
                        <li
                          key={line.key}
                          className="flex items-baseline justify-between gap-3 py-1.5"
                        >
                          <span className="min-w-0 truncate">
                            {line.label}
                            {line.quantity > 1 ? (
                              <span className="text-muted-foreground"> × {line.quantity}</span>
                            ) : null}
                          </span>
                          <span className="figure shrink-0 tabular-nums">
                            {CURRENCY(line.totalCents)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
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
              {/*
                Repasse e taxa de envio ficam lado a lado porque a pergunta na
                reunião é comparativa: "quanto disso é da Meta e quanto é de
                vocês?". Num número só, a resposta seria uma conta de cabeça
                feita na frente do cliente.
              */}
              <div className="glass-card p-2.5">
                <dt className="text-primary-foreground/60 text-[10px] uppercase leading-tight">
                  Repasse Meta
                </dt>
                <dd className="figure mt-0.5 text-sm font-semibold">
                  {CURRENCY(result.passthroughCents)}
                </dd>
              </div>
            </dl>

            <dl className="glass-card mt-2 flex items-baseline justify-between gap-2 p-2.5">
              <dt className="text-primary-foreground/60 text-[10px] uppercase leading-tight">
                Taxa de envio da plataforma
              </dt>
              <dd className="figure text-sm font-semibold">
                {result.whatsappPlatformFeeCents > 0
                  ? CURRENCY(result.whatsappPlatformFeeCents)
                  : `${new Intl.NumberFormat("pt-BR").format(result.whatsappTemplateMessages)} de ${new Intl.NumberFormat("pt-BR").format(plan.includedWhatsappTemplates)} inclusas`}
              </dd>
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

            {/*
              Não há botão de "solicitar orçamento" aqui, e a ausência é
              consequência de onde esta tela passou a viver.

              O simulador é da área comercial: quem o opera é quem emite a
              proposta. Um botão que leva ao formulário público faria o vendedor
              pedir orçamento a si mesmo — e, pior, criaria um pedido com o nome
              dele na fila que ele próprio atende.
            */}
            <p className="text-muted-foreground mt-5 flex items-start gap-1.5 text-xs leading-snug">
              <Users className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Valores de referência para dimensionamento. A proposta final considera prazo de
              contrato, migração e integrações.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
