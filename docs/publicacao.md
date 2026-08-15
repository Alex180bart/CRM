# Publicação — eloraintelligence.com.br na HostGator

Roteiro para colocar o site público da Elora no ar, na hospedagem cPanel que a
empresa já mantém. Escrito a partir do estado verificado do repositório, da conta
(consultada pela API do cPanel) e do DNS em 15/08/2026.

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

Verificado em build de produção: site público responde 200, `/inbox` e
`/administracao` respondem 307 para `/`, `/api/*` responde 404, e o endereço
inexistente continua caindo na página 404 do site. `ELORA_EXPOR_PRODUTO=1` abre
tudo — use isso apenas fora do domínio da empresa.

## Por que HostGator, e não uma plataforma gerenciada

A conta `alexfe21` tem a feature `passengerapps` habilitada — o "Setup Node.js
App" do cPanel —, além de `ssh` e `version_control`. Ou seja, ela **roda Node**,
ao contrário do que a hospedagem compartilhada costuma oferecer.

Do outro lado, o plano gratuito da Vercel proíbe uso comercial de forma
explícita, e "anunciar a venda de um produto ou serviço" é o exemplo que ela
mesma dá. Este site se enquadra, então lá o custo seria de US$ 20/mês.

O que se paga por essa escolha está listado em "Riscos conhecidos", no fim.

## 1. Onde o build acontece — e por que não é aqui

O pacote `standalone` do Next carrega as dependências que o rastreamento provou
necessárias, **incluindo binários da plataforma onde foi montado**. Montado no
Windows, ele leva `@next/swc-win32-x64-msvc` para um servidor Linux. E o build
sequer termina no Windows: recriar os symlinks do pnpm exige privilégio que a
conta comum não tem — foi o erro `EPERM: operation not permitted, symlink` que
apareceu na primeira tentativa.

No servidor também não dá: a hospedagem tem `npm`, e `npm` não resolve o
protocolo `workspace:*` que `@elora/core` e `@elora/ui` usam.

Sobra o GitHub Actions, que roda em Ubuntu e é gratuito para repositório público
— que é o caso deste. O fluxo está em
[`.github/workflows/deploy-hostgator.yml`](../.github/workflows/deploy-hostgator.yml):
instala com pnpm, roda lint, typecheck e testes, monta o standalone, envia por
FTP e toca o gatilho de restart do Passenger.

## 2. Criar a aplicação Node no cPanel

cPanel → **Setup Node.js App** → **Create Application**:

| Campo                     | Valor                                    |
| ------------------------- | ---------------------------------------- |
| Node.js version           | a mais alta disponível — **precisa ser 20.11 ou maior** |
| Application mode          | Production                               |
| Application root          | `elora`                                  |
| Application URL           | o domínio, depois que ele estiver na conta |
| Application startup file  | `server.js`                              |

**A versão do Node é o primeiro item a conferir, e é eliminatório.** O
repositório exige `>= 20.11`. Se o servidor parar em 18, este caminho acaba aqui
e a conversa volta a ser sobre plataforma gerenciada ou VPS. Depois de escolher,
ajuste `NODE_VERSION` no workflow para a mesma major: compilar numa e executar
noutra produz erro de ABI que só aparece em tempo de execução.

Não use o botão "Run NPM Install" — não há o que instalar. O standalone chega
com as dependências dentro.

## 3. Variáveis de ambiente da aplicação

Ainda em Setup Node.js App, na própria aplicação, seção de variáveis:

| Variável               | Obrigatória | Observação                                                     |
| ---------------------- | ----------- | -------------------------------------------------------------- |
| `NODE_ENV`             | **Sim**     | `production`. É o que ativa a guarda de exposição — sem ela, o produto inteiro fica público. |
| `SITE_SESSION_SECRET`  | **Sim**     | Sem ela o cookie é assinado com a chave de desenvolvimento, que está neste repositório público — qualquer pessoa forja uma sessão. Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `ELORA_ADMIN_EMAIL`    | Sim         | Sem o par e-mail + senha, nenhuma conta de administrador é criada e `/admin` fica inacessível. |
| `ELORA_ADMIN_PASSWORD` | Sim         | Nunca vai para o Git. É derivada com scrypt no primeiro login.  |
| `SMTP_USER`            | **Sim**     | Caixa do Titan que envia a notificação de pedido de proposta.   |
| `SMTP_PASSWORD`        | **Sim**     | Senha dessa caixa.                                             |
| `SMTP_HOST`            | Não         | Padrão `smtp.titan.email`.                                     |
| `SMTP_PORT`            | Não         | Padrão `465`.                                                  |
| `ELORA_ORCAMENTO_DESTINO` | Não      | Para onde o pedido é enviado. Sem ela, vai para `SMTP_USER`.   |
| `ELORA_EXPOR_PRODUTO`  | **Não definir** | Abrir o produto neste domínio é o que a guarda existe para impedir. |
| `GEMINI_API_KEY`       | Não         | A IA só é usada pelo produto, que está fechado.                 |

### O pedido de proposta precisa sair por e-mail

`repositories.site.createQuote` grava no armazém em memória, que morre quando o
Passenger recicla o processo. Sem notificação, o pedido some e quem preencheu leu
"responderemos em até um dia útil".

