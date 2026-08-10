import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Callout, Card, CardContent } from "@elora/ui";
import { AlertTriangle, Lock } from "lucide-react";

import { SignInForm } from "@/components/site/auth-forms";
import { adminConfigured, currentAccount } from "@/lib/site/auth";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Já autenticado não vê formulário de login: vê a própria conta.
  if (await currentAccount()) redirect("/conta");

  const params = await searchParams;
  const raw = params.proximo;
  const requested = Array.isArray(raw) ? raw[0] : raw;

  /**
   * Só caminho interno atravessa a tela.
   *
   * A validação se repete na Server Action, e as duas precisam existir: esta
   * impede que o campo oculto nasça com um endereço externo; a de lá impede que
   * alguém o edite antes de enviar.
   */
  const next = requested?.startsWith("/") && !requested.startsWith("//") ? requested : undefined;

  return (
    <div className="mesh-surface flex min-h-[70vh] items-center justify-center px-5 py-16">
      <Card className="w-full max-w-md">
        <CardContent className="p-7">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Entrar na área do cliente
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Seus orçamentos e cenários salvos ficam aqui.
          </p>

          {/*
            O aviso existe por um caso real de diagnóstico.

            Sem as variáveis de ambiente, o login do administrador responde
            "e-mail ou senha incorretos" — a mesma mensagem de quem errou a
            senha, porque distinguir as duas transformaria o formulário em
            oráculo de cadastro. O efeito é alguém digitar a credencial certa
            várias vezes achando que errou, quando o servidor é que subiu sem o
            `.env`. A checagem aqui é de configuração, não de credencial: não
            revela e-mail nem senha, e some assim que as variáveis existem.
          */}
          {!adminConfigured() ? (
            <Callout variant="warning" icon={<AlertTriangle />} className="mt-5">
              <p className="font-medium">
                Este servidor está sem conta de administrador configurada.
              </p>
              <p className="mt-1 text-sm leading-relaxed">
                Defina <code className="text-xs">ELORA_ADMIN_EMAIL</code> e{" "}
                <code className="text-xs">ELORA_ADMIN_PASSWORD</code> no{" "}
                <code className="text-xs">.env</code> da raiz e <strong>reinicie o servidor</strong>{" "}
                — o Next lê o arquivo na inicialização. Contas de cliente continuam funcionando
                normalmente.
              </p>
            </Callout>
          ) : null}

          {next === "/admin" ? (
            <Callout variant="warning" icon={<Lock />} className="mt-5">
              As bases de demonstração são material de venda e ficam com a equipe comercial da
              Elora. Entre com a conta de administrador para abri-las.
            </Callout>
          ) : null}

          <div className="mt-6">
            <SignInForm next={next} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
