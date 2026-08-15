import { createTransport, type Transporter } from "nodemailer";
import { PLAN_BY_KEY, formatDateTime, isPlanKey, type QuoteRequest } from "@elora/core";

/**
 * O pedido de proposta sai do servidor por e-mail.
 *
 * ## Por que isto existe
 *
 * `repositories.site.createQuote` grava no armazém em memória, que é o
 * compromisso honesto enquanto não há back-end. Em hospedagem serverless esse
 * compromisso deixa de ser honesto e passa a ser perda: cada requisição pode
 * cair numa instância diferente, e a instância que gravou o pedido não é
 * necessariamente a que desenha a lista depois. O visitante lê "responderemos em
 * até um dia útil" e ninguém do lado de cá jamais viu o pedido.
 *
 * O e-mail é a saída mínima que resolve o essencial: o lead chega a uma caixa
 * que alguém abre. Não substitui a persistência — substitui o silêncio.
 *
 * ## Falha não é exceção
 *
 * Nada aqui lança. A ação que chama já gravou o pedido e precisa responder ao
 * formulário; um erro subindo produziria a página de erro do Next no lugar da
 * confirmação, e a pessoa perderia o que digitou sem saber se o pedido saiu. O
 * resultado volta como dado, e quem chama decide o que dizer na tela.
 */

export type ResultadoNotificacao =
  | { enviado: true }
  | { enviado: false; motivo: "sem_configuracao" | "falha_envio"; detalhe?: string };

interface ConfiguracaoSmtp {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  to: string;
}

function texto(valor: string | undefined): string | undefined {
  const limpo = valor?.trim();
  return limpo ? limpo : undefined;
}

/**
 * A configuração é lida a cada envio, não no carregamento do módulo.
 *
 * Módulo carregado uma vez congela o ambiente daquele instante — e no
 * `next dev`, que recarrega módulos a cada edição, isso produziria o par
 * clássico de "mudei a variável e o servidor continua com a antiga". O custo de
 * ler `process.env` por pedido é nulo perto de abrir uma conexão SMTP.
 */
function configuracao(): ConfiguracaoSmtp | null {
  const host = texto(process.env.SMTP_HOST) ?? "smtp.titan.email";
  const user = texto(process.env.SMTP_USER);
  const password = process.env.SMTP_PASSWORD;

  // Destino separado do remetente: a caixa que envia costuma ser genérica
  // (`nao-responda@`) e a que recebe é a do time comercial.
  const to = texto(process.env.ELORA_ORCAMENTO_DESTINO) ?? user;

  if (!user || !password || !to) return null;

  const portaBruta = Number(texto(process.env.SMTP_PORT) ?? "465");
  const port = Number.isFinite(portaBruta) && portaBruta > 0 ? Math.floor(portaBruta) : 465;

  return { host, port, user, password, from: texto(process.env.SMTP_FROM) ?? user, to };
}

/** Diz se o envio está configurado — a tela usa para explicar o que vai acontecer. */
export function notificacaoConfigurada(): boolean {
  return configuracao() !== null;
}

/**
 * Endereço para onde mandar quem não conseguiu ser notificado pelo sistema.
 *
 * Cai para a conta de administrador do site quando não há SMTP: é o e-mail da
 * pessoa que opera a área comercial, e nesse cenário ela é exatamente quem
 * precisa receber o recado. Devolve `undefined` quando nada está configurado —
 * a tela então omite a frase em vez de citar um endereço inventado.
 */
export function enderecoComercial(): string | undefined {
  return (
    texto(process.env.ELORA_ORCAMENTO_DESTINO) ??
    texto(process.env.SMTP_USER) ??
    texto(process.env.ELORA_ADMIN_EMAIL)
  );
}

/**
 * O transporte é reaproveitado entre pedidos da mesma instância.
 *
 * Abrir conexão SMTP por pedido custa um handshake TLS inteiro, e o Titan — como
 * a maioria dos provedores — limita conexões por minuto. O `globalThis` sobrevive
 * ao recarregamento de módulo do `next dev`, pelo mesmo motivo que o armazém e o
 * cache de conteúdo moram lá.
 */
const cache = globalThis as unknown as {
  __eloraSmtp?: { chave: string; transporte: Transporter };
};

