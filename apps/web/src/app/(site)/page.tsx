import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedNumber, Badge, Button, Card, CardContent, Reveal } from "@elora/ui";
import { ArrowRight, Bot, Check, Sparkles } from "lucide-react";

import { Faq } from "@/components/site/faq";
import { PricingSection } from "@/components/site/pricing-section";
import { ProductPreview } from "@/components/site/product-preview";
import { ProductShowcase } from "@/components/site/product-showcase";
import { RichLine, RichText } from "@/components/site/rich-text";
import { TextRoll } from "@/components/site/text-roll";
import { contentIcon } from "@/lib/site/icons";
import { readSiteContent } from "@/lib/site/content-store";

/**
 * A landing page.
 *
 * ## O texto saiu daqui, o desenho ficou
 *
 * Cada frase desta página vinha de um literal no JSX, e trocar o título do herói
 * exigia editar este arquivo. Hoje o conteúdo vem de `readSiteContent()` — do
 * arquivo em disco quando existe, do padrão do código quando não —, e o que
 * restou aqui é composição: qual peça vai onde, com que espaçamento, em que
 * ordem de animação.
 *
 * A divisão tem uma consequência prática que vale enunciar: **lista vazia
 * esconde a seção inteira**. Quem apagar todos os cartões de segurança no editor
 * não fica com um título órfão sobre espaço em branco — a seção some, com a
 * sobrelinha e o cabeçalho junto.
 *
 * ## `generateMetadata`, e não `metadata`
 *
 * O título e a descrição também são editáveis, e um `export const metadata`
 * estático não consegue lê-los: ele é avaliado na carga do módulo, antes de
 * qualquer leitura de arquivo.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { landing } = await readSiteContent();
  return { title: landing.meta.title, description: landing.meta.description };
}

export default async function LandingPage() {
  const content = await readSiteContent();
  const { landing } = content;
  const { hero, ai, plans, cta } = landing;
  const CtaIcon = contentIcon(cta.icon);

  return (
    <>
      {/* Herói -------------------------------------------------------------
          `hero-parallax` faz o conteúdo recuar ao sair da tela, e o efeito só
          existe onde o navegador tem linha do tempo de rolagem. O `overflow-hidden`
          saiu daqui porque `.aurora` já corta — e corta com `overflow: clip`,
          que é o que não transforma o herói em contêiner de rolagem. Repor a
          classe aqui reataria o nó: o parallax mediria progresso contra uma
          caixa parada e nada se moveria. */}
      <section className="aurora bg-primary text-primary-foreground relative">
        <div className="hero-parallax mx-auto w-full max-w-6xl px-4 pb-14 pt-10 sm:px-5 md:pb-28 md:pt-24">
          {hero.eyebrow ? (
            <Reveal index={0}>
              <span className="glass-card text-primary-foreground/85 inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium leading-snug md:text-xs">
                <Sparkles className="size-3.5 shrink-0" aria-hidden />
                <RichLine>{hero.eyebrow}</RichLine>
              </span>
            </Reveal>
          ) : null}

          {/*
            Duas formas de título, e a lista de palavras decide qual.

            Sem palavras, é o título de duas partes de sempre. Com palavras, a
            primeira frase termina na palavra que rola, e a segunda **flui logo
            depois** em vez de ser empurrada para uma linha própria por uma
            quebra forçada.

            A quebra existiu e foi removida: com ela, a palavra que rola caía
            sozinha numa linha e o restante do título deixava um vão à direita —
            espaço morto no meio da peça que mais precisa de densidade. Quem
            quebra a linha agora é o texto, quando acabar a largura.

            O ponto final fica aqui e não no conteúdo: é pontuação da composição,
            e a condicional garante que esvaziar a lista no editor não deixe um
            ponto órfão no meio da frase.
          */}
          {/*
            O passo de tamanho tem um degrau a mais no celular.

            `text-4xl` (2,25 rem) numa tela de 390 px punha quatro palavras por
            linha e empurrava o título para cinco linhas — sozinho ele comia a
            dobra inteira, e o subtítulo, os botões e a prévia começavam abaixo
            dela. 2 rem com entrelinha um pouco mais fechada devolve uma linha
            de altura sem que o título deixe de ser a maior coisa da tela.
          */}
          <Reveal index={1}>
            <h1 className="font-display mt-5 max-w-4xl text-[2rem] font-semibold leading-[1.14] tracking-tight sm:text-4xl sm:leading-[1.12] md:mt-6 md:text-[3.4rem]">
              <RichLine>{hero.titleLead}</RichLine>
              {hero.titleRoll.length > 0 ? (
                <>
                  {" "}
                  <TextRoll words={hero.titleRoll} charClassName="text-accent" />.{" "}
                </>
              ) : null}
              {hero.titleAccent ? (
                <span className="text-accent">
                  {hero.titleRoll.length > 0 ? null : " "}
                  <RichLine>{hero.titleAccent}</RichLine>
                </span>
              ) : null}
            </h1>
          </Reveal>

          <Reveal index={2}>
            <RichText className="text-primary-foreground/75 mt-4 max-w-2xl text-[0.95rem] leading-relaxed md:mt-5 md:text-lg">
              {hero.subtitle}
            </RichText>
          </Reveal>

          {/*
            A ordem dos botões segue a tese da própria página, escrita lá no
            rodapé: "comece pelo número, não pela reunião". Com o orçamento em
            primeiro e o preço num link discreto, a peça dizia o contrário do
            texto — pedia a reunião antes de mostrar a conta.

            No celular eles empilham em largura total, e não é preferência
            estética: `flex-wrap` já os empilhava, mas com a largura do próprio
            texto — dois botões de tamanhos diferentes, alinhados à esquerda,
            com uma borda irregular à direita. Largura total dá a mesma linha de
            corte aos dois e põe a área de toque onde o polegar está.
          */}
          <Reveal index={3}>
            <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center md:mt-8">
              {hero.primary.label ? (
                <Button asChild size="lg" variant="accent" className="w-full sm:w-auto">
                  <Link href={hero.primary.href}>
                    {hero.primary.label}
                    <ArrowRight />
                  </Link>
                </Button>
              ) : null}
              {hero.secondary.label ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/25 text-primary-foreground hover:bg-primary-foreground/10 w-full bg-transparent sm:w-auto"
                >
                  <Link href={hero.secondary.href}>{hero.secondary.label}</Link>
                </Button>
              ) : null}
              {hero.tertiary.label ? (
                <Link
                  href={hero.tertiary.href}
                  className="text-primary-foreground/70 hover:text-primary-foreground py-1 text-center text-sm underline underline-offset-4 sm:py-0 sm:text-left"
                >
                  {hero.tertiary.label}
                </Link>
              ) : null}
            </div>
          </Reveal>

          {/*
            Estes números descrevem o **produto**, e é de propósito. Antes
            traziam "61% resolvido pela IA" e "40 s de primeira resposta":
            resultado de operação, apresentado como fato, sem um único cliente em
            produção para sustentá-lo. Número de resultado inventado é a peça mais
            cara de uma landing page — sobrevive à venda e reaparece na primeira
            reunião de revisão de contrato.
          */}
          {hero.stats.length > 0 ? (
            <Reveal index={4}>
              <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 md:mt-10">
                {hero.stats.map((stat) => (
                  <div key={stat.id} className="glass-card p-3">
                    <dd className="figure text-xl font-semibold sm:text-2xl">
                      <AnimatedNumber value={stat.value} />
                      {stat.suffix}
                    </dd>
                    <dt className="text-primary-foreground/60 mt-0.5 text-[11px] leading-tight">
                      {stat.label}
                    </dt>
                  </div>
                ))}
              </dl>
            </Reveal>
          ) : null}

          <Reveal index={5}>
            <div className="mt-10 md:mt-12">
              <ProductPreview />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Segmentos ---------------------------------------------------------- */}
      {landing.segments.length > 0 ? (
        <section className="border-border bg-surface-sunken border-b py-6">
          <p className="text-muted-foreground mb-4 text-center text-[11px] uppercase tracking-wide">
            {landing.segmentsLabel}
          </p>
          <div className="marquee">
            {/*
              A lista é duplicada porque a marquise rola em laço: sem a segunda
              cópia, o fim da faixa deixaria um vão branco atravessando a tela
              antes de recomeçar.
            */}
            <div className="marquee-track gap-10 pr-10">
              {[...landing.segments, ...landing.segments].map((segment, index) => (
                <span
                  key={`${segment}-${index}`}
                  className="text-muted-foreground/70 font-display whitespace-nowrap text-lg font-semibold"
                >
                  {segment}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Problema ------------------------------------------------------------ */}
      {landing.problems.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-5 md:py-20">
          <Reveal onView index={0}>
            <p className="text-accent-ink text-xs font-semibold uppercase tracking-wide">
              {landing.problem.eyebrow}
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl">
              <RichLine>{landing.problem.title}</RichLine>
            </h2>
            <RichText className="text-muted-foreground mt-3 max-w-2xl text-[0.95rem] leading-relaxed md:text-base">
              {landing.problem.body}
            </RichText>
          </Reveal>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {landing.problems.map((problem, index) => {
              const Icon = contentIcon(problem.icon);
              return (
                <Reveal onView key={problem.id} index={index + 1}>
                  <Card className="h-full">
                    <CardContent className="p-5">
                      <Icon className="text-accent size-6" aria-hidden />
                      <h3 className="font-display mt-3 text-base font-semibold">{problem.title}</h3>
                      <RichText className="text-muted-foreground mt-2 text-sm leading-relaxed">
                        {problem.body}
                      </RichText>
                    </CardContent>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Por dentro do produto -------------------------------------------------- */}
      <section
        id="produto"
        className="bg-surface-sunken scroll-mt-16 py-14 md:scroll-mt-20 md:py-20"
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-5">
          <Reveal onView index={0}>
            <p className="text-accent-ink text-xs font-semibold uppercase tracking-wide">
              {landing.showcase.eyebrow}
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl">
              <RichLine>{landing.showcase.title}</RichLine>
            </h2>
            <RichText className="text-muted-foreground mt-3 max-w-2xl text-[0.95rem] leading-relaxed md:text-base">
              {landing.showcase.body}
            </RichText>
          </Reveal>

          <Reveal onView index={1}>
            <div className="mt-10">
              <ProductShowcase />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Módulos ---------------------------------------------------------------- */}
      {landing.moduleCards.length > 0 ? (
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-5 md:py-20">
          <Reveal onView index={0}>
            <p className="text-accent-ink text-xs font-semibold uppercase tracking-wide">
              {landing.modules.eyebrow}
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl">
              <RichLine>{landing.modules.title}</RichLine>
            </h2>
            <RichText className="text-muted-foreground mt-3 max-w-2xl text-[0.95rem] leading-relaxed md:text-base">
              {landing.modules.body}
            </RichText>
          </Reveal>

          {/*
            No celular o cartão deita: ícone à esquerda, texto à direita.

            Empilhado, cada um dos oito módulos ocupava uma tela inteira de
            rolagem e a lista virava um corredor — e um corredor de oito é a
            forma mais eficiente de fazer alguém desistir antes do sétimo. Com o
            ícone ao lado, o cartão perde ~40% da altura e a seção volta a ser
            legível como **lista**, que é o que ela é: um inventário do que vem
            junto, não oito argumentos para ler um a um.

            A partir de `sm` volta ao empilhado, porque em duas ou quatro colunas
            a largura já não sustenta ícone e texto lado a lado.
          */}
          <div className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
            {landing.moduleCards.map((module, index) => {
              const Icon = contentIcon(module.icon);
              return (
                <Reveal onView key={module.id} index={Math.min(index + 1, 6)}>
                  <Card className="lift h-full">
                    <CardContent className="flex gap-3.5 p-4 sm:block sm:p-5">
                      <span className="bg-accent-soft text-accent-ink inline-flex size-9 shrink-0 items-center justify-center rounded-lg">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-display text-sm font-semibold sm:mt-3">
                          {module.title}
                        </h3>
                        <RichText className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                          {module.body}
                        </RichText>
                      </div>
                    </CardContent>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Planos ------------------------------------------------------------------
          O preço vem aqui, logo depois do que o produto faz — e não no oitavo
          lugar de onze, que era onde estava. Quem chegou por busca de preço não
          rola quatro seções para encontrá-lo; e quem gostou do produto quer a
          conta antes de ler sobre implantação e governança. */}
      <section
        id="planos"
        className="bg-surface-sunken scroll-mt-16 py-14 md:scroll-mt-20 md:py-20"
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-5">
          <Reveal onView index={0}>
            <p className="text-accent-ink text-xs font-semibold uppercase tracking-wide">
              {plans.eyebrow}
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl">
              <RichLine>{plans.title}</RichLine>
            </h2>
            <RichText className="text-muted-foreground mt-3 max-w-3xl text-base leading-relaxed">
              {plans.body}
            </RichText>
          </Reveal>

          {/*
            `PricingSection` no lugar de `PlanCards`, e a diferença é o
            alternador de ciclo. A página anunciava só o preço anual e explicava
            o prêmio do mensal numa nota de rodapé — quem precisa do mensal
            precisava fazer a conta de cabeça. Agora ele é um clique, e o preço
            se move em vez de trocar de valor sem aviso.

            `PlanCards` continua existindo: é o que `/precos` usa, onde não há
            alternador porque a tabela de excedentes logo abaixo já é por edição.
          */}
          <div className="mt-10">
            <PricingSection />
          </div>

          {/*
            As notas abaixo são a resposta antecipada às perguntas que todo
            orçamento de plataforma de mensagem recebe depois de assinado.
            Deixá-las para a fatura é o que produz a conversa sobre confiança.
          */}
          {plans.notes.length > 0 ? (
            <Reveal onView index={1}>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {plans.notes.map((note) => {
                  const Icon = contentIcon(note.icon);
                  return (
                    <Card key={note.id} className="h-full">
                      <CardContent className="p-5">
                        <Icon className="text-accent size-5" aria-hidden />
                        <h3 className="font-display mt-3 text-sm font-semibold">{note.title}</h3>
                        <RichText className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                          {note.body}
                        </RichText>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </Reveal>
          ) : null}

          <RichText className="text-muted-foreground mt-6 text-xs">{plans.footnote}</RichText>
        </div>
      </section>

      {/* IA -------------------------------------------------------------------- */}
      <section
        id="ia"
        className="bg-primary text-primary-foreground scroll-mt-16 py-14 md:scroll-mt-20 md:py-20"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-5 lg:grid-cols-[1fr_1fr] lg:gap-10">
          <Reveal onView index={0}>
            {ai.badge ? <Badge variant="accent">{ai.badge}</Badge> : null}
            <h2 className="font-display mt-4 text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl">
              <RichLine>{ai.title}</RichLine>
            </h2>
            <RichText className="text-primary-foreground/75 mt-4 text-[0.95rem] leading-relaxed md:text-base">
              {ai.body}
            </RichText>

            {ai.bullets.length > 0 ? (
              <ul className="mt-6 space-y-3">
                {ai.bullets.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed">
                    <Check className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
                    <span className="text-primary-foreground/85">
                      <RichLine>{item}</RichLine>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Reveal>

          {ai.trace.length > 0 ? (
            <Reveal onView index={1}>
              <div className="glass-card p-4 sm:p-5">
                <p className="text-primary-foreground/60 flex items-center gap-2 text-[11px] uppercase tracking-wide">
                  <Bot className="size-3.5" aria-hidden />
                  {ai.traceTitle}
                </p>

                <ol className="mt-4 space-y-3">
                  {ai.trace.map((row, index) => (
                    <li key={row.id} className="flex gap-3">
                      <span className="border-primary-foreground/25 text-primary-foreground/70 figure flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px]">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{row.title}</span>
                        <span
                          className={
                            row.pending
                              ? "text-accent block text-xs"
                              : "text-primary-foreground/60 block text-xs"
                          }
                        >
                          {row.detail}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>

                {ai.traceFootnote ? (
                  <RichText className="text-primary-foreground/60 border-primary-foreground/15 mt-5 border-t pt-4 text-xs leading-relaxed">
                    {ai.traceFootnote}
                  </RichText>
                ) : null}
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>

      {/* Implantação ------------------------------------------------------------- */}
      {landing.stepCards.length > 0 ? (
        <section className="py-14 md:py-20">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-5">
            <Reveal onView index={0}>
              <p className="text-accent-ink text-xs font-semibold uppercase tracking-wide">
                {landing.steps.eyebrow}
              </p>
              <h2 className="font-display mt-2 max-w-2xl text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl">
                <RichLine>{landing.steps.title}</RichLine>
              </h2>
              <RichText className="text-muted-foreground mt-3 max-w-2xl text-[0.95rem] leading-relaxed md:text-base">
                {landing.steps.body}
              </RichText>
            </Reveal>

            <ol className="mt-8 grid gap-4 sm:mt-10 sm:gap-5 md:grid-cols-3">
              {landing.stepCards.map((step, index) => {
                const Icon = contentIcon(step.icon);
                return (
                  <Reveal onView key={step.id} index={index + 1} as="li">
                    <Card className="lift-3d h-full">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <span className="figure text-muted-foreground/40 text-3xl font-semibold">
                            {index + 1}
                          </span>
                        </div>
                        <h3 className="font-display mt-3 text-base font-semibold">{step.title}</h3>
                        <RichText className="text-muted-foreground mt-2 text-sm leading-relaxed">
                          {step.body}
                        </RichText>
                        {step.detail ? (
                          <p className="text-accent-ink border-border mt-4 border-t pt-3 text-xs font-medium">
                            {step.detail}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
                  </Reveal>
                );
              })}
            </ol>
          </div>
        </section>
      ) : null}

      {/* Segurança -------------------------------------------------------------------- */}
      {landing.securityCards.length > 0 ? (
        <section
          id="seguranca"
          className="bg-surface-sunken scroll-mt-16 py-14 md:scroll-mt-20 md:py-20"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-5">
            <Reveal onView index={0}>
              <p className="text-accent-ink text-xs font-semibold uppercase tracking-wide">
                {landing.security.eyebrow}
              </p>
              <h2 className="font-display mt-2 max-w-2xl text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl">
                <RichLine>{landing.security.title}</RichLine>
              </h2>
              <RichText className="text-muted-foreground mt-3 max-w-2xl text-[0.95rem] leading-relaxed md:text-base">
                {landing.security.body}
              </RichText>
            </Reveal>

            {/*
              Duas colunas já no celular.

              Estes quatro cartões são os mais curtos da página — um ícone, um
              título de duas palavras e duas linhas de texto. Em coluna única
              eles ocupavam quatro telas para dizer o que cabe em uma, e a
              seção de segurança é justamente a que a pessoa percorre buscando
              **presença** de assunto (LGPD, auditoria, retenção), não leitura
              contínua. Ler quatro selos lado a lado é o gesto certo.
            */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4 lg:grid-cols-4">
              {landing.securityCards.map((item, index) => {
                const Icon = contentIcon(item.icon);
                return (
                  <Reveal onView key={item.id} index={index + 1}>
                    <Card className="h-full">
                      <CardContent className="p-4 sm:p-5">
                        <Icon className="text-primary size-5" aria-hidden />
                        <h3 className="font-display mt-3 text-sm font-semibold">{item.title}</h3>
                        <RichText className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                          {item.body}
                        </RichText>
                      </CardContent>
                    </Card>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* FAQ ------------------------------------------------------------------------- */}
      <section className="py-14 md:py-20">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-5">
          <Reveal onView index={0}>
            <h2 className="font-display text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl">
              {landing.faqTitle}
            </h2>
          </Reveal>
          <Reveal onView index={1}>
            <div className="mt-6 md:mt-8">
              <Faq items={content.faq} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA final --------------------------------------------------------------------- */}
      <section className="bg-primary text-primary-foreground aurora">
        <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-5 md:py-20">
          <CtaIcon className="text-accent mx-auto size-8" aria-hidden />
          <h2 className="font-display mt-5 text-[1.7rem] font-semibold leading-tight tracking-tight sm:text-3xl md:text-4xl">
            <RichLine>{cta.title}</RichLine>
          </h2>
          <RichText className="text-primary-foreground/75 mx-auto mt-4 max-w-2xl text-[0.95rem] leading-relaxed md:text-base">
            {cta.body}
          </RichText>
          <div className="mt-7 flex flex-col items-stretch gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            {cta.primary.label ? (
              <Button asChild size="lg" variant="accent" className="w-full sm:w-auto">
                <Link href={cta.primary.href}>
                  {cta.primary.label}
                  <ArrowRight />
                </Link>
              </Button>
            ) : null}
            {cta.secondary.label ? (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/25 text-primary-foreground hover:bg-primary-foreground/10 w-full bg-transparent sm:w-auto"
              >
                <Link href={cta.secondary.href}>{cta.secondary.label}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
