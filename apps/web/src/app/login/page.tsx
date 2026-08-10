import type { Metadata } from "next";
import { repositories } from "@elora/core";

import { LoginForm } from "@/components/auth/login-form";
import { LogoWordmark } from "@/components/shell/logo";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  const [organization, users] = await Promise.all([
    repositories.directory.getOrganization(),
    repositories.directory.listUsers(),
  ]);

  return (
    <div className="mesh-surface bg-background flex min-h-full items-center justify-center p-6">
      <div className="border-border bg-surface shadow-overlay grid w-full max-w-4xl overflow-hidden rounded-2xl border md:grid-cols-[1.05fr_1fr]">
        {/* Painel de marca */}
        <div className="brand-surface text-primary-foreground hidden flex-col justify-between p-8 md:flex">
          <div>
            <LogoWordmark height={26} />
            <p className="text-primary-foreground/60 mt-1.5 text-[11px] leading-tight">
              {organization.name}
            </p>
          </div>

          <div>
            <p className="text-xl font-semibold leading-snug">
              Uma plataforma para adquirir, atender, qualificar, vender e reter.
            </p>
            <p className="text-primary-foreground/70 mt-3 text-sm leading-relaxed">
              WhatsApp, e-mail, Instagram, webchat e formulários em uma única linha do tempo do
              contato — com SLA, automação auditável e inteligência artificial sob controle humano.
            </p>
          </div>

          <dl className="border-primary-foreground/15 grid grid-cols-3 gap-4 border-t pt-5">
            <div>
              <dt className="text-primary-foreground/50 text-[10px] uppercase tracking-wide">
                Canais
              </dt>
              <dd className="text-lg font-semibold tabular-nums">5</dd>
            </div>
            <div>
              <dt className="text-primary-foreground/50 text-[10px] uppercase tracking-wide">
                Filas
              </dt>
              <dd className="text-lg font-semibold tabular-nums">4</dd>
            </div>
            <div>
              <dt className="text-primary-foreground/50 text-[10px] uppercase tracking-wide">
                Automações
              </dt>
              <dd className="text-lg font-semibold tabular-nums">4</dd>
            </div>
          </dl>
        </div>

        {/* Formulário */}
        <div className="p-8">
          <LoginForm users={users} />
        </div>
      </div>
    </div>
  );
}
