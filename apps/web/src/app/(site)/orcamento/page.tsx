import type { Metadata } from "next";

import { QuoteForm } from "@/components/site/quote-form";
import { currentAccountPublic } from "@/lib/site/auth";

export const metadata: Metadata = {
  title: "Solicitar proposta",
  description:
    "Conte o tamanho da operação e o que precisa resolver. O time comercial monta a conta com os " +
    "seus números e responde em até um dia útil.",
};

/**
 * Pedido de proposta.
 *
 * A página não recebe mais cenário pela URL. O dimensionamento passou a ser
 * trabalho do comercial, na área restrita — ver `components/site/quote-form.tsx`
 * para o porquê de não haver preço nesta tela.
 */
export default async function OrcamentoPage() {
  const account = await currentAccountPublic();

  return (
    <>
      <section className="bg-primary text-primary-foreground aurora">
        <div className="mx-auto w-full max-w-6xl px-5 py-14">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Solicitar proposta
          </h1>
          <p className="text-primary-foreground/75 mt-3 max-w-2xl text-base leading-relaxed">
            A tabela é pública e está em preços. O que muda de operação para operação é o volume — e
            é isso que o time comercial dimensiona com você, sem cobrança por faixa que você não
            usa.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-12">
        <QuoteForm
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
