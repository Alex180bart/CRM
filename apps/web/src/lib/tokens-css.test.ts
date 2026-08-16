import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * O caminho sai do `exports` do pacote, não de uma pilha de `..`.
 *
 * `resolve(aqui, "../../../../packages/ui/src/styles/tokens.css")` funcionaria
 * hoje e quebraria no dia em que este arquivo mudasse de pasta — com uma
 * mensagem sobre arquivo inexistente, que não diz nada sobre a causa. O
 * `exports` do `@elora/ui` já declara onde a folha mora, e é ele que o
 * aplicativo usa para importá-la.
 */
const TOKENS = createRequire(import.meta.url).resolve("@elora/ui/styles.css");

/**
 * A folha de tokens do design system, conferida por fora.
 *
 * Mora aqui, e não em `packages/ui`, por uma razão de tipos: aquele pacote não
 * declara dependência de Node — `packages/core` chega a registrar `types: []`
 * por decisão —, e um teste que lê o sistema de arquivos precisa de `node:fs`.
 * O aplicativo já tem os tipos e já lê diretórios em teste (`exposicao.test.ts`).
 *
 * O que se testa aqui não é aparência — isso não cabe em asserção. É o punhado
 * de propriedades cuja ausência **não produz erro nenhum** e cujo sintoma
 * aparece longe da causa, semanas depois, como "o site está estranho no
 * celular".
 */
describe("folha de tokens", () => {
  /**
   * O byte que quebrou todos os utilitários de transform do Tailwind.
   *
   * O arquivo começava com BOM (`U+FEFF`). Como `@tailwind base` é a primeira
   * diretiva da folha, o byte invisível foi parar **colado no primeiro seletor
   * do CSS gerado** — que é justamente `*, ::before, ::after`, a regra onde o
   * Tailwind reseta `--tw-translate-x`, `--tw-rotate`, `--tw-scale-x` e o resto.
   *
   * Seletor com caractere estranho não casa com nada, e em CSS um item inválido
   * numa lista invalida a regra inteira. Resultado: as variáveis nunca eram
   * definidas, e toda declaração `transform: translate(var(--tw-translate-x),
   * …)` ficava inválida no cálculo. Na prática, `scale-*`, `translate-*` e
   * `rotate-*` **não funcionavam em lugar nenhum do produto** — inclusive no
   * `data-[state=checked]:translate-x-*` de qualquer switch.
   *
   * Nada disso gera aviso: o elemento simplesmente não se move. Foi descoberto
   * porque um indicador que deveria estar escondido em `scale-0` aparecia na
   * tela. Editor no Windows regrava BOM sem perguntar, então a guarda fica aqui.
   */
  it("não começa com BOM", () => {
    const bytes = readFileSync(TOKENS);
    const temBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    expect(
      temBom,
      "tokens.css voltou a ter BOM — o reset de --tw-* do Tailwind para de valer",
    ).toBe(false);
  });

  const bruto = readFileSync(TOKENS, "utf8");

  /**
   * Os comentários saem antes de qualquer asserção.
   *
   * Esta folha é mais comentário que regra — de propósito —, e as anotações
   * citam as propriedades pelo nome ao explicar por que uma delas **não** deve
   * ser escrita. Procurar no texto cru faria a explicação de um defeito reprovar
   * o teste que existe para impedi-lo.
   */
  const css = bruto.replace(/\/\*[\s\S]*?\*\//g, "");

  /**
   * `overflow: clip` no herói, e a queda `hidden` antes dele.
   *
   * `hidden` transforma o elemento em contêiner de rolagem, e é esse contêiner
   * que uma `animation-timeline: view()` toma como referência — com ele, o
   * parallax do herói mede progresso contra uma caixa que nunca rola e fica
   * parado no primeiro quadro. `clip` corta sem criar o contêiner.
   *
   * As duas linhas juntas importam: sozinho, `clip` deixa a mancha vazar em
   * navegador que não o conhece; sozinho, `hidden` desliga o parallax.
   */
  it("corta a aurora com clip, mantendo hidden como queda", () => {
    const bloco = css.match(/\.aurora\s*\{[^}]*\}/);
    expect(bloco, ".aurora sumiu da folha").not.toBeNull();
    expect(bloco?.[0]).toContain("overflow: hidden");
    expect(bloco?.[0]).toContain("overflow: clip");
    expect(bloco?.[0].indexOf("overflow: hidden")).toBeLessThan(
      bloco?.[0].indexOf("overflow: clip") ?? -1,
    );
  });

  /**
   * O prefixo `-webkit-` do desfoque escrito à mão some **junto com a
   * propriedade padrão** — o prefixador descarta as duas quando encontra o par
   * na ordem errada, e o vidro deixa de desfocar sem nenhum erro. Quem
   * acrescenta o prefixo é o autoprefixer, pelo browserslist do projeto.
   */
  it("declara o desfoque sem prefixo escrito à mão", () => {
    expect(css).not.toContain("-webkit-backdrop-filter");
    expect(css).toContain("backdrop-filter");
  });

  /**
   * A barra inferior é `fixed` e não ocupa espaço no fluxo. Sem o recuo, o fim
   * do rodapé fica atrás do vidro — legível pela metade, e sem rolagem
   * sobrando para resolver, porque a página já acabou.
   */
  it("reserva a altura da barra inferior no documento", () => {
    expect(css).toMatch(/\.has-tab-bar\s*\{[^}]*padding-bottom:\s*calc\([^)]*env\(safe-area/);
  });
});
