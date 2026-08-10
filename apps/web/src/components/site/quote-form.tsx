"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  DEMO_VERTICALS,
  calculateQuote,
  formatCurrencyCents,
  formatNumber,
  type QuoteInput,
} from "@elora/core";
import {
  Button,
  Callout,
  Card,
  CardContent,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@elora/ui";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";

import { requestQuoteAction, type FormState } from "@/app/(site)/actions";
import { quoteInputFields } from "@/lib/site/quote-params";

/**
 * Pedido de orçamento.
 *
 * O cenário do simulador viaja em campos ocultos, e o servidor **recalcula**
 * antes de gravar — ver `snapshotOf` em `actions.ts`. O resumo ao lado é só
 * espelho: se ele divergisse do que o servidor calcula, o cliente veria um valor
 * e o comercial receberia outro, que é o defeito mais caro possível numa página
 * de proposta.
 *
 * Por isso os dois lados chamam a **mesma função pura**. Não há uma conta "de
 * exibição" e outra "de verdade".
 */

const EMPTY: FormState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="mt-5 w-full" loading={pending}>
      {pending ? "Enviando…" : "Enviar pedido de orçamento"}
      {pending ? null : <Send />}
    </Button>
  );
}

export function QuoteForm({
  input,
  account,
}: {
  input: QuoteInput;
  account?: { name: string; email: string; company: string; phone?: string } | null;
}) {
  const [state, action] = useActionState(requestQuoteAction, EMPTY);
  const result = calculateQuote(input);

  if (state.ok) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="text-success mx-auto size-10" aria-hidden />
          <h2 className="font-display mt-4 text-2xl font-semibold">Pedido registrado</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-relaxed">
            {state.message} Guarde a referência{" "}
            <strong className="text-foreground">{state.reference}</strong> — é por ela que o time
            comercial vai localizar o seu cenário.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/conta">Ver meus orçamentos</Link>
            </Button>
            <Button asChild>
              <Link href="/precos#simulador">Ajustar outro cenário</Link>
            </Button>
          </div>

          <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
            Sem back-end persistente, este pedido vive na memória do servidor e some no reinício.
            Preferimos avisar aqui a deixar você descobrir amanhã.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <Card className="min-w-0">
        <CardContent className="p-6">
          <h2 className="font-display text-lg font-semibold">Seus dados</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            O time comercial responde em até um dia útil, com o cenário que você montou em mãos.
          </p>

          <form action={action} className="mt-5">
            {state.message && !state.field ? (
              <Callout variant="danger" icon={<AlertTriangle />} className="mb-4">
                {state.message}
              </Callout>
            ) : null}

            {quoteInputFields(input).map((field) => (
              <input key={field.name} type="hidden" name={field.name} value={field.value} />
            ))}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={account?.name}
                  autoComplete="name"
                  required
                  className="mt-1.5"
                />
                {state.field === "name" ? (
                  <p className="text-destructive mt-1 text-xs">{state.message}</p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={account?.email}
                  autoComplete="email"
                  required
                  className="mt-1.5"
                />
                {state.field === "email" ? (
                  <p className="text-destructive mt-1 text-xs">{state.message}</p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={account?.phone}
                  autoComplete="tel"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="company">Empresa</Label>
                <Input
                  id="company"
                  name="company"
                  defaultValue={account?.company}
                  autoComplete="organization"
                  required
                  className="mt-1.5"
                />
                {state.field === "company" ? (
                  <p className="text-destructive mt-1 text-xs">{state.message}</p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="segment">Segmento</Label>
                <Select name="segment" defaultValue="">
                  <SelectTrigger id="segment" className="mt-1.5">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEMO_VERTICALS.map((vertical) => (
                      <SelectItem key={vertical.id} value={vertical.name}>
                        {vertical.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="message">O que é mais importante no seu caso?</Label>
                <Textarea
                  id="message"
                  name="message"
                  rows={4}
                  placeholder="Ex.: precisamos migrar de outra ferramenta sem perder histórico, e temos dois números de WhatsApp."
                  className="mt-1.5"
                />
              </div>
            </div>

            <SubmitButton />

            <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
              Ao enviar, você concorda que a Elora entre em contato sobre este pedido. Não usamos os
              dados para outra finalidade sem consentimento separado.
            </p>
          </form>
        </CardContent>
      </Card>

      {/* Resumo do cenário ------------------------------------------------- */}
      <Card className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <CardContent className="p-6">
          <h2 className="font-display text-lg font-semibold">Cenário simulado</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Edição {result.plan.name} ·{" "}
            {result.billing === "anual" ? "compromisso anual" : "mensal, sem fidelidade"}
          </p>

          <dl className="border-border mt-4 grid grid-cols-2 gap-3 border-y py-4 text-sm">
            {[
              ["Colaboradores", formatNumber(input.seats)],
              ["Contatos", formatNumber(input.contacts)],
              ["Conversas / mês", formatNumber(input.conversations)],
              ["E-mails / mês", formatNumber(input.emails)],
              ["Respostas de IA / mês", formatNumber(input.aiReplies)],
              [
                "Mensagens WhatsApp / mês",
                formatNumber(
                  input.whatsapp.marketing +
                    input.whatsapp.utilidade +
                    input.whatsapp.autenticacao +
                    input.whatsapp.servico,
                ),
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground text-xs">{label}</dt>
                <dd className="figure font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <ul className="mt-4 space-y-2">
            {result.lines
              .filter((line) => line.totalCents > 0)
              .map((line) => (
                <li key={line.key} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{line.label}</span>
                  <span className="figure shrink-0">{formatCurrencyCents(line.totalCents)}</span>
                </li>
              ))}
          </ul>

          <div className="border-border mt-4 border-t pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Recorrente mensal</span>
              <span className="figure text-xl font-semibold">
                {formatCurrencyCents(result.monthlyTotalCents)}
              </span>
            </div>
            <div className="text-muted-foreground mt-1 flex items-baseline justify-between text-sm">
              <span>Primeira fatura</span>
              <span className="figure">{formatCurrencyCents(result.firstInvoiceCents)}</span>
            </div>
          </div>

          <Button asChild variant="ghost" size="sm" className="mt-4 w-full">
            <Link href="/precos#simulador">Ajustar o dimensionamento</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
