"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Callout, Input, Label } from "@elora/ui";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { signInAction, signUpAction, type FormState } from "@/app/(site)/actions";

/**
 * Formulários da área do cliente.
 *
 * `useActionState` em vez de estado próprio com `fetch`: o formulário continua
 * sendo um `<form action=...>` de verdade, então funciona antes do JavaScript
 * carregar e o erro volta renderizado pelo servidor. O que o cliente acrescenta
 * é só o estado de envio — que é exatamente o que HTML não dá.
 *
 * `useFormStatus` precisa estar num componente **filho** do `<form>`; é por isso
 * que o botão é um componente à parte e não uma linha no meio do formulário.
 */

const EMPTY: FormState = { ok: false };

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="mt-5 w-full" loading={pending}>
      {children}
      {pending ? null : <ArrowRight />}
    </Button>
  );
}

function FieldError({ state, field }: { state: FormState; field: string }) {
  if (state.field !== field || !state.message) return null;
  return <p className="text-destructive mt-1 text-xs">{state.message}</p>;
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, EMPTY);

  return (
    <form action={action}>
      {state.message && !state.field ? (
        <Callout variant="danger" icon={<AlertTriangle />} className="mb-4">
          {state.message}
        </Callout>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" name="name" autoComplete="name" required className="mt-1.5" />
          <FieldError state={state} field="name" />
        </div>

        <div>
          <Label htmlFor="email">E-mail corporativo</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1.5"
          />
          <FieldError state={state} field="email" />
        </div>

        <div>
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="(11) 99999-0000"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="company">Empresa</Label>
          <Input
            id="company"
            name="company"
            autoComplete="organization"
            required
            className="mt-1.5"
          />
          <FieldError state={state} field="company" />
        </div>

        <div>
          <Label htmlFor="jobTitle">Cargo</Label>
          <Input
            id="jobTitle"
            name="jobTitle"
            autoComplete="organization-title"
            className="mt-1.5"
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="mt-1.5"
          />
          <FieldError state={state} field="password" />
          <p className="text-muted-foreground mt-1 text-xs">
            Pelo menos 8 caracteres. Não exigimos símbolo nem maiúscula — isso produz senha anotada
            no papel e não melhora a segurança de forma relevante.
          </p>
        </div>
      </div>

      <SubmitButton>Criar conta</SubmitButton>

      <p className="text-muted-foreground mt-4 text-center text-sm">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-primary font-medium underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </form>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signInAction, EMPTY);

  return (
    <form action={action}>
      {next ? <input type="hidden" name="proximo" value={next} /> : null}
      {state.message && !state.field ? (
        <Callout variant="danger" icon={<AlertTriangle />} className="mb-4">
          {state.message}
        </Callout>
      ) : null}

      <div className="space-y-3">
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-1.5"
          />
          <FieldError state={state} field="email" />
        </div>

        <div>
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1.5"
          />
        </div>
      </div>

      <SubmitButton>Entrar</SubmitButton>

      <p className="text-muted-foreground mt-4 text-center text-sm">
        Ainda não tem conta?{" "}
        <Link href="/cadastrar" className="text-primary font-medium underline underline-offset-4">
          Criar agora
        </Link>
      </p>
    </form>
  );
}
