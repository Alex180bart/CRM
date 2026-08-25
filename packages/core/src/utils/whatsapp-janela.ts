import type { IsoDateTime } from "../types/common";
import type { WhatsappCategory } from "../pricing/catalog";
import { CURRENT_META_RATES, META_RATE_TABLES_ANUNCIADAS, ratesEffectiveAt } from "../pricing/meta-rates";

/**
 * A janela de atendimento do WhatsApp, e o que custa enviar agora.
 *
 * ## Por que isto é produto, e não detalhe de faturamento
 *
 * Desde julho de 2025 a Meta cobra **por mensagem**, não por conversa. A conta
 * do cliente deixou de depender de quantas conversas ele teve e passou a depender
 * de **quando** cada mensagem saiu: dentro da janela aberta pelo cliente, resposta
 * livre não custa nada; fora dela, só template, e template de marketing custa
 * nove vezes o de utilidade.
 *
 * Quem atende não tem como saber disso de cabeça — e é justamente quem decide o
 * envio. Uma plataforma que só repassa a fatura entrega a informação um mês
 * depois, quando não dá mais para escolher. Estas funções existem para a decisão
 * acontecer **antes** do clique.
 *
 * ## Três janelas, e elas não são a mesma coisa
 *
 * 1. **Janela de atendimento (24 h)** — abre a cada mensagem que o cliente manda.
 *    Enquanto está aberta, resposta livre é gratuita.
 * 2. **Janela FEP (72 h)** — quando o cliente chegou por anúncio Click-to-WhatsApp
 *    ou pelo botão da Página, e a empresa respondeu dentro das primeiras 24 h.
 *    Dentro dela **qualquer** mensagem é gratuita, inclusive marketing.
 * 3. **Fechada** — só template, sempre cobrado.
 *
 * A FEP é a mais valiosa e a menos conhecida: um lead que entra por anúncio custa
 * zero em mensagem por três dias.
 *
 * ## A gratuidade da janela tem prazo, e ele sai do dado
 *
 * A Meta anunciou que mensagem de serviço e template de utilidade dentro da
 * janela passam a ser cobrados. A data não está escrita aqui: sai da primeira
 * tabela anunciada em que o repasse de serviço deixa de ser zero — a mesma fonte
 * que a página de preços usa. Quando aquela tabela for promovida, estas funções
 * passam a cobrar sozinhas, sem ninguém lembrar de vir aqui.
 */

/* Origem -------------------------------------------------------------------- */

/**
 * Como a conversa começou.
 *
 * Só `anuncio_ctwa` e `botao_pagina` abrem a janela gratuita de 72 h — é isso que
 * separa um lead de anúncio de um lead que chegou pelo número no rodapé do site,
 * e a diferença vale dinheiro suficiente para justificar o campo.
 */
export type OrigemDaConversa = "cliente" | "anuncio_ctwa" | "botao_pagina" | "empresa";

export function ehPontoDeEntradaGratuito(origem: OrigemDaConversa): boolean {
  return origem === "anuncio_ctwa" || origem === "botao_pagina";
}

/* Estado da janela ----------------------------------------------------------- */

export type TipoDeJanela = "fep" | "atendimento" | "fechada";

export interface EstadoDaJanela {
  tipo: TipoDeJanela;
  /** Instante em que a janela vigente fecha. Ausente quando já está fechada. */
  expiraEm?: IsoDateTime;
  /** Minutos até fechar; zero quando fechada. */
  minutosRestantes: number;
}

export interface EntradaDaJanela {
  /**
   * Última mensagem **recebida** do cliente.
   *
   * É ela que abre e reabre a janela de 24 h — não a última mensagem da conversa.
   * Usar `lastMessageAt` seria o erro clássico: a empresa responde, o carimbo
   * avança, e a janela pareceria aberta para sempre enquanto o atendente
   * conversasse sozinho.
   */
  ultimaMensagemDoClienteAt?: IsoDateTime;
  origem: OrigemDaConversa;
  /**
   * Primeira resposta da empresa, quando houve.
   *
   * A janela FEP só nasce se a empresa respondeu **dentro das 24 h** iniciais. Sem
   * resposta, o anúncio não gera benefício nenhum — e é uma das razões práticas
   * para SLA curto em lead de campanha.
   */
  primeiraRespostaDaEmpresaAt?: IsoDateTime;
  nowIso: IsoDateTime;
}

