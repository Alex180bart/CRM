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
 * cliente não bater. Some a isso que os valores só aparecem depois de escolher
 * mercado e moeda num seletor que roda no navegador: não há HTML estático de
 * onde ler.
 *
 * Então a tabela é dado versionado, com a data em que passou a valer, a data em
 * que **nós conferimos** e o endereço de onde saiu. A interface mostra as duas
 * datas. Um número com procedência declarada vale mais que um número que se diz
 * atual e não é.
 *
 * ## A unidade é o micro de real, e isso não é preciosismo
 *
 * O resto do produto guarda dinheiro em centavos inteiros. A Meta publica com
 * **quatro casas decimais**: utilidade custa `R$ 0,0350`, que é três centavos e
 * meio. Em centavos inteiros esse número não existe — vira 3 ou 4, e num disparo
 * de 200 mil mensagens a diferença é de R$ 100 no repasse que deveria bater
 * exatamente com a fatura da Meta.
 *
 * Foi esse arredondamento que escondeu o defeito anterior: a tabela dizia que
 * autenticação custava 20 centavos quando custa 3,5, e ninguém conferiu porque
 * um inteiro plausível não chama atenção.
 *
 * Um real vale `1.000.000` micros. A conversão para centavos acontece no total
 * da linha, nunca na tarifa unitária — arredondar por mensagem e depois
 * multiplicar é o mesmo erro com outro nome.
 *
 * ## O histórico começa aqui, e de propósito
 *
 * As tabelas anteriores deste arquivo nunca foram transcritas da Meta: eram
 * valores de exemplo, e o erro de 6× em autenticação prova isso. Mantê-las como
 * "histórico" faria um orçamento antigo reproduzir um preço que a Meta nunca
 * cobrou — que é pior do que não ter histórico. O histórico volta a crescer a
 * partir da primeira transcrição de verdade, que é a de baixo.
 *
 * ## Repasse continua sem margem
 *
 * O que está aqui é o custo da Meta, repassado ao cliente pelo mesmo valor. É o
 * que permite ele conferir contra a fatura que recebe direto da Meta — e é o que
 * mantém a nossa margem auditável, porque ela não se mistura com um custo que
 * reajusta sozinho.
 *
 * A margem da Elora sobre WhatsApp existe, e viaja em **outra linha**: a taxa da
 * plataforma por mensagem, declarada por edição em `catalog.ts`. Ver lá o motivo
 * de ela ser um valor fixo em vez de um percentual sobre o custo da Meta.
 */

import type { WhatsappCategory } from "./catalog";

/** Um real em micros. A Meta publica com quatro casas; micros comportam seis. */
export const MICROS_PER_BRL = 1_000_000;

/** Micros por centavo — o divisor da conversão para a unidade do resto do produto. */
export const MICROS_PER_CENT = 10_000;

/**
 * Converte micros em centavos, arredondando para cima.
 *
 * Para cima pela mesma razão de `ceilCents` no calculador: toda diferença de
 * arredondamento é a favor de quem emite a fatura, e um simulador que mostra um
 * centavo a menos que a cobrança real produz a conversa mais desagradável
 * possível por um centavo.
 *
 * A margem de `1e-9` existe porque `35_000 / 10_000` pode sair `3.5000000000001`
 * em ponto flutuante, e `Math.ceil` transformaria 3,5 centavos exatos em 4.
 *
 * O atalho para zero não é otimização: sem ele, `Math.ceil(0 - 1e-9)` devolve
 * **`-0`**, e `Intl.NumberFormat` escreve `-R$ 0,00`. Volume zero é o caso mais
 * comum do simulador — quem não usa marketing deixa o campo em zero —, então o
 * sinal de menos apareceria na tela quase sempre, num valor que é literalmente
 * nada.
 */
export function microsToCents(micros: number): number {
  if (micros <= 0) return 0;
  return Math.ceil(micros / MICROS_PER_CENT - 1e-9);
}

/**
 * Faixa de volume da Meta.
 *
 * Só existe para utilidade e autenticação — a Meta não oferece escada em
 * marketing. Como a escada da nossa tabela de contatos, é **progressiva**: cada
 * fatia paga o preço da própria faixa.
 */
export interface MetaVolumeTier {
  /** Teto da faixa, em mensagens no mês. `null` é a última. */
  upTo: number | null;
  /** Tarifa da faixa, em micros de real. */
  rateMicros: number;
  /** Desconto sobre a taxa listada, como a Meta publica. Só para exibição. */
  discountPct: number;
}

