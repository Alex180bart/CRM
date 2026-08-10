"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { DEMO_VERTICALS, PLANS } from "@elora/core";
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

/**
 * Pedido de proposta.
 *
 * ## Por que não há preço nesta tela
 *
 * Houve uma versão em que o formulário exibia, ao lado, o cenário montado no
 * simulador público — com total mensal e primeira fatura. O simulador passou a
 * viver só na área comercial, e o resumo saiu junto: um painel de preço aqui
 * teria de mostrar o cálculo de um dimensionamento que ninguém fez, ou seja, o
 * padrão da tabela apresentado como se fosse a conta do visitante.
 *
 * O que restou é um formulário de contato qualificado. Ele pergunta as duas
 * coisas que o interessado responde sem calculadora — a edição que chamou a
 * atenção e o tamanho do time —, e ambas são **opcionais**: quem chega aqui
 * frequentemente quer justamente que alguém diga qual edição serve.
 *
 * ## E por que o campo de mensagem é o maior da tela
 *
 * Sem o cenário, ele passou a ser a única coisa que qualifica o pedido de
 * verdade. "Temos dois números de WhatsApp e migramos de outra ferramenta" vale
 * mais para a primeira ligação do que qualquer número que um formulário
 * conseguisse coletar.
 */

const EMPTY: FormState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="mt-5 w-full" loading={pending}>
      {pending ? "Enviando…" : "Enviar pedido de proposta"}
      {pending ? null : <Send />}
    </Button>
  );
}

export function QuoteForm({
  account,
}: {
  account?: { name: string; email: string; company: string; phone?: string } | null;
}) {
  const [state, action] = useActionState(requestQuoteAction, EMPTY);

  if (state.ok) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <CheckCircle2 className="text-success mx-auto size-10" aria-hidden />
          <h2 className="font-display mt-4 text-2xl font-semibold">Pedido registrado</h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-relaxed">
            {state.message} Guarde a referência{" "}
            <strong className="text-foreground">{state.reference}</strong> — é por ela que o time
            comercial vai localizar o seu pedido.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/conta">Ver meus pedidos</Link>
            </Button>
            <Button asChild>
              <Link href="/precos">Rever as edições</Link>
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
    <div className="mx-auto w-full max-w-2xl">
      <Card className="min-w-0">
        <CardContent className="p-6">
          <h2 className="font-display text-lg font-semibold">Seus dados</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            O time comercial responde em até um dia útil, já com a conta dimensionada para o seu
            caso.
          </p>

          <form action={action} className="mt-5">
            {state.message && !state.field ? (
              <Callout variant="danger" icon={<AlertTriangle />} className="mb-4">
                {state.message}
              </Callout>
            ) : null}

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

              <div>
                <Label htmlFor="teamSize">Colaboradores</Label>
                <Input
                  id="teamSize"
                  name="teamSize"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder="Quantas pessoas usariam"
                  className="mt-1.5"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="planKey">Edição de interesse</Label>
                <Select name="planKey" defaultValue="">
                  <SelectTrigger id="planKey" className="mt-1.5">
                    <SelectValue placeholder="Ainda não sei — me ajudem a escolher" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((plan) => (
                      <SelectItem key={plan.key} value={plan.key}>
                        {plan.name} — {plan.tagline}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                  Opcional. O que cada edição inclui está em{" "}
                  <Link href="/precos" className="text-primary underline underline-offset-4">
                    preços
                  </Link>
                  .
                </p>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="message">O que é mais importante no seu caso?</Label>
                <Textarea
                  id="message"
                  name="message"
                  rows={5}
                  placeholder="Ex.: precisamos migrar de outra ferramenta sem perder histórico, temos dois números de WhatsApp e uns 8 mil contatos na base."
                  className="mt-1.5"
                />
                <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                  Volume de contatos, conversas e disparos entra aqui, com as suas palavras — é o
                  que o comercial usa para montar a conta antes de ligar.
                </p>
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
    </div>
  );
}