const HORA = 3_600_000;
const JANELA_ATENDIMENTO_MS = 24 * HORA;
const JANELA_FEP_MS = 72 * HORA;

function minutosEntre(deIso: string, ateMs: number): number {
  return Math.max(0, Math.ceil((ateMs - new Date(deIso).getTime()) / 60_000));
}

export function estadoDaJanela(entrada: EntradaDaJanela): EstadoDaJanela {
  const fechada: EstadoDaJanela = { tipo: "fechada", minutosRestantes: 0 };

  const abertura = entrada.ultimaMensagemDoClienteAt;
  if (!abertura) return fechada;

  const agora = new Date(entrada.nowIso).getTime();
  const inicio = new Date(abertura).getTime();
  if (!Number.isFinite(inicio)) return fechada;

  /**
   * A FEP é conferida primeiro porque é mais permissiva e mais longa.
   *
   * Checar a janela de 24 h antes faria uma conversa de anúncio no segundo dia
   * ser classificada como fechada — e a plataforma cobraria do cliente uma
   * mensagem que a Meta entrega de graça.
   */
  if (ehPontoDeEntradaGratuito(entrada.origem) && entrada.primeiraRespostaDaEmpresaAt) {
    const resposta = new Date(entrada.primeiraRespostaDaEmpresaAt).getTime();
    const respondeuADentro = Number.isFinite(resposta) && resposta - inicio <= JANELA_ATENDIMENTO_MS;

    if (respondeuADentro) {
      const fimFep = inicio + JANELA_FEP_MS;
      if (agora < fimFep) {
        return {
          tipo: "fep",
          expiraEm: new Date(fimFep).toISOString(),
          minutosRestantes: minutosEntre(entrada.nowIso, fimFep),
        };
      }
    }
  }

  const fimAtendimento = inicio + JANELA_ATENDIMENTO_MS;
  if (agora < fimAtendimento) {
    return {
      tipo: "atendimento",
      expiraEm: new Date(fimAtendimento).toISOString(),
      minutosRestantes: minutosEntre(entrada.nowIso, fimAtendimento),
    };
  }

  return fechada;
}

/* Custo do envio ------------------------------------------------------------- */

/**
 * A data em que a janela deixa de ser gratuita.
 *
 * Derivada, não digitada: é a vigência da primeira tabela anunciada em que o
 * repasse de serviço deixa de ser zero. Enquanto não houver tabela assim, a
 * resposta é `undefined` e a gratuidade não tem prazo — que é o estado correto
 * quando a Meta não anunciou nada.
 */
export function fimDaGratuidadeNaJanela(): IsoDateTime | undefined {
  const anunciada = META_RATE_TABLES_ANUNCIADAS.find((tabela) => tabela.ratesMicros.servico > 0);
  return anunciada ? `${anunciada.effectiveFrom}T00:00:00-03:00` : undefined;
}

function janelaAindaEhGratuita(nowIso: IsoDateTime): boolean {
  // A tabela vigente é a autoridade: se o repasse de serviço já é maior que zero,
  // a mudança aconteceu, independentemente de qualquer data anunciada.
  if (CURRENT_META_RATES.ratesMicros.servico > 0) return false;

  const fim = fimDaGratuidadeNaJanela();
  if (!fim) return true;

  return new Date(nowIso).getTime() < new Date(fim).getTime();
}

export interface CustoDoEnvio {
  /** `false` quando a Meta entrega a mensagem sem cobrar. */
  cobrado: boolean;
  /** Repasse da Meta, em micros de real. Zero quando não é cobrado. */
  custoMicros: number;
  /** Frase curta para a interface, sempre preenchida. */
  motivo: string;
  /** Categoria efetivamente cobrada — `servico` quando é resposta livre. */
  categoria: WhatsappCategory;
}

