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
 * ## O simulador vive aqui, e só aqui
 *
 * Ele já esteve na landing page e em `/precos`. Saiu do site por decisão
 * comercial: a tabela continua pública e completa, mas o **dimensionamento**
 * passa pela conversa, porque é nela que se descobre que metade das operações
 * precisa de menos do que imaginava — e uma calculadora pública devolve o número
 * cheio sem essa conversa acontecer.
 *
 * O que **não** mudou: é o mesmo componente e a mesma função pura de cálculo que
 * alimentam a tabela de `/precos`. Uma cópia "de vendedor" divergiria do que o
 * cliente vê no primeiro reajuste, e a divergência apareceria na pior hora
 * possível — com os dois olhando telas diferentes na mesma chamada.
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
          <p className="font-medium">O simulador existe só aqui.</p>
          <p className="mt-1 text-sm leading-relaxed">
            O site publica a tabela inteira, mas não a calculadora: quem dimensiona é você, com os
            números que o cliente disse na conversa. O cenário vive nesta aba enquanto a página
            estiver aberta — para levá-lo à reunião seguinte, anote os números, não o endereço.
          </p>
        </Callout>

        <PricingSimulator />

        <div className="border-border mt-8 flex flex-wrap items-center gap-3 border-t pt-6">
          <Button asChild variant="outline">
            <Link href="/precos" target="_blank" rel="noreferrer">
              <Send />
              Abrir a tabela pública numa aba
            </Link>
          </Button>
          <p className="text-muted-foreground text-xs">
            É o que o cliente enxerga: franquia por edição, preço de excedente e o repasse da Meta —
            sem total calculado.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
