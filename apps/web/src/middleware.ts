import { NextResponse, type NextRequest } from "next/server";

/**
 * Quem pode embutir o quadro do webchat.
 *
 * Existe por causa de um furo real do desenho anterior. A lista de domínios era
 * conferida pelo cabeçalho `Origin` das chamadas de API — mas o widget roda
 * dentro de um `iframe` **no nosso domínio**, então toda chamada chegava com a
 * nossa origem e passava. Na prática, qualquer site podia colar o trecho de
 * incorporação e abrir conversas na fila da empresa.
 *
 * A correção fica na camada certa: `frame-ancestors`. É o próprio navegador do
 * visitante que se recusa a renderizar o quadro num site fora da lista, e isso
 * não depende de nenhum código nosso rodando na página alheia — logo, a página
 * alheia não tem como contornar.
 *
 * O `Origin` continua conferido nas rotas de API: ele protege o caso de alguém
 * chamar a API direto, sem o `iframe`. As duas checagens cobrem caminhos
 * diferentes, e nenhuma torna a outra dispensável.
 */
export async function middleware(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key")?.trim();

  if (!key) {
    // Sem chave o quadro já responde com erro; negar tudo é o padrão seguro.
    return withFrameAncestors(NextResponse.next(), "'none'");
  }

  /**
   * A resolução acontece por HTTP, não importando o repositório.
   *
   * O middleware roda no runtime de borda, onde o módulo de dados — que hoje
   * carrega toda a base de demonstração — não deve ser carregado a cada
   * requisição. Uma chamada à própria rota de configuração é mais barata e
   * mantém uma fonte de verdade só.
   */
  let domains: string[] = [];
  try {
    const response = await fetch(
      new URL(`/api/webchat/allowed-domains?key=${encodeURIComponent(key)}`, request.nextUrl.origin),
      { cache: "no-store" },
    );
    if (response.ok) {
      const payload = (await response.json()) as { domains?: string[] };
      domains = payload.domains ?? [];
    }
  } catch {
    // Falha ao resolver não pode virar permissão: nega e o quadro não carrega.
    return withFrameAncestors(NextResponse.next(), "'none'");
  }

  if (domains.length === 0) {
    return withFrameAncestors(NextResponse.next(), "'none'");
  }

  // `'self'` entra para a prévia do editor continuar funcionando no nosso domínio.
  const sources = ["'self'", ...domains.map((domain) => `https://${domain} http://${domain}`)];

  /**
   * Em desenvolvimento, qualquer `localhost` pode embutir.
   *
   * É onde roda a página de teste de quem está montando o widget, e exigir
   * domínio de produção ali tornaria o recurso impossível de experimentar antes
   * de publicar. A liberação some no build de produção — é a única diferença de
   * comportamento entre os dois ambientes neste arquivo, e ela é explícita.
   */
  if (process.env.NODE_ENV !== "production") {
    sources.push("http://localhost:*", "http://127.0.0.1:*");
  }

  return withFrameAncestors(NextResponse.next(), sources.join(" "));
}

function withFrameAncestors(response: NextResponse, value: string): NextResponse {
  response.headers.set("Content-Security-Policy", `frame-ancestors ${value}`);
  // `X-Frame-Options` não aceita lista de domínios, então não substitui a CSP.
  // Removê-lo evita que um valor herdado sobreponha a política acima.
  response.headers.delete("X-Frame-Options");
  return response;
}

export const config = {
  matcher: ["/webchat/frame"],
};