export interface MetaRateTable {
  /** País da tabela, em ISO 3166-1 alfa-2. */
  country: string;
  countryLabel: string;
  currency: "BRL";
  /** Data em que esta tabela passou a valer, ISO 8601 (só data). */
  effectiveFrom: string;
  /**
   * Presente quando a tarifa **não** foi transcrita de um rate card publicado.
   *
   * Serve para a tela dizer que aquele número é derivado de anúncio, e não lido
   * da fonte. Um valor provisório sem essa marca é indistinguível de um valor
   * conferido — e é assim que uma estimativa vira preço praticado sem ninguém
   * decidir.
   */
  provisional?: {
    motivo: string;
    /** Data em que a Meta publica o valor definitivo. */
    confirmarAte: string;
  };
  /**
   * Data em que alguém abriu a página da Meta e conferiu.
   *
   * Separada de `effectiveFrom` porque respondem perguntas diferentes: a
   * primeira é da Meta, a segunda é nossa. A tabela pode estar vigente há um ano
   * e ter sido conferida ontem — ou ter entrado em vigor ontem e ninguém ter
   * olhado desde. É a segunda que diz se dá para confiar, e é por ela que a
   * defasagem é medida.
   */
  checkedOn: string;
  /** De onde o valor foi transcrito, para quem for conferir. */
  source: string;
  sourceUrl: string;
  /** Tarifa listada por mensagem entregue, em micros de real, por categoria. */
  ratesMicros: Record<WhatsappCategory, number>;
  /** Escada por volume, onde a Meta oferece. Ausente = tarifa única. */
  volumeTiers: Partial<Record<WhatsappCategory, MetaVolumeTier[]>>;
}

/**
 * Tabelas conhecidas, da mais recente para a mais antiga.
 *
 * O histórico fica porque orçamento assinado em maio precisa continuar
 * explicável em setembro: sem a tabela antiga, a única resposta para "por que
 * este número?" é "mudou".
 *
 * **Autenticação internacional** é uma quinta categoria no seletor da Meta e não
 * está modelada aqui. É a mensagem de código enviada para número de fora do
 * Brasil, e a base deste produto é escritório contábil brasileiro atendendo
 * cliente brasileiro. Modelá-la acrescentaria uma categoria a todas as telas
 * para um caso que não acontece — e, se acontecer, o lugar de acrescentar é
 * `WhatsappCategory`, não uma exceção no cálculo.
 */
export const META_RATE_TABLES: MetaRateTable[] = [
  {
    country: "BR",
    countryLabel: "Brasil",
    currency: "BRL",
    effectiveFrom: "2026-07-01",
    checkedOn: "2026-08-14",
    source:
      "Rate card WhatsApp Business Platform — mercado Brasil, moeda BRL, lido no seletor da página oficial.",
    sourceUrl: "https://whatsappbusiness.com/pt-br/products/platform-pricing/",
    ratesMicros: {
      marketing: 321_700, // R$ 0,3217
      utilidade: 35_000, // R$ 0,0350
      autenticacao: 35_000, // R$ 0,0350
      servico: 0, // gratuita dentro da janela de 24 h
    },
    volumeTiers: {
      utilidade: [
        { upTo: 250_000, rateMicros: 35_000, discountPct: 0 },
        { upTo: 2_000_000, rateMicros: 33_300, discountPct: 5 },
        { upTo: 17_000_000, rateMicros: 31_500, discountPct: 10 },
        { upTo: 35_000_000, rateMicros: 29_800, discountPct: 15 },
        { upTo: 70_000_000, rateMicros: 28_000, discountPct: 20 },
        { upTo: null, rateMicros: 26_300, discountPct: 25 },
      ],
      autenticacao: [
        { upTo: 500_000, rateMicros: 35_000, discountPct: 0 },
        { upTo: 3_000_000, rateMicros: 33_300, discountPct: 5 },
        { upTo: 5_250_000, rateMicros: 31_500, discountPct: 10 },
        { upTo: 10_000_000, rateMicros: 29_800, discountPct: 15 },
        { upTo: null, rateMicros: 28_000, discountPct: 20 },
      ],
    },
  },
];

/** A tabela que vale hoje. A primeira da lista, por convenção de ordenação. */
export const CURRENT_META_RATES: MetaRateTable = META_RATE_TABLES[0]!;

