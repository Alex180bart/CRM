/**
 * Porta e origem da aplicação em desenvolvimento.
 *
 * ## Por que existe um arquivo só para um número
 *
 * A porta estava escrita literalmente em cinco lugares: os dois scripts do
 * `package.json`, o valor de reserva do AI Gateway e os de duas rotas que montam
 * endereço a partir do cabeçalho `Host`. Mudá-la exigia lembrar dos cinco, e o
 * esquecido nunca era o script — era um dos valores de reserva, que só falha
 * quando o cabeçalho não vem: renderização no servidor, teste, script de linha
 * de comando. O sintoma aparecia como "o trecho de incorporação saiu apontando
 * para a porta antiga", horas depois, sem erro nenhum no console.
 *
 * Aqui o número tem um dono. Os scripts do `package.json` continuam com o valor
 * literal — `next dev -p` não lê módulo TypeScript —, e é por isso que a
 * constante traz o aviso logo abaixo: são **dois** lugares a manter em acordo,
 * não um. Melhor dois do que cinco, e o segundo está anotado.
 */

/**
 * Porta de desenvolvimento.
 *
 * **Ao mudar, mude também `apps/web/package.json`** (`dev` e `start`). Não há
 * como derivar um do outro: o script roda antes de qualquer código do projeto
 * ser carregado.
 */
export const DEV_PORT = 3200;

/**
 * Origem usada quando não há como descobrir a real.
 *
 * Vale só em execução de servidor sem requisição por trás. Onde existe
 * requisição, o `Host` manda — fixar a origem ali faria o trecho de incorporação
 * copiado em produção apontar para a máquina de quem desenvolveu.
 */
export const DEFAULT_APP_ORIGIN = `http://localhost:${DEV_PORT}`;

/** `localhost:3200`, para os pontos que compõem o endereço a partir do host. */
export const DEFAULT_APP_HOST = `localhost:${DEV_PORT}`;
