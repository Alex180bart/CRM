# Publicação — eloraintelligence.com.br

Roteiro para colocar o site público da Elora no ar. Escrito a partir do estado
verificado do repositório, da conta de hospedagem e do DNS em 15/08/2026.

## O que vai ao ar

**O site público, aberto**: `/`, `/precos`, `/orcamento`, `/entrar`,
`/cadastrar`, `/conta` e `/admin`.

**O produto, atrás de login.** Inbox, Pipeline, Contatos, Administração, Chatbot
Builder, o widget de webchat e a superfície `/api` exigem sessão de
**administrador** — a conta da equipe comercial, semeada pelas variáveis de
ambiente. É o que permite abrir a demonstração na frente do cliente sem deixar a
base à mão de quem chegou pela landing page.

A guarda está em [`exposicao.ts`](../apps/web/src/lib/site/exposicao.ts) e
[`middleware.ts`](../apps/web/src/middleware.ts), e existe por duas razões
concretas:

1. O grupo `(workspace)` não verifica sessão por conta própria. Quem souber o
   endereço entraria.
2. O armazém é único por instância. Um visitante que carrega outra vertical de
   demonstração troca a base que **todo mundo** está vendo — inclusive quem
   estiver apresentando naquele instante. Não basta pedir login: precisa ser
   administrador, porque `/cadastrar` é aberto e uma conta comum sairia de graça.

**Por que o papel viaja dentro do cookie.** O middleware roda no runtime de
borda, sem `node:crypto` e sem acesso ao repositório — de lá não há como
perguntar "esta conta é administradora?". Então `issueToken` assina o papel junto
com o identificador e o vencimento, e [`sessao-edge.ts`](../apps/web/src/lib/site/sessao-edge.ts)
confere a assinatura com a Web Crypto API. A contrapartida está escrita lá: papel
revogado vale até o token vencer, o que é aceitável enquanto o administrador
nasce do ambiente e não muda em tempo de execução.

`ELORA_EXPOR_PRODUTO` ajusta isso em três estados: ausente (ou valor
desconhecido) exige administrador; `1` abre para qualquer visitante — só para
prévia descartável; `fechado` tira o produto do ar sem precisar de deploy.

Verificado em build de produção, com cookies forjados para cada caso:

| Sessão                        | `/inbox`         | `/api/*` |
| ----------------------------- | ---------------- | -------- |
| administrador                 | 200              | executa  |
| conta comum                   | 307 → `/entrar`  | 401      |
| assinada com outro segredo    | 307              | 401      |
| papel adulterado sem reassinar| 307              | 401      |
| vencida                       | 307              | 401      |

O site público responde 200 em todos os casos, e endereço inexistente continua
caindo na página 404 do site.

## Por que não na HostGator, apesar de a conta já existir

**A hospedagem compartilhada `alexfe21` não tem Node.js instalado.** Não é
questão de versão: `node -v` responde `command not found`, `/opt/alt` não tem
nenhum `alt-nodejs*` e `/opt/cpanel` só traz PHP (`ea-php80` a `ea-php85`). É por
isso que a ferramenta "Setup Node.js App" sequer aparece no painel — ela só
existe quando o seletor está provisionado.

Fica o registro de um erro de leitura que quase custou uma implantação quebrada:
a API do cPanel lista `passengerapps: 1` entre as features da conta, e isso foi
interpretado como "a conta roda Node". **A flag é permissão de interface, não
runtime instalado.** Publicar naquele servidor teria produzido exatamente o 503
silencioso que este documento existe para evitar. A verificação que vale é
executar `node -v` no ambiente, não ler a lista de features.

O plano gratuito da Vercel também está fora, por outro motivo: ele proíbe uso
comercial de forma explícita, e "anunciar a venda de um produto ou serviço" é o
exemplo que ela mesma dá.

Sobra o **Netlify**, cujo plano gratuito permite uso comercial — a restrição é
não revender hospedagem. São 100 GB de banda, 300 minutos de build e 125 mil
invocações de função por mês.

## 1. Criar o site no Netlify

Importar `Alex180bart/CRM` e configurar:

| Campo                 | Valor                                    |
| --------------------- | ---------------------------------------- |
| Branch to deploy      | `rebrand/elora`                          |
| **Base directory**    | vazio — a raiz do repositório            |
| **Package directory** | `apps/web`                               |
| Build command         | vem do `netlify.toml` (`pnpm build`)     |
| Publish directory     | vem do `netlify.toml` (`.next`)          |

A base precisa ficar na raiz para que o `pnpm install` enxergue o
`pnpm-workspace.yaml`: as dependências internas usam o protocolo `workspace:*`,
que não resolve de dentro de `apps/web`. O resto vem de
[`apps/web/netlify.toml`](../apps/web/netlify.toml), inclusive a versão do Node.

O runtime de Next.js é detectado e instalado pela própria plataforma — não há
plugin a declarar à mão.

## 2. Variáveis de ambiente (Site configuration → Environment variables)