export interface EntradaDoCusto {
  janela: EstadoDaJanela;
  /**
   * Categoria do template a enviar.
   *
   * `servico` significa resposta livre, sem template — o caso do atendente
   * digitando no compositor.
   */
  categoria: WhatsappCategory;
  nowIso: IsoDateTime;
}

/**
 * Quanto a Meta cobra para enviar esta mensagem, agora.
 *
 * Devolve **repasse**, não preço ao cliente: a taxa da plataforma por mensagem de
 * modelo é outra linha, com franquia por edição, e misturá-las produziria o
 * número que ninguém consegue conferir contra a fatura da Meta.
 */
export function custoDoEnvio(entrada: EntradaDoCusto): CustoDoEnvio {
  const tabela = ratesEffectiveAt(entrada.nowIso);
  const tarifa = tabela.ratesMicros[entrada.categoria] ?? 0;

  if (entrada.janela.tipo === "fep") {
    return {
      cobrado: false,
      custoMicros: 0,
      categoria: entrada.categoria,
      // O valor economizado entra na frase porque é o argumento que faz a equipe
      // responder rápido em lead de anúncio: sem número, "janela grátis" é jargão.
      motivo: "Grátis: janela de ponto de entrada gratuito (anúncio ou botão da Página).",
    };
  }

  if (entrada.janela.tipo === "atendimento") {
    const gratuitaAgora = janelaAindaEhGratuita(entrada.nowIso);
    const isentaNaJanela = entrada.categoria === "servico" || entrada.categoria === "utilidade";

    if (isentaNaJanela && gratuitaAgora) {
      return {
        cobrado: false,
        custoMicros: 0,
        categoria: entrada.categoria,
        motivo:
          entrada.categoria === "servico"
            ? "Grátis: resposta dentro da janela de 24 h aberta pelo cliente."
            : "Grátis: template de utilidade dentro da janela de 24 h.",
      };
    }

    return {
      cobrado: true,
      custoMicros: tarifa,
      categoria: entrada.categoria,
      motivo: isentaNaJanela
        ? "Cobrada: a gratuidade dentro da janela terminou."
        : "Cobrada: marketing e autenticação são cobrados mesmo com a janela aberta.",
    };
  }

  /**
   * Fora da janela **não existe resposta livre**.
   *
   * A Meta recusa mensagem não-template com a janela fechada, e o produto
   * precisa dizer isso antes do envio — não depois, com o erro do provedor. Como
   * a categoria efetiva passa a ser um template, o custo mostrado é o de
   * utilidade, que é o mais barato que resolve: quem vai reabrir conversa com
   * marketing sabe que escolheu isso.
   */
  if (entrada.categoria === "servico") {
    const utilidade = tabela.ratesMicros.utilidade;
    return {
      cobrado: true,
      custoMicros: utilidade,
      categoria: "utilidade",
      motivo: "A janela fechou: só template reabre a conversa, e ele é cobrado.",
    };
  }

  return {
    cobrado: true,
    custoMicros: tarifa,
    categoria: entrada.categoria,
    motivo: "Cobrada: janela fechada, envio por template.",
  };
}

/* Derivação a partir da conversa --------------------------------------------- */

/**
 * O mínimo que se precisa de uma mensagem para calcular a janela.
 *
 * Estrutural em vez de `Message` inteira: este módulo vive no `core` e não deve
 * depender do modelo do Inbox para uma conta de duas datas. Também é o que
 * permite calcular a janela a partir do payload do webhook, antes de existir
 * mensagem gravada.
 */
export interface MensagemParaJanela {
  direction: "entrada" | "saida";
  occurredAt: IsoDateTime;
}

