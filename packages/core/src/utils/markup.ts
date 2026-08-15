/**
 * Markdown mínimo para o conteúdo editável do site.
 *
 * ## Por que um analisador próprio em vez de uma biblioteca
 *
 * O que precisa existir é `**negrito**`, `*itálico*` e `[texto](/link)`. Um
 * analisador completo traria tabela, imagem, HTML embutido e bloco de código —
 * e, principalmente, traria a **saída em HTML**, que só serve para a página se
 * for injetada com `dangerouslySetInnerHTML`. É exatamente o que não se quer
 * numa página pública alimentada por um campo de formulário.
 *
 * Aqui a saída é uma **árvore de nós**, e quem renderiza monta elementos React a
 * partir dela. Texto que não casa com nenhuma regra vira texto, ponto: colar
 * `<script>alert(1)</script>` num campo produz a string `<script>alert(1)</script>`
 * na tela, porque React escapa conteúdo de texto por construção.
 *
 * ## O endereço do link é conferido aqui, não na renderização
 *
 * `javascript:` num `href` executa ao clique. A conferência mora no analisador
 * porque é o único ponto por onde todo link passa — deixá-la no componente
 * significaria que o segundo componente a renderizar conteúdo esqueceria dela.
 * Endereço recusado não vira link quebrado: vira o texto do rótulo, que é o
 * desfecho que menos confunde quem lê.
 */

export type InlineNode =
  | { kind: "texto"; value: string }
  | { kind: "forte"; children: InlineNode[] }
  | { kind: "enfase"; children: InlineNode[] }
  | { kind: "link"; href: string; children: InlineNode[] };

/**
 * Esquemas aceitos num link.
 *
 * Caminho interno (`/precos`), âncora (`#produto`), web e e-mail. Nada mais —
 * `javascript:`, `data:` e `vbscript:` são as três formas conhecidas de
 * transformar um campo de texto em execução de código no navegador de quem
 * visita.
 */
function isSafeHref(href: string): boolean {
  const value = href.trim();
  if (value.length === 0) return false;
  if (value.startsWith("//")) return false; // URL absoluta com protocolo herdado
  if (value.startsWith("/") || value.startsWith("#")) return true;
  return /^(https?:\/\/|mailto:|tel:)/i.test(value);
}

/** Um link é interno quando o roteador do Next consegue tratá-lo. */
export function isInternalHref(href: string): boolean {
  return href.startsWith("/") || href.startsWith("#");
}

/**
 * Resolve os marcadores antes da análise.
 *
 * Marcador é `{nome}`, e o valor vem do catálogo de preços — é o que permite ao
 * texto citar a tarifa da Meta sem guardar uma cópia dela. Marcador sem valor
 * correspondente **fica visível** em vez de virar vazio: um `{precoUtilidade}`
 * aparecendo na página é feio e é corrigido no mesmo dia; um espaço em branco no
 * meio da frase passa despercebido por meses.
 */
export function applyPlaceholders(source: string, values: Record<string, string>): string {
  return source.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
  );
}

/**
 * Acha o parêntese que fecha o aberto em `open`.
 *
 * Conta profundidade em vez de pegar o primeiro `)`, e a diferença apareceu num
 * teste: `[clique](javascript:alert(1))` tem um parêntese **dentro** do
 * endereço. Com a busca ingênua, o endereço era cortado em `javascript:alert(1`
 * e o `)` restante vazava como texto solto no meio da frase.
 *
 * O caso é de laboratório do lado do `javascript:` — que é recusado de qualquer
 * forma —, mas não é raro do lado legítimo: endereço de artigo da Wikipédia
 * carrega parêntese com frequência.
 *
 * Devolve `-1` quando não fecha, e aí o colchete vira texto.
 */
function matchingParen(source: string, open: number): number {
  let depth = 0;

  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    else if (source[index] === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

/**
 * Analisa a ênfase de uma linha.
 *
 * Varredura simples da esquerda para a direita. `**` é testado antes de `*`,
 * senão todo negrito seria lido como itálico vazio seguido de itálico.
 * Delimitador que abre e não fecha vira texto — quem está escrevendo no meio de
 * uma frase não deveria ver o resto do parágrafo mudar de peso enquanto digita.
 */
export function parseInline(source: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = "";

  function flush(): void {
    if (buffer.length > 0) {
      nodes.push({ kind: "texto", value: buffer });
      buffer = "";
    }
  }

  let index = 0;

  while (index < source.length) {
    const rest = source.slice(index);

    if (rest.startsWith("**")) {
      const end = source.indexOf("**", index + 2);
      if (end > index + 2) {
        flush();
        nodes.push({ kind: "forte", children: parseInline(source.slice(index + 2, end)) });
        index = end + 2;
        continue;
      }
    }

    if (rest.startsWith("*")) {
      const end = source.indexOf("*", index + 1);
      if (end > index + 1) {
        flush();
        nodes.push({ kind: "enfase", children: parseInline(source.slice(index + 1, end)) });
        index = end + 1;
        continue;
      }
    }

    if (rest.startsWith("[")) {
      const close = source.indexOf("]", index + 1);
      // O parêntese precisa vir colado ao colchete: "[a] (b)" é texto, não link.
      if (close > index && source[close + 1] === "(") {
        const paren = matchingParen(source, close + 1);
        if (paren > close + 1) {
          const label = source.slice(index + 1, close);
          const href = source.slice(close + 2, paren).trim();
          flush();
          if (isSafeHref(href)) {
            nodes.push({ kind: "link", href, children: parseInline(label) });
          } else {
            // Endereço recusado: sobra o rótulo, sem link.
            nodes.push(...parseInline(label));
          }
          index = paren + 1;
          continue;
        }
      }
    }

    buffer += source[index];
    index += 1;
  }

  flush();
  return nodes;
}

/**
 * Quebra o texto em parágrafos e analisa cada um.
 *
 * Linha em branco separa parágrafo — a convenção do Markdown, e a que a pessoa
 * que escreve já espera. Quebra simples de linha **não** separa: colar um texto
 * de outro editor traz quebras de largura de coluna, e cada uma viraria um
 * parágrafo com o espaçamento de um.
 */
export function parseBlocks(source: string): InlineNode[][] {
  return source
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => parseInline(block.replace(/\s*\n\s*/g, " ")));
}

/** O texto sem marcação — para `<title>`, `alt` e contagem de caracteres. */
export function plainText(source: string): string {
  return parseInline(source)
    .map(function render(node): string {
      if (node.kind === "texto") return node.value;
      return node.children.map(render).join("");
    })
    .join("");
}
