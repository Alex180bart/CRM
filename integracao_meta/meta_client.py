"""
meta_client.py
--------------
Cliente HTTP compartilhado para a Graph API da Meta.

Centraliza a montagem de URL (com a versão da API), o envio das requisições,
retry com backoff exponencial para erros temporários e o tratamento de erros
da API, para que os demais módulos fiquem enxutos.
"""

import time
import logging
import requests

from config import GRAPH_API_VERSION

logger = logging.getLogger("integracao_meta")

GRAPH_BASE_URL = "https://graph.facebook.com"

# Códigos de erro da Meta que valem a pena repetir (limites de taxa / temporários).
# 1 = desconhecido, 2 = temporário, 4/17/32/613 = rate limit, 341 = limite de app.
_RETRYABLE_ERROR_CODES = {1, 2, 4, 17, 32, 341, 613}


class MetaAPIError(Exception):
    """Erro retornado pela Graph API da Meta."""

    def __init__(self, status_code, payload):
        self.status_code = status_code
        self.payload = payload or {}
        error = self.payload.get("error", {})
        self.code = error.get("code")
        self.subcode = error.get("error_subcode")
        self.fbtrace_id = error.get("fbtrace_id")
        message = error.get("message", "Erro desconhecido da Graph API")
        super().__init__(
            f"[HTTP {status_code}] code={self.code} subcode={self.subcode} "
            f"fbtrace_id={self.fbtrace_id}: {message}"
        )


def _build_url(path: str) -> str:
    path = path.lstrip("/")
    return f"{GRAPH_BASE_URL}/{GRAPH_API_VERSION}/{path}"


def request(method, path, access_token, params=None, data=None, json_body=None,
            max_retries=4, timeout=30):
    """
    Executa uma requisição à Graph API.

    - method: 'GET', 'POST', 'DELETE'
    - path: caminho relativo (ex.: '{dataset_id}/events')
    - access_token: token adicionado como parâmetro access_token
    - params: query params adicionais (dict)
    - data: corpo form-urlencoded (dict) — usado quando a Meta espera campos
      serializados como string JSON (caso de /users e /events)
    - json_body: corpo JSON puro (dict)

    Retorna o corpo já desserializado (dict). Lança MetaAPIError em falha.
    """
    url = _build_url(path)
    params = dict(params or {})
    params["access_token"] = access_token

    attempt = 0
    while True:
        attempt += 1
        try:
            response = requests.request(
                method=method,
                url=url,
                params=params,
                data=data,
                json=json_body,
                timeout=timeout,
            )
        except requests.RequestException as exc:
            if attempt <= max_retries:
                sleep_for = min(2 ** attempt, 30)
                logger.warning("Falha de rede (%s). Retry em %ss...", exc, sleep_for)
                time.sleep(sleep_for)
                continue
            raise MetaAPIError(0, {"error": {"message": f"Falha de rede: {exc}"}})

        if response.status_code < 400:
            return response.json() if response.content else {}

        try:
            payload = response.json()
        except ValueError:
            payload = {"error": {"message": response.text}}

        error_code = payload.get("error", {}).get("code")
        is_retryable = (
            response.status_code >= 500 or error_code in _RETRYABLE_ERROR_CODES
        )
        if is_retryable and attempt <= max_retries:
            sleep_for = min(2 ** attempt, 30)
            logger.warning(
                "Erro temporário da Meta (HTTP %s, code %s). Retry em %ss...",
                response.status_code, error_code, sleep_for,
            )
            time.sleep(sleep_for)
            continue

        raise MetaAPIError(response.status_code, payload)


def get(path, access_token, params=None, **kwargs):
    return request("GET", path, access_token, params=params, **kwargs)


def post(path, access_token, params=None, data=None, json_body=None, **kwargs):
    return request("POST", path, access_token, params=params, data=data,
                   json_body=json_body, **kwargs)


def delete(path, access_token, params=None, data=None, **kwargs):
    return request("DELETE", path, access_token, params=params, data=data, **kwargs)
