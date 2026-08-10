/**
 * Troca de vertical — o único ponto que conhece os dois lados.
 *
 * `active.ts` guarda a escolha e não sabe que existe armazém; `store.ts` sabe
 * recarregar e não sabe que existe vertical. Este módulo os junta, e é ele que
 * a rota de API chama.
 *
 * A ordem importa: primeiro o identificador, depois a recarga. Invertida, o
 * armazém seria semeado com a vertical antiga e a interface mostraria a nova
 * escolha com os dados anteriores — o defeito que parece cache e não é.
 */

import type { DemoVerticalId } from "./types";
import { setActiveVerticalId } from "./active";
import { reseedStore } from "../repositories/store";

export function switchVertical(id: DemoVerticalId): void {
  setActiveVerticalId(id);
  reseedStore();
}
