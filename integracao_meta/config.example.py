"""
config.example.py
------------------
Copie este arquivo para `config.py` e preencha com as credenciais reais.
NUNCA versione o config.py em Git (adicione ao .gitignore).

Em produção, prefira ler estes valores de variáveis de ambiente ou de um
cofre de segredos (AWS Secrets Manager, GCP Secret Manager, Vault, etc.).
"""

import os

# ---------------------------------------------------------------------------
# Versão da Graph API.
# Verifique a versão estável mais recente no changelog oficial antes de subir
# para produção: https://developers.facebook.com/docs/graph-api/changelog
# Cada versão fica disponível por ~2 anos. Mantenha atualizada.
# ---------------------------------------------------------------------------
GRAPH_API_VERSION = os.getenv("META_API_VERSION", "v24.0")

# ---------------------------------------------------------------------------
# Identificadores da conta Meta
# ---------------------------------------------------------------------------
# Dataset ID (antigo "Pixel ID") usado pela Conversions API — encontrado no
# Events Manager > seu conjunto de dados > Configurações.
DATASET_ID = os.getenv("META_DATASET_ID", "000000000000000")

# ID da conta de anúncios, com o prefixo act_ (ex.: act_1234567890).
AD_ACCOUNT_ID = os.getenv("META_AD_ACCOUNT_ID", "act_0000000000")

# ID da Página do Facebook que hospeda os formulários de Lead Ads.
PAGE_ID = os.getenv("META_PAGE_ID", "000000000000000")

# ---------------------------------------------------------------------------
# Tokens de acesso
# ---------------------------------------------------------------------------
# Token de usuário de sistema (System User) do Business Manager.
# Use-o para Conversions API, Públicos Personalizados e conversões offline.
SYSTEM_USER_TOKEN = os.getenv("META_SYSTEM_USER_TOKEN", "COLE_O_TOKEN_AQUI")

# Token da Página (Page access token) com a permissão leads_retrieval.
# Necessário apenas para buscar o conteúdo dos leads de Lead Ads.
PAGE_ACCESS_TOKEN = os.getenv("META_PAGE_ACCESS_TOKEN", "COLE_O_TOKEN_DA_PAGINA")

# App secret do app criado no Meta for Developers — usado para validar a
# assinatura (X-Hub-Signature-256) dos webhooks de Lead Ads.
APP_SECRET = os.getenv("META_APP_SECRET", "COLE_O_APP_SECRET")

# Token de verificação que VOCÊ define ao cadastrar o webhook no painel do app.
# Precisa ser idêntico dos dois lados (painel do Meta e este código).
WEBHOOK_VERIFY_TOKEN = os.getenv("META_WEBHOOK_VERIFY_TOKEN", "defina-uma-string-secreta")

# ---------------------------------------------------------------------------
# Modo de teste
# ---------------------------------------------------------------------------
# Preencha com o código de teste do Events Manager (aba "Testar eventos") para
# validar eventos sem afetar dados de produção. Deixe None em produção.
TEST_EVENT_CODE = os.getenv("META_TEST_EVENT_CODE") or None
