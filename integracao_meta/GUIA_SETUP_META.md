# Guia de configuração no Meta — pré-requisitos da integração

Este guia cobre tudo o que precisa ser criado do lado do Meta **antes** de o
código rodar. Feito uma vez pela pessoa administradora do Business Manager.
Ao final você terá todos os valores para preencher o `config.py`.

## Visão geral do que será criado

| Item                             | Onde                      | Serve para                                           |
| -------------------------------- | ------------------------- | ---------------------------------------------------- |
| App do tipo Business             | Meta for Developers       | Autenticar as chamadas de API e receber webhooks     |
| Usuário de sistema (System User) | Business Manager          | Token de longa duração para CAPI, Públicos e Offline |
| Dataset (Pixel)                  | Events Manager            | Receber os eventos da Conversions API                |
| Token da Página                  | Graph API / painel do app | Buscar o conteúdo dos Lead Ads                       |
| Webhook `leadgen`                | Painel do app             | Notificar novos leads em tempo real                  |

---

## 1. Criar o app no Meta for Developers

1. Acesse `developers.facebook.com` com uma conta que administre o Business Manager.
2. **My Apps → Create App → tipo "Business"**.
3. Vincule o app ao Business Manager da Contabilidade Facilitada.
4. Anote o **App ID** e o **App Secret** (em _App Settings → Basic_). O App
   Secret vai no `config.py` (`APP_SECRET`) e valida a assinatura dos webhooks.
5. Adicione os produtos: **Marketing API**, **Conversions API** e **Webhooks**.

## 2. Criar o usuário de sistema e o token (CAPI, Públicos, Offline)

1. No **Business Manager → Configurações do negócio → Usuários → Usuários de sistema**.
2. Crie um usuário de sistema (recomendado o tipo **Admin** para gestão de públicos).
3. **Atribuir ativos**: dê a esse usuário acesso à **conta de anúncios** e ao
   **Dataset/Pixel**.
4. Clique em **Gerar novo token**, selecione o app criado no passo 1 e marque as permissões:
   - `ads_management`
   - `business_management`
5. Copie o token gerado → é o `SYSTEM_USER_TOKEN` do `config.py`.
   Tokens de usuário de sistema não expiram, mas podem ser revogados. Guarde em cofre de segredos.

## 3. Localizar o Dataset ID (Conversions API e Offline)

1. **Events Manager** → selecione o conjunto de dados (Dataset/Pixel) usado nos anúncios.
2. Em **Configurações**, copie o **ID do conjunto de dados** → `DATASET_ID`.
3. Na mesma tela, em _Testar eventos_, há um **código de teste** → use em
   `TEST_EVENT_CODE` durante a homologação e remova em produção.

> Observação: a Meta unificou as conversões web e offline no mesmo Dataset.
> Não é mais necessário criar "Offline Event Set" separado — as vendas offline
> entram pelo mesmo endpoint, mudando apenas o `action_source`.

## 4. Configurar o token da Página (Lead Ads)

Buscar o conteúdo dos leads exige um **token da Página** com `leads_retrieval`.

1. Garanta que o app tenha as permissões: `leads_retrieval`, `pages_show_list`,
   `pages_read_engagement`, `pages_manage_metadata`.
2. Gere um token da Página de longa duração (via _Graph API Explorer_ ou fluxo
   OAuth do app) para a Página que hospeda os formulários → `PAGE_ACCESS_TOKEN`.
3. Copie o **ID da Página** (em _Sobre_ da Página, ou via API) → `PAGE_ID`.

## 5. Cadastrar o webhook de Lead Ads

O código (`lead_ads.py`) expõe `GET/POST /webhook/meta-leads`. Ele precisa
estar publicado em uma **URL pública com HTTPS válido**.

1. Suba a aplicação (ex.: `gunicorn lead_ads:app`) atrás de HTTPS.
2. No painel do app: **Webhooks → Page → Subscribe to this object**.
3. **Callback URL**: `https://SEU_DOMINIO/webhook/meta-leads`
4. **Verify Token**: a mesma string definida em `WEBHOOK_VERIFY_TOKEN`.
5. A Meta faz um GET de verificação; o código responde ao `hub.challenge`.
6. Assine o campo **`leadgen`**.
7. Rode uma vez `lead_ads.inscrever_pagina_no_app()` para inscrever a Página no app
   (passo "Subscribed Apps" — além de assinar o webhook).

Para testar sem tráfego real, use a **Lead Ads Testing Tool** da Meta
(`developers.facebook.com/tools/lead-ads-testing`) para disparar um lead falso.

---

## 6. Preencher o config.py

Copie `config.example.py` para `config.py` e preencha:

| Variável               | Origem                                                     |
| ---------------------- | ---------------------------------------------------------- |
| `DATASET_ID`           | Passo 3                                                    |
| `AD_ACCOUNT_ID`        | Business Manager → contas de anúncios (com prefixo `act_`) |
| `PAGE_ID`              | Passo 4                                                    |
| `SYSTEM_USER_TOKEN`    | Passo 2                                                    |
| `PAGE_ACCESS_TOKEN`    | Passo 4                                                    |
| `APP_SECRET`           | Passo 1                                                    |
| `WEBHOOK_VERIFY_TOKEN` | Você define (igual ao painel do app)                       |
| `GRAPH_API_VERSION`    | Última estável no changelog da Graph API                   |

> **Segurança / LGPD.** Todo dado pessoal enviado à Meta vai com hash SHA-256
> (feito automaticamente pelo código). Ainda assim, garanta base legal para o
> compartilhamento, honre pedidos de descadastro (use `remove_users` nos
> Públicos) e nunca versione o `config.py` nem os tokens no Git.
