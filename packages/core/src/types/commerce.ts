/**
 * Catálogo de produtos e serviços, e a proposta que os leva ao cliente.
 *
 * Cobre a seção **26.1 (P1)** do plano — "produtos/ofertas; propostas; aprovação
 * de descontos" — e alimenta a 26.4 (bloco de pagamento) e a 26.7 (vínculo
 * aluno-produto). O gatilho "compra aprovada" que a seção 15 lista nasce daqui.
 *
 * ## Dinheiro é inteiro, em centavos, sempre
 *
 * Nenhum valor deste arquivo é ponto flutuante. `0,1 + 0,2` vale
 * `0,30000000000000004` em IEEE 754, e num desconto de 33% sobre três parcelas
 * isso vira um centavo de diferença entre o que a tela mostra e o que o link de
 * pagamento cobra. O cliente vê os dois números. A conversão para reais acontece
 * na formatação, no último instante, e em lugar nenhum antes.
 *
 * Moeda é real e só real. A seção 26.1 coloca "múltiplas moedas quando
 * necessário" em P2, e um campo de moeda que só aceita um valor é pior que
 * nenhum: dá a impressão de que a conversão está resolvida em algum lugar.
 *
 * ## A proposta é uma fotografia, não um ponteiro
 *
 * `ProposalItem` guarda nome, preço e recorrência **copiados** do produto no
 * instante em que a proposta foi montada. Referenciar `productId` e ler o preço
 * na hora de exibir faria a proposta que o cliente recebeu ontem por R$ 890
 * aparecer por R$ 990 hoje, porque alguém reajustou a tabela — e o histórico da
 * conversa passaria a contradizer o print que o cliente tem.
 *
 * `productId` continua guardado, mas serve para relatório e reconciliação, nunca
 * para resolver preço. Pelo mesmo motivo `sellerName` é copiado: o link já foi
 * gerado com aquele nome, e quem sai da empresa não pode apagar o passado.
 */

import type { BaseEntity, Id, IsoDateTime } from "./common";

/* Catálogo -------------------------------------------------------------------- */

/**
 * Produto ou serviço.
 *
 * A distinção não é decorativa: serviço contábil recorrente e produto avulso
 * têm ciclo de cobrança, argumento de venda e vínculo com o aluno diferentes
 * (26.7). O tipo aparece na tela e no que a IA responde.
 */
export type ProductKind = "produto" | "servico";

/** Como o valor se repete. `unico` é cobrança avulsa; o resto é assinatura. */
export type ProductRecurrence = "unico" | "mensal" | "trimestral" | "semestral" | "anual";

export const PRODUCT_KIND_LABEL: Record<ProductKind, string> = {
  produto: "Produto",
  servico: "Serviço",
};