/**
 * Custo do repasse para um volume, aplicando a escada da Meta.
 *
 * Progressiva, como `contactOverageCents`: quem manda 300 mil mensagens de
 * utilidade paga as primeiras 250 mil à taxa cheia e só o excedente com o
 * desconto de 5%. Aplicar a faixa final ao volume inteiro produziria o degrau em
 * que mandar mais mensagens reduz a conta.
 *
 * Devolve **micros**, não centavos: a conversão acontece uma vez só, no total da
 * linha. Arredondar aqui e somar depois reintroduziria o erro que a unidade
 * existe para evitar.
 */
export function metaCostMicros(
  table: MetaRateTable,
  category: WhatsappCategory,
  messages: number,
): number {
  const volume = Math.max(0, Math.floor(messages));
  if (volume === 0) return 0;

  const tiers = table.volumeTiers[category];
  if (!tiers || tiers.length === 0) {
    return volume * table.ratesMicros[category];
  }

  let remaining = volume;
  let cursor = 0;
  let total = 0;

  for (const tier of tiers) {
    if (remaining <= 0) break;
    const ceiling = tier.upTo ?? Number.POSITIVE_INFINITY;
    const slice = Math.min(remaining, Math.max(0, ceiling - cursor));
    if (slice <= 0) continue;

    total += slice * tier.rateMicros;
    remaining -= slice;
    cursor += slice;
  }

  // A última faixa declara `upTo: null`, então nunca deveria sobrar. O laço
  // cobre o caso por segurança, e não por expectativa.
  if (remaining > 0) {
    const last = tiers[tiers.length - 1]!;
    total += remaining * last.rateMicros;
  }

  return total;
}

/**
 * Tarifa média efetivamente paga por mensagem, em micros.
 *
 * É o número que explica a linha quando a escada entrou: "R$ 0,0350 por
 * mensagem" deixa de ser verdade acima de 250 mil, e mostrar a taxa listada ao
 * lado de um total que não bate com ela é o tipo de conta que o cliente refaz na
 * calculadora e não fecha.
 */
export function metaEffectiveRateMicros(
  table: MetaRateTable,
  category: WhatsappCategory,
  messages: number,
): number {
  const volume = Math.max(0, Math.floor(messages));
  if (volume === 0) return table.ratesMicros[category];
  return metaCostMicros(table, category, volume) / volume;
}

export type RateStaleness = "atual" | "revisar" | "vencida";

export interface StalenessCheck {
  status: RateStaleness;
  ageDays: number;
  message: string;
}

/**
 * Há quanto tempo ninguém confere esta tabela.
 *
 * Mede a partir de `checkedOn`, não de `effectiveFrom`. A pergunta que importa
 * antes de mandar uma proposta não é "quando a Meta mudou?" — é "quando foi a
 * última vez que alguém olhou?". Medir pela vigência daria "tabela de 0 dias"
 * para uma tabela que entrou em vigor hoje e que ninguém conferiu.
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
  const checked = new Date(`${table.checkedOn}T00:00:00-03:00`).getTime();
  const now = new Date(nowIso).getTime();
  const ageDays = Math.max(0, Math.floor((now - checked) / 86_400_000));

  if (ageDays >= 180) {
    return {
      status: "vencida",
      ageDays,
      message: `Ninguém confere esta tabela há ${ageDays} dias. Abra o rate card da Meta antes de usar este número em proposta.`,
    };
  }

  if (ageDays >= 90) {
    return {
      status: "revisar",
      ageDays,
      message: `Conferida há ${ageDays} dias. Vale checar se a Meta reajustou alguma categoria.`,
    };
  }

  return {
    status: "atual",
    ageDays,
    message: `Vigente desde ${formatDate(table.effectiveFrom)}, conferida em ${formatDate(table.checkedOn)}.`,
  };
}

function formatDate(iso: string): string {
  return iso.split("-").reverse().join("/");
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

/* Mudanças anunciadas e ainda não vigentes ---------------------------------------- */

/**
 * Tabelas que a Meta já anunciou e que ainda não valem.
 *
 * ## Por que não entram em `META_RATE_TABLES`
 *
 * `CURRENT_META_RATES` é o primeiro item daquela lista, e `catalog.ts` lê dele o
 * repasse de cada categoria na carga do módulo. Colocar uma tabela futura na
 * posição zero passaria a cobrar **hoje** um preço que só vale em outubro — e o
 * defeito não apareceria como erro: apareceria como fatura maior que a do
 * concorrente, sem ninguém entender por quê. `ratesEffectiveAt` também depende
 * daquela lista estar ordenada da mais recente para a mais antiga entre as que
 * **já valem**.
 *
 * Então o que vem fica separado, e a promoção para a lista principal é um ato
 * consciente: mover a entrada, apagar o `provisional` e conferir o número contra
 * a página da Meta.
 *
 * ## Por que existe registro do que ainda não vale
 *
 * Porque o esquecimento aqui é caro e silencioso. A página publica "Serviço —
 * não é cobrada"; em 1º de outubro de 2026 isso deixa de ser verdade, e sem
 * registro nenhum ninguém descobre até um cliente conferir a fatura da Meta
 * contra a nossa. `mudancasDeTarifa` transforma essa data num aviso na tela de
 * quem cota.
 */
