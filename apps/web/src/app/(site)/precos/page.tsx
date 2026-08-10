import type { Metadata } from "next";
import Link from "next/link";
import {
  ADDONS,
  PLANS,
  WHATSAPP_PRICES,
  formatCurrencyCents,
  formatNumber,
} from "@elora/core";
import { Button, Card, CardContent, Reveal } from "@elora/ui";
import { ArrowRight } from "lucide-react";

import { Faq } from "@/components/site/faq";
import { PlanCards } from "@/components/site/plan-cards";

export const metadata: Metadata = {
  title: "Preços",
  description:
    "Edições, franquias, preço por excedente e o repasse da Meta — a tabela inteira, aberta, " +
    "antes de falar com vendedor.",
};

/**
 * Página de preços.
 *
 * A tabela de excedente vem depois dos cartões, e não escondida atrás de um
 * "consulte-nos". O preço do excedente é o que decide a conta de quem cresce, e
 * é exatamente o número que costuma aparecer só na terceira fatura.
 *
 * ## Por que não há simulador aqui
 *
 * Havia, e ele passou a viver só na área comercial (`/admin`). A tabela continua
 * pública e completa — o que saiu foi a **calculadora**, não a informação. A
 * diferença importa: uma tabela aberta com o dimensionamento feito junto com o
 * cliente é o oposto de um "consulte-nos", que esconde os números.
 */
