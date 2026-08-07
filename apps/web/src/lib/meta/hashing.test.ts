/**
 * Equivalência com a referência Python.
 *
 * Os hashes esperados **não foram escritos à mão**: saíram de
 * `integracao_meta/hashing.py` executado sobre as mesmas entradas. É a única
 * verificação que vale para esta função, porque o erro dela é silencioso — um
 * hash fora da regra da Meta não gera exceção, apenas nunca casa com ninguém, e
 * o sintoma aparece semanas depois como taxa de correspondência ruim.
 */

import { describe, expect, it } from "vitest";

import {
  buildUserData,
  hashBirthDate,
  hashCity,
  hashCountry,
  hashEmail,
  hashGender,
  hashName,
  hashPhone,
  hashState,
  hashZip,
  matchSignalCount,
  normalizePhone,
} from "./hashing";

describe("equivalência com a referência Python", () => {
  it("e-mail: minúsculas e sem espaço nas pontas", () => {
    const vetores: Array<[string, string]> = [
      [
        "  Rafael.Souza@Contabilidade.com  ",
        "15bdf91f87eac56119ace0333fdbec36ca24b8fffc8da5dd1932d87e3fdb1716",
      ],
      ["a@b.co", "80305c9bb1bb2480e03894350e0a8a366dcbdeb302e69e0817aa0743abd77054"],
    ];
    for (const [entrada, esperado] of vetores) {
      expect(hashEmail(entrada)).toBe(esperado);
    }
  });

  it("nome: minúsculas, acento preservado", () => {
    const vetores: Array<[string, string]> = [
      ["  Rafael  ", "79063e8037fff16d297a1fe65136f1251126cddb2cc9870ecf8d653835538e85"],
      ["JOÃO", "d147147c3dcbe0ac2756b42297dd7f013f8b2fa6178e209c3f74dc7d752243ef"],
      ["Conceição", "01984f463a1681c5827b11a006db945028014d595133776dd6b6a68cd06260fd"],
    ];
    for (const [entrada, esperado] of vetores) {
      expect(hashName(entrada)).toBe(esperado);
    }
  });

  it("cidade: sem acento e só letras", () => {
    const vetores: Array<[string, string]> = [
      ["São Paulo", "8f7f2f7ccd3f2898cf4850905346e8fb333d00aac1c974f8f37326e068cf7b1e"],
      [" RIO DE JANEIRO ", "f1b5cb813c226fd2583edf275f51bfff0a70c162c9ee81bda595e0e5da213e4f"],
      ["Brasília", "3fc9b36d48613cd3e9a597bb72ab2330f3fd178a44e5e0850b51f573515a2297"],
    ];
    for (const [entrada, esperado] of vetores) {
      expect(hashCity(entrada)).toBe(esperado);
    }
  });

  it("estado: sigla em minúsculas", () => {
    const vetores: Array<[string, string]> = [
      ["SP", "be18b85f77fc024db379acf19e8a1ce62307ab7bb1bca395389ecfc2dafaf741"],
      [" rj ", "8604818af4d21bbfc08a82a68f3ab4666d6893aaf88134504530282d9fae818d"],
    ];
    for (const [entrada, esperado] of vetores) {
      expect(hashState(entrada)).toBe(esperado);
    }
  });

  it("CEP: só dígitos", () => {
    const vetores: Array<[string, string]> = [
      ["01310-100", "9a4a139dfbfcd2fc89a3cb4302dad65a35abd8d29a56c09a962b69c5cf3bca40"],
      [" 01310100 ", "9a4a139dfbfcd2fc89a3cb4302dad65a35abd8d29a56c09a962b69c5cf3bca40"],
    ];
    for (const [entrada, esperado] of vetores) {
      expect(hashZip(entrada)).toBe(esperado);
    }
  });

  it("país: ISO de duas letras", () => {
    const vetores: Array<[string, string]> = [
      ["BR", "885036a0da3dff3c3e05bc79bf49382b12bc5098514ed57ce0875aba1aa2c40d"],
      [" br ", "885036a0da3dff3c3e05bc79bf49382b12bc5098514ed57ce0875aba1aa2c40d"],
    ];
    for (const [entrada, esperado] of vetores) {
      expect(hashCountry(entrada)).toBe(esperado);
    }
  });

  it("gênero: reduzido a m ou f", () => {
    const vetores: Array<[string, string]> = [
      ["Masculino", "62c66a7a5dd70c3146618063c344e531e6d4b59e379808443ce962b3abd63c5a"],
      ["F", "252f10c83610ebca1a059c0bae8255eba2f95be4d1d7bcfa89d7248a82d9f111"],
    ];
    for (const [entrada, esperado] of vetores) {
      expect(hashGender(entrada)).toBe(esperado);
    }
  });

  it("nascimento: YYYYMMDD", () => {
    const vetores: Array<[string, string]> = [
      ["1985-03-07", "3756264b5db1cd31872fcfbf37bfb76673f6126c56a906fce638e38132fde7b4"],
      ["19850307", "3756264b5db1cd31872fcfbf37bfb76673f6126c56a906fce638e38132fde7b4"],
    ];
    for (const [entrada, esperado] of vetores) {
      expect(hashBirthDate(entrada)).toBe(esperado);
    }
  });

  it("telefone: casos em que a referência acerta", () => {
    const vetores: Array<[string, string]> = [
      ["(11) 99999-8888", "b8e374ecc3a7a117a4df68efc21b0157f7c2ea542f7edaf29b33dc8818cf695e"],
      ["11999998888", "b8e374ecc3a7a117a4df68efc21b0157f7c2ea542f7edaf29b33dc8818cf695e"],
      ["5511999998888", "b8e374ecc3a7a117a4df68efc21b0157f7c2ea542f7edaf29b33dc8818cf695e"],
      ["+55 11 3000-1000", "5762be83802239adda892b73a71dcec5794cf01be0b39d3651f51b948eed52b6"],
    ];
    for (const [entrada, esperado] of vetores) {
      expect(hashPhone(entrada)).toBe(esperado);
    }
  });
});