export const META_RATE_TABLES_ANUNCIADAS: MetaRateTable[] = [
  {
    country: "BR",
    countryLabel: "Brasil",
    currency: "BRL",
    effectiveFrom: "2026-10-01",
    checkedOn: "2026-08-16",
    source:
      "Anúncio oficial: mensagens de serviço passam a ser cobradas por mensagem e templates de utilidade perdem a gratuidade dentro da janela de 24 h. A Meta declara que a tarifa de serviço é a mesma de utilidade e autenticação, e publica os valores até 01/09/2026.",
    sourceUrl:
      "https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages",
    provisional: {
      motivo:
        "A tarifa de serviço é derivada da declaração da Meta de que ela iguala utilidade e autenticação — não foi transcrita de rate card, porque o rate card com o valor ainda não existe.",
      confirmarAte: "2026-09-01",
    },
    ratesMicros: {
      marketing: 321_700,
      utilidade: 35_000,
      autenticacao: 35_000,
      // Deixa de ser zero: é a mudança inteira desta vigência.
      servico: 35_000,
    },
    volumeTiers: {
      utilidade: [
        { upTo: 250_000, rateMicros: 35_000, discountPct: 0 },
        { upTo: 2_000_000, rateMicros: 33_300, discountPct: 5 },
        { upTo: 17_000_000, rateMicros: 31_500, discountPct: 10 },
        { upTo: 35_000_000, rateMicros: 29_800, discountPct: 15 },
        { upTo: 70_000_000, rateMicros: 28_000, discountPct: 20 },
        { upTo: null, rateMicros: 26_300, discountPct: 25 },
      ],
      autenticacao: [
        { upTo: 500_000, rateMicros: 35_000, discountPct: 0 },
        { upTo: 3_000_000, rateMicros: 33_300, discountPct: 5 },
        { upTo: 5_250_000, rateMicros: 31_500, discountPct: 10 },
        { upTo: 10_000_000, rateMicros: 29_800, discountPct: 15 },
        { upTo: null, rateMicros: 28_000, discountPct: 20 },
      ],
    },
  },
];

export type EstadoDaMudanca = "anunciada" | "atrasada";

export interface MudancaDeTarifa {
  tabela: MetaRateTable;
  estado: EstadoDaMudanca;
  /** Dias até a vigência; negativo quando a data já passou. */
  dias: number;
  message: string;
}

/**
 * O que vem por aí, e o que já devia ter entrado.
 *
 * `anunciada` é informativo: existe mudança com data marcada, e quem cota hoje
 * precisa saber para não prometer o preço de hoje para o mês que vem.
 *
 * `atrasada` é o estado que importa: a data chegou e a tabela continua fora da
 * lista principal, o que significa que o produto está cobrando por uma tabela
 * que a Meta já substituiu. Recebe o relógio por parâmetro, e não `Date.now()`,
 * pela mesma razão de `rateStaleness`: o teste precisa poder viajar no tempo, e a
 * função não pode divergir entre servidor e navegador.
 */
export function mudancasDeTarifa(nowIso: string, country = "BR"): MudancaDeTarifa[] {
  const agora = new Date(nowIso).getTime();
  const umDia = 86_400_000;

  return META_RATE_TABLES_ANUNCIADAS.filter((tabela) => tabela.country === country).map(
    (tabela) => {
      const vigencia = new Date(`${tabela.effectiveFrom}T00:00:00-03:00`).getTime();
      const dias = Math.ceil((vigencia - agora) / umDia);
      const estado: EstadoDaMudanca = dias > 0 ? "anunciada" : "atrasada";

      const message =
        estado === "anunciada"
          ? `Nova tabela da Meta em ${formatDate(tabela.effectiveFrom)} — ${dias} ${dias === 1 ? "dia" : "dias"}. Mensagem de serviço passa a ser cobrada.`
          : `A tabela de ${formatDate(tabela.effectiveFrom)} já está vigente e ainda não foi promovida: o repasse cobrado está desatualizado.`;

      return { tabela, estado, dias, message };
    },
  );
}
