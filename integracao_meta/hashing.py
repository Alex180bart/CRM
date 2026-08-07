"""
hashing.py
----------
Normalização e hashing de dados pessoais (PII) exigidos pela Meta.

Regras oficiais da Meta:
- Todo dado pessoal identificável (e-mail, telefone, nome, cidade, etc.) deve
  ser enviado com hash SHA-256 em hexadecimal minúsculo.
- Antes do hash é obrigatório normalizar: remover espaços nas pontas, converter
  para minúsculas e remover caracteres especiais quando aplicável.
- Telefone: somente dígitos, incluindo o código do país (Brasil = 55), sem
  '+', espaços ou pontuação.
- external_id (ID do contato no seu CRM) NÃO precisa de hash, mas é recomendado
  aplicá-lo por consistência. Aqui deixamos como texto puro por padrão.

Referências:
- Conversions API - Customer Information Parameters
- Custom Audiences - Normalization & Hashing
"""

import hashlib
import re
import unicodedata


def _sha256(value: str) -> str:
    """Retorna o hash SHA-256 em hexadecimal minúsculo."""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _strip_accents(text: str) -> str:
    """Remove acentos (ex.: 'São Paulo' -> 'sao paulo')."""
    normalized = unicodedata.normalize("NFKD", text)
    return "".join(c for c in normalized if not unicodedata.combining(c))


def hash_email(email):
    if not email:
        return None
    normalized = email.strip().lower()
    return _sha256(normalized)


def hash_phone(phone, default_country_code="55"):
    """
    Normaliza telefone para o padrão E.164 sem '+': apenas dígitos com DDI.
    Ex.: '(11) 99999-8888' com DDI 55 -> '5511999998888'.
    Se o número já vier com o DDI, não o duplica.
    """
    if not phone:
        return None
    digits = re.sub(r"\D", "", str(phone))
    if not digits:
        return None
    # Heurística Brasil: números locais têm 10 ou 11 dígitos (DDD + número).
    # Se não começar com o DDI e tiver comprimento local, prefixa o DDI.
    if default_country_code and not digits.startswith(default_country_code):
        if len(digits) <= 11:
            digits = default_country_code + digits
    return _sha256(digits)


def hash_name(name):
    """Nomes: minúsculas, sem espaços nas pontas. Acentos são preservados
    pela Meta (FN/LN aceitam caracteres especiais), mas normalizamos o caixa."""
    if not name:
        return None
    return _sha256(name.strip().lower())


def hash_city(city):
    if not city:
        return None
    normalized = _strip_accents(city.strip().lower())
    normalized = re.sub(r"[^a-z]", "", normalized)
    return _sha256(normalized)


def hash_state(state):
    """Estado como sigla de 2 letras em minúsculo (ex.: 'SP' -> 'sp')."""
    if not state:
        return None
    normalized = _strip_accents(state.strip().lower())
    normalized = re.sub(r"[^a-z]", "", normalized)
    return _sha256(normalized)


def hash_zip(zip_code):
    """CEP: apenas os dígitos, sem hífen. Ex.: '01310-100' -> '01310100'."""
    if not zip_code:
        return None
    normalized = re.sub(r"\D", "", str(zip_code))
    return _sha256(normalized) if normalized else None


def hash_country(country_code):
    """Código de país ISO de 2 letras minúsculo (Brasil = 'br')."""
    if not country_code:
        return None
    normalized = country_code.strip().lower()
    normalized = re.sub(r"[^a-z]", "", normalized)
    return _sha256(normalized) if normalized else None


def hash_gender(gender):
    """Gênero normalizado para 'm' ou 'f' antes do hash."""
    if not gender:
        return None
    g = gender.strip().lower()[:1]
    if g not in ("m", "f"):
        return None
    return _sha256(g)


def hash_dob(date_of_birth):
    """Data de nascimento no formato YYYYMMDD antes do hash.
    Aceita 'YYYY-MM-DD' ou já em 'YYYYMMDD'."""
    if not date_of_birth:
        return None
    digits = re.sub(r"\D", "", str(date_of_birth))
    return _sha256(digits) if len(digits) == 8 else None
