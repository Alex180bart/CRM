/**
 * O que este domínio publica.
 *
 * O repositório serve duas coisas do mesmo Next: o **site público** — landing
 * page, preços, pedido de proposta, conta e a mesa de trabalho comercial em
 * `/admin` — e o **produto**, que hoje é demonstração de instância única, sem
 * back-end, com o armazém em memória compartilhado por todo mundo que abrir a
 * página. No domínio de produção só o primeiro está pronto para público: o
 * grupo `(workspace)` não tem verificação de sessão, e um visitante que troca a
 * vertical de demonstração troca a base que todos os outros estão vendo — o que
 * inclui a apresentação que alguém da equipe está fazendo naquele instante.
 *
 * Por isso a guarda fecha o produto **por omissão** em produção, e a chave para
 * abri-lo é explícita. O lugar natural para demonstrar continua existindo: um
 * deploy de prévia com `ELORA_EXPOR_PRODUTO=1`, cuja URL não é o domínio da
 * empresa.
 *
 * ## Por que lista do produto, e não lista do site
 *
 * A lista branca seria o padrão mais seguro, mas transformaria **todo** endereço
 * desconhecido em bloqueio — inclusive o erro de digitação, que deixaria de cair
 * na página 404 do site. Nomear o produto mantém o 404 funcionando e tem um
 * único risco conhecido: a lista envelhece quando alguém acrescenta uma tela ao
 * `(workspace)` e esquece daqui. Esse risco é coberto por teste — `exposicao.test.ts`
 * lê os diretórios do grupo e falha se algum ficar de fora. Sem o teste, a tela
 * nova nasceria exposta e ninguém veria: não há erro, não há aviso, a página
 * simplesmente abre.
 */

/**
 * Prefixos que pertencem ao produto.
 *
 * `/api` entra inteiro porque **nenhuma** rota de API é usada pelo site público
 * — ele fala com o servidor por Server Action, que posta no caminho da própria
 * página. Deixá-las abertas com o produto fechado permitiria chamar
 * `/api/ai/copilot` direto e gastar a chave do provedor a partir de um endereço
 * que nenhuma tela alcança.
 *
 * `/webchat` cobre as duas coisas com esse nome: o editor de widget do produto e
 * o par público `frame` + `embed.js`. O widget vai junto de propósito — sem
 * Inbox acessível, a conversa que ele abre não tem quem atenda, e um canal que
 * recebe e não responde é pior que canal ausente.
 */
export const PREFIXOS_DO_PRODUTO = [
  "/api",
  "/login",
  "/webchat",
  "/administracao",
  "/agentes",
  "/analytics",
  "/automacoes",
  "/campanhas",
  "/chatbots",
  "/contatos",
  "/email-studio",
  "/inbox",
  "/inicio",
  "/jornadas",
  "/pipeline",
] as const;

export interface AmbienteDeExposicao {
  ELORA_EXPOR_PRODUTO?: string;
  NODE_ENV?: string;
}

/**
 * Quem alcança o produto neste domínio.
 *
 * São três estados porque o uso real tem três casos, e reduzi-los a um
 * liga-desliga forçava escolher entre expor a demonstração ao mundo ou não poder
 * demonstrar de lugar nenhum:
 *
 * - `aberto` — qualquer visitante. Serve para ambiente local e para uma prévia
 *   descartável, nunca para o endereço da empresa.
 * - `somente_admin` — exige sessão de administrador, a conta semeada pelas
 *   variáveis de ambiente. É o padrão em produção: a equipe comercial abre o
 *   produto na frente do cliente, e quem chega pela landing page não entra.
 * - `fechado` — ninguém. Existe para o dia em que o produto precisar sumir do ar
 *   sem esperar um deploy que remova código.
 *
 * O padrão em produção é `somente_admin`, e não `fechado`, porque já exige
 * credencial: o padrão seguro aqui é "pedir login", não "não existir". Fechar
 * por omissão custaria a cena em que tudo está configurado, o produto não abre e
 * ninguém sabe por quê.
 */
export type ModoDeExposicao = "aberto" | "somente_admin" | "fechado";

/**
 * Fora de produção nada é bloqueado.
 *
 * Trancar o produto no ambiente local travaria o trabalho de quem desenvolve as
 * telas — e a variável precisaria ser lembrada em cada máquina nova, o que a
 * transformaria em cerimônia esquecida em vez de proteção.
 */
export function modoDeExposicao(env: AmbienteDeExposicao): ModoDeExposicao {
  if (env.NODE_ENV !== "production") return "aberto";

  const valor = env.ELORA_EXPOR_PRODUTO?.trim().toLowerCase();

  if (valor === "1" || valor === "true" || valor === "aberto") return "aberto";
  if (valor === "0" || valor === "false" || valor === "nao" || valor === "fechado") return "fechado";

  // Inclui o valor ausente e o valor digitado errado. Um valor que ninguém
  // reconhece não pode significar "abra para todos": o erro de digitação viraria
  // exposição, sem nada na tela indicando isso.
  return "somente_admin";
}

/**
 * Atalho para quem só precisa saber se a peça deve ser desenhada.
 *
 * A galeria de verticais usa isto: com o produto atrás de login, o botão
 * continua valendo — quem está em `/admin` já é administrador, e o clique vai
 * funcionar.
 */
export function produtoExposto(env: AmbienteDeExposicao): boolean {
  return modoDeExposicao(env) !== "fechado";
}

/** Diz se o caminho pedido pertence ao produto — comparação por segmento. */
export function ehDoProduto(pathname: string): boolean {
  return PREFIXOS_DO_PRODUTO.some(
    (prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`),
  );
}