describe("telefone: onde a referência erra e esta versão corrige", () => {
  /**
   * DDD 55 é real — Santa Maria e região, no Rio Grande do Sul.
   *
   * A heurística original era "não começa com 55? prefixe 55". Um número
   * daquele DDD já começa com 55, então não recebia o país e o hash saía de um
   * número sem DDI. A base inteira daquela região sumia da correspondência sem
   * nenhum erro aparecer.
   */
  it("completa o país mesmo quando o DDD é 55", () => {
    expect(normalizePhone("5599998888")).toBe("555599998888");
    expect(normalizePhone("55999998888")).toBe("5555999998888");
  });

  /**
   * Sem DDD não há número. A referência prefixava o país num local de 9
   * dígitos e produzia `55999998888` — que não é o telefone de ninguém e,
   * pior, colidia com o celular legítimo de DDD 55 do caso acima: dois
   * contatos diferentes, o mesmo hash.
   */
  it("recusa número sem DDD em vez de inventar", () => {
    expect(normalizePhone("999998888")).toBeUndefined();
    expect(normalizePhone("99998888")).toBeUndefined();
    expect(hashPhone("999998888")).toBeUndefined();
  });

  it("aceita fixo e celular com DDD, e o formato internacional", () => {
    expect(normalizePhone("(11) 3000-1000")).toBe("551130001000");
    expect(normalizePhone("11999998888")).toBe("5511999998888");
    expect(normalizePhone("+55 11 99999-8888")).toBe("5511999998888");
  });
});

describe("bloco de correspondência", () => {
  it("omite o que não existe em vez de enviar vazio", () => {
    const data = buildUserData({ email: "a@b.co", phone: null, city: "" });

    expect(data.em).toHaveLength(1);
    // Campo presente e vazio piora a qualidade da correspondência sem
    // acrescentar informação: a Meta conta o campo, não o conteúdo.
    expect("ph" in data).toBe(false);
    expect("ct" in data).toBe(false);
  });

  it("mantém em texto puro o que a Meta exige sem hash", () => {
    const data = buildUserData({ externalId: "ct_123", fbp: "fb.1.2.3" });

    expect(data.external_id).toBe("ct_123");
    expect(data.fbp).toBe("fb.1.2.3");
  });

  it("conta os sinais de correspondência", () => {
    // Evento sem nenhum identificador é peso morto: a Meta aceita, processa e
    // nunca atribui. Contar permite barrar antes de enviar.
    expect(matchSignalCount(buildUserData({}))).toBe(0);
    expect(matchSignalCount(buildUserData({ email: "a@b.co", externalId: "x" }))).toBe(2);
  });
});
