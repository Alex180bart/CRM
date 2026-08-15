import Link from "next/link";
import * as React from "react";
import {
  applyPlaceholders,
  contentPlaceholderValues,
  isInternalHref,
  parseBlocks,
  parseInline,
  type InlineNode,
} from "@elora/core";

/**
 * Renderiza o Markdown mínimo do conteúdo editável.
 *
 * ## Não existe `dangerouslySetInnerHTML` neste caminho
 *
 * O analisador devolve árvore de nós e esta função monta elementos React. É a
 * diferença entre "o texto pode conter marcação" e "o texto pode conter código":
 * qualquer coisa que não case com as três regras conhecidas chega à tela como
 * texto, escapado pelo próprio React.
 *
 * ## Link interno usa o roteador; externo abre fora
 *
 * `/precos` vira `<Link>` — navegação sem recarregar a página, que é o que
 * mantém a landing page rápida. Endereço de outro domínio vira `<a>` com
 * `target="_blank"` e `rel="noreferrer"`: sem o `rel`, a página aberta recebe
 * referência ao nosso `window` e pode reescrever a aba de origem.
 *
 * ## Os marcadores são resolvidos aqui, uma vez por texto
 *
 * `{precoUtilidade}` sai do catálogo de preços no instante da renderização.
 * Fazer isso no analisador misturaria duas responsabilidades; fazer no editor
 * gravaria o número no arquivo, que é justamente o acoplamento que o marcador
 * existe para evitar.
 */

function renderNodes(nodes: InlineNode[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (node.kind) {
      case "texto":
        return <React.Fragment key={key}>{node.value}</React.Fragment>;

      case "forte":
        return (
          <strong key={key} className="font-semibold">
            {renderNodes(node.children, key)}
          </strong>
        );

      case "enfase":
        return <em key={key}>{renderNodes(node.children, key)}</em>;

      case "link":
        return isInternalHref(node.href) ? (
          <Link key={key} href={node.href} className="underline underline-offset-4">
            {renderNodes(node.children, key)}
          </Link>
        ) : (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            {renderNodes(node.children, key)}
          </a>
        );
    }
  });
}

export interface RichTextProps {
  /** Markdown mínimo: `**negrito**`, `*itálico*` e `[texto](/link)`. */
  children: string;
  /**
   * Valores dos marcadores.
   *
   * Padrão: o catálogo de preços. Recebe outro mapa só no editor, onde a prévia
   * mostra o marcador resolvido sem depender de contexto de servidor.
   */
  values?: Record<string, string>;
  className?: string;
}

/**
 * Texto de uma linha só — título, rótulo, item de lista.
 *
 * Não envolve em `<p>`: usado dentro de `<h2>`, `<li>` e `<span>`, um parágrafo
 * aninhado produziria HTML inválido e o navegador fecharia a tag no lugar
 * errado, quebrando o layout de um jeito difícil de rastrear.
 */
export function RichLine({ children, values, className }: RichTextProps) {
  const resolved = applyPlaceholders(children, values ?? contentPlaceholderValues());
  const nodes = renderNodes(parseInline(resolved), "l");

  return className ? <span className={className}>{nodes}</span> : <>{nodes}</>;
}

/**
 * Texto de corpo, com parágrafos.
 *
 * Linha em branco separa parágrafo. O espaçamento entre eles sai do `className`
 * de quem chama — cada seção da página tem a sua medida, e fixá-la aqui
 * obrigaria a sobrescrever em metade dos usos.
 */
export function RichText({ children, values, className }: RichTextProps) {
  const resolved = applyPlaceholders(children, values ?? contentPlaceholderValues());
  const blocks = parseBlocks(resolved);

  if (blocks.length === 0) return null;

  return (
    <>
      {blocks.map((block, index) => (
        <p key={`b-${index}`} className={index === 0 ? className : `mt-3 ${className ?? ""}`}>
          {renderNodes(block, `b${index}`)}
        </p>
      ))}
    </>
  );
}