function transporte(config: ConfiguracaoSmtp): Transporter {
  // A chave inclui tudo o que define a conexão: mudar a senha na Vercel precisa
  // derrubar o transporte antigo, senão a instância continua autenticando com a
  // anterior até ser reciclada.
  const chave = `${config.host}:${config.port}:${config.user}:${config.password}`;
  const atual = cache.__eloraSmtp;
  if (atual?.chave === chave) return atual.transporte;

  const novo = createTransport({
    host: config.host,
    port: config.port,
    // 465 é TLS implícito; 587 negocia com STARTTLS. Errar isto trava o envio
    // num tempo limite em vez de num erro de autenticação, que é o sintoma mais
    // difícil de ligar à causa.
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
  });

  cache.__eloraSmtp = { chave, transporte: novo };
  return novo;
}

/**
 * Assunto não aceita quebra de linha.
 *
 * O nome vem de campo de formulário, e `\n` num cabeçalho de e-mail é injeção de
 * cabeçalho — o clássico de acrescentar um `Bcc:` pelo nome da empresa. O
 * nodemailer já codifica, mas a defesa fica aqui também porque é uma linha e
 * porque a codificação dele é detalhe de implementação, não contrato.
 */
function umaLinha(valor: string): string {
  return valor.replace(/[\r\n]+/g, " ").trim();
}

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linhas(pedido: QuoteRequest): Array<[string, string]> {
  // A edição chega como chave (`essencial`) e sai com o nome do catálogo. Quem lê
  // o e-mail é a área comercial, que fala em nome de edição, não em identificador.
  const edicao = isPlanKey(pedido.planKey) ? PLAN_BY_KEY[pedido.planKey].name : pedido.planKey;

  const campos: Array<[string, string | undefined]> = [
    ["Referência", pedido.reference],
    ["Nome", pedido.name],
    ["E-mail", pedido.email],
    ["Telefone", pedido.phone],
    ["Empresa", pedido.company],
    ["Segmento", pedido.segment],
    ["Edição de interesse", edicao],
    ["Tamanho do time", pedido.teamSize ? `${pedido.teamSize} pessoas` : undefined],
    ["Já tem conta no site", pedido.accountId ? "Sim" : "Não"],
    ["Recebido em", formatDateTime(pedido.createdAt)],
  ];

  return campos.filter((par): par is [string, string] => Boolean(par[1]));
}

export async function notificarPedidoDeOrcamento(
  pedido: QuoteRequest,
): Promise<ResultadoNotificacao> {
  const config = configuracao();

  if (!config) {
    /**
     * Ausência de configuração é registrada com o pedido inteiro no log.
     *
     * É a última rede: sem SMTP e sem persistência, o log do deploy é o único
     * lugar onde o lead ainda existe. Registrar só "SMTP ausente" deixaria a
     * pessoa que preencheu o formulário sem nenhum rastro.
     */
    console.error(
      "[orcamento] SMTP não configurado — pedido registrado apenas em memória:",
      JSON.stringify(pedido),
    );
    return { enviado: false, motivo: "sem_configuracao" };
  }

  const campos = linhas(pedido);
  const corpoTexto = campos.map(([rotulo, valor]) => `${rotulo}: ${valor}`).join("\n");
  const mensagem = texto(pedido.message);

  const corpoHtml = [
    `<h2 style="font:600 16px system-ui,sans-serif">Pedido de proposta ${escaparHtml(pedido.reference)}</h2>`,
    '<table style="font:14px system-ui,sans-serif;border-collapse:collapse">',
    ...campos.map(
      ([rotulo, valor]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#555">${escaparHtml(rotulo)}</td>` +
        `<td style="padding:4px 0"><strong>${escaparHtml(valor)}</strong></td></tr>`,
    ),
    "</table>",
    mensagem
      ? `<p style="font:14px system-ui,sans-serif;white-space:pre-wrap;border-left:3px solid #ddd;padding-left:12px">${escaparHtml(mensagem)}</p>`
      : "",
  ].join("");

  try {
    await transporte(config).sendMail({
      from: config.from,
      to: config.to,
      // Responder ao e-mail vai direto para quem pediu, sem copiar endereço à
      // mão — que é onde o comercial erra e a resposta volta para si mesmo.
      replyTo: `${umaLinha(pedido.name)} <${pedido.email}>`,
      subject: umaLinha(`[Elora] Proposta ${pedido.reference} — ${pedido.company}`),
      text: mensagem ? `${corpoTexto}\n\nMensagem:\n${mensagem}` : corpoTexto,
      html: corpoHtml,
    });

    return { enviado: true };
  } catch (error) {
    console.error("[orcamento] falha ao enviar e-mail:", error, JSON.stringify(pedido));
    return {
      enviado: false,
      motivo: "falha_envio",
      detalhe: error instanceof Error ? error.message : undefined,
    };
  }
}
