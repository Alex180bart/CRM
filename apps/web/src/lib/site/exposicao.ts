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
 * Fora de produção nada é bloqueado.
 *
 * Trancar o produto no ambiente local travaria o trabalho de quem desenvolve as
 * telas — e a variável precisaria ser lembrada em cada máquina nova, o que a
 * transformaria em cerimônia esquecida em vez de proteção.
 */
export function produtoExposto(env: AmbienteDeExposicao): boolean {
  if (env.NODE_ENV !== "production") return true;

  const valor = env.ELORA_EXPOR_PRODUTO?.trim().toLowerCase();
  return valor === "1" || valor === "true";
}

/** Diz se o caminho pedido pertence ao produto — comparação por segmento. */
export function ehDoProduto(pathname: string): boolean {
  return PREFIXOS_DO_PRODUTO.some(
    (prefixo) => pathname === prefixo || pathname.startsWith(`${prefixo}/`),
  );
}
