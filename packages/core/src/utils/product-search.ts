/**
 * Busca no catálogo, para a montagem de proposta.
 *
 * ## Por que não é `filter(includes)`
 *
 * Porque o catálogo real não é uma lista de dez itens com nomes distintos. Quem
 * monta proposta digita o que o **cliente** disse — "trilho", "clareamento",
 * "abrir empresa" — e o nome cadastrado quase nunca é essa palavra. Um
 * `includes` no nome devolve zero resultado e o vendedor conclui que o produto
 * não existe; um `includes` em tudo devolve o catálogo inteiro em ordem
 * aleatória, que dá no mesmo.
 *
 * O que muda o resultado é **onde** casou e **quantos** termos casaram. Nome vale
 * mais que descrição; começo de palavra vale mais que meio de palavra; e todos os
 * termos digitados precisam casar em algum lugar, senão "trilho spot" traria
 * tudo que fala de spot.
 *
 * ## O que "inteligente" quer dizer aqui, e o que não quer
 *
 * É recuperação **léxica e determinística** — a mesma disciplina de
 * `utils/knowledge.ts`. Não há modelo, não há embedding e não há aprendizado com
 * o histórico. A mesma consulta devolve a mesma ordem hoje e amanhã, o que é o
 * que permite ao vendedor decorar que "clar" traz clareamento.
 *
 * O que a aproxima de inteligente é o **contexto**: a conversa aberta entra como
 * sinal. Numa conversa cujo assunto é "cúpula trincada", o produto de reposição
 * sobe sem ninguém digitar nada. É sugestão por proximidade de vocabulário, não
 * previsão — e por isso cada resultado carrega o motivo pelo qual apareceu, para
 * a tela poder mostrá-lo em vez de pedir fé.
 *
 * ## Consulta vazia não é lista vazia
 *
 * Sem termo digitado, a busca devolve o catálogo **ordenado pelo contexto**. É o
 * estado inicial da tela, e é onde a sugestão tem mais valor: antes de o vendedor
 * saber o que procurar.
 */

import type { Product } from "../types/commerce";

/** U+0300–U+036F é o bloco de diacríticos combinantes. */
const DIACRITICS = /[\u0300-\u036f]/g;

function normalize(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

/**
 * Palavras que casariam com tudo e não informam nada.
 *
 * Sem esta lista, digitar "plano de saúde" faz "de" casar com metade do
 * catálogo e o resultado empata em todo lugar. Só entram termos de função —
 * nada de domínio, porque "mensal" e "anual" separam produto de verdade.
 */
const STOP_WORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "um",
  "uma",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "e",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "por",
  "para",
  "com",
  "sem",
  "ao",
  "aos",
  "que",
  "the",
]);

function tokenize(value: string): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/** Campo do produto onde um termo pode casar, com o peso da casa. */
interface Field {
  label: string;
  weight: number;
  read: (product: Product) => string;
}

/**
 * Os pesos são a regra de negócio da busca.
 *
 * `salesNotes` entra com peso baixo mas entra: é lá que mora a objeção conhecida
 * e o "combina com", que é exatamente o vocabulário que o cliente usa. Deixá-lo
 * de fora tornaria invisível o produto certo para a pergunta "tem algo para pé
 * direito alto?".
 */
const FIELDS: Field[] = [
  { label: "nome", weight: 10, read: (product) => product.name },
  { label: "chave", weight: 6, read: (product) => product.key.replace(/_/g, " ") },
  { label: "resumo", weight: 5, read: (product) => product.summary },
  { label: "o que inclui", weight: 4, read: (product) => product.includes.join(" ") },
  { label: "descrição", weight: 2, read: (product) => product.description },
  { label: "notas de venda", weight: 1, read: (product) => product.salesNotes },
];

export interface ProductMatch {
  product: Product;
  score: number;
  /** Por que este produto apareceu — a tela mostra, em vez de pedir fé. */
  reasons: string[];
  /** Subiu por causa da conversa aberta, não do que foi digitado. */
  fromContext: boolean;
}

export interface ProductSearchOptions {
  /**
   * Texto da conversa — assunto, últimas mensagens, tags.
   *
   * Entra como sinal fraco de propósito: contexto **desempata e sugere**, nunca
   * decide. Um contexto pesado faria a busca ignorar o que foi digitado, que é o
   * comportamento mais irritante possível numa caixa de busca.
   */
  context?: string;
  limit?: number;
  /** Inclui produtos inativos. Padrão: não — inativo some da montagem. */
  includeInactive?: boolean;
}

const CONTEXT_WEIGHT = 3;

/** Comprimento mínimo de um termo de contexto para valer alguma coisa. */
const CONTEXT_MIN_LENGTH = 4;

/**
 * Acima desta fatia do catálogo, o termo de contexto é descartado.
 *
 * É frequência inversa, na versão mais simples que resolve o problema
 * observado: a conversa traz dezenas de palavras, e as comuns — "produto",
 * "entrega", "valor", "cliente" — casam com quase tudo. Com elas contando, todo
 * item ganhava o selo de sugerido, e um selo que aparece em tudo não sugere
 * nada; vira ruído que o vendedor aprende a ignorar em dois dias.
 *
 * Trinta por cento é o corte: um termo que aparece em mais de um terço do
 * catálogo não distingue nada dentro dele. O que sobra são as palavras que
 * pertencem a poucos produtos — que é exatamente o que uma sugestão precisa ter.
 */
