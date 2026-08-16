import type { Metadata } from "next";
import Link from "next/link";
import {
  ADDONS,
  PLANS,
  WHATSAPP_PRICES,
  formatCurrencyCents,
  formatNumber,
  formatRateMicros,
} from "@elora/core";
import { Button, Card, CardContent, Reveal } from "@elora/ui";
import { ArrowRight } from "lucide-react";

import { Faq } from "@/components/site/faq";
import { PlanCards } from "@/components/site/plan-cards";
import { RichLine, RichText } from "@/components/site/rich-text";
import { readSiteContent } from "@/lib/site/content-store";

export async function generateMetadata(): Promise<Metadata> {
  const { pricing } = await readSiteContent();
  return { title: pricing.meta.title, description: pricing.meta.description };
}

/**
 * Página de preços.
 *
 * A tabela de excedente vem depois dos cartões, e não escondida atrás de um
 * "consulte-nos". O preço do excedente é o que decide a conta de quem cresce, e
 * é exatamente o número que costuma aparecer só na terceira fatura.
 *
 * ## O texto é editável; os números, não
 *
 * Título, chamada e nota de rodapé vêm do conteúdo editável. As sete tabelas
 * continuam sendo geradas a partir de `PLANS`, `ADDONS` e `WHATSAPP_PRICES` —
 * duplicar um preço num campo de texto criaria a divergência que aparece na pior
 * hora: o site anunciando um valor que a proposta não confirma. Onde o texto
 * precisa citar um número, ele usa marcador (`{vigencia}`), resolvido contra o
 * catálogo na renderização.
 *
 * ## Por que não há simulador aqui
 *
 * Havia, e ele passou a viver só na área comercial (`/admin`). A tabela continua
 * pública e completa — o que saiu foi a **calculadora**, não a informação. A
 * diferença importa: uma tabela aberta com o dimensionamento feito junto com o
 * cliente é o oposto de um "consulte-nos", que esconde os números.
 */
