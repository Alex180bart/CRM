"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  isDemoVerticalId,
  isPlanKey,
  PLAN_BY_KEY,
  repositories,
  switchVertical,
} from "@elora/core";

import {
  currentAccount,
  currentAdmin,
  endSession,
  ensureAdminAccount,
  hashPassword,
  startSession,
  verifyPassword,
} from "@/lib/site/auth";
import { produtoExposto } from "@/lib/site/exposicao";
import { enderecoComercial, notificarPedidoDeOrcamento } from "@/lib/site/notificacao";

/**
 * Escritas do site público.
 *
 * Server Actions, e não rotas de API, por um motivo concreto: o formulário
 * precisa funcionar **antes** do JavaScript carregar. A landing page é a
 * primeira coisa que um visitante em rede ruim abre, e um botão de cadastro que
 * só responde depois do bundle é um cadastro perdido.
 *
 * Toda ação devolve `FormState` em vez de lançar. Erro de validação não é
 * exceção: é resposta, com a mensagem ao lado do campo. Lançar produziria a
 * página de erro do Next no lugar do formulário, e a pessoa perderia o que
 * digitou.
 */

export interface FormState {
  ok: boolean;
  message?: string;
  field?: string;
  /** Referência do orçamento criado, quando houver. */
  reference?: string;
}

const EMPTY: FormState = { ok: false };

