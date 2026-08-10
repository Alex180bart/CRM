import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  QUOTE_STATUS_LABEL,
  formatCurrencyCents,
  formatDateTime,
  formatNumber,
  repositories,
} from "@elora/core";
import { Badge, Button, Callout, Card, CardContent, EmptyState } from "@elora/ui";
import { ArrowRight, Boxes, Calculator, FileText, Info, LogOut } from "lucide-react";

import { signOutAction } from "@/app/(site)/actions";
import { VerticalGallery } from "@/components/site/vertical-gallery";
import { currentAccount } from "@/lib/site/auth";

export const metadata: Metadata = { title: "Minha conta" };

/**
 * Área do cliente.
 *
 * Mostra o que existe de verdade — a conta e os orçamentos pedidos — e não
 * inventa painel de uso, fatura ou contrato. Um painel de consumo com números
 * fabricados seria a única coisa desta página que o cliente levaria a sério, e
 * seria a única falsa.
 */
export default async function ContaPage() {
  const account = await currentAccount();
  if (!account) redirect("/entrar");

  const quotes = await repositories.site.listQuotes(account.id);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Olá, {account.name.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {account.company}
            {account.jobTitle ? ` · ${account.jobTitle}` : ""} · {account.email}
          </p>
        </div>

        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut />
            Sair
          </Button>
        </form>
      </div>

      {/*
        A área comercial vem primeiro, e só para quem tem o papel.
        
        Quem entra com a conta de administrador veio abrir uma demonstração —
        empurrar isso para baixo dos atalhos de orçamento obrigaria a rolar a
        página no meio de uma reunião com o cliente na chamada.
      */}
      {account.isAdmin ? (
        <section className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Bases de demonstração
            </h2>
            <Badge variant="accent">área comercial</Badge>
          </div>

          <Callout variant="info" icon={<Info />} className="mt-3">
            Abrir uma base recarrega os dados do servidor e vale para toda a instância. Em
            apresentação simultânea, combine antes quem troca.
          </Callout>

          <div className="mt-5">
            <VerticalGallery />
          </div>
        </section>
      ) : null}

      <h2 className="font-display mt-12 text-xl font-semibold tracking-tight">Atalhos</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Card className="lift">
          <CardContent className="p-5">
            <Calculator className="text-accent size-5" aria-hidden />
            <h3 className="font-display mt-3 text-sm font-semibold">Simular um cenário</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Ajuste volume, time e canais e veja a conta linha a linha.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link href="/precos#simulador">Abrir simulador</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lift">
          <CardContent className="p-5">
            <Boxes className="text-accent size-5" aria-hidden />
            <h3 className="font-display mt-3 text-sm font-semibold">
              {account.isAdmin ? "Demonstrações" : "Demonstração guiada"}
            </h3>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              {account.isAdmin
                ? "Abra a base do segmento e entre direto no produto."
                : "Um especialista abre a base do seu setor e conduz a apresentação."}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3 w-full">
              <Link href={account.isAdmin ? "/admin" : "/orcamento"}>
                {account.isAdmin ? "Ver bases" : "Agendar"}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lift">
          <CardContent className="p-5">
            <FileText className="text-accent size-5" aria-hidden />
            <h3 className="font-display mt-3 text-sm font-semibold">Pedir proposta</h3>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Envie o cenário para o comercial com os seus dados já preenchidos.
            </p>
            <Button asChild size="sm" className="mt-3 w-full">
              <Link href="/orcamento">
                Solicitar
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <h2 className="font-display mt-12 text-xl font-semibold tracking-tight">Meus orçamentos</h2>

      {quotes.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-8">
            <EmptyState
              icon={<FileText />}
              title="Nenhum orçamento pedido ainda"
              description="Dimensione a operação no simulador e envie o cenário. Ele aparece aqui com a referência para citar com o comercial."
              action={
                <Button asChild>
                  <Link href="/precos#simulador">Abrir o simulador</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-4 space-y-3">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <Card>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2">
                        <span className="figure text-sm font-semibold">
                          Orçamento {quote.reference}
                        </span>
                        <Badge variant={quote.status === "novo" ? "info" : "neutral"}>
                          {QUOTE_STATUS_LABEL[quote.status]}
                        </Badge>
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Edição {quote.snapshot.planName} ·{" "}
                        {quote.snapshot.billing === "anual" ? "anual" : "mensal"} · enviado em{" "}
                        {formatDateTime(quote.createdAt)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="figure text-xl font-semibold">
                        {formatCurrencyCents(quote.snapshot.monthlyTotalCents)}
                        <span className="text-muted-foreground text-xs font-normal"> / mês</span>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatCurrencyCents(quote.snapshot.firstInvoiceCents)} na primeira fatura
                      </p>
                    </div>
                  </div>

                  <dl className="border-border mt-4 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
                    {[
                      ["Colaboradores", formatNumber(quote.snapshot.seats)],
                      ["Contatos", formatNumber(quote.snapshot.contacts)],
                      ["Conversas / mês", formatNumber(quote.snapshot.conversations)],
                      ["Respostas de IA", formatNumber(quote.snapshot.aiReplies)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-muted-foreground text-[11px]">{label}</dt>
                        <dd className="figure text-sm font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  {quote.message ? (
                    <p className="text-muted-foreground border-border mt-4 border-t pt-4 text-sm leading-relaxed">
                      “{quote.message}”
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground mt-8 text-xs leading-relaxed">
        Esta conta vive na memória do servidor: um reinício apaga o cadastro e os orçamentos. A
        persistência entra junto com a fundação de back-end.
      </p>
    </div>
  );
}
