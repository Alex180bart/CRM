/**
 * Script de incorporação.
 *
 * É o arquivo que o cliente cola no site. Faz uma coisa só: cria um `iframe`
 * apontando para `/webchat/frame` e escuta o tamanho que ele pede.
 *
 * ## Por que iframe e não desenhar na página
 *
 * Duas razões, ambas práticas. **Isolamento**: o CSS do site do cliente não
 * alcança o widget e o nosso não vaza para o site dele — sem isso, um
 * `* { box-sizing: content-box }` na folha de estilo alheia deforma o chat, e a
 * culpa cai em nós. **Uma implementação só**: o widget é React, o mesmo
 * componente da prévia do editor. Redesenhá-lo em JavaScript puro criaria duas
 * versões do mesmo widget, e a que não recebesse a próxima correção seria
 * justamente a que está no ar.
 *
 * O `iframe` começa pequeno, do tamanho do lançador, e cresce quando abre — um
 * `iframe` de tela cheia bloquearia o clique no site inteiro.
 */

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function script(origin: string): string {
  return `(function () {
  "use strict";

  var current = document.currentScript;
  var key = current && current.dataset ? current.dataset.key : null;

  if (!key) {
    console.error("[webchat] data-key ausente no script de incorporação.");
    return;
  }

  var ORIGIN = ${JSON.stringify(origin)};
  var FRAME_ID = "crmcf-webchat-frame";

  if (document.getElementById(FRAME_ID)) return;

  var frame = document.createElement("iframe");
  frame.id = FRAME_ID;
  frame.title = "Atendimento por chat";
  // A origem da página vai junto: sem ela, a conversa é registrada como vinda
  // do nosso próprio domínio (o do iframe), e a operação perde a informação de
  // qual site gerou o lead. Não é credencial: quem autoriza é a política
  // frame-ancestors que o servidor manda, conferida pelo próprio navegador.
  frame.src =
    ORIGIN +
    "/webchat/frame?key=" +
    encodeURIComponent(key) +
    "&host=" +
    encodeURIComponent(window.location.origin);
  frame.setAttribute("allow", "clipboard-write");
  // Sem borda e com fundo transparente: o que aparece é o widget, não a moldura.
  frame.style.cssText = [
    "position:fixed",
    "border:0",
    "background:transparent",
    "color-scheme:normal",
    "z-index:2147483000",
    "transition:width .18s ease,height .18s ease",
    "max-width:100vw",
    "max-height:100vh"
  ].join(";");

  function place(box) {
    var left = box && box.position === "esquerda";
    frame.style.width = (box && box.width ? box.width : 96) + "px";
    frame.style.height = (box && box.height ? box.height : 96) + "px";
    frame.style.bottom = "0px";
    frame.style.right = left ? "auto" : "0px";
    frame.style.left = left ? "0px" : "auto";
  }

  place(null);

  // Só aceita mensagem vinda do nosso próprio quadro: sem esta checagem,
  // qualquer script da página poderia redimensionar ou remover o widget.
  //
  // O tamanho vem sempre do quadro, inclusive ao fechar: quem sabe a largura do
  // lançador é quem o desenha. Ter uma medida fixa aqui cortava o lançador com
  // rótulo, que precisa de bem mais que os 96 px de uma bolha.
  window.addEventListener("message", function (event) {
    if (event.origin !== ORIGIN) return;
    var data = event.data;
    if (!data || data.source !== "crmcf-webchat") return;
    if (data.type !== "resize" && data.type !== "close") return;

    place(data);
  });

  function mount() {
    document.body.appendChild(frame);
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();`;
}

export function GET(request: NextRequest): Response {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  return new Response(script(origin), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // O script muda quando a origem muda; cachear por muito tempo entregaria
      // um endereço velho depois de uma troca de domínio.
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
