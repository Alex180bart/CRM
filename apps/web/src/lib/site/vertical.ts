import { cookies } from "next/headers";
import {
  activeVerticalId,
  isDemoVerticalId,
  switchVertical,
  type DemoVerticalId,
} from "@elora/core";

/**
 * A vertical de demonstração escolhida vive num cookie.
 *
 * ## O defeito que isto corrige
 *
 * `switchVertical` grava a escolha no `globalThis` e recarrega o armazém — o que
 * funciona num servidor só, que é onde este código nasceu. Em hospedagem
 * serverless cada requisição pode cair numa instância diferente, e a instância
 * que nunca ouviu falar da troca serve a base padrão. O sintoma é o que se viu:
 * clicar em "abrir esta demonstração" leva para dentro do produto e o produto
 * continua mostrando contabilidade, sem erro nenhum na tela.
 *
 * O cookie resolve porque viaja com a pessoa, não com o processo: cada instância
 * lê a escolha e alinha o próprio armazém antes de renderizar.
 *
 * ## Um efeito colateral que é melhoria
 *
 * Antes, a troca valia para a instalação inteira — dois vendedores demonstrando
 * ao mesmo tempo viam a base um do outro, e isso estava documentado como
 * limitação aceita. Com o cookie, a escolha passa a ser **por navegador**. É o
 * comportamento que a operação esperava desde o começo.
 *
 * O armazém continua sendo único por instância, então o recarregamento ainda é
 * global àquele processo: se duas pessoas com verticais diferentes caírem na
 * mesma instância, cada requisição realinha a base antes de responder. Custa uma
 * re-semeadura ocasional e devolve o dado certo — o que não dá para fazer sem
 * back-end é manter as duas bases vivas ao mesmo tempo.
 */
export const COOKIE_VERTICAL = "elora_demo";

const UM_ANO_EM_SEGUNDOS = 60 * 60 * 24 * 365;

/**
 * Alinha o armazém desta instância com a escolha de quem está pedindo a página.
 *
 * Chame no começo de toda superfície que lê dados de demonstração. Devolve a
 * vertical em vigor, para a tela não precisar perguntar de novo.
 */
export async function aplicarVerticalEscolhida(): Promise<DemoVerticalId> {
  const escolhida = (await cookies()).get(COOKIE_VERTICAL)?.value;

  // A comparação evita a re-semeadura no caso comum, que é a instância já estar
  // com a base certa. Sem ela, toda requisição descartaria o armazém e o custo
  // apareceria como lentidão sem causa aparente.
  if (isDemoVerticalId(escolhida) && escolhida !== activeVerticalId()) {
    switchVertical(escolhida);
  }

  return activeVerticalId();
}

/**
 * Grava a escolha e alinha o armazém.
 *
 * Só pode ser chamada de Server Action ou Route Handler — escrever cookie
 * durante a renderização de uma página é proibido pelo Next, e com razão: a
 * resposta pode já ter começado a ser transmitida.
 */
export async function definirVertical(id: DemoVerticalId): Promise<void> {
  (await cookies()).set(COOKIE_VERTICAL, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: UM_ANO_EM_SEGUNDOS,
  });

  switchVertical(id);
}
