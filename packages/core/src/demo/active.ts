/**
 * Qual vertical está ativa agora.
 *
 * O estado vive no processo do servidor e é preso ao `globalThis` pelo mesmo
 * motivo do armazém da Administração: o `next dev` recarrega módulos a cada
 * edição, e sem a âncora a vertical escolhida voltaria para contabilidade no
 * meio de uma demonstração — o que parece defeito do produto e é do ambiente.
 *
 * **Não é preferência de usuário.** É estado da instância: quem trocar a
 * vertical troca para todo mundo que estiver naquele servidor. Isso é
 * intencional enquanto não há back-end — a alternativa seria um cookie por
 * navegador, e aí a base do Inbox divergiria da base que o `/api/*` responde,
 * porque o repositório em memória é único.
 */

import type { DemoDataset, DemoVerticalId } from "./types";
import { DEFAULT_VERTICAL, datasetFor, isDemoVerticalId } from "./registry";

const globalRef = globalThis as unknown as { __eloraDemoVertical?: DemoVerticalId };

export function activeVerticalId(): DemoVerticalId {
  const current = globalRef.__eloraDemoVertical;
  return isDemoVerticalId(current) ? current : DEFAULT_VERTICAL;
}

/**
 * Troca a vertical ativa. Não recarrega o armazém — quem faz isso é
 * `switchVertical` em `control.ts`, que é o único ponto que conhece os dois
 * lados. Separado para que este módulo continue sem dependência de repositório
 * e possa ser importado de qualquer lugar.
 */
export function setActiveVerticalId(id: DemoVerticalId): void {
  globalRef.__eloraDemoVertical = id;
}

export function dataset(): DemoDataset {
  return datasetFor(activeVerticalId());
}
