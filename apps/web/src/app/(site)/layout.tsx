import { currentAccountPublic } from "@/lib/site/auth";
import { readSiteContent } from "@/lib/site/content-store";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/**
 * Casca do site público.
 *
 * Separada do workspace por grupo de rotas, e não por aplicativo à parte: o site
 * usa os mesmos tokens, os mesmos componentes e o mesmo motor de preço que o
 * produto. Um segundo Next no monorepo duplicaria o design system em dois
 * bundles e criaria a divergência que aparece meses depois, quando o botão da
 * landing page deixa de ser o botão do produto.
 *
 * O layout raiz continua sendo o de `app/layout.tsx` — é ele que resolve paleta,
 * modo e densidade antes da primeira pintura. Este acrescenta cabeçalho, rodapé
 * e a rolagem da página, que o workspace não tem (lá quem rola é o painel).
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [account, content] = await Promise.all([currentAccountPublic(), readSiteContent()]);

  /**
   * Sem `overflow-y-auto` aqui, e a ausência é o que faz o cabeçalho grudar.
   *
   * A primeira versão tinha `overflow-y-auto` neste contêiner, por simetria com
   * o workspace — onde quem rola é o painel, não a página. O efeito colateral é
   * conhecido e silencioso: **um ancestral com `overflow` diferente de `visible`
   * vira o contexto de rolagem do `position: sticky`**. Como este contêiner tem
   * `min-height` (e não `height`), ele cresce com o conteúdo e nunca rola por
   * dentro — então o cabeçalho ficava "grudado" no topo de uma caixa que subia
   * junto com a página, ou seja, sumia ao rolar.
   *
   * Sem a propriedade, quem rola é o documento e o `sticky top-0` do cabeçalho
   * passa a valer. O site rola como página; o produto continua rolando por
   * painel. São exigências diferentes e agora estão escritas assim.
   */
  return (
    <div className="bg-background flex min-h-full flex-col">
      <SiteHeader accountName={account?.name} content={content.header} />
      <main className="flex-1">{children}</main>
      <SiteFooter content={content.footer} />
    </div>
  );
}