const CONTEXT_MAX_DOC_FRACTION = 0.3;

/** Quantos termos distintos precisam casar para o item ser "sugerido". */
const CONTEXT_MIN_HITS = 1;

/**
 * Quanto um termo vale num texto.
 *
 * Três degraus, e a diferença entre eles é o que ordena a lista:
 * palavra inteira > começo de palavra > pedaço no meio. Sem o degrau do meio,
 * "clar" não acharia "clareamento"; sem o de cima, "trilho" empataria com
 * "trilhos eletrificados" em qualquer campo.
 */
function termScore(haystack: string, term: string): number {
  if (!haystack.includes(term)) return 0;

  const boundary = new RegExp(`(^|[^a-z0-9])${term}([^a-z0-9]|$)`);
  if (boundary.test(haystack)) return 1;

  const prefix = new RegExp(`(^|[^a-z0-9])${term}`);
  if (prefix.test(haystack)) return 0.7;

  return 0.35;
}

export function searchProducts(
  products: Product[],
  query: string,
  options: ProductSearchOptions = {},
): ProductMatch[] {
  const pool = options.includeInactive ? products : products.filter((product) => product.active);
  const terms = tokenize(query);

  /** Texto onde o contexto procura: o que descreve o produto para quem compra. */
  const surfaceOf = (product: Product) =>
    normalize(
      `${product.name} ${product.summary} ${product.includes.join(" ")} ${product.salesNotes}`,
    );

  const surfaces = new Map(pool.map((product) => [product.id, surfaceOf(product)]));

  /**
   * Os termos do contexto passam por dois filtros antes de valer ponto.
   *
   * Curto demais não distingue ("kit", "voz"), e frequente demais também não —
   * ver `CONTEXT_MAX_DOC_FRACTION`. O que sobra é vocabulário específico, do tipo
   * "cúpula" ou "clareamento", que aponta para poucos itens.
   */
  const contextTerms = new Set<string>();
  const ceiling = Math.max(1, Math.floor(pool.length * CONTEXT_MAX_DOC_FRACTION));

  for (const term of new Set(tokenize(options.context ?? ""))) {
    if (term.length < CONTEXT_MIN_LENGTH) continue;

    let documentFrequency = 0;
    for (const surface of surfaces.values()) {
      if (termScore(surface, term) >= 0.7) documentFrequency += 1;
    }

    if (documentFrequency > 0 && documentFrequency <= ceiling) contextTerms.add(term);
  }

  const matches: ProductMatch[] = [];

  for (const product of pool) {
    const fields = FIELDS.map((field) => ({ field, text: normalize(field.read(product)) }));

    let score = 0;
    const reasons = new Set<string>();

    /**
     * Todos os termos precisam casar — e é aqui que a busca recusa resultado.
     *
     * Um `OR` traria o catálogo inteiro para "trilho spot", porque "spot"
     * aparece em quase tudo. Com `AND`, refinar a consulta refina a lista, que é
     * o que a pessoa espera ao digitar a segunda palavra.
     */
    let allMatched = true;

    for (const term of terms) {
      let best = 0;
      let bestLabel = "";

      for (const { field, text } of fields) {
        const value = termScore(text, term) * field.weight;
        if (value > best) {
          best = value;
          bestLabel = field.label;
        }
      }

      if (best === 0) {
        allMatched = false;
        break;
      }

      score += best;
      reasons.add(bestLabel);
    }

    if (!allMatched) continue;

    let contextHits = 0;
    if (contextTerms.size > 0) {
      const surface = surfaces.get(product.id) ?? "";
      for (const term of contextTerms) {
        if (termScore(surface, term) >= 0.7) contextHits += 1;
      }
    }

    const contextScore = contextHits >= CONTEXT_MIN_HITS ? contextHits * CONTEXT_WEIGHT : 0;

    /**
     * Contexto sozinho **não** cria resultado quando há consulta.
     *
     * Se o vendedor digitou "trilho", trazer o clareamento porque a conversa fala
     * de estética seria ignorar o que ele pediu. O contexto só entra quando a
     * consulta está vazia, ou como desempate entre quem já casou.
     */
    if (terms.length === 0 && contextScore === 0 && contextTerms.size > 0) {
      matches.push({ product, score: 0, reasons: [], fromContext: false });
      continue;
    }

    if (contextScore > 0) reasons.add("assunto da conversa");

    matches.push({
      product,
      score: score + contextScore,
      reasons: [...reasons],
      fromContext: terms.length === 0 && contextScore > 0,
    });
  }

  /**
   * Empate resolve por nome, nunca por ordem de chegada.
   *
   * A ordem do arranjo de origem muda quando alguém cadastra um produto novo, e
   * aí a lista de resultados de uma consulta que ninguém alterou muda junto — o
   * tipo de instabilidade que faz o vendedor desconfiar da busca.
   */
  matches.sort(
    (a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, "pt-BR"),
  );

  return options.limit ? matches.slice(0, options.limit) : matches;
}
