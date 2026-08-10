import type { Metadata } from "next";
import Link from "next/link";
import { AnimatedNumber, Badge, Button, Card, CardContent, Reveal } from "@elora/ui";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CalendarClock,
  Check,
  Fingerprint,
  GitBranch,
  Inbox,
  Layers,
  Lock,
  Mail,
  MessagesSquare,
  PlugZap,
  Route,
  Rocket,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Workflow,
} from "lucide-react";

import { Faq } from "@/components/site/faq";
import { PlanCards } from "@/components/site/plan-cards";
import { PricingSimulator } from "@/components/site/pricing-simulator";
import { ProductPreview } from "@/components/site/product-preview";
import { ProductShowcase } from "@/components/site/product-showcase";

export const metadata: Metadata = {
  title: "Elora — atendimento, CRM e IA numa plataforma só",
  description:
    "Plataforma omnichannel brasileira: WhatsApp, e-mail, Instagram e webchat numa linha do tempo, " +
    "com CRM 360º, automação auditável, agentes de IA sob controle humano e simulador de custo aberto.",
};

/* Conteúdo ------------------------------------------------------------------------ */

const SEGMENTS = [
  "Contabilidade",
  "E-commerce",
  "Clínicas e saúde",
  "Imobiliárias",
  "Educação",
  "Serviços B2B",
  "Franquias",
  "Escritórios de advocacia",
];

const MODULES = [
  {
    icon: Inbox,
    title: "Inbox omnichannel",
    body: "WhatsApp, e-mail, Instagram, Messenger e webchat na mesma fila, com SLA por política, notas internas, respostas rápidas e transferência com contexto.",
  },
  {
    icon: Building2,
    title: "CRM 360º",
    body: "Uma linha do tempo por contato: mensagem, negócio, campanha, consentimento e automação. Resolução de identidade por telefone, e-mail e identificador de canal.",
  },
  {
    icon: Target,
    title: "Funis de venda",
    body: "Vários pipelines por processo, com etapa, probabilidade, tempo parado e motivo de perda. Tarefa vinculada a contato e a negócio.",
  },
  {
    icon: Workflow,
    title: "Automações",
    body: "Aconteceu isto, confira aquilo, faça isso. Gatilho por evento de domínio, com histórico de execução — não é caixa-preta.",
  },
  {
    icon: Route,
    title: "Jornadas",
    body: "Acompanhamento por dias ou meses, com estado próprio por participante, espera, ramificação e versão publicada imutável.",
  },
  {
    icon: GitBranch,
    title: "Chatbot Builder",
    body: "Fluxo visual com o mesmo motor no simulador e em produção. O que você aprovou no editor é o que o visitante vê.",
  },
  {
    icon: Mail,
    title: "Campanhas e E-mail Studio",
    body: "Segmentação dinâmica, limite de frequência, janela silenciosa, lote e aprovação por tamanho de público. Disparo em massa com freio.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "Dicionário de métricas, SLA por fila, custo por atendimento e volume por canal. Métrica com definição escrita, não número solto.",
  },
];

const PROBLEMS = [
  {
    icon: Layers,
    title: "Cinco ferramentas, nenhuma conversa inteira",
    body: "O WhatsApp num aplicativo, o e-mail em outro, o funil numa planilha. Ninguém consegue responder 'o que já falamos com este cliente?' sem abrir quatro abas.",
  },
  {
    icon: Timer,
    title: "SLA que ninguém mede porque ninguém consegue",
    body: "Sem fila, sem distribuição e sem relógio, o atendimento bom depende de quem está de bom humor naquele dia — e o ruim só aparece na reclamação.",
  },
  {
    icon: ScrollText,
    title: "Automação que ninguém audita",
    body: "A régua dispara, o cliente reclama, e a pergunta 'por que ele recebeu isso?' fica sem resposta. Sem rastro, ajustar automação vira adivinhação.",
  },
];

const STEPS = [
  {
    icon: PlugZap,
    title: "Conecte os canais",
    body: "Número de WhatsApp oficial, caixa de e-mail, Instagram e o widget de webchat no seu site. A configuração é guiada, etapa por etapa, com o que é seu e o que é nosso separado.",
    detail: "1 a 3 dias",
  },
  {
    icon: Layers,
    title: "Desenhe filas e regras",
    body: "Times, escalas, habilidades e a política de distribuição de cada fila. A prévia mostra quem receberia a próxima conversa e por quê — antes de valer para o cliente.",
    detail: "1 a 2 semanas",
  },
  {
    icon: Rocket,
    title: "Ligue a automação e a IA",
    body: "Chatbot no site, régua de campanha e o agente de IA com base de conhecimento. Começa em leitura, e a escrita entra quando o time confia no rastro.",
    detail: "a partir da 3ª semana",
  },
];