| Variável               | Obrigatória | Observação                                                     |
| ---------------------- | ----------- | -------------------------------------------------------------- |
| `SITE_SESSION_SECRET`  | **Sim**     | Sem ela o cookie é assinado com a chave de desenvolvimento, que está neste repositório público — qualquer pessoa forja uma sessão. Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `ELORA_ADMIN_EMAIL`    | Sim         | Sem o par e-mail + senha, nenhuma conta de administrador é criada e `/admin` fica inacessível. |
| `ELORA_ADMIN_PASSWORD` | Sim         | Nunca vai para o Git. É derivada com scrypt no primeiro login.  |
| `SMTP_USER`            | **Sim**     | Caixa do Titan que envia a notificação de pedido de proposta.   |
| `SMTP_PASSWORD`        | **Sim**     | Senha dessa caixa.                                             |
| `SMTP_HOST`            | Não         | Padrão `smtp.titan.email`.                                     |
| `SMTP_PORT`            | Não         | Padrão `465`.                                                  |
| `ELORA_ORCAMENTO_DESTINO` | Não      | Para onde o pedido é enviado. Sem ela, vai para `SMTP_USER`.   |
| `ELORA_EXPOR_PRODUTO`  | **Não definir** | Ausente já significa "exige administrador", que é o comportamento desejado. Só defina para abrir a todos (`1`) numa prévia, ou para tirar o produto do ar (`fechado`). |
| `GEMINI_API_KEY`       | Recomendada | O copiloto do Inbox e a redação de e-mail fazem parte do que se demonstra. Sem ela, o painel do copiloto aparece desligado — que é honesto, mas menos convincente numa apresentação. |

`NODE_ENV` não entra na lista: a plataforma já define `production` no build e na
função. Defini-la à mão só cria uma segunda verdade a divergir.

### O pedido de proposta precisa sair por e-mail

`repositories.site.createQuote` grava no armazém em memória. Em serverless cada
requisição pode cair numa instância diferente, e a que gravou não é
necessariamente a que desenha a lista depois — o pedido some, e quem preencheu
leu "responderemos em até um dia útil".

`lib/site/notificacao.ts` envia cada pedido assim que ele é gravado. Sem as
variáveis SMTP nada quebra: o pedido é registrado, o conteúdo inteiro vai para o
log e a tela **avisa quem preencheu** que o time não foi notificado, com o
endereço para escrever direto.

Depois de configurar, envie um pedido de teste pelo próprio `/orcamento` e
confirme a chegada. É a única verificação que prova a credencial — porta errada
falha por tempo limite, não por erro de autenticação.

## 3. O domínio

Estado conferido antes de qualquer mudança:

| Registro | Valor hoje                            | O que fazer                        |
| -------- | ------------------------------------- | ---------------------------------- |
| `NS`     | `dns3.hostgator.com.br` / `dns4...`   | Não mexer — o DNS fica na HostGator |
| `A` (`@`)| `162.240.81.81` (não responde HTTP)   | `75.2.60.5`, ou ALIAS/ANAME para `apex-loadbalancer.netlify.com` se o painel aceitar |
| `www`    | `CNAME` → `eloraintelligence.com.br`  | `CNAME` → `<seu-site>.netlify.app` |
| `MX`     | `mx1.titan.email` / `mx2.titan.email` | **Não mexer** — o e-mail depende deles |

O ALIAS é preferível ao registro A quando existe: ele acompanha mudanças de
endereço da plataforma sem exigir edição manual.

**A troca não é feita pela API do cPanel.** A zona não pertence à conta de
hospedagem — a API respondeu, com todas as letras: *"You do not control a DNS
zone named eloraintelligence.com.br"*. Ela é servida por `dns3`/`dns4`, do painel
de domínios da HostGator, e é lá que os registros mudam.

No Netlify, adicione `eloraintelligence.com.br` como domínio principal e
`www.eloraintelligence.com.br` com redirecionamento para ele.

## 4. Conferência depois de publicar

```bash
nslookup eloraintelligence.com.br
curl -I https://eloraintelligence.com.br                  # 200
curl -I https://www.eloraintelligence.com.br              # redireciona para a raiz
curl -I https://eloraintelligence.com.br/inbox            # 307 para /entrar
curl -I https://eloraintelligence.com.br/api/ai/copilot   # 401
```

Depois, entre em `/entrar` com a conta de administrador e confirme que `/inicio`
abre. É o teste que prova a cadeia inteira: a variável de segredo, a semeadura da
conta no login e a leitura do cookie pelo middleware — três coisas que falham de
formas parecidas e cuja diferença não aparece na tela.

Confira também que o e-mail do domínio continua entrando — é o teste que ninguém
lembra de fazer e o único cujo defeito aparece dias depois.

## O editor de conteúdo do site nesta hospedagem

A aba de conteúdo em `/admin` grava em `apps/web/content/site-content.json`. Em
serverless o sistema de arquivos é **somente leitura**: a leitura funciona (o
arquivo versionado é servido normalmente), e o botão de publicar recusa com o
motivo escrito na tela.

O caminho é o que a própria tela indica: **exportar o JSON, comitar no
repositório, e o deploy publica**. Mais lento que salvar, e em troca a mudança de
texto passa a ter histórico, autor e reversão.

Uma armadilha coberta: o arquivo é lido por caminho montado em tempo de execução,
e o rastreador do Next não enxergava isso em todas as rotas — `/orcamento`,
`/entrar`, `/cadastrar` e `/conta` sairiam com o cabeçalho e o rodapé padrão
enquanto a home mostrava o texto editado. `outputFileTracingIncludes` no
`next.config.mjs` resolve, e o `"/**"` já cobre rota nova.

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
recuperado de uma base depois. É também o motivo de um VPS ser o destino natural
quando o Supabase, os workers e as filas do roadmap entrarem.

## Sobre a conta da HostGator

Ela continua servindo duas coisas que não mudam: **o e-mail do domínio** (Titan)
e **a zona de DNS**. A conta de FTP `eloraintelligence` e o diretório criados na
tentativa anterior não têm mais uso — podem ser removidos, e a senha que passou
por canal de conversa deve ser trocada de qualquer forma.
