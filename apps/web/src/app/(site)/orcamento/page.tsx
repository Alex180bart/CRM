import type { Metadata } from "next";

import { QuoteForm } from "@/components/site/quote-form";
import { currentAccountPublic } from "@/lib/site/auth";
import { parseQuoteInput } from "@/lib/site/quote-params";

export const metadata: Metadata = {
  title: "Solicitar orçamento",
  description:
    "Envie o cenário que você dimensionou no simulador e receba a proposta do time comercial em " +
    "até um dia útil.",
};

export default async function OrcamentoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const input = parseQuoteInput(params);
  const account = await currentAccountPublic();

  return (
    <>
      <section className="bg-primary text-primary-foreground aurora">
        <div className="mx-auto w-full max-w-6xl px-5 py-14">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Solicitar orçamento
          </h1>
          <p className="text-primary-foreground/75 mt-3 max-w-2xl text-base leading-relaxed">
            O cenário abaixo veio do simulador e é recalculado no servidor antes de ser gravado —
            então o número que você vê é o mesmo que o comercial recebe.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-12">
        <QuoteForm
          input={input}
          account={
            account
              ? {
                  name: account.name,
                  email: account.email,
                  company: account.company,
                  phone: account.phone,
                }
              : null
          }
        />
      </section>
    </>
  );
}