export const RECURRENCE_LABEL: Record<ProductRecurrence, string> = {
  unico: "Pagamento único",
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

/** Sufixo curto para compor o preço na tela e na fala da IA. */
export const RECURRENCE_SUFFIX: Record<ProductRecurrence, string> = {
  unico: "",
  mensal: "/mês",
  trimestral: "/trimestre",
  semestral: "/semestre",
  anual: "/ano",
};

/**
 * Como o cliente paga.
 *
 * `integrado` delega a cobrança a um provedor financeiro, que devolve um
 * endereço por proposta e avisa o pagamento por webhook. `link` aponta para uma
 * página que já existe — a ferramenta que a operação usa hoje —, e nesse caso a
 * plataforma não sabe se o pagamento aconteceu: **alguém marca à mão**. Os dois
 * são legítimos, e confundi-los produziria o pior dos mundos, uma proposta que
 * parece conciliada e não é.
 */
export type CheckoutMode = "integrado" | "link";

export const CHECKOUT_MODE_LABEL: Record<CheckoutMode, string> = {
  integrado: "Ferramenta financeira integrada",
  link: "Link de direcionamento próprio",
};

export interface ProductCheckout {
  mode: CheckoutMode;
  /**
   * Endereço base, obrigatório no modo `link`.
   *
   * Guardado **sem** identificação de vendedor: quem acrescenta é
   * `buildCheckoutUrl`, no momento do envio, porque o vendedor muda de proposta
   * para proposta e o produto é um só.
   */
  baseUrl?: string;
  /** Provedor no modo `integrado`. Vazio enquanto nenhum estiver conectado. */
  providerKey?: string;
}

export interface Product extends BaseEntity {
  /**
   * Chave estável, imutável depois de usada.
   *
   * Vai gravada dentro de cada `ProposalItem` e de cada evento. Renomeá-la
   * depois de a primeira proposta sair renomearia o passado pela metade, e o
   * relatório passaria a mostrar duas linhas para o mesmo produto — a mesma
   * razão pela qual habilidade e motivo de encerramento também travam a chave.
   */
  key: string;
  name: string;
  kind: ProductKind;
  /** Uma linha, para a lista e para o cartão na conversa. */
  summary: string;
  /** Texto longo, para a tela de detalhe e para a IA explicar o que é. */
  description: string;
  priceCents: number;
  recurrence: ProductRecurrence;
  /**
   * Teto de desconto que o vendedor concede sozinho, em pontos percentuais.
   *
   * Zero significa preço de tabela e nada além. É este número — e só ele — que
   * decide se a proposta sai direto ou fica esperando o gestor, e é por isso que
   * ele vive no produto e não numa configuração global: margem de serviço
   * recorrente e de produto avulso não se parecem.
   */
  maxDiscountPct: number;
  /** O que está incluso, em itens curtos. A IA lê isto para responder "o que vem junto?". */
  includes: string[];
  /**
   * Argumentos de venda e objeções conhecidas, escritos para a IA.
   *
   * Separado de `description` de propósito: a descrição é o que o cliente pode
   * ler; isto é orientação interna, e vazá-la ao cliente soaria como script de
   * telemarketing lido em voz alta.
   */
  salesNotes: string;
  checkout: ProductCheckout;
  /**
   * Inativo some da montagem de proposta e da resposta da IA, mas **continua**
   * aparecendo nas propostas antigas. Excluir de verdade quebraria o histórico.
   */
  active: boolean;
}

/* Proposta -------------------------------------------------------------------- */

/**
 * Estados da proposta.
 *
 * O caminho feliz é `rascunho → enviada → aceita → paga`. Os dois desvios que
 * importam:
 *
 * - desconto acima do teto entra em `aguardando_aprovacao` **antes** de o
 *   cliente ver qualquer coisa — reprovar depois de enviado obrigaria a
 *   desdizer um preço já prometido, que é a pior conversa possível;
 * - `expirada` existe porque proposta sem prazo vira reclamação seis meses
 *   depois com um preço que não existe mais.
 *
 * `paga` só é alcançável de verdade no modo `integrado`. No modo `link` alguém
 * marca à mão, e o tipo não esconde isso: `paidConfirmedBy` diz quem afirmou.
 */
export type ProposalStatus =
  | "rascunho"
  | "aguardando_aprovacao"
  | "reprovada_interna"
  | "enviada"
  | "aceita"
  | "recusada"
  | "expirada"
  | "paga"
  | "cancelada";

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando o gestor",
  reprovada_interna: "Reprovada pelo gestor",
  enviada: "Enviada ao cliente",
  aceita: "Aceita pelo cliente",
  recusada: "Recusada pelo cliente",
  expirada: "Expirada",
  paga: "Paga",
  cancelada: "Cancelada",
};

