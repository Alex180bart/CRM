import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuoteRequest } from "@elora/core";

import { enderecoComercial, notificacaoConfigurada, notificarPedidoDeOrcamento } from "./notificacao";

const CHAVES = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_FROM",
  "ELORA_ORCAMENTO_DESTINO",
  "ELORA_ADMIN_EMAIL",
] as const;

const original: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const chave of CHAVES) {
    original[chave] = process.env[chave];
    delete process.env[chave];
  }
});

afterEach(() => {
  for (const chave of CHAVES) {
    if (original[chave] === undefined) delete process.env[chave];
    else process.env[chave] = original[chave];
  }
  vi.restoreAllMocks();
});

const PEDIDO: QuoteRequest = {
  id: "quote_1",
  organizationId: "org_1",
  name: "Joana Prado",
  email: "joana@exemplo.com.br",
  company: "Prado Contabilidade",
  teamSize: 8,
  status: "novo",
  reference: "2026-0007",
  createdAt: "2026-08-15T12:00:00.000Z",
} as QuoteRequest;

describe("configuração do envio", () => {
  it("exige usuário e senha — host tem padrão, o resto não", () => {
    expect(notificacaoConfigurada()).toBe(false);

    process.env.SMTP_USER = "comercial@eloraintelligence.com.br";
    expect(notificacaoConfigurada()).toBe(false);

    process.env.SMTP_PASSWORD = "segredo";
    expect(notificacaoConfigurada()).toBe(true);
  });

  /**
   * A ordem existe para o caso de quem configurou só metade: sem destino
   * dedicado, o pedido vai para a própria caixa que envia; sem SMTP nenhum, a
   * tela ainda tem um endereço para oferecer a quem preencheu o formulário.
   */
  it("resolve o endereço comercial na ordem esperada", () => {
    expect(enderecoComercial()).toBeUndefined();

    process.env.ELORA_ADMIN_EMAIL = "admin@exemplo.com";
    expect(enderecoComercial()).toBe("admin@exemplo.com");

    process.env.SMTP_USER = "envio@exemplo.com";
    expect(enderecoComercial()).toBe("envio@exemplo.com");

    process.env.ELORA_ORCAMENTO_DESTINO = "comercial@exemplo.com";
    expect(enderecoComercial()).toBe("comercial@exemplo.com");
  });

  it("ignora valor em branco", () => {
    process.env.SMTP_USER = "   ";
    process.env.SMTP_PASSWORD = "segredo";
    expect(notificacaoConfigurada()).toBe(false);
  });
});

describe("envio sem configuração", () => {
  /**
   * Este é o caminho que roda se alguém publicar sem preencher as variáveis, e o
   * que ele **não** pode fazer é lançar: a ação já gravou o pedido e precisa
   * responder ao formulário. O log com o pedido inteiro é a última rede — sem
   * SMTP e sem persistência, é o único lugar onde o lead ainda existe.
   */
  it("devolve o motivo e registra o pedido inteiro no log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await notificarPedidoDeOrcamento(PEDIDO);

    expect(resultado).toEqual({ enviado: false, motivo: "sem_configuracao" });
    expect(log).toHaveBeenCalledOnce();
    expect(String(log.mock.calls[0]?.[1])).toContain("2026-0007");
    expect(String(log.mock.calls[0]?.[1])).toContain("joana@exemplo.com.br");
  });
});
