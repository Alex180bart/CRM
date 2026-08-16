import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { verticalMeta } from "@elora/core";
import { Badge, Button, Callout } from "@elora/ui";
import { ArrowRight, Lock } from "lucide-react";

import { AdminConsole } from "@/components/site/admin-console";
import { currentAccount, currentAdmin } from "@/lib/site/auth";
import { readSiteContent, siteContentSource } from "@/lib/site/content-store";
import { aplicarVerticalEscolhida } from "@/lib/site/vertical";

export const metadata: Metadata = {
  title: "Área comercial",
  /**
   * A página é privada, e o robô não deveria indexá-la.
   *
   * Não é sigilo — quem tem a conta entra e vê. É que um resultado de busca
   * levando a uma tela de "faça login" desperdiça o clique de quem procurava o
   * produto, e nenhuma das duas partes ganha nada com isso.
   */
  robots: { index: false, follow: false },
};

/**
 * A mesa de trabalho de quem vende.
 *
 * ## Por que as duas ferramentas moram na mesma página
 *
 * Demonstração e simulador são usados **na mesma reunião, alternando**: mostra a
 * tela, o cliente pergunta quanto custa, você calcula com os números dele,
 * volta para a tela. Em páginas separadas, esse vaivém custa duas navegações
 * por pergunta — e a segunda delas cai numa página pública, com cabeçalho de
 * marketing e botão de "solicitar orçamento" que não faz sentido para quem está
 * do lado de cá.
 *
 * ## Por que abas, e não as duas em sequência
 *
 * O simulador é alto. Empilhado abaixo das quatro bases, ele empurraria a
 * primeira coisa que se usa numa demonstração — o botão de abrir a base — para
 * fora da primeira tela toda vez que a página carregasse.
 *
 * ## A checagem de papel vive aqui e na ação
 *
 * Esta função decide se a página é desenhada. `openVerticalAction` decide se a
 * troca acontece. Server Action tem endereço próprio: um `POST` montado à mão
 * nunca passa por aqui.
 */
export default async function AdminPage() {
  const admin = await currentAdmin();

  if (!admin) {
    /**
     * Cliente autenticado vê o aviso; visitante vai para a entrada.
     *
     * Redirecionar quem já entrou com a conta certa e não tem o papel produziria
     * o vaivém clássico — a pessoa cai no login, entra de novo com a mesma conta
     * e volta para o login. Dizer "esta área é da equipe comercial" resolve em
     * uma tela.
     */
    const account = await currentAccount();
    if (!account) redirect("/entrar?proximo=/admin");

    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-20">
        <Callout variant="warning" icon={<Lock />}>
          <p className="font-medium">Esta área é da equipe comercial da Elora.</p>
          <p className="mt-1 text-sm leading-relaxed">
            As bases de demonstração carregam dados na instância inteira, então o acesso é restrito
            a quem conduz a apresentação. Se você quer conhecer o produto com dados do seu setor,
            peça uma demonstração guiada — respondemos em até um dia útil.
          </p>
        </Callout>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/orcamento">
              Pedir demonstração guiada
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/conta">Voltar para minha conta</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Lê a escolha do cookie, e não a memória da instância: sem isso a mesa
  // comercial anuncia "base ativa: contabilidade" logo depois de alguém abrir a
  // demonstração de e-commerce, porque quem respondeu foi outra instância.
  const active = verticalMeta(await aplicarVerticalEscolhida());
  const [content, contentSource] = await Promise.all([readSiteContent(), siteContentSource()]);

  return (
    <>
      <section className="bg-primary text-primary-foreground aurora">
        <div className="mx-auto w-full max-w-6xl px-5 py-12 md:py-14">
          <Badge variant="accent">Área comercial · {admin.name}</Badge>
          <h1 className="font-display mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            Tudo o que a demonstração precisa, numa página só.
          </h1>
          <p className="text-primary-foreground/75 mt-3 max-w-2xl text-base leading-relaxed">
            Abra a base do segmento do cliente, mostre o produto com dados que ele reconhece e
            calcule o preço com os números da operação dele — sem sair daqui.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-10">
        <AdminConsole
          activeCompany={active.company}
          activeName={active.name}
          content={content}
          contentSource={contentSource}
        />
      </section>

      <section className="bg-surface-sunken py-14">
        <div className="mx-auto w-full max-w-4xl px-5">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Como as bases são construídas
          </h2>
          <div className="text-muted-foreground mt-4 space-y-4 text-sm leading-relaxed">
            <p>
              Uma vertical é um <strong>overlay</strong> sobre a base original: reescreve o que
              carrega narrativa — organização, times, filas, contatos, conversas, funis, campanhas —
              e herda o resto. É o que mantém o custo de acrescentar a quinta parecido com o da
              segunda.
            </p>
            <p>
              Três famílias de identificador permanecem estáveis entre as verticais: filas, contas
              de canal e chaves de habilidade. Elas são citadas por módulos que a vertical não
              reescreve — o agente de IA aponta a fila de transbordo, o widget aponta a fila de
              destino. Trocar o identificador junto com o rótulo deixaria essas referências
              penduradas, e o sintoma seria discreto do pior jeito: nome de fila em branco no meio
              da demonstração.
            </p>
            <p>
              Os dados são fictícios e determinísticos. Nenhum nome, telefone, documento ou mensagem
              corresponde a pessoa real, e o instante de referência é fixo — é por isso que os
              contadores de SLA continuam fazendo sentido em qualquer dia que você abrir.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
