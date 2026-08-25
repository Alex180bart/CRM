import { describe, expect, it } from "vitest";

import {
  custoDoEnvio,
  ehPontoDeEntradaGratuito,
  estadoDaJanela,
  fimDaGratuidadeNaJanela,
  janelaDaConversa,
  tempoRestanteLegivel,
} from "./whatsapp-janela";

const CLIENTE_ESCREVEU = "2026-08-16T10:00:00.000Z";

/** Uma hora depois da mensagem do cliente. */
const AGORA = "2026-08-16T11:00:00.000Z";

describe("estado da janela", () => {
  it("fica fechada quando o cliente nunca escreveu", () => {
    const janela = estadoDaJanela({ origem: "empresa", nowIso: AGORA });

    expect(janela.tipo).toBe("fechada");
    expect(janela.minutosRestantes).toBe(0);
  });

  it("abre 24 h a partir da mensagem do cliente", () => {
    const janela = estadoDaJanela({
      ultimaMensagemDoClienteAt: CLIENTE_ESCREVEU,
      origem: "cliente",
      nowIso: AGORA,
    });

    expect(janela.tipo).toBe("atendimento");
    expect(janela.expiraEm).toBe("2026-08-17T10:00:00.000Z");
    expect(janela.minutosRestantes).toBe(23 * 60);
  });

  it("fecha depois de 24 h", () => {
    const janela = estadoDaJanela({
      ultimaMensagemDoClienteAt: CLIENTE_ESCREVEU,
      origem: "cliente",
      nowIso: "2026-08-17T10:00:01.000Z",
    });

    expect(janela.tipo).toBe("fechada");
  });

  describe("ponto de entrada gratuito", () => {
    it("dá 72 h quando a empresa respondeu dentro das primeiras 24 h", () => {
      const janela = estadoDaJanela({
        ultimaMensagemDoClienteAt: CLIENTE_ESCREVEU,
        origem: "anuncio_ctwa",
        primeiraRespostaDaEmpresaAt: "2026-08-16T10:30:00.000Z",
        // Segundo dia: a janela de 24 h já fechou, mas a FEP continua.
        nowIso: "2026-08-17T12:00:00.000Z",
      });

      expect(janela.tipo).toBe("fep");
      expect(janela.expiraEm).toBe("2026-08-19T10:00:00.000Z");
    });

    /**
     * Sem resposta dentro das 24 h, o anúncio não gera benefício nenhum. É a
     * razão prática de SLA curto em lead de campanha: a demora não custa só a
     * venda, custa a gratuidade de três dias.
     */
    it("não dá FEP quando a empresa respondeu tarde", () => {
      const janela = estadoDaJanela({
        ultimaMensagemDoClienteAt: CLIENTE_ESCREVEU,
        origem: "anuncio_ctwa",
        primeiraRespostaDaEmpresaAt: "2026-08-17T11:00:00.000Z",
        nowIso: "2026-08-17T12:00:00.000Z",
      });

      expect(janela.tipo).toBe("fechada");
    });

    it("não dá FEP quando a empresa não respondeu", () => {
      const janela = estadoDaJanela({
        ultimaMensagemDoClienteAt: CLIENTE_ESCREVEU,
        origem: "anuncio_ctwa",
        nowIso: AGORA,
      });

      expect(janela.tipo).toBe("atendimento");
    });

    it("não dá FEP para quem chegou por outro caminho", () => {
      const janela = estadoDaJanela({
        ultimaMensagemDoClienteAt: CLIENTE_ESCREVEU,
        origem: "cliente",
        primeiraRespostaDaEmpresaAt: "2026-08-16T10:30:00.000Z",
        nowIso: "2026-08-17T12:00:00.000Z",
      });

      expect(janela.tipo).toBe("fechada");
    });

    /**
     * A FEP é conferida antes da janela de 24 h porque é mais permissiva. Na
     * ordem inversa, uma conversa de anúncio no primeiro dia seria classificada
     * como "atendimento" — e um template de marketing enviado ali apareceria
     * como cobrado quando a Meta o entrega de graça.
     */
    it("prefere FEP sobre atendimento quando as duas valem", () => {
      const janela = estadoDaJanela({
        ultimaMensagemDoClienteAt: CLIENTE_ESCREVEU,
        origem: "botao_pagina",
        primeiraRespostaDaEmpresaAt: "2026-08-16T10:10:00.000Z",
        nowIso: AGORA,
      });

      expect(janela.tipo).toBe("fep");
    });
  });

  it("reconhece as duas origens gratuitas e só elas", () => {
    expect(ehPontoDeEntradaGratuito("anuncio_ctwa")).toBe(true);
    expect(ehPontoDeEntradaGratuito("botao_pagina")).toBe(true);
    expect(ehPontoDeEntradaGratuito("cliente")).toBe(false);
    expect(ehPontoDeEntradaGratuito("empresa")).toBe(false);
  });
});

