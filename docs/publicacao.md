# Publicação — eloraintelligence.com.br

Roteiro para colocar o site público da Elora no domínio da empresa. Escrito a
partir do estado verificado do repositório e do DNS em 15/08/2026.

## O que vai ao ar

**Só o site público**: `/`, `/precos`, `/orcamento`, `/entrar`, `/cadastrar`,
`/conta` e `/admin`.

O produto — Inbox, Pipeline, Contatos, Administração, Chatbot Builder, o widget
de webchat e toda a superfície `/api` — fica **fechado por omissão em produção**.
A guarda está em [`apps/web/src/lib/site/exposicao.ts`](../apps/web/src/lib/site/exposicao.ts),
é aplicada pelo middleware e tem duas razões concretas:

1. O grupo `(workspace)` não verifica sessão. Quem souber o endereço entra.
2. O armazém é único por instância. Um visitante que carrega outra vertical de
   demonstração troca a base que **todo mundo** está vendo — inclusive quem
   estiver apresentando naquele instante.

Comportamento verificado em build de produção: site público responde 200,
`/inbox` e `/administracao` respondem 307 para `/`, `/api/*` responde 404, e o
endereço inexistente continua caindo na página 404 do site.

Para demonstrar o produto, use um **deploy de prévia** com
`ELORA_EXPOR_PRODUTO=1` — a URL de prévia não é o endereço da empresa. Não
defina essa variável no ambiente de produção.

## Por que não a hospedagem compartilhada da HostGator

O br616 é cPanel: serve arquivo estático e PHP. Esta aplicação é Next.js 15 com
middleware, 20 rotas de API e Server Actions — precisa de processo Node
permanente. Exportação estática não é alternativa: `output: "export"` não
convive com nenhuma dessas quatro coisas.

O DNS continua na HostGator. Só o apontamento muda.

## 1. Código no GitHub

O repositório é `Alex180bart/CRM`. A Vercel publica a partir da **branch de
produção** do projeto (por padrão, a branch padrão do repositório). Garanta que a
branch que contém o site — hoje `rebrand/elora` — seja a branch de produção do
projeto na Vercel, ou faça o merge em `main` antes.

## 2. Projeto na Vercel

| Campo               | Valor                                                          |
| ------------------- | -------------------------------------------------------------- |
| Framework Preset    | Next.js (detectado)                                            |
| **Root Directory**  | `apps/web`                                                     |
| Install Command     | padrão — a Vercel detecta o workspace pnpm pelo lockfile da raiz |
| Build Command       | padrão (`next build`)                                          |
| Node.js Version     | 22 (o repositório exige ≥ 20.11)                               |

Root Directory em `apps/web` é o que faz a Vercel montar a função a partir do
app; a instalação continua acontecendo na raiz, porque `pnpm-workspace.yaml` e o
lockfile estão lá e `@elora/core` e `@elora/ui` são dependências de workspace.

## 3. Variáveis de ambiente (escopo Production)

| Variável               | Obrigatória | Observação                                                     |
| ---------------------- | ----------- | -------------------------------------------------------------- |
| `SITE_SESSION_SECRET`  | **Sim**     | Sem ela o cookie é assinado com a chave de desenvolvimento, que está no código deste repositório publicado — qualquer pessoa forja uma sessão. Gere com `openssl rand -hex 32`. |
| `ELORA_ADMIN_EMAIL`    | Sim         | Sem o par e-mail + senha, **nenhuma** conta de administrador é criada e `/admin` fica inacessível. |
| `ELORA_ADMIN_PASSWORD` | Sim         | Nunca vai para o Git. É derivada com scrypt no primeiro login.  |
| `ELORA_ADMIN_NAME`     | Não         | Padrão: "Equipe Elora".                                        |
| `ELORA_EXPOR_PRODUTO`  | **Não definir** | Só no escopo Preview, quando for demonstrar o produto.      |
| `SMTP_USER`            | **Sim**     | Caixa do Titan que envia a notificação de pedido de proposta. Veja a seção abaixo. |
| `SMTP_PASSWORD`        | **Sim**     | Senha dessa caixa.                                             |
| `SMTP_HOST`            | Não         | Padrão `smtp.titan.email`.                                     |
| `SMTP_PORT`            | Não         | Padrão `465` (TLS implícito). Use `587` se o provedor exigir STARTTLS. |
| `SMTP_FROM`            | Não         | Remetente, quando diferente da caixa que autentica.            |
| `ELORA_ORCAMENTO_DESTINO` | Não      | Para onde o pedido é enviado. Sem ela, vai para `SMTP_USER`.   |
| `GEMINI_API_KEY`       | Não         | A IA só é usada pelo produto, que está fechado. Deixar de fora evita que a chave exista num ambiente onde nada a consome. |
| `WHATSAPP_*`           | Não         | O webhook está bloqueado junto com `/api`.                     |

### O pedido de proposta precisa sair por e-mail

`repositories.site.createQuote` grava no armazém em memória. Em serverless cada
requisição pode cair numa instância diferente, e a que gravou não é
necessariamente a que desenha a lista depois — o pedido some, e quem preencheu
leu "responderemos em até um dia útil".

Por isso `lib/site/notificacao.ts` envia cada pedido por e-mail assim que ele é
gravado. Sem as variáveis SMTP, o site continua no ar e nada quebra: o pedido é
registrado, o conteúdo inteiro vai para o log do deploy — que passa a ser o
único lugar onde o lead existe — e a tela **avisa quem preencheu** que o time não
foi notificado, oferecendo o endereço para escrever direto. É pior que enviar, e
muito melhor que confirmar um retorno que não vai acontecer.

