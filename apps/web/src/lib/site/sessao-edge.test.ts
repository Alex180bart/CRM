import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { lerSessao } from "./sessao-edge";

const SEGREDO = "segredo-de-teste";
const env = { SITE_SESSION_SECRET: SEGREDO };

/**
 * Emite um token com o **mesmo algoritmo de `lib/site/auth.ts`**, e é essa
 * duplicação deliberada que dá valor ao arquivo: o servidor assina com
 * `node:crypto` e o middleware confere com a Web Crypto. Se um dos lados mudar
 * sozinho — outro separador, outro campo, outra ordem —, nada quebra em tempo de
 * compilação e ninguém vê erro. O que acontece é uma porta destrancada, ou toda
 * sessão válida recusada.
 */
function emitir(accountId: string, expiresAt: number, isAdmin: boolean, segredo = SEGREDO): string {
  const carga = `${accountId}.${expiresAt}.${isAdmin ? "1" : "0"}`;
  const assinatura = createHmac("sha256", segredo).update(carga).digest("hex");
  return `${carga}.${assinatura}`;
}

const AGORA = 1_760_000_000_000;
const DAQUI_A_UMA_HORA = AGORA + 3_600_000;

describe("leitura da sessão na borda", () => {
  it("aceita token válido e devolve o papel", async () => {
    const admin = await lerSessao(emitir("acc_1", DAQUI_A_UMA_HORA, true), env, AGORA);
    expect(admin).toEqual({ accountId: "acc_1", isAdmin: true });

    const comum = await lerSessao(emitir("acc_2", DAQUI_A_UMA_HORA, false), env, AGORA);
    expect(comum).toEqual({ accountId: "acc_2", isAdmin: false });
  });

  it("recusa token sem cookie, malformado ou truncado", async () => {
    expect(await lerSessao(undefined, env, AGORA)).toBeNull();
    expect(await lerSessao("", env, AGORA)).toBeNull();
    expect(await lerSessao("acc_1.123", env, AGORA)).toBeNull();
    expect(await lerSessao("acc_1.123.1", env, AGORA)).toBeNull();
  });

  it("recusa assinatura de outro segredo", async () => {
    const forjado = emitir("acc_1", DAQUI_A_UMA_HORA, true, "outro-segredo");
    expect(await lerSessao(forjado, env, AGORA)).toBeNull();
  });

  /**
   * O ataque óbvio contra papel-dentro-do-token: trocar o `0` por `1` e tentar
   * entrar como administrador. Só passa quem também souber assinar.
   */
  it("recusa promoção do papel sem reassinar", async () => {
    const comum = emitir("acc_2", DAQUI_A_UMA_HORA, false);
    const adulterado = comum.replace(/\.0\./, ".1.");

    expect(adulterado).not.toBe(comum);
    expect(await lerSessao(adulterado, env, AGORA)).toBeNull();
  });

  it("recusa token vencido, mesmo com assinatura boa", async () => {
    const vencido = emitir("acc_1", AGORA - 1, true);
    expect(await lerSessao(vencido, env, AGORA)).toBeNull();
  });

  /**
   * Sem `SITE_SESSION_SECRET`, o servidor cai numa chave de desenvolvimento que
   * está publicada neste repositório. O comportamento precisa ser o mesmo dos
   * dois lados: um recusando e o outro aceitando deixaria o ambiente local sem
   * login funcionando — ou, muito pior, produção aceitando token assinado com a
   * chave que qualquer pessoa pode ler.
   */
  it("usa a chave de desenvolvimento quando o segredo está ausente", async () => {
    const semSegredo = {};
    const token = emitir("acc_1", DAQUI_A_UMA_HORA, true, "elora-dev-session-secret-nao-usar-em-producao");

    expect(await lerSessao(token, semSegredo, AGORA)).toEqual({ accountId: "acc_1", isAdmin: true });
  });
});
