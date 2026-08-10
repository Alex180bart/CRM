"use client";

import Link from "next/link";
import * as React from "react";
import { Button, Callout, Tabs, TabsContent, TabsList, TabsTrigger } from "@elora/ui";
import { Calculator, Info, Layers, Send } from "lucide-react";

import { PricingSimulator } from "./pricing-simulator";
import { VerticalGallery } from "./vertical-gallery";

/**
 * O console da equipe comercial: bases de demonstração e simulador de preço.
 *
 * ## Por que o estado da aba fica aqui, e não na URL
 *
 * Numa reunião, a pessoa alterna entre as duas o tempo todo. Guardar na URL
 * encheria o histórico do navegador — e o botão "voltar", que o apresentador usa
 * para retornar do produto para o console, passaria a desfazer trocas de aba em
 * vez de voltar de página.
 *
 * ## O simulador é o mesmo da página pública
 *
 * Mesmo componente, mesma função de cálculo. Uma cópia "de vendedor" divergiria
 * do preço que o cliente vê em `/precos` no primeiro reajuste, e a divergência
 * apareceria na pior hora possível: com os dois olhando telas diferentes na
 * mesma chamada.
 */
export function AdminConsole({
  activeCompany,
  activeName,
}: {
  activeCompany: string;
  activeName: string;
}) {
  const [tab, setTab] = React.useState("demonstracoes");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="demonstracoes" className="gap-1.5">
          <Layers className="size-3.5" aria-hidden />
          Demonstrações
        </TabsTrigger>
        <TabsTrigger value="simulador" className="gap-1.5">
          <Calculator className="size-3.5" aria-hidden />
          Simulador de preços
        </TabsTrigger>
      </TabsList>

      <TabsContent value="demonstracoes" className="mt-6 focus-visible:outline-none">
        <Callout variant="info" icon={<Info />} className="mb-6">
          A base carregada agora é <strong>{activeCompany}</strong> ({activeName}). Trocar recarrega
          os dados do servidor e vale para todo mundo conectado nesta instância — em apresentação
          simultânea, combine antes quem troca.
        </Callout>

        <VerticalGallery />
      </TabsContent>

      <TabsContent value="simulador" className="mt-6 focus-visible:outline-none">
        <Callout variant="neutral" icon={<Calculator />} className="mb-6">
          <p className="font-medium">Mesmo simulador que o cliente vê em /precos.</p>
          <p className="mt-1 text-sm leading-relaxed">
            Monte o cenário com os números da operação dele. O endereço da página pública carrega o
            cenário — se quiser deixar o cliente conferir depois, use o botão do fim do resumo para
            gerar o pedido de orçamento com tudo preenchido.
          </p>
        </Callout>

        <PricingSimulator />

        <div className="border-border mt-8 flex flex-wrap items-center gap-3 border-t pt-6">
          <Button asChild variant="outline">
            <Link href="/precos#simulador">
              <Send />
              Abrir a versão pública para compartilhar
            </Link>
          </Button>
          <p className="text-muted-foreground text-xs">
            A tabela completa, com preço de excedente e repasse da Meta, fica em{" "}
            <Link href="/precos" className="text-primary underline underline-offset-4">
              /precos
            </Link>
            .
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