describe("custo do envio", () => {
  const fep = { tipo: "fep", minutosRestantes: 100 } as const;
  const aberta = { tipo: "atendimento", minutosRestantes: 100 } as const;
  const fechada = { tipo: "fechada", minutosRestantes: 0 } as const;

  it("na FEP, tudo é grátis — inclusive marketing", () => {
    for (const categoria of ["servico", "utilidade", "autenticacao", "marketing"] as const) {
      const custo = custoDoEnvio({ janela: fep, categoria, nowIso: AGORA });
      expect(custo.cobrado, categoria).toBe(false);
      expect(custo.custoMicros, categoria).toBe(0);
    }
  });

  it("na janela aberta, resposta livre e utilidade são grátis", () => {
    for (const categoria of ["servico", "utilidade"] as const) {
      const custo = custoDoEnvio({ janela: aberta, categoria, nowIso: AGORA });
      expect(custo.cobrado, categoria).toBe(false);
    }
  });

  /**
   * A isenção da janela **não** cobre marketing nem autenticação. Tratá-las como
   * grátis mostraria custo zero para o envio mais caro do catálogo, e a surpresa
   * chegaria na fatura.
   */
  it("na janela aberta, marketing e autenticação continuam cobrados", () => {
    const marketing = custoDoEnvio({ janela: aberta, categoria: "marketing", nowIso: AGORA });
    expect(marketing.cobrado).toBe(true);
    expect(marketing.custoMicros).toBe(321_700);

    const autenticacao = custoDoEnvio({ janela: aberta, categoria: "autenticacao", nowIso: AGORA });
    expect(autenticacao.cobrado).toBe(true);
  });

  /**
   * Fora da janela não existe resposta livre: a Meta recusa. Dizer isso antes do
   * envio é o ponto — depois, o atendente recebe um erro de provedor e não sabe
   * que precisava de template.
   */
  it("com a janela fechada, resposta livre vira template cobrado", () => {
    const custo = custoDoEnvio({ janela: fechada, categoria: "servico", nowIso: AGORA });

    expect(custo.cobrado).toBe(true);
    expect(custo.categoria).toBe("utilidade");
    expect(custo.custoMicros).toBe(35_000);
    expect(custo.motivo).toContain("janela fechou");
  });

  it("com a janela fechada, marketing custa a tarifa de marketing", () => {
    const custo = custoDoEnvio({ janela: fechada, categoria: "marketing", nowIso: AGORA });
    expect(custo.custoMicros).toBe(321_700);
  });

  /**
   * O gasto real da diferença de categoria: nove vezes. É o número que faz a
   * conversa sobre classificar template acontecer.
   */
  it("marketing custa mais de nove vezes a utilidade", () => {
    const marketing = custoDoEnvio({ janela: fechada, categoria: "marketing", nowIso: AGORA });
    const utilidade = custoDoEnvio({ janela: fechada, categoria: "utilidade", nowIso: AGORA });

    expect(marketing.custoMicros / utilidade.custoMicros).toBeGreaterThan(9);
  });
});

describe("o fim da gratuidade sai do dado", () => {
  it("aponta a vigência anunciada em que serviço passa a ser cobrado", () => {
    expect(fimDaGratuidadeNaJanela()).toBe("2026-10-01T00:00:00-03:00");
  });

  it("antes da data, resposta na janela é grátis", () => {
    const custo = custoDoEnvio({
      janela: { tipo: "atendimento", minutosRestantes: 60 },
      categoria: "servico",
      nowIso: "2026-09-30T12:00:00-03:00",
    });

    expect(custo.cobrado).toBe(false);
  });

  /**
   * Na virada, a mesma mensagem passa a ser cobrada — sem ninguém editar código.
   * É o que a estrutura de tarifas por vigência existe para garantir, e o teste
   * prova que a data está ligada ao comportamento, não só ao texto da página.
   */
  it("a partir da data, a mesma resposta passa a ser cobrada", () => {
    const custo = custoDoEnvio({
      janela: { tipo: "atendimento", minutosRestantes: 60 },
      categoria: "servico",
      nowIso: "2026-10-01T00:00:01-03:00",
    });

    expect(custo.cobrado).toBe(true);
    expect(custo.motivo).toContain("gratuidade dentro da janela terminou");
  });

  it("template de utilidade na janela segue a mesma data", () => {
    const antes = custoDoEnvio({
      janela: { tipo: "atendimento", minutosRestantes: 60 },
      categoria: "utilidade",
      nowIso: "2026-09-30T12:00:00-03:00",
    });
    const depois = custoDoEnvio({
      janela: { tipo: "atendimento", minutosRestantes: 60 },
      categoria: "utilidade",
      nowIso: "2026-10-02T12:00:00-03:00",
    });

    expect(antes.cobrado).toBe(false);
    expect(depois.cobrado).toBe(true);
  });

  /**
   * A FEP não foi afetada pelo anúncio, e é isso que a torna mais valiosa depois
   * de outubro: continua sendo o único caminho em que marketing sai de graça.
   */
  it("a FEP continua gratuita depois da virada", () => {
    const custo = custoDoEnvio({
      janela: { tipo: "fep", minutosRestantes: 60 },
      categoria: "marketing",
      nowIso: "2026-12-01T12:00:00-03:00",
    });

    expect(custo.cobrado).toBe(false);
  });
});