const SECURITY = [
  {
    icon: Fingerprint,
    title: "Multiempresa desde o tipo",
    body: "Toda entidade carrega a organização a que pertence. Não é filtro na consulta: é a chave que a política de acesso valida em cada linha.",
  },
  {
    icon: Lock,
    title: "Segredo não volta pela API",
    body: "Token de canal é gravado no cofre do servidor e nunca devolvido. A tela pergunta se o segredo existe, por nome — nunca o valor.",
  },
  {
    icon: ShieldCheck,
    title: "Consentimento por finalidade",
    body: "Atendimento, marketing e cobrança são consentimentos distintos, com base legal, versão do texto e data. Revogação para o disparo, não a conversa.",
  },
  {
    icon: CalendarClock,
    title: "Retenção com prazo escrito",
    body: "Cada categoria de dado tem política de retenção e anonimização declarada, e toda escrita administrativa deixa registro de auditoria.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Herói ------------------------------------------------------------- */}
      <section className="aurora bg-primary text-primary-foreground relative overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-5 pb-20 pt-16 md:pb-28 md:pt-24">
          <Reveal index={0}>
            <span className="glass-card text-primary-foreground/85 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium">
              <Sparkles className="size-3.5" aria-hidden />
              Plataforma brasileira · WhatsApp oficial · IA sob controle humano
            </span>
          </Reveal>

          <Reveal index={1}>
            <h1 className="font-display mt-6 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
              Adquirir, atender, qualificar, vender e reter.
              <span className="text-accent"> Numa plataforma só.</span>
            </h1>
          </Reveal>

          <Reveal index={2}>
            <p className="text-primary-foreground/75 mt-5 max-w-2xl text-base leading-relaxed md:text-lg">
              A Elora junta o atendimento omnichannel, o CRM 360º, a automação e os agentes de
              inteligência artificial na mesma linha do tempo do contato — com SLA que se mede,
              automação que se audita e IA que propõe sem gravar sozinha.
            </p>
          </Reveal>

          <Reveal index={3}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="accent">
                <Link href="/orcamento">
                  Solicitar orçamento
                  <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/25 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
              >
                <Link href="#produto">Ver o produto por dentro</Link>
              </Button>
              <Link
                href="#simulador"
                className="text-primary-foreground/70 hover:text-primary-foreground text-sm underline underline-offset-4"
              >
                ou simule o custo em 30 segundos
              </Link>
            </div>
          </Reveal>

          <Reveal index={4}>
            <dl className="mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { value: 5, suffix: "", label: "canais numa fila" },
                { value: 61, suffix: "%", label: "resolvido pela IA" },
                { value: 40, suffix: "s", label: "primeira resposta" },
                { value: 8, suffix: "", label: "módulos integrados" },
              ].map((stat) => (
                <div key={stat.label} className="glass-card p-3">
                  <dd className="figure text-2xl font-semibold">
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

          <Reveal index={5}>
            <div className="mt-12">
              <ProductPreview />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Segmentos ---------------------------------------------------------- */}
      <section className="border-border bg-surface-sunken border-b py-6">
        <p className="text-muted-foreground mb-4 text-center text-[11px] uppercase tracking-wide">
          Desenhada para operação brasileira, em qualquer setor de alto contato
        </p>
        <div className="marquee">
          <div className="marquee-track gap-10 pr-10">
            {[...SEGMENTS, ...SEGMENTS].map((segment, index) => (
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

      {/* Problema ------------------------------------------------------------ */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20">
        <Reveal index={0}>
          <p className="text-accent-ink text-xs font-semibold uppercase tracking-wide">
            O problema
          </p>
          <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
            Não falta ferramenta. Falta a conversa inteira num lugar só.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PROBLEMS.map((problem, index) => (
            <Reveal key={problem.title} index={index + 1}>
              <Card className="h-full">
                <CardContent className="p-5">
                  <problem.icon className="text-accent size-6" aria-hidden />
                  <h3 className="font-display mt-3 text-base font-semibold">{problem.title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {problem.body}
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Por dentro do produto -------------------------------------------------- */}
      <section id="produto" className="bg-surface-sunken scroll-mt-20 py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <Reveal index={0}>
            <p className="text-accent-ink text-xs font-semibold uppercase tracking-wide">
              Por dentro
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              Sete telas que mostram como a operação funciona no dia a dia.
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-relaxed">
              Não é um pacote de produtos integrados por API: é um modelo de dados só. Quando o
              chatbot qualifica um lead, o funil sabe; quando a campanha é suprimida, a linha do
              tempo do contato registra o motivo.
            </p>
          </Reveal>

          <Reveal index={1}>
            <div className="mt-10">
              <ProductShowcase />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Módulos ---------------------------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20">
        <Reveal index={0}>
          <p className="text-accent-ink text-xs font-semibold uppercase tracking-wide">
            A plataforma
          </p>
          <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
            Oito módulos que compartilham o mesmo contato, o mesmo evento e o mesmo rastro.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((module, index) => (
            <Reveal key={module.title} index={Math.min(index + 1, 6)}>
              <Card className="lift h-full">
                <CardContent className="p-5">
                  <span className="bg-accent-soft text-accent-ink inline-flex size-9 items-center justify-center rounded-lg">
                    <module.icon className="size-4" aria-hidden />
                  </span>
                  <h3 className="font-display mt-3 text-sm font-semibold">{module.title}</h3>
                  <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                    {module.body}
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Implantação ------------------------------------------------------------- */}
      <section className="bg-surface-sunken py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <Reveal index={0}>
            <p className="text-accent-ink text-xs font-semibold uppercase tracking-wide">
              Implantação
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              No ar em três movimentos — e nenhum deles é "migrar tudo de uma vez".
            </h2>
          </Reveal>

          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Reveal key={step.title} index={index + 1} as="li">
                <Card className="lift-3d h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
                        <step.icon className="size-4" aria-hidden />
                      </span>
                      <span className="figure text-muted-foreground/40 text-3xl font-semibold">
                        {index + 1}
                      </span>
                    </div>
                    <h3 className="font-display mt-3 text-base font-semibold">{step.title}</h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      {step.body}
                    </p>
                    <p className="text-accent-ink border-border mt-4 border-t pt-3 text-xs font-medium">
                      {step.detail}
                    </p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* IA -------------------------------------------------------------------- */}
      <section id="ia" className="bg-primary text-primary-foreground scroll-mt-20 py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 lg:grid-cols-[1fr_1fr]">
          <Reveal index={0}>
            <Badge variant="accent">Inteligência artificial</Badge>
            <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
              A IA propõe. A aplicação valida. A pessoa grava.
            </h2>
            <p className="text-primary-foreground/75 mt-4 text-base leading-relaxed">
              É a mesma regra em todos os pontos onde há modelo: copiloto do atendente, agente de
              autoatendimento, redação de e-mail e extração de dados da conversa. O agente executa o
              que é leitura — consultar pedido, buscar na base, explicar política. O que é escrita
              vira pendência com um botão, e o botão é de gente.
            </p>

            <ul className="mt-6 space-y-3">
              {[
                "Piso de confiança que transfere para humano, conferido pela aplicação — não pedido ao modelo.",
                "Teto de custo por conversa, verificado antes de gastar.",
                "Fila de transferência validada contra o catálogo: fila inventada cai na padrão.",
                "Rastro completo por passo: decisão, ferramenta, parâmetro, retorno, confiança e custo.",
                "Conjunto de avaliação executável, com nota por dimensão e versão do prompt.",
              ].map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-relaxed">
                  <Check className="text-accent mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="text-primary-foreground/85">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal index={1}>
            <div className="glass-card p-5">
              <p className="text-primary-foreground/60 flex items-center gap-2 text-[11px] uppercase tracking-wide">
                <Bot className="size-3.5" aria-hidden />
                Rastro de uma execução
              </p>

              <ol className="mt-4 space-y-3">
                {[
                  {
                    step: "1",
                    title: "Classificou a intenção",
                    detail: "rastreio_pedido · confiança 0,94 · 320 ms",
                  },
                  {
                    step: "2",
                    title: "Chamou a ferramenta consultar_pedido",
                    detail: "leitura permitida na allowlist da versão · executada",
                  },
                  {
                    step: "3",
                    title: "Respondeu ao cliente",
                    detail: "gemini-2.5-flash · 812 tokens · R$ 0,004 · prompt v7",
                  },
                  {
                    step: "4",
                    title: "Propôs alterar endereço de entrega",
                    detail: "escrita — aguardando confirmação humana no Inbox",
                    pending: true,
                  },
                ].map((row) => (
                  <li key={row.step} className="flex gap-3">
                    <span className="border-primary-foreground/25 text-primary-foreground/70 figure flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px]">
                      {row.step}
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

              <p className="text-primary-foreground/60 border-primary-foreground/15 mt-5 border-t pt-4 text-xs leading-relaxed">
                Sem esse rastro, depurar agente vira troca de adjetivos e o prompt passa a ser
                ajustado no escuro.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Simulador ---------------------------------------------------------------- */}
      <section id="simulador" className="scroll-mt-20 py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <Reveal index={0}>
            <p className="text-accent-ink text-xs font-semibold uppercase tracking-wide">
              Simulador
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              O preço inteiro, linha a linha, antes de falar com vendedor.
            </h2>
            <p className="text-muted-foreground mt-3 max-w-3xl text-base leading-relaxed">
              Assinatura, assentos, contatos, conversas, e-mail, respostas de IA e o repasse da Meta
              — cada item com a conta escrita ao lado. O que a Elora cobra e o que o provedor cobra
              aparecem separados de propósito: é o que permite conferir a fatura depois.
            </p>
          </Reveal>

          <Reveal index={1}>
            <div className="mt-10">
              <PricingSimulator />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Planos --------------------------------------------------------------------- */}
      <section id="planos" className="bg-surface-sunken scroll-mt-20 py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <Reveal index={0}>
            <p className="text-accent-ink text-xs font-semibold uppercase tracking-wide">Edições</p>
            <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              Dois eixos de preço: quantas pessoas usam e quanto a operação consome.
            </h2>
            <p className="text-muted-foreground mt-3 max-w-3xl text-base leading-relaxed">
              Quem cresce em time paga no assento. Quem cresce em volume paga no consumo. Ninguém
              paga pelo crescimento do outro — e, na edição de cima, o assento deixa de ser cobrado.
            </p>
          </Reveal>

          <div className="mt-10">
            <PlanCards />
          </div>

          <p className="text-muted-foreground mt-6 text-xs">
            Valores no compromisso anual. Sem fidelidade, a assinatura e os assentos custam 25% a
            mais.{" "}
            <Link href="/precos" className="text-primary underline underline-offset-4">
              Ver a tabela completa
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Segurança -------------------------------------------------------------------- */}
      <section id="seguranca" className="scroll-mt-20 py-20">
        <div className="mx-auto w-full max-w-6xl px-5">
          <Reveal index={0}>
            <p className="text-accent-ink text-xs font-semibold uppercase tracking-wide">
              Segurança e LGPD
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              Governança que aparece no tipo, não só na política de privacidade.
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SECURITY.map((item, index) => (
              <Reveal key={item.title} index={index + 1}>
                <Card className="h-full">
                  <CardContent className="p-5">
                    <item.icon className="text-primary size-5" aria-hidden />
                    <h3 className="font-display mt-3 text-sm font-semibold">{item.title}</h3>
                    <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                      {item.body}
                    </p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ ------------------------------------------------------------------------- */}
      <section className="bg-surface-sunken py-20">
        <div className="mx-auto w-full max-w-4xl px-5">
          <Reveal index={0}>
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Perguntas que sempre aparecem
            </h2>
          </Reveal>
          <Reveal index={1}>
            <div className="mt-8">
              <Faq />
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA final --------------------------------------------------------------------- */}
      <section className="bg-primary text-primary-foreground aurora">
        <div className="mx-auto w-full max-w-4xl px-5 py-20 text-center">
          <MessagesSquare className="text-accent mx-auto size-8" aria-hidden />
          <h2 className="font-display mt-5 text-3xl font-semibold tracking-tight md:text-4xl">
            Comece pelo número, não pela reunião.
          </h2>
          <p className="text-primary-foreground/75 mx-auto mt-4 max-w-2xl text-base leading-relaxed">
            Dimensione a operação no simulador e, se fizer sentido, peça a proposta. O time
            comercial responde em até um dia útil com o cenário que você montou em mãos — e leva a
            demonstração do seu setor para a conversa.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="accent">
              <Link href="/orcamento">
                Solicitar orçamento
                <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-primary-foreground/25 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
            >
              <Link href="/cadastrar">Criar conta e salvar cenários</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