/**
 * Deriva o estado da janela da lista de mensagens da conversa.
 *
 * ## Por que derivar em vez de guardar
 *
 * `Conversation` tem `lastMessageAt`, que é a última mensagem **de qualquer
 * lado** — usá-la aqui seria o defeito silencioso mais provável deste módulo: o
 * atendente responde, o carimbo avança, e a janela pareceria aberta enquanto ele
 * conversa sozinho. O que abre a janela é mensagem **de entrada**, e a lista de
 * mensagens já está na tela que precisa da informação.
 *
 * Quando o back-end entrar, vale materializar `lastInboundAt` na conversa para a
 * lista não precisar carregar mensagem — mas o cálculo continua sendo este, e a
 * coluna passa a ser cache, não segunda verdade.
 *
 * A origem chega por parâmetro porque o modelo ainda não a guarda: no WhatsApp
 * ela vem do campo `referral` do webhook, que identifica anúncio Click-to-WhatsApp.
 * Sem essa informação, o padrão é `cliente` — que subestima o benefício em vez de
 * prometer gratuidade que a Meta não deu.
 */
export function janelaDaConversa(input: {
  mensagens: readonly MensagemParaJanela[];
  origem?: OrigemDaConversa;
  nowIso: IsoDateTime;
}): EstadoDaJanela {
  let ultimaEntrada: string | undefined;
  let primeiraEntradaMs: number | undefined;
  let primeiraSaidaDepoisDaEntrada: string | undefined;

  for (const mensagem of input.mensagens) {
    const instante = new Date(mensagem.occurredAt).getTime();
    if (!Number.isFinite(instante)) continue;

    if (mensagem.direction === "entrada") {
      if (!ultimaEntrada || instante > new Date(ultimaEntrada).getTime()) {
        ultimaEntrada = mensagem.occurredAt;
      }
      if (primeiraEntradaMs === undefined || instante < primeiraEntradaMs) {
        primeiraEntradaMs = instante;
      }
      continue;
    }

    /**
     * A resposta que interessa é a primeira **depois** da primeira entrada.
     *
     * A janela FEP nasce da reação da empresa ao contato inicial. Uma mensagem de
     * saída anterior — disparo de campanha, por exemplo — não é resposta a nada, e
     * contá-la faria conversa fria parecer elegível.
     */
    if (primeiraEntradaMs !== undefined && instante >= primeiraEntradaMs) {
      if (
        !primeiraSaidaDepoisDaEntrada ||
        instante < new Date(primeiraSaidaDepoisDaEntrada).getTime()
      ) {
        primeiraSaidaDepoisDaEntrada = mensagem.occurredAt;
      }
    }
  }

  /**
   * A FEP conta das 72 h da **primeira** entrada, não da última.
   *
   * `estadoDaJanela` recebe uma data só, e para a FEP a referência correta é a
   * abertura do ponto de entrada. Passar a última entrada renovaria a gratuidade a
   * cada mensagem do cliente e prometeria de graça o que a Meta cobra.
   */
  const origem = input.origem ?? "cliente";
  const referenciaFep =
    primeiraEntradaMs !== undefined ? new Date(primeiraEntradaMs).toISOString() : undefined;

  if (ehPontoDeEntradaGratuito(origem) && referenciaFep && primeiraSaidaDepoisDaEntrada) {
    const fep = estadoDaJanela({
      ultimaMensagemDoClienteAt: referenciaFep,
      origem,
      primeiraRespostaDaEmpresaAt: primeiraSaidaDepoisDaEntrada,
      nowIso: input.nowIso,
    });

    if (fep.tipo === "fep") return fep;
  }

  return estadoDaJanela({
    ultimaMensagemDoClienteAt: ultimaEntrada,
    origem: "cliente",
    nowIso: input.nowIso,
  });
}

/* Apresentação --------------------------------------------------------------- */

/**
 * "68 h" em vez de "4.081 minutos".
 *
 * O atendente decide com essa informação no meio de uma conversa; unidade que
 * exige conta mental é unidade que ninguém lê.
 */
export function tempoRestanteLegivel(minutos: number): string {
  if (minutos <= 0) return "encerrada";
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    const resto = minutos % 60;
    return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
  }

  const dias = Math.floor(horas / 24);
  const restoHoras = horas % 24;
  return restoHoras === 0 ? `${dias} d` : `${dias} d ${restoHoras} h`;
}
