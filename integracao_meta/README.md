# Integração CRM Interno ↔ Meta

Pacote de referência para conectar o CRM interno da Contabilidade Facilitada às
contas do Meta (Business Manager / Ads), cobrindo os quatro fluxos solicitados:

1. **Conversions API (CAPI)** — envio de eventos server-side (Lead, Purchase, etc.).
2. **Importação de Lead Ads** — recebimento em tempo real dos leads dos formulários.
3. **Públicos Personalizados** — sincronização de listas do CRM (Custom/Lookalike).
4. **Conversões Offline** — envio de vendas fechadas fora do site de volta ao Meta.

> Escopo deste pacote: **código + documentação** para a equipe de desenvolvimento
> implementar. As chamadas reais à API exigem os tokens que só existem após o
> setup no Meta (ver `GUIA_SETUP_META.md`).

## Estrutura dos arquivos

```
integracao_meta/
├── README.md                 # este arquivo
├── GUIA_SETUP_META.md        # passo a passo de configuração no Meta (fazer 1x)
├── requirements.txt          # dependências (requests, Flask)
├── config.example.py         # modelo de configuração — copie para config.py
├── hashing.py                # normalização + hash SHA-256 do PII (LGPD/Meta)
├── meta_client.py            # cliente HTTP compartilhado (retry, erros, versão)
├── conversions_api.py        # fluxo 1: eventos server-side
├── lead_ads.py               # fluxo 2: webhook + busca de leads (Flask)
├── custom_audiences.py       # fluxo 3: públicos personalizados
└── offline_conversions.py    # fluxo 4: conversões offline (via CAPI)
```

## Como começar

```bash
pip install -r requirements.txt
cp config.example.py config.py     # preencha com as credenciais (ver guia)
```

Em seguida siga o **`GUIA_SETUP_META.md`** para criar o app, o usuário de
sistema, o token da Página e o webhook, e para obter todos os IDs/tokens.

Cada módulo tem um bloco `if __name__ == "__main__":` com um exemplo executável.
Rode em modo de teste primeiro (`TEST_EVENT_CODE` preenchido) e valide no
**Events Manager → Testar eventos**.

## Como cada fluxo funciona

### 1. Conversions API — `conversions_api.py`

Monta `user_data` (com PII hasheada) e envia eventos para `/{DATASET_ID}/events`.
Use o **mesmo `event_id`** no Pixel do navegador e na CAPI para o Meta
deduplicar. Exemplo típico: quando um lead entra no CRM, dispare um evento `Lead`.

### 2. Lead Ads — `lead_ads.py`

Sobe um receptor Flask em `/webhook/meta-leads`. Quando a Meta notifica um novo
lead, o código valida a assinatura (`X-Hub-Signature-256`), busca os dados
completos pelo `leadgen_id` e chama `salvar_lead_no_crm()`.
**Adapte `salvar_lead_no_crm()`** para a API/tabela do CRM interno (gravação
idempotente pelo `id` do lead).

### 3. Públicos Personalizados — `custom_audiences.py`

`create_audience()` cria o público (uma vez). `add_users()` / `remove_users()`
sincronizam contatos em lotes de até 10.000, com hash automático. Ideal rodar
por rotina/cron a partir de uma consulta ao CRM.

### 4. Conversões Offline — `offline_conversions.py`

Camada sobre a CAPI para vendas fechadas por telefone, balcão, e-mail ou
WhatsApp. Diferença-chave: o `action_source` (`phone_call`, `physical_store`,
etc.) e o envio do **event_time real da venda** (aceita até 62 dias retroativos).

## Decisões técnicas relevantes

- **Versão da API parametrizada** (`GRAPH_API_VERSION`, padrão `v24.0`). Confirme
  a última estável no changelog antes de produção — versões saem de circulação
  em ~2 anos.
- **Conversões offline via CAPI**: a antiga Offline Conversions API com Offline
  Event Sets foi descontinuada; tudo vai pelo mesmo Dataset/endpoint de eventos.
- **Retry com backoff** para rate limits e erros temporários (em `meta_client.py`).
- **Hashing centralizado** em `hashing.py`, seguindo as regras de normalização
  da Meta (minúsculas, telefone E.164 sem `+`, CEP só dígitos, etc.).

## Checklist de validação (recomendado antes de produção)

- [ ] Eventos aparecem no **Events Manager → Testar eventos** com `TEST_EVENT_CODE`.
- [ ] Qualidade da correspondência (_Event Match Quality_) satisfatória na CAPI.
- [ ] Webhook responde ao handshake e recebe um lead de teste (Lead Ads Testing Tool).
- [ ] Público personalizado sai de "Populando" para tamanho > 0 após `add_users`.
- [ ] Conversão offline aparece atribuída à campanha correta.
- [ ] Base legal (LGPD) e fluxo de descadastro (`remove_users`) definidos.
