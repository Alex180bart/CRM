/**
 * Testes do Markdown mínimo.
 *
 * O alvo é a classe de defeito que este analisador existe para impedir, e ela é
 * silenciosa dos dois lados: marcação que não vira marcação (o negrito aparece
 * como asterisco na página publicada) e endereço que vira link quando não
 * deveria (`javascript:` num campo de texto de um painel autenticado, executando
 * no navegador de quem visita).
 *
 * Nenhuma das duas produz erro. A primeira é feia; a segunda é vulnerabilidade.
 */

import { describe, expect, it } from "vitest";

import { applyPlaceholders, parseBlocks, parseInline, plainText } from "./markup";

describe("parseInline", () => {
  it("lê negrito, itálico e link", () => {
    expect(parseInline("um **forte** e um *fraco*")).toEqual([
      { kind: "texto", value: "um " },
      { kind: "forte", children: [{ kind: "texto", value: "forte" }] },
      { kind: "texto", value: " e um " },
      { kind: "enfase", children: [{ kind: "texto", value: "fraco" }] },
    ]);
  });

  it("testa `**` antes de `*`", () => {
    /**
     * Sem esta precedência, todo negrito seria lido como itálico vazio seguido
     * de itálico — e o texto sairia com o peso errado em toda a página.
     */
    const nodes = parseInline("**negrito**");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe("forte");
  });

  it("trata delimitador que abre e não fecha como texto", () => {
    /**
     * É o estado de quem está digitando: o asterisco de abertura existe antes do
     * de fechamento. Se o analisador consumisse o resto do parágrafo, a prévia
     * mudaria de peso a cada tecla.
     */
    expect(parseInline("preço de 5 * 3 reais")).toEqual([
      { kind: "texto", value: "preço de 5 * 3 reais" },
    ]);
  });

  it("aceita caminho interno, âncora e endereço web", () => {
    for (const href of ["/precos", "#produto", "https://exemplo.com", "mailto:a@b.com"]) {
      const [node] = parseInline(`[rótulo](${href})`);
      expect(node).toEqual({
        kind: "link",
        href,
        children: [{ kind: "texto", value: "rótulo" }],
      });
    }
  });

  it("recusa esquema executável e deixa só o rótulo", () => {
    /**
     * O caso que motiva a conferência morar no analisador: `javascript:` num
     * `href` executa ao clique, e o texto vem de um campo de formulário que
     * termina numa página pública.
     */
    for (const href of ["javascript:alert(1)", "data:text/html,<script>", "vbscript:msgbox"]) {
      expect(parseInline(`[clique](${href})`)).toEqual([{ kind: "texto", value: "clique" }]);
    }
  });

  it("recusa URL absoluta com protocolo herdado", () => {
    // `//site-falso` é endereço absoluto, e a mesma armadilha que o destino de
    // login (`?proximo=`) já recusa.
    expect(parseInline("[ir](//site-falso.com)")).toEqual([{ kind: "texto", value: "ir" }]);
  });

  it("não interpreta marcação dentro de colchete solto", () => {
    expect(plainText("[a] (b)")).toBe("[a] (b)");
  });

  it("fecha no parêntese correspondente, não no primeiro", () => {
    /**
     * Endereço com parêntese existe no mundo real — artigo de enciclopédia é o
     * caso comum. Com a busca ingênua pelo primeiro `)`, o endereço era cortado
     * e o resto vazava como texto solto no meio da frase.
     */
    const [node] = parseInline("[verbete](https://pt.wikipedia.org/wiki/Elo_(desambiguação))");
    expect(node).toEqual({
      kind: "link",
      href: "https://pt.wikipedia.org/wiki/Elo_(desambiguação)",
      children: [{ kind: "texto", value: "verbete" }],
    });
  });
});

describe("parseBlocks", () => {
  it("separa parágrafo por linha em branco, e não por quebra simples", () => {
    /**
     * Texto colado de outro editor traz quebras de largura de coluna. Se cada
     * uma virasse parágrafo, o espaçamento estouraria a seção.
     */
    const blocks = parseBlocks("primeira linha\nainda o mesmo parágrafo\n\nsegundo parágrafo");
    expect(blocks).toHaveLength(2);
    expect(plainTextOf(blocks[0])).toBe("primeira linha ainda o mesmo parágrafo");
  });

  it("devolve lista vazia para texto em branco", () => {
    expect(parseBlocks("   \n\n  ")).toEqual([]);
  });
});

describe("applyPlaceholders", () => {
  it("substitui o marcador conhecido", () => {
    expect(applyPlaceholders("custa {preco} por mensagem", { preco: "R$ 0,0350" })).toBe(
      "custa R$ 0,0350 por mensagem",
    );
  });

  it("deixa visível o marcador sem valor", () => {
    /**
     * Apagar produziria um vazio no meio da frase, que passa despercebido por
     * meses. `{inexistente}` na página é feio e corrigido no mesmo dia.
     */
    expect(applyPlaceholders("valor: {inexistente}", {})).toBe("valor: {inexistente}");
  });
});

function plainTextOf(nodes: ReturnType<typeof parseInline>): string {
  return nodes
    .map(function render(node): string {
      return node.kind === "texto" ? node.value : node.children.map(render).join("");
    })
    .join("");
}