export default async function PrecosPage() {
  return (
    <>
      <section className="bg-primary text-primary-foreground aurora">
        <div className="mx-auto w-full max-w-6xl px-5 py-16 md:py-20">
          <Reveal index={0}>
            <h1 className="font-display max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Preço em dois eixos: quantas pessoas usam e quanto a operação consome.
            </h1>
            <p className="text-primary-foreground/75 mt-4 max-w-2xl text-base leading-relaxed">
              Assinatura da plataforma, assento e consumo medido — separados, para que o
              crescimento de um não pague pelo do outro. O que o provedor cobra viaja como repasse,
              sem margem e em linha própria.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-16">
        <PlanCards />
      </section>

      {/* Excedente ---------------------------------------------------------- */}
      <section className="bg-surface-sunken py-16">
        <div className="mx-auto w-full max-w-6xl px-5">
          <Reveal index={0}>
            <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              O que custa passar da franquia
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
              Contato é cobrado em faixas <strong>progressivas</strong>: cada fatia paga o preço da
              própria faixa. Aplicar o preço da faixa final ao total produziria o salto em que
              cadastrar mil contatos a mais reduz a fatura.
            </p>
          </Reveal>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-border border-b text-left">
                  <th className="py-2.5 pr-4 font-semibold">Edição</th>
                  <th className="py-2.5 pr-4 font-semibold">Contato extra (por mil)</th>
                  <th className="py-2.5 pr-4 font-semibold">Conversa extra</th>
                  <th className="py-2.5 pr-4 font-semibold">E-mail extra (por mil)</th>
                  <th className="py-2.5 pr-4 font-semibold">Resposta de IA (por mil)</th>
                  <th className="py-2.5 font-semibold">Implantação</th>
                </tr>
              </thead>
              <tbody>
                {PLANS.map((plan) => (
                  <tr key={plan.key} className="border-border border-b">
                    <td className="py-3 pr-4 font-medium">{plan.name}</td>
                    <td className="figure py-3 pr-4">
                      {plan.contactTiers
                        .map((tier) => formatCurrencyCents(tier.pricePerThousandCents))
                        .join(" → ")}
                    </td>
                    <td className="figure py-3 pr-4">
                      {formatCurrencyCents(plan.conversationOverageCents)}
                    </td>
                    <td className="figure py-3 pr-4">
                      {formatCurrencyCents(plan.emailOveragePerThousandCents)}
                    </td>
                    <td className="figure py-3 pr-4">
                      {formatCurrencyCents(plan.aiOveragePerThousandCents)}
                    </td>
                    <td className="figure py-3">{formatCurrencyCents(plan.setupCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-muted-foreground mt-3 text-xs">
            A seta indica a progressão entre faixas — a franquia da edição vale até o teto declarado,
            e o excedente cai na faixa seguinte, pelo preço dela.
          </p>

          {/* WhatsApp */}
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <h3 className="font-display text-base font-semibold">Repasse do WhatsApp</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  Valores cobrados pela Meta, referência de agosto de 2026 para o Brasil. Repassados
                  sem margem — o desconto comercial não incide sobre eles.
                </p>
                <ul className="divide-border mt-4 divide-y">
                  {WHATSAPP_PRICES.map((price) => (
                    <li key={price.category} className="flex items-baseline justify-between gap-4 py-2.5">
                      <span>
                        <span className="text-sm font-medium">{price.label}</span>
                        <span className="text-muted-foreground block text-xs leading-snug">
                          {price.description}
                        </span>
                      </span>
                      <span className="figure shrink-0 text-sm font-semibold">
                        {price.metaCostCents === 0
                          ? "grátis"
                          : `${formatCurrencyCents(price.metaCostCents)} / msg`}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="font-display text-base font-semibold">Complementos</h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  Contratáveis por edição. Alguns já vêm inclusos nas edições superiores.
                </p>
                <ul className="divide-border mt-4 divide-y">
                  {ADDONS.map((addon) => (
                    <li key={addon.key} className="flex items-baseline justify-between gap-4 py-2.5">
                      <span>
                        <span className="text-sm font-medium">{addon.name}</span>
                        <span className="text-muted-foreground block text-xs leading-snug">
                          {addon.description}
                        </span>
                      </span>
                      <span className="figure shrink-0 text-sm font-semibold">
                        {formatCurrencyCents(addon.priceCents)}
                        <span className="text-muted-foreground block text-[10px] font-normal">
                          {addon.oneTime ? "única" : "/ mês"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Franquias comparadas */}
          <div className="mt-12 overflow-x-auto">
            <h3 className="font-display text-base font-semibold">O que está incluído</h3>
            <table className="mt-4 w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-border border-b text-left">
                  <th className="py-2.5 pr-4 font-semibold">Incluído por mês</th>
                  {PLANS.map((plan) => (
                    <th key={plan.key} className="py-2.5 pr-4 font-semibold">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Contatos", (p: (typeof PLANS)[number]) => formatNumber(p.includedContacts)],
                    ["Conversas", (p: (typeof PLANS)[number]) => formatNumber(p.includedConversations)],
                    ["E-mails", (p: (typeof PLANS)[number]) => formatNumber(p.includedEmails)],
                    ["Respostas de IA", (p: (typeof PLANS)[number]) => formatNumber(p.includedAiReplies)],
                    [
                      "Números de WhatsApp",
                      (p: (typeof PLANS)[number]) => formatNumber(p.includedWhatsappNumbers),
                    ],
                    [
                      "Colaboradores",
                      (p: (typeof PLANS)[number]) =>
                        p.maxSeats === null ? "ilimitados" : `${p.minSeats} a ${p.maxSeats}`,
                    ],
                  ] as const
                ).map(([label, render]) => (
                  <tr key={label} className="border-border border-b">
                    <td className="text-muted-foreground py-3 pr-4">{label}</td>
                    {PLANS.map((plan) => (
                      <td key={plan.key} className="figure py-3 pr-4">
                        {render(plan)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Conta do seu caso ----------------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-5 py-16">
        <Reveal index={0}>
          <Card>
            <CardContent className="p-8 md:p-10">
              <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                A conta do seu caso, feita com você
              </h2>
              <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
                Tudo o que entra no preço está nesta página: assinatura, assento, franquia, preço do
                excedente e o repasse da Meta linha a linha. O que falta é o seu volume — e aí a
                conversa vale mais que um formulário, porque metade das operações descobre no meio
                dela que precisa de menos do que imaginava.
              </p>
              <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
                O time comercial monta o cenário com os seus números na primeira ligação e manda a
                planilha aberta, com cada linha separada. Resposta em até um dia útil.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button asChild size="lg" variant="accent">
                  <Link href="/orcamento">
                    Solicitar proposta
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/cadastrar">Criar conta e acompanhar</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </section>

      <section id="faq" className="bg-surface-sunken scroll-mt-20 py-16">
        <div className="mx-auto w-full max-w-4xl px-5">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Dúvidas de preço</h2>
          <div className="mt-6">
            <Faq />
          </div>
          <p className="text-muted-foreground mt-8 text-sm">
            Ficou algo de fora?{" "}
            <Link href="/orcamento" className="text-primary font-medium underline underline-offset-4">
              Peça um orçamento
            </Link>{" "}
            e escreva a pergunta no campo aberto — ela vai junto com o cenário.
          </p>
        </div>
      </section>
    </>
  );
}
