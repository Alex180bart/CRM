import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PREFIXOS_DO_PRODUTO, ehDoProduto, produtoExposto } from "./exposicao";

const aqui = dirname(fileURLToPath(import.meta.url));
const APP = resolve(aqui, "..", "..", "app");

function segmentosDe(grupo: string): string[] {
  return readdirSync(resolve(APP, grupo), { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .filter((nome) => !nome.startsWith("(") && !nome.startsWith("_") && !nome.startsWith("@"));
}

describe("prefixos do produto", () => {
  /**
   * Prefixo sem a barra inicial — `"inbox"` no lugar de `"/inbox"` — não casa
   * com nenhum caminho e não produz erro: a tela simplesmente deixa de ser
   * bloqueada. Barra no fim tem o mesmo efeito, porque a comparação já a
   * acrescenta ao testar o segmento.
   */
  it("declara prefixos com a forma que a comparação espera", () => {
    for (const prefixo of PREFIXOS_DO_PRODUTO) {
      expect(prefixo.startsWith("/"), `${prefixo} não começa com barra`).toBe(true);
      expect(prefixo.endsWith("/"), `${prefixo} termina com barra`).toBe(false);
    }
    expect(new Set(PREFIXOS_DO_PRODUTO).size).toBe(PREFIXOS_DO_PRODUTO.length);
  });

  /**
   * Este é o teste que sustenta a decisão de nomear o produto em vez de nomear o
   * site. Tela nova no `(workspace)` sem entrada aqui nasceria pública no
   * domínio da empresa, e o sintoma é o pior tipo: nenhum erro, nenhum aviso, a
   * página simplesmente abre para quem souber o endereço.
   */
  it("cobre todos os segmentos do grupo (workspace)", () => {
    const segmentos = segmentosDe("(workspace)");

    expect(segmentos.length).toBeGreaterThan(0);
    for (const segmento of segmentos) {
      expect(ehDoProduto(`/${segmento}`), `/${segmento} ficou fora de PREFIXOS_DO_PRODUTO`).toBe(
        true,
      );
    }
  });

  it("cobre as rotas de produto que moram fora do grupo", () => {
    // `/login` é a tela de entrada do produto e `/webchat` serve o widget.
    expect(ehDoProduto("/login")).toBe(true);
    expect(ehDoProduto("/webchat/frame")).toBe(true);
    expect(ehDoProduto("/webchat/embed.js")).toBe(true);
  });

  it("cobre a superfície de API inteira", () => {
    expect(ehDoProduto("/api")).toBe(true);
    expect(ehDoProduto("/api/ai/copilot")).toBe(true);
    expect(ehDoProduto("/api/canais/whatsapp/webhook")).toBe(true);
  });

  it("não bloqueia nenhuma rota do site público", () => {
    for (const caminho of segmentosDe("(site)")) {
      expect(ehDoProduto(`/${caminho}`), `/${caminho} é do site e foi bloqueado`).toBe(false);
    }
    expect(ehDoProduto("/")).toBe(false);
  });

  it("não bloqueia os ícones e a arte da marca", () => {
    for (const asset of ["/icon.svg", "/apple-icon.png", "/opengraph-image.png", "/marca/x.svg"]) {
      expect(ehDoProduto(asset)).toBe(false);
    }
  });

  /**
   * A comparação é por segmento, não por texto: um `startsWith` cru bloquearia
   * `/inicio-rapido` ou `/contatos-lp` — endereços de campanha que a área
   * comercial cria sem avisar ninguém.
   */
  it("não confunde prefixo com começo de palavra", () => {
    expect(ehDoProduto("/inicio-rapido")).toBe(false);
    expect(ehDoProduto("/contatos-lp")).toBe(false);
    expect(ehDoProduto("/apiario")).toBe(false);
  });
});

describe("chave de exposição", () => {
  it("libera tudo fora de produção", () => {
    expect(produtoExposto({ NODE_ENV: "development" })).toBe(true);
    expect(produtoExposto({ NODE_ENV: "test" })).toBe(true);
  });

  it("fecha por omissão em produção", () => {
    expect(produtoExposto({ NODE_ENV: "production" })).toBe(false);
    expect(produtoExposto({ NODE_ENV: "production", ELORA_EXPOR_PRODUTO: "" })).toBe(false);
    expect(produtoExposto({ NODE_ENV: "production", ELORA_EXPOR_PRODUTO: "sim" })).toBe(false);
  });

  it("aceita 1 e true, com espaço e maiúscula", () => {
    expect(produtoExposto({ NODE_ENV: "production", ELORA_EXPOR_PRODUTO: "1" })).toBe(true);
    expect(produtoExposto({ NODE_ENV: "production", ELORA_EXPOR_PRODUTO: " TRUE " })).toBe(true);
  });
});
