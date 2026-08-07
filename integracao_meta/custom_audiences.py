"""
custom_audiences.py
-------------------
Sincronização de listas de contatos do CRM com Públicos Personalizados
(Custom Audiences) da Meta, para segmentação e criação de Lookalikes.

Fluxo:
1. create_audience(...)  -> cria o público (uma vez).
2. add_users(...)        -> adiciona/atualiza contatos (em lotes de 10.000).
3. remove_users(...)     -> remove contatos (ex.: descadastro/LGPD).

A Meta exige que todo PII vá com hash SHA-256. O 'schema' declara a ordem das
colunas e o 'data' traz as linhas já hasheadas na mesma ordem.

Endpoints:
- POST /act_{AD_ACCOUNT_ID}/customaudiences   (criar)
- POST /{AUDIENCE_ID}/users                   (adicionar)
- DELETE /{AUDIENCE_ID}/users                 (remover)

Referência: developers.facebook.com/docs/marketing-api/audiences
"""

import json

import config
import hashing
import meta_client

MAX_ROWS_PER_BATCH = 10000

# Mapa: chave amigável -> (nome do schema na Meta, função de hashing).
# external_id vai em texto puro (não hashear).
_FIELD_MAP = {
    "email": ("EMAIL", hashing.hash_email),
    "phone": ("PHONE", hashing.hash_phone),
    "first_name": ("FN", hashing.hash_name),
    "last_name": ("LN", hashing.hash_name),
    "city": ("CT", hashing.hash_city),
    "state": ("ST", hashing.hash_state),
    "zip_code": ("ZIP", hashing.hash_zip),
    "country": ("COUNTRY", hashing.hash_country),
    "gender": ("GEN", hashing.hash_gender),
    "date_of_birth": ("DOBYYYYMMDD", hashing.hash_dob),
    "external_id": ("EXTERN_ID", lambda v: str(v) if v else None),
}


def create_audience(name, description="", ad_account_id=None, access_token=None):
    """Cria um Público Personalizado a partir de arquivo de clientes (CRM)."""
    ad_account_id = ad_account_id or config.AD_ACCOUNT_ID
    access_token = access_token or config.SYSTEM_USER_TOKEN

    body = {
        "name": name,
        "description": description,
        "subtype": "CUSTOM",
        # Origem dos dados: coletados diretamente pela empresa junto ao cliente.
        "customer_file_source": "USER_PROVIDED_ONLY",
    }
    resposta = meta_client.post(
        f"{ad_account_id}/customaudiences", access_token, data=body
    )
    return resposta.get("id")


def _build_payload(contacts, fields):
    """
    Monta (schema, data) a partir da lista de contatos.

    - contacts: lista de dicts (ex.: [{'email': ..., 'phone': ...}, ...])
    - fields: lista de chaves amigáveis definindo a ordem das colunas.
    """
    schema = []
    hashers = []
    for field in fields:
        if field not in _FIELD_MAP:
            raise ValueError(f"Campo não suportado: {field}")
        meta_name, hasher = _FIELD_MAP[field]
        schema.append(meta_name)
        hashers.append((field, hasher))

    data = []
    for contact in contacts:
        row = []
        for field, hasher in hashers:
            raw = contact.get(field)
            hashed = hasher(raw) if raw else ""
            row.append(hashed or "")
        data.append(row)
    return schema, data


def _mutate_users(audience_id, contacts, fields, method, access_token):
    schema, data = _build_payload(contacts, fields)
    total = 0
    respostas = []
    for i in range(0, len(data), MAX_ROWS_PER_BATCH):
        lote = data[i:i + MAX_ROWS_PER_BATCH]
        body = {"payload": json.dumps({"schema": schema, "data": lote})}
        resp = meta_client.request(
            method, f"{audience_id}/users", access_token, data=body
        )
        respostas.append(resp)
        total += resp.get("num_received", len(lote))
    return {"num_processed": total, "respostas": respostas}


def add_users(audience_id, contacts, fields=("email", "phone"), access_token=None):
    """
    Adiciona/atualiza contatos no público. `fields` define quais colunas enviar
    (quanto mais campos, melhor a taxa de correspondência).
    """
    access_token = access_token or config.SYSTEM_USER_TOKEN
    return _mutate_users(audience_id, contacts, list(fields), "POST", access_token)


def remove_users(audience_id, contacts, fields=("email",), access_token=None):
    """Remove contatos do público (ex.: pedidos de descadastro / LGPD)."""
    access_token = access_token or config.SYSTEM_USER_TOKEN
    return _mutate_users(audience_id, contacts, list(fields), "DELETE", access_token)


# ---------------------------------------------------------------------------
# Exemplo de uso
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # 1) Criar o público (rodar uma vez e guardar o ID retornado).
    # audience_id = create_audience("Alunos ativos - Pos RT",
    #                               "Base de matriculados exportada do CRM")
    audience_id = "COLE_O_AUDIENCE_ID"

    contatos = [
        {"email": "aluno1@exemplo.com.br", "phone": "11999998888",
         "first_name": "Ana", "last_name": "Lima", "external_id": "crm-1"},
        {"email": "aluno2@exemplo.com.br", "phone": "21988887777",
         "first_name": "Bruno", "last_name": "Costa", "external_id": "crm-2"},
    ]

    resultado = add_users(
        audience_id, contatos,
        fields=("email", "phone", "first_name", "last_name", "external_id"),
    )
    print(json.dumps(resultado, indent=2, ensure_ascii=False))