/**
 * Transições permitidas.
 *
 * Tabela explícita, e não uma sequência de `if` espalhada pelo repositório: é o
 * que permite a tela desabilitar o botão pela mesma fonte que o repositório usa
 * para recusar a gravação — o par "botão habilitado, escrita recusada" nasce
 * exatamente de duas cópias dessa lógica.
 *
 * Estado final não tem saída. `paga` inclusive: estorno é outro fato, com outro
 * registro, e reaproveitar a proposta apagaria a venda que existiu.
 */
export const PROPOSAL_TRANSITIONS: Record<ProposalStatus, ProposalStatus[]> = {
  rascunho: ["aguardando_aprovacao", "enviada", "cancelada"],
  aguardando_aprovacao: ["enviada", "reprovada_interna", "cancelada"],
  reprovada_interna: ["rascunho", "cancelada"],
  enviada: ["aceita", "recusada", "expirada", "cancelada"],
  aceita: ["paga", "cancelada"],
  recusada: [],
  expirada: [],
  paga: [],
  cancelada: [],
};

export interface ProposalItem {
  productId: Id;
  /** Cópia da chave do produto: sobrevive à exclusão e serve ao relatório. */
  productKey: string;
  /** Cópia do nome no instante da montagem. Ver o cabeçalho deste arquivo. */
  name: string;
  kind: ProductKind;
  recurrence: ProductRecurrence;
  quantity: number;
  /** Preço de tabela copiado, antes do desconto. */
  unitPriceCents: number;
  /** Desconto aplicado a esta linha, em pontos percentuais inteiros. */
  discountPct: number;
  /** Teto vigente no momento da montagem — o que sustenta a decisão de portão. */
  maxDiscountPct: number;
  /** `quantity × unitPriceCents` menos o desconto, já arredondado. */
  totalCents: number;
}

export interface ProposalApproval {
  /** Quem precisa decidir, quando a proposta passou do teto. */
  requestedAt: IsoDateTime;
  requestedBy: Id;
  /** Motivo legível: qual item passou do teto e por quanto. */
  reason: string;
  decidedAt?: IsoDateTime;
  decidedBy?: Id;
  decidedByLabel?: string;
  /** Escrito por quem reprovou. Aprovação não precisa de justificativa. */
  note?: string;
}

export interface Proposal extends BaseEntity {
  conversationId: Id;
  contactId: Id;
  /** Vendedor: quem monta, quem aparece no link e quem responde pela venda. */
  sellerId: Id;
  /** Cópia do nome — o link já saiu com ele. */
  sellerName: string;
  items: ProposalItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  status: ProposalStatus;
  /** Uma linha do vendedor para o cliente, opcional, acima dos itens. */
  message: string;
  /** Prazo do preço. Depois dele a proposta vira `expirada`. */
  expiresAt: IsoDateTime;
  approval?: ProposalApproval;
  /**
   * Endereço de pagamento.
   *
   * **Só existe depois do aceite.** Gerá-lo na montagem e guardá-lo escondido
   * até o cliente aceitar seria a mesma coisa do ponto de vista de quem
   * inspeciona a rede — e o produto passaria a prometer uma ordem que não
   * cumpre. O campo nasce vazio, de propósito.
   */
  checkoutUrl?: string;
  sentAt?: IsoDateTime;
  respondedAt?: IsoDateTime;
  paidAt?: IsoDateTime;
  /** No modo `link` o pagamento é afirmado por gente. Aqui fica quem afirmou. */
  paidConfirmedBy?: Id;
  /** Origem da montagem: quem digitou, ou o agente que propôs e alguém confirmou. */
  origin: "atendente" | "agente_ia";
}

/* Apoios para a interface e para a IA ------------------------------------------ */

export interface ProposalTotals {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  /**
   * Recorrentes e avulsos somados separadamente.
   *
   * Um total único misturando "R$ 300/mês" com "R$ 900 de abertura" produz um
   * número que não existe: nem é a primeira cobrança, nem é a mensalidade. A
   * tela mostra os dois, e a IA fala os dois.
   */
  oneOffCents: number;
  recurringCents: number;
}
