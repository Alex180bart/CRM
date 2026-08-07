"""
conversions_api.py
------------------
Envio de eventos server-side para a Meta via Conversions API (CAPI).

Use este módulo para mandar eventos que acontecem no seu CRM/back-end —
Lead, CompleteRegistration, Purchase, Subscribe, etc. — direto ao Meta,
sem depender do Pixel do navegador.

Endpoint: POST /{DATASET_ID}/events

Boas práticas implementadas:
- user_data com PII sempre hasheada (via hashing.py).
- event_id para deduplicação com o Pixel do navegador (envie o MESMO event_id
  no Pixel e na CAPI para o Meta não contar o evento duas vezes).
- action_source obrigatório.
- Suporte a test_event_code para validação no Events Manager.

Referência: developers.facebook.com/docs/marketing-api/conversions-api
"""

import json
import time

import config
import hashing
import meta_client


# action_source válidos na Conversions API.
VALID_ACTION_SOURCES = {
    "email", "website", "app", "phone_call", "chat",
    "physical_store", "system_generated", "business_messaging", "other",
}


def build_user_data(*, email=None, phone=None, first_name=None, last_name=None,
                    city=None, state=None, zip_code=None, country=None,
                    gender=None, date_of_birth=None, external_id=None,
                    client_ip_address=None, client_user_agent=None,
                    fbc=None, fbp=None):
    """
    Monta o bloco user_data já com hashing aplicado nos campos de PII.

    Campos NÃO hasheados (a Meta exige em texto puro):
      client_ip_address, client_user_agent, fbc, fbp, external_id.

    Quanto mais campos de correspondência você enviar, melhor a taxa de match.
    """
    user_data = {}

    def put(key, value):
        if value:
            user_data[key] = value

    # Campos hasheados (a Meta aceita array de hashes por campo).
    put("em", [hashing.hash_email(email)] if email else None)
    put("ph", [hashing.hash_phone(phone)] if phone else None)
    put("fn", [hashing.hash_name(first_name)] if first_name else None)
    put("ln", [hashing.hash_name(last_name)] if last_name else None)
    put("ct", [hashing.hash_city(city)] if city else None)
    put("st", [hashing.hash_state(state)] if state else None)
    put("zp", [hashing.hash_zip(zip_code)] if zip_code else None)
    put("country", [hashing.hash_country(country)] if country else None)
    put("ge", [hashing.hash_gender(gender)] if gender else None)
    put("db", [hashing.hash_dob(date_of_birth)] if date_of_birth else None)

    # Campos em texto puro.
    put("external_id", str(external_id) if external_id else None)
    put("client_ip_address", client_ip_address)
    put("client_user_agent", client_user_agent)
    put("fbc", fbc)
    put("fbp", fbp)

    return user_data


def build_event(*, event_name, user_data, event_time=None, event_id=None,
                action_source="system_generated", event_source_url=None,
                custom_data=None, opt_out=False):
    """
    Monta um evento único no formato esperado pela CAPI.

    - event_name: ex. 'Lead', 'Purchase', 'CompleteRegistration', 'Subscribe'.
    - event_time: unix timestamp em segundos. Padrão: agora. A Meta aceita
      eventos com até 7 dias de atraso (para eventos web).
    - event_id: chave de deduplicação com o Pixel. Use um ID único e estável
      (ex.: id do lead/pedido no CRM).
    - action_source: origem do evento (ver VALID_ACTION_SOURCES).
    """
    if action_source not in VALID_ACTION_SOURCES:
        raise ValueError(
            f"action_source inválido: {action_source}. "
            f"Use um de: {sorted(VALID_ACTION_SOURCES)}"
        )

    event = {
        "event_name": event_name,
        "event_time": int(event_time or time.time()),
        "action_source": action_source,
        "user_data": user_data,
    }
    if event_id:
        event["event_id"] = str(event_id)
    if event_source_url:
        event["event_source_url"] = event_source_url
    if custom_data:
        event["custom_data"] = custom_data
    if opt_out:
        event["opt_out"] = True
    return event


def send_events(events, access_token=None, dataset_id=None, test_event_code="__from_config__"):
    """
    Envia uma lista de eventos (máx. 1000 por requisição) para a CAPI.

    Retorna o corpo da resposta da Meta, que inclui 'events_received',
    'messages' e 'fbtrace_id'.
    """
    if not events:
        return {"events_received": 0, "messages": []}
    if len(events) > 1000:
        raise ValueError("Envie no máximo 1000 eventos por requisição.")

    access_token = access_token or config.SYSTEM_USER_TOKEN
    dataset_id = dataset_id or config.DATASET_ID
    if test_event_code == "__from_config__":
        test_event_code = config.TEST_EVENT_CODE

    # A Meta espera o campo 'data' como string JSON no corpo form-urlencoded.
    body = {"data": json.dumps(events)}
    if test_event_code:
        body["test_event_code"] = test_event_code

    return meta_client.post(f"{dataset_id}/events", access_token, data=body)


# ---------------------------------------------------------------------------
# Exemplo de uso
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Exemplo: registrar um lead que entrou no CRM.
    user = build_user_data(
        email="cliente@exemplo.com.br",
        phone="(11) 99999-8888",
        first_name="Maria",
        last_name="Silva",
        city="São Paulo",
        state="SP",
        zip_code="01310-100",
        country="BR",
        external_id="crm-lead-12345",
    )
    evento = build_event(
        event_name="Lead",
        user_data=user,
        event_id="crm-lead-12345",          # mesmo id usado no Pixel, se houver
        action_source="system_generated",
        custom_data={"lead_event_source": "CRM Interno", "content_name": "Pos RT"},
    )
    resposta = send_events([evento])
    print(json.dumps(resposta, indent=2, ensure_ascii=False))
