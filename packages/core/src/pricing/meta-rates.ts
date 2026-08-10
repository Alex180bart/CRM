/**
 * Tabela de preços da Meta, versionada por vigência.
 *
 * ## Por que não é "tempo real"
 *
 * A Meta **não publica API de tabela de preços**. O que existe é a página de
 * rate card, atualizada por decisão dela, e o `conversation_analytics` do Graph
 * API — que responde quanto **a sua conta** já gastou, não quanto custa para
 * quem ainda não é cliente. Nenhum dos dois serve para cotar venda nova em tempo
 * real.
 *
 * Raspar a página seria o pior dos mundos: parece tempo real, quebra quando a
 * Meta mexe no HTML, e falha **em silêncio** — o simulador continua cotando, com
 * o preço da última leitura bem-sucedida, e ninguém percebe até a fatura do
 * cliente não bater.
 *
 * Então a tabela é dado versionado, com a data em que passou a valer, e a
 * interface **mostra essa data**. Um número com procedência declarada vale mais
 * que um número que se diz atual e não é.
 *
 * ## A defasagem é anunciada, não escondida
 *
 * `rateStaleness` classifica a tabela pela idade, na mesma disciplina do alerta
 * de 90 dias das fontes de conhecimento do agente. O motivo é o mesmo: a fonte
 * envelhece sem avisar, e quem consulta precisa saber disso **antes** de usar o
 * número numa proposta, não depois.
 *
 * ## Repasse continua sem margem
 *
 * O que está aqui é o custo da Meta, repassado ao cliente pelo mesmo valor. É o
 * que permite ele conferir contra a fatura que recebe direto da Meta — e é o que
 * mantém a nossa margem auditável, porque ela não se mistura com um custo que
 * reajusta sozinho. Ver `costs.ts`.
 */

import type { WhatsappCategory } from "./catalog";

export interface MetaRateTable {
  /** País da tabela, em ISO 3166-1 alfa-2. */
  country: string;
  countryLabel: string;
  currency: "BRL";
  /** Data em que esta tabela passou a valer, ISO 8601 (só data). */
  effectiveFrom: string;
  /** De onde o valor foi transcrito, para quem for conferir. */
  source: string;
  /** Preço por mensagem cobrado pela Meta, em centavos, por categoria. */
  ratesCents: Record<WhatsappCategory, number>;
}

/**
 * Tabelas conhecidas, da mais recente para a mais antiga.
 *
 * O histórico fica porque orçamento assinado em maio precisa continuar
 * explicável em setembro: sem a tabela antiga, a única resposta para "por que
 * este número?" é "mudou".
 */
export const META_RATE_TABLES: MetaRateTable[] = [
  {
    country: "BR",
    countryLabel: "Brasil",
    currency: "BRL",
    effectiveFrom: "2026-07-01",
    source: "Rate card WhatsApp Business Platform — Brasil, transcrito manualmente.",
    ratesCents: { marketing: 31, utilidade: 4, autenticacao: 20, servico: 0 },
  },
  {
    country: "BR",
    countryLabel: "Brasil",
    currency: "BRL",
    effectiveFrom: "2025-07-01",
    source: "Rate card WhatsApp Business Platform — Brasil, transcrito manualmente.",
    ratesCents: { marketing: 38, utilidade: 8, autenticacao: 24, servico: 0 },
  },
];

/** A tabela que vale hoje. A primeira da lista, por convenção de ordenação. */
export const CURRENT_META_RATES: MetaRateTable = META_RATE_TABLES[0]!;

export type RateStaleness = "atual" | "revisar" | "vencida";

export interface StalenessCheck {
  status: RateStaleness;
  ageDays: number;
  message: string;
}

/**
 * Quão velha é a tabela.
 *
 * Recebe o instante por parâmetro, como todo o resto deste repositório: o tempo
 * é ancorado em `REFERENCE_NOW_ISO`, e função que lê relógio não se testa sem
 * viajar no tempo.
 *
 * Os degraus são 90 e 180 dias. O primeiro é o mesmo do alerta de fonte de
 * conhecimento — não por simetria, mas porque é o intervalo em que a Meta
 * historicamente mexe em alguma categoria. O segundo é onde a tabela deixa de
 * ser aproximação e passa a ser chute.
 */
export function rateStaleness(table: MetaRateTable, nowIso: string): StalenessCheck {
  const effective = new Date(`${table.effectiveFrom}T00:00:00-03:00`).getTime();
  const now = new Date(nowIso).getTime();
  const ageDays = Math.max(0, Math.floor((now - effective) / 86_400_000));

  if (ageDays >= 180) {
    return {
      status: "vencida",
      ageDays,
      message: `Tabela de ${ageDays} dias atrás. Confira o rate card da Meta antes de usar este número em proposta.`,
    };
  }

  if (ageDays >= 90) {
    return {
      status: "revisar",
      ageDays,
      message: `Tabela com ${ageDays} dias. Vale conferir se a Meta reajustou alguma categoria.`,
    };
  }

  return {
    status: "atual",
    ageDays,
    message: `Tabela vigente desde ${table.effectiveFrom.split("-").reverse().join("/")}.`,
  };
}

/**
 * Encontra a tabela que valia numa data.
 *
 * É o que permite reabrir um orçamento antigo e ver o mesmo número que o cliente
 * viu. Sem isso, todo histórico é reescrito pelo preço de hoje.
 */
export function ratesEffectiveAt(dateIso: string, country = "BR"): MetaRateTable {
  const target = new Date(dateIso).getTime();

  const match = META_RATE_TABLES.filter((table) => table.country === country).find(
    (table) => new Date(`${table.effectiveFrom}T00:00:00-03:00`).getTime() <= target,
  );

  return match ?? CURRENT_META_RATES;
}