`lib/site/notificacao.ts` envia cada pedido assim que ele é gravado. Sem as
variáveis SMTP nada quebra: o pedido é registrado, o conteúdo inteiro vai para o
log e a tela **avisa quem preencheu** que o time não foi notificado, com o
endereço para escrever direto.

Depois de configurar, envie um pedido de teste pelo próprio `/orcamento` e
confirme a chegada. É a única verificação que prova a credencial — porta errada
falha por tempo limite, não por erro de autenticação.

## 4. Credenciais de publicação no GitHub

Em **Settings → Secrets and variables → Actions** do repositório:

| Nome                       | Tipo     | Valor                                      |
| -------------------------- | -------- | ------------------------------------------ |
| `HOSTGATOR_FTP_HOST`       | Secret   | `50.116.112.95`                            |
| `HOSTGATOR_FTP_USER`       | Secret   | usuário da conta FTP                       |
| `HOSTGATOR_FTP_PASSWORD`   | Secret   | senha dessa conta                          |
| `HOSTGATOR_DEPLOY`         | Variable | `true` — só então o workflow publica       |

Crie uma **conta FTP dedicada** no cPanel, com diretório restrito a `elora`, em
vez de usar a credencial principal. A senha vai para um segredo do GitHub, e um
segredo que dá acesso à conta inteira é um segredo que você não pode rotacionar
sem parar tudo.

`HOSTGATOR_DEPLOY` existe para o workflow rodar como verificação antes de a
publicação estar pronta: enquanto ela não valer `true`, cada push roda lint,
typecheck, teste e build, e não tenta enviar nada.

## 5. O domínio

Estado conferido antes de qualquer mudança:

| Registro | Valor hoje                            | O que fazer                        |
| -------- | ------------------------------------- | ---------------------------------- |
| `NS`     | `dns3.hostgator.com.br` / `dns4...`   | Não mexer                          |
| `A` (`@`)| `162.240.81.81` (não responde HTTP)   | Apontar para `50.116.112.97`       |
| `www`    | `CNAME` → `eloraintelligence.com.br`  | Manter                             |
| `MX`     | `mx1.titan.email` / `mx2.titan.email` | **Não mexer** — o e-mail depende deles |

Duas coisas precisam acontecer, nesta ordem:

1. **Adicionar `eloraintelligence.com.br` à conta** (cPanel → Domínios →
   Criar um novo domínio), para que o Apache saiba servi-lo e o AutoSSL emita o
   certificado. Depois disso, volte à aplicação Node e defina o Application URL.
2. **Trocar o registro A** para o IP da hospedagem.

**A troca do A não é feita por aqui.** A API do cPanel desta conta respondeu, com
todas as letras: *"You do not control a DNS zone named eloraintelligence.com.br"*.
A zona é servida por `dns3`/`dns4`, que pertencem ao painel de domínios da
HostGator — é lá, na área de gerenciamento de DNS do domínio, que o registro A
muda. A conta de hospedagem só controla a zona do próprio domínio temporário.

## 6. Conferência depois de publicar

```bash
nslookup eloraintelligence.com.br             # 50.116.112.97
curl -I https://eloraintelligence.com.br      # 200
curl -I https://eloraintelligence.com.br/inbox            # 307 para /
curl -I https://eloraintelligence.com.br/api/ai/copilot   # 404
```

Confira também que o e-mail do domínio continua entrando — é o teste que ninguém
lembra de fazer e o único cujo defeito aparece dias depois.

## O editor de conteúdo do site funciona aqui

Diferente de hospedagem serverless, o Passenger roda num sistema de arquivos
gravável: a aba de conteúdo em `/admin` publica direto em
`apps/web/content/site-content.json`, dentro do diretório da aplicação.

**Com uma ressalva que precisa estar escrita:** o deploy sobrescreve aquele
arquivo com a versão do repositório. Quem editar pelo painel e não trouxer a
mudança para o Git perde o texto na publicação seguinte. O botão de exportar
existe para isso — baixe o JSON, comite, e a próxima publicação passa a ser a
fonte da verdade.

## Riscos conhecidos desta hospedagem

Escritos aqui porque cada um já cobrou o seu preço em projetos parecidos, e
porque a escolha por ela foi consciente:

1. **Sem log, o diagnóstico para.** Erro de inicialização do Passenger aparece
   como 503 sem explicação. O log fica em `~/logs` e em
   `~/elora/stderr.log` — chegar até ele exige SSH ou o Gerenciador de Arquivos.
2. **Memória da conta é limitada.** O Next em produção consome de 100 a 200 MB
   por processo. Se a conta estourar o limite, o Passenger derruba e reinicia o
   app — e o sintoma para o visitante é lentidão intermitente, não erro.
3. **Sem CDN e sem rollback de um clique.** Voltar atrás é outro deploy inteiro,
   e leva o tempo do workflow.
4. **O armazém em memória zera quando o Passenger recicla o processo.** Contas
   criadas em `/cadastrar` e pedidos gravados desaparecem — é o motivo de o
   e-mail do orçamento não ser opcional. A conta de administrador é a exceção,
   porque é semeada das variáveis de ambiente no momento do login.
5. **Cada publicação para o site por alguns segundos**, enquanto o FTP substitui
   os arquivos e o Passenger recarrega.