describe("derivação a partir das mensagens", () => {
  /**
   * O defeito que esta função existe para evitar: usar `lastMessageAt`, que é a
   * última mensagem de qualquer lado. O atendente responde, o carimbo avança, e a
   * janela pareceria aberta enquanto ele conversa sozinho.
   */
  it("a janela conta da última mensagem do cliente, não da do atendente", () => {
    const janela = janelaDaConversa({
      mensagens: [
        { direction: "entrada", occurredAt: "2026-08-15T10:00:00.000Z" },
        { direction: "saida", occurredAt: "2026-08-16T09:00:00.000Z" },
      ],
      nowIso: "2026-08-16T11:00:00.000Z",
    });

    // A entrada foi há 25 h: fechada, apesar de a saída ser recente.
    expect(janela.tipo).toBe("fechada");
  });

  it("reabre a cada nova mensagem do cliente", () => {
    const janela = janelaDaConversa({
      mensagens: [
        { direction: "entrada", occurredAt: "2026-08-15T10:00:00.000Z" },
        { direction: "saida", occurredAt: "2026-08-15T10:30:00.000Z" },
        { direction: "entrada", occurredAt: "2026-08-16T10:00:00.000Z" },
      ],
      nowIso: "2026-08-16T11:00:00.000Z",
    });

    expect(janela.tipo).toBe("atendimento");
    expect(janela.minutosRestantes).toBe(23 * 60);
  });

  it("conversa sem mensagem do cliente fica fechada", () => {
    const janela = janelaDaConversa({
      mensagens: [{ direction: "saida", occurredAt: "2026-08-16T10:00:00.000Z" }],
      nowIso: AGORA,
    });

    expect(janela.tipo).toBe("fechada");
  });

  it("reconhece FEP quando a origem é anúncio e houve resposta rápida", () => {
    const janela = janelaDaConversa({
      mensagens: [
        { direction: "entrada", occurredAt: "2026-08-16T10:00:00.000Z" },
        { direction: "saida", occurredAt: "2026-08-16T10:20:00.000Z" },
      ],
      origem: "anuncio_ctwa",
      nowIso: "2026-08-17T20:00:00.000Z",
    });

    expect(janela.tipo).toBe("fep");
  });

  /**
   * A FEP conta da **primeira** entrada. Contar da última renovaria a gratuidade
   * a cada mensagem do cliente e prometeria de graça o que a Meta cobra.
   */
  it("a FEP não é renovada por mensagem nova do cliente", () => {
    const janela = janelaDaConversa({
      mensagens: [
        { direction: "entrada", occurredAt: "2026-08-10T10:00:00.000Z" },
        { direction: "saida", occurredAt: "2026-08-10T10:20:00.000Z" },
        // Cinco dias depois, muito além das 72 h.
        { direction: "entrada", occurredAt: "2026-08-15T10:00:00.000Z" },
      ],
      origem: "anuncio_ctwa",
      nowIso: "2026-08-15T11:00:00.000Z",
    });

    // Continua valendo a janela normal de 24 h, não a FEP.
    expect(janela.tipo).toBe("atendimento");
  });

  /**
   * Disparo de campanha antes de o cliente falar não é resposta a nada. Contá-lo
   * faria conversa fria parecer elegível à gratuidade de 72 h.
   */
  it("saída anterior à entrada não gera FEP", () => {
    const janela = janelaDaConversa({
      mensagens: [
        { direction: "saida", occurredAt: "2026-08-16T09:00:00.000Z" },
        { direction: "entrada", occurredAt: "2026-08-16T10:00:00.000Z" },
      ],
      origem: "anuncio_ctwa",
      nowIso: "2026-08-17T20:00:00.000Z",
    });

    expect(janela.tipo).toBe("fechada");
  });

  it("ignora carimbo inválido em vez de quebrar", () => {
    const janela = janelaDaConversa({
      mensagens: [
        { direction: "entrada", occurredAt: "data-invalida" },
        { direction: "entrada", occurredAt: "2026-08-16T10:00:00.000Z" },
      ],
      nowIso: AGORA,
    });

    expect(janela.tipo).toBe("atendimento");
  });
});

describe("tempo restante legível", () => {
  it("usa a unidade que o atendente lê sem fazer conta", () => {
    expect(tempoRestanteLegivel(0)).toBe("encerrada");
    expect(tempoRestanteLegivel(45)).toBe("45 min");
    expect(tempoRestanteLegivel(60)).toBe("1 h");
    expect(tempoRestanteLegivel(90)).toBe("1 h 30 min");
    expect(tempoRestanteLegivel(24 * 60)).toBe("1 d");
    expect(tempoRestanteLegivel(68 * 60)).toBe("2 d 20 h");
  });
});
