import { CubeLoader } from "@/components/shell/cube-loader";

/**
 * Estado de carregamento das rotas do workspace.
 *
 * O Next mostra este arquivo enquanto o Server Component da rota busca dado e
 * renderiza. A barra lateral **continua na tela** — ela vive no layout, e o
 * `loading` só substitui o conteúdo —, o que é o comportamento certo: a
 * navegação permanece utilizável e a pessoa consegue mudar de ideia no meio da
 * espera.
 *
 * Fica no nível do grupo, e não em cada rota, porque a espera aqui tem sempre a
 * mesma natureza: renderização no servidor. Um arquivo por rota repetiria o
 * mesmo componente doze vezes para dizer a mesma coisa.
 */
export default function WorkspaceLoading() {
  return <CubeLoader />;
}
