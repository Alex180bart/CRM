/**
 * Diagnóstico da conexão do WhatsApp.
 *
 * Responde o que o servidor sabe sobre a própria configuração e o que já chegou
 * pelo webhook. É o que transforma a tela de conexão de um checklist decorativo
 * em ferramenta: sem isto, quem configura fica alternando entre o painel da Meta
 * e o silêncio, sem saber se o problema é rede, token ou endereço.
 *
 * **Nenhum valor de segredo sai daqui** — só presença, como `providerStatus()`
 * no AI Gateway. "O token está configurado" é tudo que a tela precisa, e é tudo
 * que pode atravessar a rede até o navegador.
 *
 * `POST` roda o autoteste: o servidor chama o **próprio** webhook com o token
 * que ele tem, imitando o que a Meta faz. Prova a metade que depende de nós — o
 * endereço responde e o token confere — antes de a Meta ser envolvida. A outra
 * metade, alcançabilidade pela internet, só a Meta prova, e a tela diz isso.
 */

import { DEFAULT_APP_HOST } from "@elora/core";
import type { WhatsappDiagnostics } from "@elora/core";
import type { NextRequest } from "next/server";

import { recentEvents, whatsappEnv, webhookUrlFrom } from "@/lib/canais/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hostOf(request: NextRequest): string {
  return request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? DEFAULT_APP_HOST;
}

export function GET(request: NextRequest): Response {
  const { url, publiclyReachable } = webhookUrlFrom(hostOf(request));

  const diagnostics: WhatsappDiagnostics = {
    webhookUrl: url,
    verifyTokenConfigured: Boolean(whatsappEnv.verifyToken()),
    appSecretConfigured: Boolean(whatsappEnv.appSecret()),
    accessTokenConfigured: Boolean(whatsappEnv.accessToken()),
    phoneNumberIdConfigured: Boolean(whatsappEnv.phoneNumberId()),
    publiclyReachable,
    recentEvents: recentEvents(),
  };

  return Response.json(diagnostics, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest): Promise<Response> {
  const token = whatsappEnv.verifyToken();

  if (!token) {
    return Response.json({
      ok: false,
      step: "token",
      message:
        "WHATSAPP_VERIFY_TOKEN não está no `.env` do servidor. Escolha uma frase qualquer, coloque na variável, reinicie e cadastre a mesma frase no painel da Meta.",
    });
  }

  const { url, publiclyReachable } = webhookUrlFrom(hostOf(request));

  /**
   * Desafio aleatório a cada teste.
   *
   * Fixo, um cache no caminho devolveria a resposta anterior e o teste passaria
   * sem o webhook ter sido tocado — que é justamente o falso positivo que
   * tornaria este botão inútil.
   */
  const challenge = crypto.randomUUID();

  const target = new URL(url);
  target.searchParams.set("hub.mode", "subscribe");
  target.searchParams.set("hub.verify_token", token);
  target.searchParams.set("hub.challenge", challenge);

  let response: Response;
  try {
    response = await fetch(target, { cache: "no-store" });
  } catch {
    return Response.json({
      ok: false,
      step: "rede",
      message: `O servidor não conseguiu chamar o próprio webhook em ${url}.`,
    });
  }

  if (response.status === 403) {
    return Response.json({
      ok: false,
      step: "token",
      message:
        "O webhook recusou o token. Confira se o valor de WHATSAPP_VERIFY_TOKEN é exatamente o mesmo cadastrado na Meta — sem espaço no fim e sem aspas.",
    });
  }

  if (!response.ok) {
    return Response.json({
      ok: false,
      step: "resposta",
      message: `O webhook respondeu ${response.status}, e a Meta espera 200.`,
    });
  }

  const body = (await response.text()).trim();

  if (body !== challenge) {
    /**
     * Este caso existe porque é o erro mais silencioso da integração: devolver
     * o desafio dentro de um JSON, ou com aspas em volta, produz 200 e a Meta
     * recusa mesmo assim, com uma mensagem que não diz o motivo.
     */
    return Response.json({
      ok: false,
      step: "desafio",
      message:
        "O webhook respondeu 200 mas não devolveu o desafio em texto puro. A Meta recusa a inscrição nesse caso.",
    });
  }

  return Response.json({
    ok: true,
    publiclyReachable,
    message: publiclyReachable
      ? "O webhook respondeu corretamente ao desafio. Pode cadastrar o endereço na Meta."
      : "O webhook respondeu corretamente, mas este endereço é local: a Meta não alcança `localhost`. Publique a aplicação, ou use um túnel, antes de cadastrar.",
  });
}
