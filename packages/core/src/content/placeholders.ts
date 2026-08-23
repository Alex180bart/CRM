/**
 * Os marcadores que o texto editável pode citar.
 *
 * ## Por que marcador, e não o número digitado no campo
 *
 * A landing page precisa dizer quanto a Meta cobra por mensagem de utilidade. Se
 * esse número for digitado no campo de texto, ele passa a existir em dois
 * lugares: aqui e em `pricing/meta-rates.ts`. No dia do reajuste, um dos dois é
 * atualizado — e o site anuncia um preço que a proposta não confirma. É o mesmo
 * raciocínio que mantém o simulador e a tabela de `/precos` chamando a mesma
 * função de cálculo.
 *
 * O marcador resolve isso sem tirar o texto das mãos de quem escreve: a frase é
 * editável, o número não.
 *
 * ## O catálogo é a fonte, sempre
 *
 * Nenhum valor deste arquivo é literal. Todos saem de `pricing/`, formatados
 * pelas mesmas funções que a tabela pública usa — inclusive `formatRateMicros`,
 * que é o único jeito de escrever `R$ 0,0350` sem o arredondamento que já
 * escondeu uma tarifa errada por seis vezes.
 */

import { CURRENT_META_RATES } from "../pricing/meta-rates";
import { formatDateOnly } from "../utils/datetime";
import { MONTHLY_PREMIUM_PCT, PLANS, WHATSAPP_PRICE_BY_CATEGORY } from "../pricing/catalog";
import { formatRateMicros } from "../utils/format";

/** Data ISO (`2026-07-01`) no formato que o leitor brasileiro espera. */
export interface ContentPlaceholder {
  key: string;
  /** O que o marcador significa, mostrado ao lado do campo no editor. */
  description: string;
}

/**
 * O catálogo mostrado no editor.
 *
 * Existe para que quem escreve descubra o marcador sem ler código — um recurso
 * que ninguém sabe que existe é um recurso que ninguém usa, e o texto voltaria a
 * trazer o número digitado à mão.
 */
export const CONTENT_PLACEHOLDERS: ContentPlaceholder[] = [
  { key: "precoMarketing", description: "Tarifa da Meta por mensagem de marketing" },
  { key: "precoUtilidade", description: "Tarifa da Meta por mensagem de utilidade" },
  { key: "precoAutenticacao", description: "Tarifa da Meta por mensagem de autenticação" },
  { key: "premioMensal", description: "Acréscimo cobrado sem compromisso anual" },
  { key: "vigencia", description: "Início da vigência da tabela da Meta" },
  { key: "conferencia", description: "Data da última conferência da tabela da Meta" },
  { key: "totalEdicoes", description: "Quantidade de edições publicadas" },
];

/**
 * Os valores, resolvidos contra o catálogo no instante da renderização.
 *
 * Função, e não constante: uma constante seria avaliada na carga do módulo e
 * congelaria a tarifa daquele instante — sem efeito prático hoje, porque o
 * catálogo é estático, e com efeito imediato no dia em que o preço passar a vir
 * do banco.
 */
export function contentPlaceholderValues(): Record<string, string> {
  return {
    precoMarketing: formatRateMicros(WHATSAPP_PRICE_BY_CATEGORY.marketing.metaCostMicros),
    precoUtilidade: formatRateMicros(WHATSAPP_PRICE_BY_CATEGORY.utilidade.metaCostMicros),
    precoAutenticacao: formatRateMicros(WHATSAPP_PRICE_BY_CATEGORY.autenticacao.metaCostMicros),
    premioMensal: `${MONTHLY_PREMIUM_PCT}%`,
    vigencia: formatDateOnly(CURRENT_META_RATES.effectiveFrom),
    conferencia: formatDateOnly(CURRENT_META_RATES.checkedOn),
    totalEdicoes: String(PLANS.length),
  };
}
