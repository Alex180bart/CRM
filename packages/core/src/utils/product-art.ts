/**
 * Arte do produto — a "foto" que o catálogo ainda não tem.
 *
 * ## Por que arte gerada, e não imagem
 *
 * O caminho de mídia da seção 11 não existe: não há upload, antivírus,
 * armazenamento nem URL assinada. Um campo `imageUrl` hoje só poderia apontar
 * para um binário no repositório ou para um host externo — o primeiro engorda o
 * versionamento com arquivo que muda por decisão de marketing, o segundo quebra
 * a regra de a base de demonstração funcionar offline.
 *
 * Mas cartão de produto sem imagem é uma lista de texto, e a montagem de
 * proposta com dez itens em texto puro é justamente a tela em que o vendedor
 * erra o item. Então a arte é **derivada do próprio produto**: motivo escolhido
 * pelo que ele é, matiz estável derivada da chave. Custa zero byte, é a mesma em
 * todo carregamento e acompanha o tema, porque quem pinta é o componente com
 * `currentColor` e matiz — não um PNG com fundo branco embutido.
 *
 * ## Quando a foto real chegar
 *
 * Ela entra como campo próprio no `Product`, e esta função vira o **fallback**:
 * produto sem foto continua tendo cartão decente. É o mesmo desenho do avatar
 * com iniciais, que não deixou de existir quando a foto de perfil passou a
 * existir.
 *
 * ## Determinismo
 *
 * Nada aqui sorteia. A mesma chave produz a mesma matiz em qualquer máquina e
 * em qualquer carregamento — sem isso, um `Math.random()` faria a cor do
 * produto mudar entre servidor e navegador e a hidratação quebraria, que é
 * exatamente o defeito que `datetime.ts` evita do lado do tempo.
 */

/** Formas que o cartão sabe desenhar. Acrescentar uma exige desenhá-la na UI. */
export type ProductMotif =
  | "documento"
  | "caixa"
  | "luminaria"
  | "casa"
  | "chave"
  | "sorriso"
  | "estetoscopio"
  | "curso"
  | "assinatura"
  | "ferramenta"
  | "grafico"
  | "escudo";

export interface ProductArt {
  motif: ProductMotif;
  /** Matiz HSL, no mesmo esquema das tags: a UI compõe saturação e luminosidade. */
  hue: number;
}

/**
 * Paleta de matizes, escolhida e não calculada.
 *
 * Um `hash % 360` cru cai em faixas que ficam sujas quando compostas com a
 * luminosidade dos tokens de chip — os verdes-limão por volta de 70° e os
 * lilases apagados por volta de 300°. Esta lista é a mesma família de matizes já
 * usada em tag e avatar, então o cartão de produto pertence visualmente ao resto
 * do produto em vez de parecer colado de outro sistema.
 */
const HUES = [218, 200, 174, 160, 262, 280, 340, 12, 30, 45, 100] as const;

const MOTIF_RULES: Array<{ motif: ProductMotif; terms: string[] }> = [
  {
    motif: "luminaria",
    terms: ["luminaria", "pendente", "trilho", "spot", "abajur", "lustre", "iluminacao", "cupula"],
  },
  {
    motif: "sorriso",
    terms: ["clareamento", "alinhador", "ortodont", "dente", "sorriso", "raspagem", "profilaxia"],
  },
  {
    motif: "estetoscopio",
    terms: [
      "consulta",
      "exame",
      "checkup",
      "check-up",
      "clinic",
      "saude",
      "avaliacao",
      "laudo medico",
    ],
  },
  {
    motif: "casa",
    terms: [
      "imovel",
      "apartamento",
      "casa",
      "locacao",
      "aluguel",
      "condominio",
      "planta",
      "vistoria",
    ],
  },
  {
    motif: "chave",
    terms: ["venda de imovel", "assessoria de venda", "escritura", "chave", "corretagem"],
  },
  {
    motif: "curso",
    terms: ["curso", "aula", "treinamento", "mentoria", "workshop", "turma", "certificado"],
  },
  {
    motif: "documento",
    terms: [
      "abertura",
      "contabilidade",
      "declaracao",
      "imposto",
      "fiscal",
      "regulariza",
      "certidao",
      "balanco",
      "folha",
      "contrato",
    ],
  },
  { motif: "assinatura", terms: ["clube", "plano", "assinatura", "mensalidade", "manutencao"] },
  {
    motif: "ferramenta",
    terms: ["montagem", "instalacao", "reparo", "tecnico", "suporte", "implanta"],
  },
  { motif: "escudo", terms: ["garantia", "seguro", "protecao", "fianca", "cobertura"] },
  {
    motif: "grafico",
    terms: ["consultoria", "diagnostico", "analise", "assessoria", "planejamento", "relatorio"],
  },
  { motif: "caixa", terms: ["kit", "produto", "frete", "entrega", "combo", "pacote"] },
];

/** U+0300–U+036F é o bloco de diacríticos combinantes. */
const DIACRITICS = /[\u0300-\u036f]/g;

function normalize(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
}

/**
 * Hash estável de 32 bits (FNV-1a).
 *
 * Poderia ser a soma dos códigos dos caracteres, e aí `abertura_mei` e
 * `abertura_ime` cairiam na mesma cor — anagrama é comum em chave de catálogo
 * ("plano_a" / "plano_b" não, mas "kit_luz" / "luz_kit" sim). FNV distribui pela
 * posição, então a diferença de ordem muda o resultado.
 */
function hash(value: string): number {
  let result = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16_777_619);
  }
  return result >>> 0;
}

export interface ProductArtSeed {
  key: string;
  name: string;
  kind: "produto" | "servico";
  recurrence: "unico" | "mensal" | "trimestral" | "semestral" | "anual";
  summary?: string;
}

/**
 * O motivo sai do que o produto **é**, e o texto tem precedência sobre o tipo.
 *
 * A ordem das regras importa: "kit de luminárias" casa com `luminaria` e com
 * `caixa`, e a primeira é mais informativa. Por isso `caixa` e `grafico` estão no
 * fim — são os genéricos de produto e de serviço.
 */
export function productArt(seed: ProductArtSeed): ProductArt {
  const haystack = normalize(`${seed.key} ${seed.name} ${seed.summary ?? ""}`);

  const matched = MOTIF_RULES.find((rule) => rule.terms.some((term) => haystack.includes(term)));

  const motif: ProductMotif =
    matched?.motif ??
    (seed.recurrence !== "unico" ? "assinatura" : seed.kind === "produto" ? "caixa" : "grafico");

  return { motif, hue: HUES[hash(seed.key) % HUES.length] };
}
