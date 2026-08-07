"""
lead_ads.py
-----------
Recebe leads dos formulários de Lead Ads da Meta em tempo real e os grava
no CRM interno.

Como funciona o fluxo de Lead Ads:
1. A Meta chama seu webhook (HTTP POST) sempre que um lead é enviado. O payload
   traz apenas o `leadgen_id` (o ID do lead), não os dados preenchidos.
2. Você usa esse `leadgen_id` para buscar os dados completos via Graph API:
   GET /{leadgen_id}?fields=field_data,created_time,...
3. Grava no CRM.

Segurança:
- A verificação inicial do webhook usa hub.verify_token (que VOCÊ define).
- Cada POST vem assinado no header X-Hub-Signature-256 (HMAC-SHA256 com o
  App Secret). Sempre valide antes de processar.

Este arquivo traz um receptor pronto em Flask. Adapte `salvar_lead_no_crm`
para a API/tabela do seu CRM interno.

Referência: developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving
"""

import hmac
import hashlib
import logging

from flask import Flask, request, abort

import config
import meta_client

logger = logging.getLogger("integracao_meta.lead_ads")

app = Flask(__name__)


# ---------------------------------------------------------------------------
# 1. Busca dos dados completos do lead
# ---------------------------------------------------------------------------
def fetch_lead(leadgen_id, access_token=None):
    """
    Busca os dados completos de um lead pelo leadgen_id.

    Retorna um dict com:
      - id, created_time, form_id, ad_id (quando disponível)
      - campos: dict {nome_do_campo: valor} já achatado a partir de field_data
    """
    access_token = access_token or config.PAGE_ACCESS_TOKEN
    fields = "id,created_time,ad_id,form_id,field_data"
    resposta = meta_client.get(leadgen_id, access_token, params={"fields": fields})

    campos = {}
    for item in resposta.get("field_data", []):
        valores = item.get("values", [])
        campos[item.get("name")] = valores[0] if valores else None

    return {
        "id": resposta.get("id"),
        "created_time": resposta.get("created_time"),
        "form_id": resposta.get("form_id"),
        "ad_id": resposta.get("ad_id"),
        "campos": campos,
    }


# ---------------------------------------------------------------------------
# 2. Gravação no CRM — ADAPTE PARA O SEU CRM INTERNO
# ---------------------------------------------------------------------------
def salvar_lead_no_crm(lead):
    """
    Ponto de integração com o CRM interno.

    Substitua o corpo por uma chamada à API do seu CRM ou um INSERT no banco.
    Recomendação: gravar de forma idempotente usando lead['id'] como chave
    única, para não duplicar caso a Meta reentregue o webhook.
    """
    logger.info("Novo lead recebido: %s", lead)
    # Exemplo (pseudo):
    # crm.upsert_lead(
    #     external_id=lead["id"],
    #     nome=lead["campos"].get("full_name"),
    #     email=lead["campos"].get("email"),
    #     telefone=lead["campos"].get("phone_number"),
    #     origem="Meta Lead Ads",
    #     form_id=lead["form_id"],
    # )
    return True


# ---------------------------------------------------------------------------
# 3. Validação de assinatura do webhook
# ---------------------------------------------------------------------------
def _assinatura_valida(payload_bytes, signature_header):
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    esperado = hmac.new(
        config.APP_SECRET.encode("utf-8"), payload_bytes, hashlib.sha256
    ).hexdigest()
    recebido = signature_header.split("=", 1)[1]
    return hmac.compare_digest(esperado, recebido)


# ---------------------------------------------------------------------------
# 4. Endpoints do webhook
# ---------------------------------------------------------------------------
@app.route("/webhook/meta-leads", methods=["GET"])
def verificar_webhook():
    """Handshake de verificação exigido pela Meta ao cadastrar o webhook."""
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")
    if mode == "subscribe" and token == config.WEBHOOK_VERIFY_TOKEN:
        logger.info("Webhook verificado com sucesso.")
        return challenge, 200
    logger.warning("Falha na verificação do webhook (token divergente).")
    abort(403)


@app.route("/webhook/meta-leads", methods=["POST"])
def receber_lead():
    """Recebe a notificação de novo lead, busca os dados e grava no CRM."""
    if not _assinatura_valida(request.get_data(), request.headers.get("X-Hub-Signature-256")):
        logger.warning("Assinatura do webhook inválida. Requisição descartada.")
        abort(403)

    body = request.get_json(silent=True) or {}
    if body.get("object") != "page":
        return "ignored", 200

    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            if change.get("field") != "leadgen":
                continue
            leadgen_id = change.get("value", {}).get("leadgen_id")
            if not leadgen_id:
                continue
            try:
                lead = fetch_lead(leadgen_id)
                salvar_lead_no_crm(lead)
            except Exception:
                # Loga mas responde 200 para a Meta não reenviar em loop;
                # trate reprocessamento por uma fila/dead-letter se preferir.
                logger.exception("Erro ao processar leadgen_id=%s", leadgen_id)

    # Sempre responda 200 rapidamente; processe o pesado de forma assíncrona
    # se o volume for alto (fila/worker).
    return "ok", 200


# ---------------------------------------------------------------------------
# 5. Assinatura da Página aos eventos de leadgen (rodar uma vez no setup)
# ---------------------------------------------------------------------------
def inscrever_pagina_no_app(page_id=None, page_access_token=None):
    """
    Inscreve a Página para enviar eventos 'leadgen' ao app.
    Equivale ao passo de "Subscribed Apps" — necessário além de cadastrar o
    webhook no painel do app.
    """
    page_id = page_id or config.PAGE_ID
    page_access_token = page_access_token or config.PAGE_ACCESS_TOKEN
    return meta_client.post(
        f"{page_id}/subscribed_apps",
        page_access_token,
        data={"subscribed_fields": "leadgen"},
    )


if __name__ == "__main__":
    # Sobe o receptor local. Em produção, use gunicorn/uwsgi atrás de HTTPS.
    # A Meta exige URL pública com HTTPS válido para o webhook.
    app.run(host="0.0.0.0", port=8080)