Depois de configurar, envie um pedido de teste pelo próprio `/orcamento` e
confirme a chegada. É a única verificação que prova a credencial: porta errada
falha por tempo limite, não por erro de autenticação.

## 4. Domínio na Vercel

Adicione os dois em **Settings → Domains**:

- `eloraintelligence.com.br` — canônico;
- `www.eloraintelligence.com.br` — com **Redirect to** apontando para o primeiro.

A Vercel recomenda o inverso (www canônico, com CNAME), porque CNAME dá a ela
mais controle de roteamento que um A record. A raiz como canônica funciona por
anycast; a escolha aqui foi pela raiz, e a ressalva fica registrada.

## 5. DNS na HostGator

Estado atual do domínio, conferido antes de qualquer mudança:

| Registro | Valor hoje                                | O que fazer                        |
| -------- | ----------------------------------------- | ---------------------------------- |
| `NS`     | `dns3.hostgator.com.br` / `dns4...`       | **Não mexer** — o DNS fica na HostGator |
| `A` (`@`)| `162.240.81.81` (não responde HTTP)       | Trocar pelo IP do cartão do domínio na Vercel |
| `www`    | `CNAME` → `eloraintelligence.com.br`      | Trocar pelo alvo CNAME que a Vercel mostrar |
| `MX`     | `mx1.titan.email` / `mx2.titan.email`     | **Não mexer** — o e-mail do domínio depende deles |

Nada mais deve ser alterado. Os registros de SPF, DKIM e o host de webmail do
Titan continuam onde estão; mexer neles derruba o e-mail da empresa, que é um
serviço em uso e não tem relação com esta publicação.

**Copie os valores do painel da Vercel, não deste documento.** O IP do apex sai
do cartão do domínio no projeto (costuma ser `76.76.21.21`, mas projetos novos
recebem outro, como `216.198.79.1`), e o CNAME do `www` é único por projeto
(algo como `d1d4fc829fe7bc7c.vercel-dns-017.com`). A verificação procura o valor
exato que aquele projeto espera — qualquer outro deixa o domínio inválido.

Se o painel oferecer, baixe o TTL desses dois registros antes da troca. A
propagação costuma levar de minutos a poucas horas.

## 6. Conferência depois de publicar

```bash
nslookup eloraintelligence.com.br          # deve devolver o IP da Vercel
curl -I https://eloraintelligence.com.br   # 200
curl -I https://www.eloraintelligence.com.br  # 307/308 para a raiz
curl -I https://eloraintelligence.com.br/inbox      # 307 para /
curl -I https://eloraintelligence.com.br/api/ai/copilot  # 404
```

Confira também que o e-mail do domínio continua entrando — é o teste que ninguém
lembra de fazer e o único cujo defeito aparece dias depois.

## O editor de conteúdo do site nesta hospedagem

A aba de conteúdo em `/admin` grava em `apps/web/content/site-content.json`. Na
Vercel o sistema de arquivos é **somente leitura**: a leitura funciona (o arquivo
versionado é servido normalmente), e o botão de publicar recusa com o motivo
escrito na tela.

O caminho é o que a própria tela indica: **exportar o JSON, comitar no
repositório, e o deploy publica**. É mais lento que salvar, e em troca a mudança
de texto passa a ter histórico, autor e reversão.

Uma armadilha coberta: o arquivo é lido por caminho montado em tempo de execução,
e o rastreador do Next não enxergava isso em todas as rotas — `/orcamento`,
`/entrar`, `/cadastrar` e `/conta` sairiam com o cabeçalho e o rodapé padrão
enquanto a home mostrava o texto editado. `outputFileTracingIncludes` no
`next.config.mjs` resolve, e o comentário lá explica por quê. Ao criar rota nova
no site, o `"/**"` já cobre.

## A vitrine de demonstração em `/admin`

Com o produto fechado, o botão "abrir esta demonstração" não teria destino — ele
recarrega o armazém e leva para `/inicio`, que o middleware devolve para a home.
A galeria detecta isso sozinha (`produtoExposto`), desabilita o botão e explica o
motivo na tela. A ação `openVerticalAction` recusa a chamada pelo mesmo critério,
porque Server Action tem endereço próprio e a tela não protege contra um `POST`
montado à mão.

As outras duas abas de `/admin` — simulador de preço e editor de conteúdo —
funcionam integralmente em produção.

## O que ainda não existe em produção

Nada é persistido além do arquivo de conteúdo. Contas criadas em `/cadastrar`
vivem no armazém em memória e **somem a cada novo deploy** e a cada reciclagem da
função — a tela de cadastro já diz isso antes do formulário. Em serverless há um
agravante que a tela não menciona: instâncias diferentes não compartilham o
armazém, então cadastrar e entrar em seguida pode falhar com "e-mail ou senha
incorretos" sem que nada esteja errado com a senha.

A conta de administrador é a exceção, e por construção: ela é semeada a partir
das variáveis de ambiente **no momento do login**, então existe em qualquer
instância.

Enquanto não houver back-end, trate o pedido de proposta como notificação, não
como registro: quem preencher é respondido pelo e-mail que sai na hora, não
recuperado de uma base depois.