function text(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function integer(data: FormData, key: string, fallback = 0): number {
  const value = Number(data.get(key));
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/* Cadastro e sessão --------------------------------------------------------------- */

export async function signUpAction(_prev: FormState = EMPTY, data: FormData): Promise<FormState> {
  const name = text(data, "name");
  const email = text(data, "email");
  const company = text(data, "company");
  const password = String(data.get("password") ?? "");

  if (name.length < 3) return { ok: false, field: "name", message: "Informe seu nome completo." };
  if (!isEmail(email)) return { ok: false, field: "email", message: "E-mail inválido." };
  if (company.length < 2)
    return { ok: false, field: "company", message: "Informe o nome da empresa." };

  /**
   * Oito caracteres, e a regra para por aí.
   *
   * Exigir símbolo e maiúscula produz senha anotada em post-it e não melhora
   * entropia de forma relevante — é o que a recomendação do NIST diz desde
   * 2017. O que protege aqui é o `scrypt` e o limite de tentativa, não o teatro
   * de complexidade.
   */
  if (password.length < 8)
    return { ok: false, field: "password", message: "A senha precisa de pelo menos 8 caracteres." };

  const material = hashPassword(password);

  const result = await repositories.site.createAccount({
    name,
    email,
    company,
    phone: text(data, "phone") || undefined,
    jobTitle: text(data, "jobTitle") || undefined,
    ...material,
  });

  if (!result.ok) return { ok: false, field: result.field, message: result.reason };

  await startSession(result.value.id);
  redirect("/conta");
}

export async function signInAction(_prev: FormState = EMPTY, data: FormData): Promise<FormState> {
  const email = text(data, "email");
  const password = String(data.get("password") ?? "");

  /**
   * A semeadura acontece **antes** da busca, e é por isso que ela mora aqui.
   *
   * O armazém morre no reinício do servidor. Semear na inicialização do módulo
   * pareceria mais limpo e falharia no caso comum: o `next dev` recarrega
   * módulos, e a conta criada no carregamento anterior já não existe. O login é
   * o instante em que ela precisa existir.
   */
  await ensureAdminAccount();

  const account = await repositories.site.getAccountByEmail(email);

  /**
   * A mesma mensagem para e-mail inexistente e senha errada.
   *
   * Distinguir os dois transforma o formulário de login em oráculo de cadastro:
   * dá para descobrir quem tem conta testando e-mails.
   */
  const invalid: FormState = { ok: false, field: "email", message: "E-mail ou senha incorretos." };

  if (!account) return invalid;
  if (!verifyPassword(password, account)) return invalid;

  await repositories.site.registerLogin(account.id);
  // O papel entra no token porque o middleware não tem como consultar o
  // repositório para descobri-lo — ver `issueToken` em `lib/site/auth.ts`.
  await startSession(account.id, Boolean(account.isAdmin));

  /**
   * Quem vende cai direto no material de venda; quem pede orçamento, nos
   * próprios pedidos. Mandar os dois para a mesma tela obrigaria um deles a
   * navegar antes de chegar ao que veio fazer.
   *
   * O destino pedido pela página anterior tem precedência, mas **só se for
   * caminho interno**: aceitar qualquer string aqui transformaria o formulário
   * de login num redirecionador aberto — o golpe clássico de mandar a vítima
   * para `elora.com.br/entrar?proximo=https://site-falso` e devolvê-la
   * autenticada em outro domínio. Duas barras no início também são recusadas,
   * porque `//site-falso` é URL absoluta com o protocolo herdado.
   */
  const requested = text(data, "proximo");
  const safeNext = requested.startsWith("/") && !requested.startsWith("//") ? requested : undefined;

  redirect(safeNext ?? (account.isAdmin ? "/admin" : "/conta"));
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/");
}

/* Orçamento ------------------------------------------------------------------------ */

/**
 * Pedido de proposta.
 *
 * ## Por que não chega mais cálculo nenhum aqui
 *
 * O simulador saiu do site público e vive só na área comercial. Antes, o
 * formulário trazia o cenário em campos ocultos e esta função **refazia** a conta
 * no servidor — aceitar o total que o navegador enviou permitiria a alguém pedir
 * orçamento de R$ 1, e o pedido chegaria ao comercial com aparência legítima.
 *
 * A defesa continua valendo, agora por construção: não há total a forjar porque
 * não há total. O que o formulário envia é declaração — quem é, de que tamanho é
 * a operação, o que importa no caso dele —, e declaração não precisa ser
 * recalculada, precisa ser conferida contra o catálogo, que é o que
 * `isPlanKey` faz logo abaixo.
 */
export async function requestQuoteAction(
  _prev: FormState = EMPTY,
  data: FormData,
): Promise<FormState> {
  const name = text(data, "name");
  const email = text(data, "email");
  const company = text(data, "company");

  if (name.length < 3) return { ok: false, field: "name", message: "Informe seu nome." };
  if (!isEmail(email)) return { ok: false, field: "email", message: "E-mail inválido." };
  if (company.length < 2)
    return { ok: false, field: "company", message: "Informe o nome da empresa." };

  const account = await currentAccount();

  /**
   * Edição inexistente vira ausência, não erro de formulário.
   *
   * O campo é um `select` com as quatro edições, então só chega lixo aqui se
   * alguém montou o corpo à mão. Devolver "edição inválida" a esse alguém não
   * protege nada e custaria o pedido de quem usou um navegador que traduziu a
   * página. Gravar sem a edição é o desfecho certo: o comercial pergunta.
   */
  const planKeyRaw = text(data, "planKey");
  const seats = integer(data, "teamSize");

  const result = await repositories.site.createQuote({
    accountId: account?.id,
    name,
    email,
    company,
    phone: text(data, "phone") || undefined,
    segment: text(data, "segment") || undefined,
    planKey: isPlanKey(planKeyRaw) ? planKeyRaw : undefined,
    teamSize: seats,
    message: text(data, "message") || undefined,
  });

  if (!result.ok) return { ok: false, field: result.field, message: result.reason };

  revalidatePath("/conta");

  /**
   * A gravação vem primeiro; o e-mail, depois.
   *
   * É a mesma ordem do envio de proposta na conversa, e pelo mesmo motivo: no
   * pior caso sobra um pedido gravado sem aviso, que ainda é recuperável. O
   * inverso — avisar sem gravar — produziria referência citada num e-mail que não
   * corresponde a pedido nenhum.
   */
  const notificacao = await notificarPedidoDeOrcamento(result.value);

  /**
   * Falha de notificação **é dita a quem preencheu**.
   *
   * A tentação é responder sucesso e resolver depois: o pedido "está gravado",
   * afinal. Só que o armazém é por instância e não sobrevive ao próximo deploy —
   * sem o e-mail, este pedido provavelmente não existe para ninguém. Confirmar
   * mesmo assim é prometer retorno que não vai acontecer, e a pessoa só descobre
   * pela ausência, dias depois, quando já procurou outro fornecedor.
   *
   * O texto não expõe o motivo técnico: quem preencheu não pode fazer nada com
   * "falha de autenticação SMTP". O que ele oferece é o caminho que funciona
   * agora, que é escrever direto para o comercial.
   */
  if (!notificacao.enviado) {
    const contato = enderecoComercial();

    return {
      ok: true,
      reference: result.value.reference,
      message:
        `Pedido ${result.value.reference} registrado, mas não conseguimos avisar o time comercial ` +
        `automaticamente. ` +
        (contato
          ? `Para garantir o retorno, escreva para ${contato} citando esta referência.`
          : `Se possível, entre em contato pelos canais da Contabilidade Facilitada citando esta referência.`),
    };
  }

  return {
    ok: true,
    reference: result.value.reference,
    message: `Pedido ${result.value.reference} registrado. O time comercial responde em até um dia útil.`,
  };
}

/* Verticais de demonstração --------------------------------------------------------- */

/**
 * Abre uma vertical e leva para dentro do produto.
 *
 * A troca **recarrega o armazém do servidor** e vale para toda a instância, não
 * só para quem clicou — ver `demo/active.ts`. O `revalidatePath("/", "layout")`
 * é obrigatório: sem ele, o Next serviria o layout do workspace já renderizado
 * com a organização anterior, e a barra lateral mostraria "Lumini Casa" sobre
 * dados de contabilidade.
 */
export async function openVerticalAction(data: FormData): Promise<void> {
  /**
   * A checagem de papel acontece **aqui**, não só na tela que mostra o botão.
   *
   * Esconder o formulário protege contra o clique acidental e contra mais nada:
   * Server Action tem endereço próprio, e um `POST` montado à mão chega direto
   * nesta função. Como a troca recarrega o armazém da instância inteira, deixar
   * a validação na interface entregaria a qualquer visitante o poder de trocar a
   * base debaixo de uma apresentação em andamento.
   */
  if (!(await currentAdmin())) redirect("/entrar?proximo=/admin");

  /**
   * Com o produto fechado, trocar a vertical não tem para onde levar.
   *
   * A tela já desabilita o botão, e isso protege contra o clique. Esta linha
   * protege contra a requisição: Server Action tem endereço próprio, e um `POST`
   * montado à mão recarregaria o armazém da instância para depois cair num
   * `/inicio` que o middleware devolve para a home — efeito colateral sem
   * benefício nenhum.
   */
  if (!produtoExposto(process.env)) redirect("/admin");

  const id = text(data, "vertical");
  if (!isDemoVerticalId(id)) return;

  switchVertical(id);
  revalidatePath("/", "layout");
  redirect("/inicio");
}

/** Preço "a partir de" de cada edição, para o cartão da LP. */
export async function planStartingPrice(planKey: string): Promise<number> {
  const plan = isPlanKey(planKey) ? PLAN_BY_KEY[planKey] : PLAN_BY_KEY.essencial;
  return plan.platformFeeCents + plan.minSeats * plan.seatPriceCents;
}
