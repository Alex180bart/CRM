"""
offline_conversions.py
-----------------------
Envio de conversões OFFLINE (vendas fechadas no CRM, por telefone, no balcão,
por e-mail/WhatsApp) de volta para a Meta.

IMPORTANTE — mudança de arquitetura da Meta:
A antiga "Offline Conversions API" com Offline Event Sets separados foi
DESCONTINUADA. Hoje as conversões offline são enviadas pela MESMA Conversions
API, para o MESMO endpoint /{DATASET_ID}/events, diferenciando-se apenas pelo
campo `action_source` (physical_store, phone_call, chat, email, other...).

Ou seja: este módulo é uma camada fina sobre conversions_api.py, com os
padrões corretos para eventos offline.

Janela de envio: a Meta aceita eventos offline com data retroativa de até
62 dias. Sempre envie o event_time real da venda (não a hora do upload) para
o Meta atribuir a conversão à campanha certa.

Referência: developers.facebook.com/docs/marketing-api/conversions-api
(seção "Offline Events" / action_source)
"""

import json

import conversions_api

# action_source aceitáveis para vendas offline registradas no CRM.
OFFLINE_ACTION_SOURCES = {"physical_store", "phone_call", "chat", "email", "other"}


def build_offline_purchase(*, value, currency="BRL", event_time, order_id,
                           action_source="phone_call", user_identifiers,
                           content_name=None, content_ids=None,
                           event_name="Purchase"):
    """
    Monta um evento de compra offline.

    - value: valor da venda (float). Ex.: 1997.00
    - currency: ISO 4217. Padrão 'BRL'.
    - event_time: unix timestamp em segundos da DATA REAL da venda.
    - order_id: identificador único do pedido/matrícula no CRM (deduplicação).
    - action_source: como a venda foi fechada (ver OFFLINE_ACTION_SOURCES).
    - user_identifiers: dict com os dados do cliente, repassado para
      conversions_api.build_user_data (email, phone, first_name, external_id...).
    """
    if action_source not in OFFLINE_ACTION_SOURCES:
        raise ValueError(
            f"Para conversões offline use action_source em {sorted(OFFLINE_ACTION_SOURCES)}."
        )

    user_data = conversions_api.build_user_data(**user_identifiers)

    custom_data = {"currency": currency, "value": round(float(value), 2)}
    if order_id:
        custom_data["order_id"] = str(order_id)
    if content_name:
        custom_data["content_name"] = content_name
    if content_ids:
        custom_data["content_ids"] = content_ids

    return conversions_api.build_event(
        event_name=event_name,
        user_data=user_data,
        event_time=event_time,
        event_id=str(order_id) if order_id else None,
        action_source=action_source,
        custom_data=custom_data,
    )


def upload_offline_sales(sales, access_token=None, dataset_id=None):
    """
    Recebe uma lista de vendas do CRM e envia em lotes de até 1000.

    Cada item de `sales` deve ser um dict com as chaves aceitas por
    build_offline_purchase. Retorna a lista de respostas da Meta (uma por lote).
    """
    events = [build_offline_purchase(**sale) for sale in sales]

    respostas = []
    for i in range(0, len(events), 1000):
        lote = events[i:i + 1000]
        respostas.append(
            conversions_api.send_events(lote, access_token=access_token,
                                        dataset_id=dataset_id)
        )
    return respostas


# ---------------------------------------------------------------------------
# Exemplo de uso
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import time

    vendas = [
        {
            "value": 1997.00,
            "currency": "BRL",
            "event_time": int(time.time()) - 3600,   # venda de 1h atrás
            "order_id": "matricula-98765",
            "action_source": "phone_call",
            "content_name": "Pos-graduacao Reforma Tributaria",
            "user_identifiers": {
                "email": "aluno@exemplo.com.br",
                "phone": "(21) 98888-7777",
                "first_name": "João",
                "last_name": "Souza",
                "external_id": "crm-contact-98765",
            },
        }
    ]
    respostas = upload_offline_sales(vendas)
    print(json.dumps(respostas, indent=2, ensure_ascii=False))
