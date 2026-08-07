/**
 * Configuração de conexão de uma conta de canal.
 *
 * Esta rota é o **único** ponto onde segredo entra no sistema, e ela tem uma
 * assimetria deliberada: aceita valor no `POST` e nunca o devolve no `GET`.
 *
 * O `GET` responde o que a tela precisa para desenhar — quais campos secretos já
 * foram gravados, por nome — e nada mais. Não existe caminho, aqui ou em outro
 * lugar, que leve um token de acesso de volta ao navegador. É a mesma disciplina
 * do `providerStatus()` no AI Gateway, aplicada a um dado bem mais perigoso: o
 * token do WhatsApp envia mensagem em nome da empresa.
 *
 * ## Por que os campos se separam antes de gravar
 *
 * O corpo chega misturado — `phoneNumberId` ao lado de `accessToken` —, porque é
 * assim que o formulário pensa. A separação acontece aqui, guiada pelo `secret`
 * da especificação do provedor: o que é público vai para o repositório, o que é
 * segredo vai para o cofre. Deixar a tela decidir isso significaria confiar no
 * cliente para classificar a própria credencial.
 */

import type { ChannelConnection } from "@crm/core";
import { CURRENT_USER_ID, offsetIso, providerSpec, repositories } from "@crm/core";
import type { NextRequest } from "next/server";

import { describeSecrets, secretRefFor, storeSecrets } from "@/lib/canais/vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(message: string, status = 400): Response {
  return Response.json({ ok: false, reason: message }, { status });
}

/**
 * Quais segredos cada conta já tem — por nome, nunca por valor.
 *
 * Uma chamada só para todas as contas: a aba de Canais desenha a lista inteira
 * de uma vez, e uma requisição por conta transformaria oito contas em oito
 * idas ao servidor para responder a mesma pergunta.
 */
export async function GET(): Promise<Response> {
  const accounts = await repositories.directory.listChannelAccounts();

  const secrets: Record<string, string[]> = {};
  for (const account of accounts) {
    secrets[account.id] = describeSecrets(secretRefFor(account.id));
  }

  return Response.json({ secrets }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Corpo da requisição não é JSON válido.");
  }

  const record = (body ?? {}) as Record<string, unknown>;
  const accountId = typeof record.accountId === "string" ? record.accountId.trim() : "";
  const provider = typeof record.provider === "string" ? record.provider.trim() : "";
  const values = (record.values ?? {}) as Record<string, unknown>;

  if (!accountId) return fail("Conta não informada.");

  const spec = providerSpec(provider);
  if (!spec) return fail(`Provedor desconhecido: ${provider || "(vazio)"}.`);

  const accounts = await repositories.directory.listChannelAccounts();
  const account = accounts.find((item) => item.id === accountId);
  if (!account) return fail("Conta não encontrada.", 404);

  if (!spec.kinds.includes(account.kind)) {
    return fail(`${spec.label} não atende contas de ${account.kind}.`);
  }

  /* Separação: público vai ao repositório, segredo vai ao cofre --------------- */

  const publicFields: Record<string, string> = { ...(account.connection?.fields ?? {}) };
  const secretValues: Record<string, string> = {};

  for (const field of spec.fields) {
    const raw = values[field.key];
    if (typeof raw !== "string") continue;

    const value = raw.trim().slice(0, 4_000);

    if (field.secret) {
      // Vazio não apaga: o formulário mostra segredo em branco por não poder
      // exibir o valor, e quem editou só um campo deixaria o outro em branco.
      if (value) secretValues[field.key] = value;
      continue;
    }

    publicFields[field.key] = value;
  }

  const ref = secretRefFor(accountId);
  if (Object.keys(secretValues).length > 0) storeSecrets(ref, secretValues);

  const present = describeSecrets(ref);

  /**
   * O estado sai do que falta, não do que a tela pediu.
   *
   * Aceitar um `state` vindo do cliente permitiria marcar como conectado uma
   * conta sem token — e a lista passaria a mentir sobre a própria configuração.
   */
  const missing = spec.fields.filter((field) => {
    if (field.optional) return false;
    return field.secret ? !present.includes(field.key) : !publicFields[field.key]?.trim();
  });

  const connection: ChannelConnection = {
    provider: spec.id,
    fields: publicFields,
    secretRef: present.length > 0 ? ref : undefined,
    /**
     * Completo é `aguardando_verificacao`, não `conectado`.
     *
     * Ter as credenciais preenchidas não prova que elas funcionam: quem prova é
     * o provedor, respondendo. Marcar conectado aqui repetiria o erro que a
     * tela de WhatsApp existe para evitar — o painel dizendo "assinado"
     * enquanto nada chega.
     */
    state: missing.length > 0 ? "nao_configurado" : "aguardando_verificacao",
    lastCheckedAt: offsetIso({}),
  };

  const users = await repositories.directory.listUsers();
  const me = users.find((user) => user.id === CURRENT_USER_ID);

  const result = await repositories.admin.setChannelConnection(
    { id: CURRENT_USER_ID, label: me?.name ?? "Administrador" },
    accountId,
    connection,
  );

  if (!result.ok) return Response.json(result, { status: 409 });

  return Response.json({
    ok: true,
    state: connection.state,
    missing: missing.map((field) => field.label),
    presentSecrets: present,
  });
}
