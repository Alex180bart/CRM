"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { User } from "@crm/core";
import { ROLE_LABEL } from "@crm/core";
import { Avatar, Button, Callout, Input, Label, Separator, cn } from "@crm/ui";
import { ArrowRight, Info, KeyRound, ShieldCheck } from "lucide-react";

/**
 * Tela de entrada do protótipo.
 *
 * A autenticação real será Supabase Auth com MFA para perfis sensíveis
 * (seção 18 do plano). Aqui, a escolha de perfil serve para demonstrar como a
 * interface muda conforme o papel do usuário — nada é validado no servidor.
 */
export function LoginForm({ users }: { users: User[] }) {
  const router = useRouter();
  const [email, setEmail] = useState(users[0]?.email ?? "");
  const [password, setPassword] = useState("••••••••••");
  const [selectedId, setSelectedId] = useState(users[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    router.push("/inbox");
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col">
      <div className="mb-6 md:hidden">
        <span className="bg-primary text-primary-foreground inline-flex size-9 items-center justify-center rounded-lg text-sm font-bold">
          CF
        </span>
      </div>

      <h1 className="text-xl font-semibold tracking-tight">Entrar no CRM</h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Use suas credenciais corporativas da Contabilidade Facilitada.
      </p>

      <div className="mt-6 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail corporativo</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <button type="button" className="text-primary text-xs hover:underline">
              Esqueci minha senha
            </button>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
      </div>

      <Button type="submit" size="lg" className="mt-5 w-full" loading={submitting}>
        Entrar
        {submitting ? null : <ArrowRight />}
      </Button>

      <div className="text-muted-foreground mt-3 flex items-center gap-2 text-[11px]">
        <ShieldCheck className="text-success size-3.5" aria-hidden />
        MFA será exigida para perfis administrativos e de auditoria.
      </div>

      <div className="my-6 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
          Perfil de demonstração
        </span>
        <Separator className="flex-1" />
      </div>

      <fieldset>
        <legend className="sr-only">Escolha o perfil para explorar a interface</legend>
        <div className="grid max-h-52 gap-1.5 overflow-y-auto pr-1">
          {users.map((user) => (
            <label
              key={user.id}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border p-2 transition-colors",
                selectedId === user.id
                  ? "border-accent bg-accent-soft"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name="perfil"
                value={user.id}
                checked={selectedId === user.id}
                onChange={() => {
                  setSelectedId(user.id);
                  setEmail(user.email);
                }}
                className="sr-only"
              />
              <Avatar initials={user.initials} hue={user.accentHue} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">{user.name}</span>
                <span className="text-muted-foreground block truncate text-[11px]">
                  {ROLE_LABEL[user.role]}
                </span>
              </span>
              <KeyRound
                className={cn(
                  "size-3.5 shrink-0",
                  selectedId === user.id ? "text-accent" : "text-muted-foreground/40",
                )}
                aria-hidden
              />
            </label>
          ))}
        </div>
      </fieldset>

      <Callout variant="neutral" icon={<Info />} className="mt-5">
        Ambiente de protótipo com base de demonstração. Nenhum dado real de contato, mensagem ou
        documento é utilizado.
      </Callout>
    </form>
  );
}
