import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Callout, Card, CardContent } from "@elora/ui";
import { Info } from "lucide-react";

import { SignUpForm } from "@/components/site/auth-forms";
import { currentAccount } from "@/lib/site/auth";

export const metadata: Metadata = { title: "Criar conta" };

export default async function CadastrarPage() {
  if (await currentAccount()) redirect("/conta");

  return (
    <div className="mesh-surface flex min-h-[70vh] items-center justify-center px-5 py-16">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-7">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Criar conta</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Para pedir proposta com os seus dados prontos e acompanhar o andamento de cada pedido.
          </p>

          <Callout variant="neutral" icon={<Info />} className="mt-5">
            A senha é derivada com <code className="text-xs">scrypt</code> e a sessão é um cookie
            assinado — nada disso é de mentira. O que é de demonstração é a{" "}
            <strong>persistência</strong>: as contas vivem na memória do servidor e são apagadas no
            reinício, enquanto a fundação de back-end não entra. Preferimos avisar antes do
            formulário.
          </Callout>

          <div className="mt-6">
            <SignUpForm />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