export default async function PrecosPage() {
  const content = await readSiteContent();
  const { pricing } = content;

  return (
    <>
      <section className="bg-primary text-primary-foreground aurora">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-5 md:py-20">
          <Reveal index={0}>
            <h1 className="font-display max-w-3xl text-[2rem] font-semibold leading-[1.14] tracking-tight sm:text-4xl sm:leading-tight md:text-5xl">
              <RichLine>{pricing.hero.title}</RichLine>
            </h1>
            <RichText className="text-primary-foreground/75 mt-4 max-w-2xl text-base leading-relaxed">
              {pricing.hero.subtitle}
            </RichText>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-5 md:py-16">
        <PlanCards />
      </section>

      {/* Excedente ---------------------------------------------------------- */}
      <section className="bg-surface-sunken py-12 md:py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-5">
          <Reveal index={0}>
            <h2 className="font-display text-[1.55rem] font-semibold leading-tight tracking-tight sm:text-2xl md:text-3xl">
              <RichLine>{pricing.overage.title}</RichLine>
            </h2>
            <RichText className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
              {pricing.overage.body}
            </RichText>
          </Reveal>

          {/*
            A coluna de implantação saiu da tabela.

            Implantação é a linha que mais varia entre dois clientes do mesmo
            porte — depende de quantos canais, de quanta base a migrar e de quanto
            processo existe para desenhar. Publicá-la como número fixo ao lado do
            excedente fazia o oposto do que uma tabela de preço deve fazer: fixava
            a expectativa no menor valor possível e transformava a proposta real
            numa negociação para justificar a diferença.

            O excedente continua publicado, porque ele é o contrário — não varia,
            e é o número que decide a conta de quem cresce.
          */}

          {/* Celular: um cartão por edição. Ver a nota da grade abaixo. */}
          <div className="mt-8 space-y-3 md:hidden">
            {PLANS.map((plan) => (
              <Card key={plan.key}>
                <CardContent className="p-4">
                  <h3 className="font-display text-base font-semibold">{plan.name}</h3>
                  <dl className="divide-border mt-2 divide-y text-sm">
                    {(
                      [
                        [
                          "Contato extra (por mil)",
                          plan.contactTiers
                            .map((tier) => formatCurrencyCents(tier.pricePerThousandCents))
                            .join(" → "),
                        ],
                        ["Conversa extra", formatCurrencyCents(plan.conversationOverageCents)],
                        [
                          "E-mail extra (por mil)",
                          formatCurrencyCents(plan.emailOveragePerThousandCents),
                        ],
                        [
                          "Resposta de IA (por mil)",
                          formatCurrencyCents(plan.aiOveragePerThousandCents),
                        ],
                        [
                          "Envio de WhatsApp (por msg)",
                          formatRateMicros(plan.whatsappTemplateFeeMicros),
                        ],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between gap-3 py-2">
                        <dt className="text-muted-foreground text-xs leading-snug">{label}</dt>
                        <dd className="figure shrink-0 text-sm font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>

          {/*
            Tabela só a partir de `md`.

            Seis colunas de número não cabem em 390 px — a versão anterior tinha
            `min-w-[720px]` e resolvia com rolagem lateral dentro do bloco, que no
            celular esconde metade dos preços atrás de um gesto que ninguém
            descobre. Comparar edições é o trabalho desta seção, e comparação que
            exige arrastar não acontece.
          */}
          <div className="mt-8 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-border border-b text-left">
                  <th className="py-2.5 pr-4 font-semibold">Edição</th>
                  <th className="py-2.5 pr-4 font-semibold">Contato extra (por mil)</th>
                  <th className="py-2.5 pr-4 font-semibold">Conversa extra</th>
                  <th className="py-2.5 pr-4 font-semibold">E-mail extra (por mil)</th>
                  <th className="py-2.5 pr-4 font-semibold">Resposta de IA (por mil)</th>
                  <th className="py-2.5 font-semibold">Envio de WhatsApp (por msg)</th>
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
                    <td className="figure py-3">
                      {formatRateMicros(plan.whatsappTemplateFeeMicros)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <RichText className="text-muted-foreground mt-3 text-xs">
            {pricing.overage.footnote}
          </RichText>

          {/* WhatsApp */}
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {/*
              Duas colunas de preço, e não uma soma.

              O cliente recebe fatura da Meta e fatura nossa. Publicar só o total
              deixaria ele sem como conferir nem uma nem outra — e a primeira
              conclusão de quem não consegue conferir é que está pagando a mais.
            */}
            <Card>
              <CardContent className="p-5">
                <h3 className="font-display text-base font-semibold">
                  <RichLine>{pricing.whatsapp.title}</RichLine>
                </h3>
                <RichText className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {pricing.whatsapp.body}
                </RichText>
                <ul className="divide-border mt-4 divide-y">
                  {WHATSAPP_PRICES.map((price) => (
                    <li
                      key={price.category}
                      className="flex items-baseline justify-between gap-4 py-2.5"
                    >
                      <span>
                        <span className="text-sm font-medium">{price.label}</span>
                        <span className="text-muted-foreground block text-xs leading-snug">
                          {price.description}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="figure block text-sm font-semibold">
                          {price.metaCostMicros === 0
                            ? "grátis"
                            : `${formatRateMicros(price.metaCostMicros)} / msg`}
                        </span>
                        <span className="text-muted-foreground block text-[10px] font-normal">
                          {price.billableTemplate ? "repasse da Meta" : "não é cobrada"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                {/*
                  As duas datas viajam como marcador (`{vigencia}`, `{conferencia}`)
                  e são resolvidas contra `CURRENT_META_RATES` na renderização. É o
                  que permite editar a frase sem que a data possa ficar para trás
                  da tabela que ela descreve.
                */}
                <RichText className="text-muted-foreground mt-3 text-xs leading-relaxed">
                  {pricing.whatsapp.footnote}
                </RichText>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h3 className="font-display text-base font-semibold">
                  <RichLine>{pricing.addons.title}</RichLine>
                </h3>
                <RichText className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {pricing.addons.body}
                </RichText>
                <ul className="divide-border mt-4 divide-y">
                  {ADDONS.map((addon) => (
                    <li
                      key={addon.key}
                      className="flex items-baseline justify-between gap-4 py-2.5"
                    >
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
          <div className="mt-12">
            <h3 className="font-display text-base font-semibold">{pricing.included.title}</h3>

            {/*
              No celular, a comparação inverte: um cartão por edição, com as sete
              franquias dentro. A matriz de 5 colunas exigiria rolagem lateral, e
              quem rola perde a coluna de rótulos — fica olhando números sem saber
              a que se referem.
            */}
            <div className="mt-4 space-y-3 md:hidden">
              {PLANS.map((plan) => (
                <Card key={plan.key}>
                  <CardContent className="p-4">
                    <h4 className="font-display text-sm font-semibold">{plan.name}</h4>
                    <dl className="divide-border mt-2 divide-y text-sm">
                      {(
                        [
                          ["Contatos", formatNumber(plan.includedContacts)],
                          ["Conversas", formatNumber(plan.includedConversations)],
                          ["E-mails", formatNumber(plan.includedEmails)],
                          ["Respostas de IA", formatNumber(plan.includedAiReplies)],
                          ["Mensagens de modelo", formatNumber(plan.includedWhatsappTemplates)],
                          ["Números de WhatsApp", formatNumber(plan.includedWhatsappNumbers)],
                          [
                            "Colaboradores",
                            plan.maxSeats === null
                              ? "ilimitados"
                              : `${plan.minSeats} a ${plan.maxSeats}`,
                          ],
                        ] as const
                      ).map(([label, value]) => (
                        <div key={label} className="flex items-baseline justify-between gap-3 py-2">
                          <dt className="text-muted-foreground text-xs">{label}</dt>
                          <dd className="figure shrink-0 text-sm font-semibold">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="mt-4 w-full min-w-[640px] border-collapse text-sm">
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
                    [
                      "Conversas",
                      (p: (typeof PLANS)[number]) => formatNumber(p.includedConversations),
                    ],
                    ["E-mails", (p: (typeof PLANS)[number]) => formatNumber(p.includedEmails)],
                    [
                      "Respostas de IA",
                      (p: (typeof PLANS)[number]) => formatNumber(p.includedAiReplies),
                    ],
                    [
                      "Mensagens de modelo",
                      (p: (typeof PLANS)[number]) => formatNumber(p.includedWhatsappTemplates),
                    ],
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
        </div>
      </section>

      {/* Conta do seu caso ----------------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-5 md:py-16">
        <Reveal index={0}>
          <Card>
            <CardContent className="p-8 md:p-10">
              <h2 className="font-display text-[1.55rem] font-semibold leading-tight tracking-tight sm:text-2xl md:text-3xl">
                <RichLine>{pricing.close.title}</RichLine>
              </h2>
              <RichText className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
                {pricing.close.body}
              </RichText>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                {pricing.close.primary.label ? (
                  <Button asChild size="lg" variant="accent">
                    <Link href={pricing.close.primary.href}>
                      {pricing.close.primary.label}
                      <ArrowRight />
                    </Link>
                  </Button>
                ) : null}
                {pricing.close.secondary.label ? (
                  <Button asChild size="lg" variant="outline">
                    <Link href={pricing.close.secondary.href}>{pricing.close.secondary.label}</Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </section>

      <section id="faq" className="bg-surface-sunken scroll-mt-16 py-12 md:scroll-mt-20 md:py-16">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-5">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {pricing.faq.title}
          </h2>
          <div className="mt-6">
            <Faq items={content.faq} />
          </div>
          <RichText className="text-muted-foreground mt-8 text-sm">{pricing.faq.footnote}</RichText>
        </div>
      </section>
    </>
  );
}
