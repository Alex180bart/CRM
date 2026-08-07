/**
 * Cofre de segredos das contas de canal.
 *
 * ## Por que existe
 *
 * As credenciais do WhatsApp viviam no `.env`: quatro variáveis, uma conta. Isso
 * bastava enquanto o produto suportava **um** número — e deixa de bastar assim
 * que a segunda conta entra, porque duas contas têm dois tokens e um arquivo de
 * ambiente não tem onde guardar "o token da conta B".
 *
 * Então o segredo passa a ser por conta. E o lugar dele não é o repositório: o
 * repositório alimenta telas, e tela roda em navegador.
 *
 * ## A regra que não se negocia
 *
 * **Grava e não devolve.** Não existe função aqui que leia um segredo para fora
 * do servidor. `describe()` responde quais chaves existem — nunca os valores —, e
 * é isso que a tela de conexão consome para saber o que falta preencher.
 *
 * A única leitura de valor é `resolve()`, e ela existe para o webhook validar
 * assinatura e para o worker de envio autenticar. Ambos rodam no servidor, e
 * ambos usam o valor sem nunca o colocar numa resposta HTTP.
 *
 * ## O que este armazenamento é
 *
 * Um `Map` preso ao `globalThis`, como as sessões do webchat e o armazém da
 * Administração. Morre no reinício. **Não é um cofre de verdade** — o de verdade
 * é um gerenciador de segredos com rotação, versionamento e auditoria de acesso,
 * e entra com a fundação de back-end. O que este arquivo garante hoje é a
 * fronteira certa: quando o cofre real chegar, muda o corpo destas três funções
 * e nada mais.
 */

interface SecretBag {
  /** Chave do campo (`appSecret`, `accessToken`) → valor. */
  values: Record<string, string>;
  updatedAt: number;
}

const globalStore = globalThis as unknown as { __channelVault?: Map<string, SecretBag> };
const vault = (globalStore.__channelVault ??= new Map<string, SecretBag>());

/** Referência estável a partir do identificador da conta. */
export function secretRefFor(accountId: string): string {
  return `canal:${accountId}`;
}

/**
 * Grava os segredos informados, preservando os que não vieram.
 *
 * A mesclagem importa: o formulário de conexão mostra campo de segredo vazio
 * (porque não pode mostrar o valor), e quem edita só o token de acesso deixaria
 * o segredo do app em branco. Sobrescrever com vazio apagaria uma credencial
 * válida — e o sintoma seria o webhook recusando tudo, sem ninguém ligar as
 * duas coisas.
 */
export function storeSecrets(ref: string, values: Record<string, string>): void {
  const current = vault.get(ref)?.values ?? {};
  const next = { ...current };

  for (const [key, value] of Object.entries(values)) {
    const trimmed = value.trim();
    if (trimmed) next[key] = trimmed;
  }

  vault.set(ref, { values: next, updatedAt: Date.now() });
}

/** Quais segredos existem — **nunca** os valores. É o que a tela pode ver. */
export function describeSecrets(ref: string): string[] {
  return Object.keys(vault.get(ref)?.values ?? {});
}

/**
 * Lê um segredo. **Só no servidor.**
 *
 * Chamado pelo webhook para validar assinatura e pelo envio para autenticar. O
 * retorno nunca pode entrar numa resposta HTTP — e é por isso que esta função
 * mora aqui e não no repositório, onde qualquer tela a alcançaria.
 */
export function resolveSecret(ref: string, key: string): string | undefined {
  return vault.get(ref)?.values[key];
}

export function forgetSecrets(ref: string): void {
  vault.delete(ref);
}
