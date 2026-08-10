import {
  DEFAULT_QUOTE_INPUT,
  isAddonKey,
  isPlanKey,
  type AddonSelection,
  type QuoteInput,
} from "@elora/core";

/**
 * O dimensionamento viaja na URL.
 *
 * ## Por que na URL, e não em sessão
 *
 * Porque é a coisa que a pessoa quer mandar para outra pessoa. O caso real é o
 * gerente que simula, cola o endereço no grupo e pede opinião do financeiro
 * antes de pedir proposta — e um simulador que perde o cenário nesse pulo não é
 * usado duas vezes. Guardar em sessão também exigiria cookie antes do
 * consentimento, para um dado que não é pessoal.
 *
 * ## A leitura nunca lança
 *
 * Parâmetro ausente, texto no lugar de número, plano que não existe: tudo cai no
 * padrão. Uma URL editada à mão é entrada hostil, e a resposta certa a ela é uma
 * simulação padrão, não a página de erro do Next.
 */

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

function readInt(source: ParamSource, key: string, fallback: number): number {
  const raw = read(source, key);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

export function serializeQuoteInput(input: QuoteInput): string {
  const params = new URLSearchParams({
    plano: input.planKey,
    ciclo: input.billing,
    usuarios: String(input.seats),
    contatos: String(input.contacts),
    conversas: String(input.conversations),
    wa_mkt: String(input.whatsapp.marketing),
    wa_util: String(input.whatsapp.utilidade),
    wa_auth: String(input.whatsapp.autenticacao),
    wa_serv: String(input.whatsapp.servico),
    emails: String(input.emails),
    ia: String(input.aiReplies),
    implantacao: input.includeSetup ? "1" : "0",
    desconto: String(input.discountPct),
  });

  if (input.addons.length > 0) {
    params.set("addons", input.addons.map((addon) => `${addon.key}:${addon.quantity}`).join(","));
  }

  return params.toString();
}

export function parseQuoteInput(source: ParamSource): QuoteInput {
  const planRaw = read(source, "plano");
  const cycleRaw = read(source, "ciclo");

  const addons: AddonSelection[] = [];
  for (const entry of (read(source, "addons") ?? "").split(",")) {
    const [key, quantity] = entry.trim().split(":");
    if (isAddonKey(key)) addons.push({ key, quantity: Number(quantity) || 1 });
  }

  return {
    planKey: isPlanKey(planRaw) ? planRaw : DEFAULT_QUOTE_INPUT.planKey,
    billing: cycleRaw === "mensal" ? "mensal" : "anual",
    seats: Math.max(1, readInt(source, "usuarios", DEFAULT_QUOTE_INPUT.seats)),
    contacts: readInt(source, "contatos", DEFAULT_QUOTE_INPUT.contacts),
    conversations: readInt(source, "conversas", DEFAULT_QUOTE_INPUT.conversations),
    whatsapp: {
      marketing: readInt(source, "wa_mkt", DEFAULT_QUOTE_INPUT.whatsapp.marketing),
      utilidade: readInt(source, "wa_util", DEFAULT_QUOTE_INPUT.whatsapp.utilidade),
      autenticacao: readInt(source, "wa_auth", DEFAULT_QUOTE_INPUT.whatsapp.autenticacao),
      servico: readInt(source, "wa_serv", DEFAULT_QUOTE_INPUT.whatsapp.servico),
    },
    emails: readInt(source, "emails", DEFAULT_QUOTE_INPUT.emails),
    aiReplies: readInt(source, "ia", DEFAULT_QUOTE_INPUT.aiReplies),
    addons,
    includeSetup: read(source, "implantacao") !== "0",
    discountPct: readInt(source, "desconto", 0),
  };
}

/** Campos ocultos que levam o cenário para dentro da Server Action. */
export function quoteInputFields(input: QuoteInput): Array<{ name: string; value: string }> {
  return [
    { name: "planKey", value: input.planKey },
    { name: "billing", value: input.billing },
    { name: "seats", value: String(input.seats) },
    { name: "contacts", value: String(input.contacts) },
    { name: "conversations", value: String(input.conversations) },
    { name: "whatsappMarketing", value: String(input.whatsapp.marketing) },
    { name: "whatsappUtilidade", value: String(input.whatsapp.utilidade) },
    { name: "whatsappAutenticacao", value: String(input.whatsapp.autenticacao) },
    { name: "whatsappServico", value: String(input.whatsapp.servico) },
    { name: "emails", value: String(input.emails) },
    { name: "aiReplies", value: String(input.aiReplies) },
    {
      name: "addons",
      value: input.addons.map((addon) => `${addon.key}:${addon.quantity}`).join(","),
    },
    { name: "includeSetup", value: input.includeSetup ? "true" : "false" },
    { name: "discountPct", value: String(input.discountPct) },
  ];
}
