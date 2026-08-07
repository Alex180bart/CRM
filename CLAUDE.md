# CRM CF — instruções do repositório

CRM omnichannel interno da Contabilidade Facilitada: atendimento, CRM 360º, automação e
inteligência artificial em uma plataforma só.

**A fonte da verdade do produto é `docs/referencia/plano-completo-crm-v2.txt`** (35 seções, extraído
do documento aprovado em 27/07/2026). Antes de decidir escopo, modelo de dados, regra de negócio ou
prioridade, localize a seção correspondente e cite-a pelo número. Se o plano for omisso, diga que é
omisso — não invente requisito como se fosse dele.

## Estado atual

**Front-end das fases 2 a 4 do roadmap**, com base de demonstração local. Não há back-end, Supabase,
autenticação real nem integração com canais.

Construído: Início, Inbox, Contatos, Contato 360º, Pipeline, Campanhas (lista, segmentos, templates,
detalhe e assistente de criação), Automações, Chatbot Builder, Journey Builder, E-mail Studio,
Webchat, Agentes de IA, Analytics e Administração. Falta toda a camada de escrita/back-end.

**Duas exceções reais**, ambas dependentes de `GEMINI_API_KEY` no `.env` da raiz:

- o copiloto do atendente no Inbox — `apps/web/src/app/api/ai/copilot/route.ts`;
- a redação de e-mail no Studio — `apps/web/src/app/api/ai/email/route.ts`, que recebe um briefing e
  devolve assunto, preheader, corpo e chamada validados contra schema. Rota separada de propósito: o
  corpo não tem conversa nenhuma, e aceitá-lo na rota do copiloto obrigaria a afrouxar a exigência de
  contexto que aquela rota precisa manter.

**Tabulação — o copiloto propõe, a aplicação valida, a pessoa grava.** Ao analisar a conversa, o
copiloto devolve `proposals` (seção 16.1, linha "Extração"): CPF dito pelo cliente, cargo, campo
personalizado, pedido de retorno com data. Três camadas, e cada uma recusa coisa diferente:

1. `apps/web/src/lib/ai/gateway.ts` sanea a **forma** — descarta proposta sem evidência, com `kind`
   fora do enum ou com prazo no passado (o modelo não tem relógio; o prompt informa o instante atual
   e `readDueAt` é a rede);
2. `packages/core/src/utils/proposals.ts` confronta com o **cadastro** — normaliza para E.164 e
   máscara padrão, confere dígito verificador via `utils/identity.ts` e classifica em `novo`,
   `divergente`, `igual` ou `invalido`. Lacuna e divergência nunca compartilham botão: preencher
   campo vazio é barato, trocar valor existente pode apagar o certo;
3. o painel em `components/inbox/tabulation-panel.tsx` só desenha e devolve o clique.

O que a IA vê para isso está em `context.ts` como **presença, não conteúdo** — `fieldStates` diz que
o campo documento está vazio, nunca qual documento estaria lá. É o que mantém a minimização da seção
16.4 de pé com o recurso funcionando. Campo com "Não informado" conta como lacuna, de propósito.

**Agente de IA não é fluxo, e a distinção é a mesma de Automações e Jornadas.** O fluxo do Chatbot
Builder percorre um caminho que alguém desenhou: nó, aresta, ramo. O agente é um **laço** — recebe
mensagem, decide, eventualmente usa ferramenta, responde, repete até resolver ou transferir. Modelar
agente como fluxo obrigaria a desenhar sete nós para o que uma instrução resolve. Os dois convivem, e
quem escolhe o condutor é o canal: `WidgetBehavior.responder` vale `ninguem`, `fluxo` ou `agente`.
Campo explícito de propósito — deduzir da presença de `botFlowId`/`agentId` transformaria "experimentei
o agente e não apaguei o fluxo" num estado ambíguo resolvido por precedência escondida.

O que o plano cobre: 16.1 (autoatendimento), 16.3 (ferramentas), 16.4 (allowlist por agente,
confirmação humana, métricas) e 26.4 (P2). Não é módulo inventado — é a fase 6 pendente.

**Ferramenta viaja como dado, não como function calling.** Os dois provedores declaram ferramenta de
formas diferentes, e a fila de reserva teria de traduzir mais um protocolo — com o agravante de que
uma troca de provedor no meio do laço perderia a chamada pendente. A 16.3 descreve exatamente o que a
saída estruturada já faz: "o modelo apenas propõe a ferramenta e os parâmetros; a aplicação valida
permissão, executa a ação e retorna o resultado". Mesma disciplina da tabulação, e funciona igual nos
dois provedores pela tradução de schema que já existe.

Consequência direta no `AGENT_SCHEMA` (`lib/ai/prompts.ts`): **todo campo é obrigatório**, e `tool`
tem o valor `nenhuma` em vez de ser omitido. É a armadilha que este arquivo já anotava — campo
opcional com `enum` quebra em `toStrictSchema`, porque o `enum` não incluiria `null`.

**Leitura executa; escrita nunca.** `lib/ai/agent-tools.ts` confere a allowlist da versão, executa
leitura e transforma escrita em `AgentPendingAction`, que espera clique de gente no Inbox. O texto que
volta ao modelo é redigido com cuidado: a primeira versão dizia "registrado", o agente lia como
confirmação e escrevia "pronto, já agendei" — promessa que ninguém tinha cumprido. Hoje o retorno é
explícito sobre o tempo verbal.

**Três guardas moram na aplicação, não no prompt.** O piso de confiança vira transferência em
`agent-runtime.ts` conferindo o número que o modelo declarou; a fila escolhida é validada contra a
lista permitida, e fila desconhecida cai na padrão; e o teto de custo é **por conversa**, conferido
antes de gastar. Pedir ao modelo que se autocensure funciona às vezes; conferir funciona sempre.

**O rastro é o produto.** `AgentTraceStep` registra decisão, ferramenta, parâmetro, retorno, confiança
e custo. Sem ele, depurar agente vira troca de adjetivos e o prompt passa a ser ajustado no escuro. O
mesmo rastro alimenta o simulador do editor e a aba "IA" do Inbox — quem assume a conversa precisa
saber o que a máquina já disse antes de escrever a primeira linha.

**A busca na base ainda não é o RAG da 16.2.** `utils/knowledge.ts` é recuperação léxica sobre artigos
em memória. Vale assim porque o que muda com o pgvector é **de onde o trecho vem**, não o contrato.
Artigo curto vai inteiro, e o limite existe por erro observado: devolvendo um parágrafo só, o agente
respondeu quais documentos são necessários e emendou "sobre o prazo, preciso verificar" — o prazo
estava no parágrafo seguinte do mesmo artigo.

**A fonte tem três origens e cada uma falha diferente.** `artigo` nunca quebra; `link` envelhece
quando a página muda (daí o alerta de 90 dias em `agent-validation.ts`); `arquivo` quebra por formato.
`AgentSourceStatus` carrega isso até a tela. **TXT, Markdown, CSV e JSON são extraídos de verdade** em
`utils/extract.ts`; **PDF, Word e planilha ficam `processando` com o motivo escrito**, porque a
extração depende do caminho de mídia da seção 11. Aceitá-los em silêncio como vazios seria pior: o
agente responderia "não encontrei" sobre um documento que a operação acredita ter cadastrado.

`/api/agents/knowledge` é o **terceiro** consumidor de `lib/net/safe-fetch.ts`. Colar
`http://169.254.169.254/latest/meta-data/` no campo de link, sem a guarda, gravaria os metadados da
nuvem numa base que o modelo lê em voz alta. O arquivo enviado **não é armazenado** — é lido, o texto
é extraído e o binário é descartado.

**O roteamento tem três modos** (`AgentHandoff.routing`). `regras` é previsível e para de escalar: o
que ninguém previu some na fila padrão. `automatico` entrega o catálogo de filas com descrição e o
agente escolhe pela necessidade. `hibrido` é o padrão sensato — regra primeiro, catálogo no que sobra.
Nos três, o identificador escolhido é **validado contra o catálogo** pela aplicação; fila inventada
cai na padrão. É pela **descrição** da fila que o modelo decide, não pelo nome: nome de fila é
abreviação interna, e escolher por ele produz o roteamento de quem adivinha.

**A avaliação roda.** `/api/ai/agent/avaliar` executa os casos e pontua por dimensão — ação,
ferramenta, fila, menção obrigatória, proibição. As verificações são **determinísticas**: um
juiz-modelo traria a variância que a avaliação existe para medir para dentro da própria régua. Roda
em série de propósito, senão a cota do provedor reprova casos que o agente acertou. E o resultado
viaja com `promptVersion`, porque só significa alguma coisa atrelado ao prompt que o produziu.

**A pesquisa de satisfação fica no widget, não no agente.** A conversa pode terminar com a IA ou com
uma pessoa, e a nota precisa ser comparável entre as duas — presa ao agente, mediria só o que a IA
resolveu sozinha, que é o recorte mais favorável e o menos útil. `surveyOffered` viaja separado da
nota porque as duas ausências dizem coisas diferentes: não perguntamos, ou perguntamos e ninguém
respondeu. O comentário só aparece **depois** da nota e só abaixo do piso configurado: pedir os dois
de uma vez derruba a resposta, e insistir com quem elogiou gasta a boa vontade que a nota demonstrou.

**Webchat é o único canal que funciona de ponta a ponta hoje** — e o único lugar onde a cor não sai
de token. O plano nomeia `webchat_widgets` na seção 17 e lista webchat como P1 na 25, mas não
descreve o widget; o que está em `packages/core/src/types/webchat.ts` deriva do que o resto do plano
já exige de um canal — fila, horário, consentimento, versão publicada imutável.

O ciclo fecha de verdade: `/webchat/embed.js` monta um `iframe` no site do cliente →
`/webchat/frame` renderiza o widget → `/api/webchat/*` resolve configuração, abre sessão e executa o
fluxo de chatbot → a conversa aparece no Inbox e a resposta do atendente volta ao visitante. As
sessões vivem num `Map` em `lib/webchat/server.ts`, preso ao `globalThis` para sobreviver ao
recarregamento do `next dev`. Some no reinício e não é compartilhado entre réplicas — é o que cabe
sem back-end, e o que troca quando ele entrar é o corpo daquelas funções, não a fronteira HTTP.

**Dois relógios, e misturá-los quebra em silêncio.** `lastActivityAt` usa o instante ancorado
(`offsetIso`), que é o que a interface exibe; `touchedAtMs` usa `Date.now()`, que é o que mede tempo
decorrido. A primeira versão expirava sessão comparando o carimbo ancorado com o relógio real — como
o âncora fica no passado, toda sessão nascia vencida e sumia na chamada seguinte.

**O runtime de fluxo é um só.** `packages/core/src/utils/flow-runtime.ts` percorre o documento; o
simulador do editor e o servidor do webchat chamam as mesmas funções. Duas implementações produziriam
a divergência que mais custa caro num construtor visual: o fluxo aprovado no simulador se comportando
de outro jeito na frente do visitante.

**O formulário anterior à conversa alimenta o fluxo — senão o bot repergunta.** `VARIABLE_ALIASES`
em `lib/webchat/server.ts` traduz o `mapsTo` do campo (`contato.nome`, `campo.origem_detalhada`) para
a variável do fluxo, e o runtime entra com elas já preenchidas. `alreadyAnswered` então pula o nó de
pergunta cuja variável já tem valor. Sem isso o visitante digitava o nome no formulário e o primeiro
ato do bot era perguntar o nome de novo — foi essa a causa raiz de "o fluxo não faz sentido", somada
a reaproveitar no site um fluxo escrito para anúncio de WhatsApp. Fluxo de canal é escrito por canal:
`bot_webchat_site` existe porque o site já sabe nome, telefone e assunto, e o anúncio não sabe nada.

**Busca de URL do cliente passa por `lib/net/safe-fetch.ts`.** A guarda de SSRF saiu da rota de mídia
quando a prévia de site passou a precisar dela. Ao mexer, leia antes: as duas rotas buscam endereço
informado pelo cliente, e afrouxar a validação transforma o servidor em procurador da rede interna.

Três coisas que o resto do produto não tem:

- **Domínios autorizados, e quem os aplica é o navegador.** O trecho de incorporação é público — vive
  no HTML de quem visita. Quem autoriza é `allowedDomains`, e sem ele a publicação fica bloqueada,
  porque o mesmo trecho copiado para outro site abriria conversas na fila da empresa. **Conferir o
  cabeçalho `Origin` nas rotas não basta**: o widget roda num `iframe` no nosso domínio, então toda
  chamada de API chega com a nossa origem e passa — a lista parecia aplicada e não era. A checagem
  que vale está em `apps/web/src/middleware.ts`, que responde a diretiva `frame-ancestors` (em
  `Content-Security-Policy`) no quadro; é o navegador do visitante que se recusa a renderizar num
  site fora da lista, e a página alheia não tem como contornar. O `Origin` continua conferido nas rotas, para o
  caso de chamarem a API sem o `iframe`: caminhos diferentes, nenhuma torna a outra dispensável.
  Consequência prática: o `&host=` que o `embed.js` repassa é **informação de procedência** (de qual
  site veio o lead), nunca autorização — qualquer um pode forjar aquela string.
- **Contraste calculado em duas frentes** (`utils/color.ts`). A primeira versão só media o rótulo
  contra a cor, e esse teste aprova tudo: como a tinta é escolhida pela máquina entre branco e
  escuro, a razão do texto nunca cai abaixo de ~4,03:1. O que reprova de verdade é a **peça contra a
  página branca** (WCAG 1.4.11, 3:1). Abaixo de 2:1 é erro e bloqueia; entre 2 e 3 é alerta, porque
  a sombra do lançador compensa em parte — é onde cai o próprio laranja da marca, com 2,13:1.
- **A prévia é o produto.** `widget-preview.tsx` não usa token nenhum: usa a cor configurada e
  neutros literais, porque no site do cliente não existe `--primary`. Um widget pintado com
  `bg-primary` mudaria junto com o nosso tema e mentiria sobre o resultado. Pelo mesmo motivo o
  lançador tem SVG próprio em `launcher-icon.tsx` em vez de ícone de biblioteca, e o modo `logo` cai
  no balão quando não há endereço — quadrado vazio no canto do site alheio é pior que ícone genérico.
  A prévia alterna desktop e celular porque os dois reprovam coisas diferentes: no celular a janela
  é de tela cheia e formulário longo empurra o botão para fora da dobra.

**O quadro diz o tamanho; o `embed.js` obedece.** O `iframe` é fixo e transparente, e cresce ao abrir
— tela cheia bloquearia o clique no site inteiro. Quem mede é `live-widget.tsx`, com `ResizeObserver`
sobre o lançador, e manda por `postMessage`. Ter medida fixa no script de incorporação cortava o
lançador com rótulo, que precisa de bem mais que os 96 px de uma bolha — inclusive ao fechar. As
animações de abrir e fechar (`.webchat-open`, `.webchat-close`, com `--webchat-origin`) vivem em
`tokens.css`, e o fechamento é em duas fases: a saída roda por `CLOSE_MS` antes do quadro encolher,
senão o `iframe` some no primeiro quadro e a animação nunca aparece.

**A Administração escreve de verdade, e é a primeira parte do produto que escreve.**
`repositories/types.ts` ganhou `AdminRepository`; a implementação em `admin-memory.ts` grava num
armazém preso ao `globalThis` (`repositories/store.ts`), que sobrevive à navegação e ao recarregamento
e morre no reinício — o mesmo compromisso das sessões do webchat. **A escrita nasceu no repositório,
não em estado de componente**, para que a troca por Supabase não toque nenhuma tela.

Três consequências que valem enunciar:

1. **Toda escrita devolve `AdminWriteResult`, nunca lança.** "É o último administrador" não é
   exceção: é resposta, com o motivo escrito, e a tela o mostra **dentro do diálogo** — num toast,
   some antes de a pessoa terminar de ler e ela clica de novo esperando outro resultado.
2. **Toda escrita registra auditoria**, dentro do repositório. Fazer isso em cada chamador
   significaria que a próxima tela a gravar esqueceria o registro; aqui não existe caminho de escrita
   sem rastro. A gravidade sai do que foi mexido, não do verbo — matriz de permissão é sempre crítica,
   renomear time é informativo.
3. **As regras moram em `utils/admin-rules.ts` e são consultadas duas vezes**: a tela pergunta para
   desabilitar o botão, o repositório pergunta antes de gravar. Uma cópia da lógica em cada lado
   produziria o par clássico — botão habilitado e escrita recusada.

O que elas recusam foi escolhido pelo dano irreversível sem back-end: excluir o último administrador
tranca todo mundo para fora; excluir a única pessoa de um time deixa filas sem ninguém; rebaixar o
superadministrador cria a situação em que ninguém mais consegue conceder aquele acesso.

**O armazém mescla em vez de derrubar.** `store.ts` não usa `??=` puro: quando `globalThis` já tem um
armazém de antes de uma coleção existir, ele preenche só o que falta. Sem isso, quem puxa o código com
uma entidade nova encontra `undefined` onde esperava arranjo, a Administração inteira responde 500 — e
reiniciar o servidor resolve, o que faz o defeito parecer intermitente.

**A fila decide quem atende, e a regra é função pura.** `utils/distribution.ts` expõe
`decideAssignment`, que recebe tudo por parâmetro, não lê relógio e não sorteia. Roteamento é a regra
mais cara de depurar de um CRM de atendimento porque o defeito nunca vira erro: vira "às vezes cai
para a pessoa errada", meses depois, sem passo a passo. Pureza é o que permite responder "por que foi
para o Rafael?" com uma resposta em vez de um palpite.

Os cinco modelos (`DistributionModel`) se dividem em dois grupos, e confundi-los foi o primeiro erro
do desenho: `roleta` e `menor_carga` **escolhem** sozinhos; `proprietario` e `habilidade` só
**restringem** — o dono do contato pode estar offline, e cinco pessoas podem ter a mesma competência.
Daí o campo `tiebreak`: sem ele, "por habilidade" escolheria entre os habilitados por alguma regra
escondida no código, e a operação descobriria qual só observando o resultado por semanas.

Quatro decisões que valem enunciar:

1. **Empate resolve por identificador, nunca por sorteio.** Com `Math.random()`, o mesmo estado
   produziria respostas diferentes e o simulador da Administração deixaria de valer como prova. Pelo
   mesmo motivo a roleta ordena por identificador, e não por nome (muda quando alguém casa) nem por
   ordem de cadastro (muda quando alguém é reativado) — as duas fariam o rodízio pular gente em
   silêncio ao reordenar.
2. **`menor_carga` compara ocupação relativa.** Quem tem capacidade 10 e seis conversas está mais
   folgado que quem tem 4 e cinco; ordenar pelo número bruto transformaria `User.capacity` em enfeite.
3. **A decisão carrega `excluded`, com o motivo de cada descarte.** É o que transforma "a fila está
   parada" em frase completa — "está parada porque as quatro pessoas do time estão acima da
   capacidade". Sem isso, o gestor abre chamado e alguém lê código para responder.
4. **`offline` nunca recebe, em nenhuma configuração**, e não há chave para afrouxar. Atribuir a quem
   não está conectado deixa a conversa parada com aparência de atendida — pior que deixá-la
   visivelmente na fila, porque some do painel de quem cobraria.

**A entrega é escolha por fila, e as duas são legítimas.** `direta` atribui e pronto; `oferta` reserva
por `offerTimeoutSeconds` e espera aceite, passando ao próximo quem não respondeu. Fila de lead novo
ganha com oferta (quem aceita, atende agora); fila interna de baixo volume ganha com direta (o aceite
vira cerimônia sem retorno). Consequência no retorno: em `direta` a `order` tem **um** elemento, porque
sem aceite não existe recusa e portanto não existe "próximo". `maxOffers` existe porque sem teto uma
conversa percorreria o time inteiro em ofertas de 30 s e chegaria ao último com o SLA já estourado —
e `warnOfferBudget` mostra essa conta como **alerta, não recusa**: há fila em que insistir vale mais.

**O executor ainda não existe, e a tela não finge que existe.** `decideAssignment` decide e devolve;
gravar a atribuição, contar o tempo da oferta e passar ao próximo é da camada de escrita, que ainda
não existe para conversas. O que a Administração entrega hoje é a **configuração** e a **prévia** —
`queue-distribution.tsx` chama a mesma função pura com carga fictícia e diz isso em voz alta no
rodapé. Uma simulação aproximada escrita à parte seria pior que nenhuma: daria confiança em algo que
diverge do real justamente nos casos de borda que a pessoa está tentando entender.

**Escala tem faixas no plural, e isso não é detalhe.** `WidgetSchedule` guarda um par `from`/`to` por
dia e não consegue expressar o almoço — "09:00–12:00 e 13:30–18:00" viraria "09:00–18:00", e o widget
prometeria atendimento na hora em que não há ninguém. `BusinessSchedule` (`types/scheduling.ts`) tem
`ranges[]` por dia e `exceptions` por **data**: modelar feriado desligando a terça funcionaria uma vez
e deixaria todas as terças seguintes fechadas — erro que só aparece na semana seguinte.

`utils/schedule.ts` lê a hora por `Intl.DateTimeFormat` com `timeZone` explícito, pela mesma razão de
`datetime.ts`: comparar `getHours()` do processo com "09:00" funciona na máquina de quem desenvolve e
abre três horas cedo em produção. **Escala ausente responde aberto** — o contrário faria toda fila
existente parar de distribuir no dia em que este código entrou. E é por isso que excluir escala em uso
é recusado: o efeito colateral seria abrir o atendimento 24 horas por dia, em silêncio.

**A chave do catálogo é imutável; o rótulo não.** Habilidade, motivo de encerramento e campo
personalizado gravam `key` dentro de conversa, contato e evento. Renomear a chave depois de usada
renomearia o passado pela metade, e o relatório passaria a mostrar duas linhas para a mesma coisa —
por isso o repositório recusa a troca em vez de aceitá-la e quebrar depois. Duas recusas seguem o
mesmo raciocínio de dano: exigir competência que ninguém do time tem trava a fila de forma
indistinguível de "está todo mundo ocupado"; e zerar os motivos marcados como resolvidos deixa a taxa
de resolução travada em 0% para sempre, número que parece colapso operacional e é só configuração.

**Perfil customizado guarda a diferença, não a matriz.** `CustomRole.overrides` traz só o que difere
do embutido de origem. Copiar a matriz inteira faria o perfil congelar no dia da criação: recurso novo
do produto não apareceria nele, e o sintoma seria "o perfil Analista Fiscal não enxerga o módulo que
lançamos ontem". `queueIds` e `teamIds` respondem a outra pergunta — não _o que_ pode fazer, mas
_sobre quais dados_; vazio é "todos", porque é o comportamento dos embutidos.

**A política de acesso declara o que ainda não vale.** Sessão, segundo fator, bloqueio por tentativa e
faixas de origem dependem do servidor de autenticação que não existe: os valores são gravados e
auditados, e a tela diz isso antes dos campos, não depois. Um painel de segurança que parece proteger
e não protege é pior que a ausência dele — encerra a conversa sobre o assunto. O único controle
aplicado de verdade hoje é `allowedEmailDomains`, conferido a cada convite.

**Canal de webchat é derivado do widget, não cadastrado.** `deriveWebchatChannel` em `utils/channels.ts`
o calcula a partir do widget, e `listChannelAccounts` o concatena aos demais. Criar widget cria canal;
excluir widget remove. Antes a conta era cadastrada à mão e o widget apontava para ela — e o que se
esquecia era criar a conta, produzindo widget publicado que abre conversa sem destino. Derivar elimina
o estado a dessincronizar: não há canal órfão nem nome divergente, porque nada é guardado.

**Credencial é por conta, não por instalação — e é isso que permite várias contas.** As quatro
variáveis `WHATSAPP_*` no `.env` suportam **um** número, e deixam de bastar na segunda conta: duas
contas têm dois tokens e um arquivo de ambiente não tem onde guardar "o token da conta B". Então o
identificador público (`phoneNumberId`, `wabaId`, `pageId`, domínio) vive em `ChannelConnection` no
repositório, e o segredo vive em `lib/canais/vault.ts` — que **grava e não devolve**. `describeSecrets`
responde quais chaves existem, por nome; `resolveSecret` só é chamada pelo webhook e pelo envio, e o
retorno nunca entra numa resposta HTTP. O `.env` continua valendo como caminho de uma conta só.

**O webhook resolve a conta pelo `phone_number_id` antes de validar a assinatura.** A Meta entrega
todos os números no mesmo endereço — o webhook é do app, não do número. A leitura acontece sobre corpo
ainda não confiável, e isso é seguro porque o identificador só **escolhe o verificador**: corpo forjado
apontando para outra conta passa a ser conferido contra o segredo daquela conta, que quem forjou não
tem. Verificado: mesmo corpo aceito com o segredo da conta certa e recusado com o de outra.

**Endereço duplicado é recusa.** Duas contas com o mesmo número fazem a mensagem casar com as duas, e
qual atende passa a depender da ordem da lista — o sintoma aparece como "foi para a fila errada, às
vezes". A comparação normaliza pontuação de telefone: `+55 11 93000-1000` e `+5511930001000` são o
mesmo número.

**A conta nasce desconectada, e o estado sai do que falta.** Cadastrar endereço não fala com provedor
nenhum, e completar o formulário leva a `aguardando_verificacao` — nunca a `conectado`. Quem confirma é
o provedor respondendo. `ChannelConnectionState` é separado de `ChannelAccount.status` de propósito: um
é o quanto foi configurado, o outro é a saúde que o provedor reporta.

**O catálogo de canais diz o que não dá.** `CHANNEL_CATALOG` classifica por dificuldade — `disponivel`,
`fundacao`, `restrito` — e cada entrada carrega a ressalva que decide o cronograma. A mais importante é
a do **LinkedIn**: não existe API pública de caixa de mensagens, e listá-lo com o mesmo botão do
WhatsApp prometeria o que a plataforma não entrega. Instagram e Messenger declaram que compartilham a
infraestrutura da Meta com o WhatsApp — é o que muda a ordem de trabalho.

**WhatsApp tem a fronteira pronta e nada atrás dela.** `/api/canais/whatsapp/webhook` faz de verdade
as duas coisas que a Meta exige: devolve o desafio da verificação **em texto puro** (JSON ou aspas em
volta produzem 200 e a Meta recusa mesmo assim, sem dizer por quê) e valida `X-Hub-Signature-256` com
HMAC sobre o **corpo cru** — reserializar o JSON parseado muda espaço e ordem de chave, e a assinatura
nunca bate. A comparação é em tempo constante nos dois casos, e **sem `WHATSAPP_APP_SECRET` o webhook
recusa tudo**: liberar quando a variável está vazia transformaria esquecê-la em produção num endpoint
público que aceita qualquer corpo.

Erro nosso **não vira erro HTTP**. A Meta reentrega o que não recebe 200 e webhook que falha repetido
derruba a qualidade do número — o ativo que a seção 11 manda proteger. Só assinatura inválida responde
4xx, porque aí não é a Meta chamando.

`utils/whatsapp.ts` é o **único** lugar que conhece o formato da Meta: traduz `entry[].changes[].value`
para `WhatsappInboundMessage` e `WhatsappStatusUpdate`. Trocar a versão da API, ou a Cloud API por um
BSP, mexe ali e em mais nada. Nada nele lança — tipo desconhecido vira `desconhecido`, não exceção.

**O que não existe: a mensagem não vira conversa.** Falta persistência, idempotência por `waMessageId`
(a Meta reentrega), fila e worker. **Não "termine" isso com um `Map`** — o do webchat é honesto porque
é o nosso widget na nossa máquina; aqui é o número da empresa na mão do cliente.

A tela em `/administracao/whatsapp` mostra as seis etapas separadas por dono (painel da Meta ou aqui),
o endereço para copiar, quais variáveis estão presentes — **nunca o valor**, como `providerStatus()` —
e o registro dos últimos eventos recebidos, que responde a pergunta que trava toda configuração de
webhook: "a Meta está chegando aqui?".

**Automações não é jornada.** `/automacoes` é uma regra: aconteceu isto, confira aquilo, faça isso —
e acabou. A jornada acompanha o contato por dias ou meses e tem estado próprio por participante
(seção 15). Separar os dois evita montar sete nós para fazer "quando clicar no botão, cria tarefa".
Os tipos estão em `packages/core/src/types/rules.ts`; cada gatilho declara o evento de domínio que
escuta, em `RULE_TRIGGER_EVENT`.

**Anexo tem duas origens, e `Attachment.source` as separa.**

`arquivo` ainda não sai do navegador: o compositor valida, mostra prévia e monta o `Attachment`, mas o
conteúdo vive num `File` em memória com object URL. O caminho real de mídia (seção 11: upload,
antivírus, armazenamento, expiração, miniatura, URL assinada) é trabalho de back-end. Não escreva
código que finja que o arquivo foi armazenado.

`link` já funciona: `/api/media/preview` resolve tipo, tamanho, título e capa no servidor — inclusive
vídeo do YouTube por oEmbed. Falta o back-end baixar e verificar o conteúdo antes de despachar pelo
canal. **Ao mexer nessa rota, leia a guarda contra SSRF antes de tocar em qualquer `fetch`**: ela busca
URL informada pelo cliente, e afrouxar a validação de destino transforma o servidor em procurador para
a rede interna. Regra prática: classificação de URL é função pura em `packages/core/src/utils/media.ts`,
compartilhada entre rota e interface — não duplique a lógica em componente.

## Comandos

```bash
pnpm install
pnpm dev          # http://localhost:3100
pnpm typecheck    # tsc --noEmit nos 3 pacotes
pnpm lint         # eslint com --max-warnings=0
pnpm build        # next build
pnpm format
```

Node ≥ 20.11, pnpm 9.

**Não rode `pnpm build` com o `pnpm dev` no ar.** Os dois escrevem em `apps/web/.next`, e o build
substitui os artefatos que o servidor de desenvolvimento mantém abertos. O sintoma não parece
ambiental: metade das rotas passa a responder **`Internal Server Error` em texto puro, 21 bytes** —
sem a página de erro do React, sem pilha, sem nada no navegador que aponte para a causa. O código
continua íntegro; quem quebrou foi a instância em execução. A saída é parar o `dev`, apagar `.next` e
subir de novo. Para medir desempenho com o `dev` de alguém no ar, use `next build --distDir .next-perf`
e `next start --distDir .next-perf` numa porta separada.

**E não canalize o `dev` para `head`.** `pnpm dev | head -n` fecha o cano quando enche, o processo
recebe SIGPIPE e o servidor morre no meio da primeira compilação — o que se parece com "o Next
travou compilando o Inbox".

## Estrutura

```
apps/web/            Next.js 15 (App Router) + React 19 + Tailwind 3
packages/core/       tipos canônicos, utilitários, base de demonstração e repositórios
packages/ui/         design system (@crm/ui) — tokens, componentes, primitivas Radix
packages/config/     preset Tailwind compartilhado
docs/referencia/     Plano Completo (fonte da verdade)
.claude/agents/      equipe de agentes especializados
```

## Regras que não se negociam

**Acesso a dados passa por repositório.** A aplicação consome as interfaces de
`packages/core/src/repositories/types.ts`. A implementação atual é em memória; a próxima será
Supabase. Se você escrever `fetch` ou cliente Supabase dentro de um componente de tela, está errado.

**IA passa pelo Gateway.** Seção 16.1: a aplicação não chama Claude ou Gemini em dezenas de pontos do
código. A tela chama `repositories.ai` (contrato em `repositories/types.ts`), que fala com
`/api/ai/copilot`, que é o único lugar com a credencial e o único que escolhe modelo, aplica política,
valida saída contra schema e mede custo.

Dois arquivos, e só eles, podem nomear um provedor:

- `apps/web/src/lib/ai/gateway.ts` — política por tarefa, prompt, mascaramento, validação, registro;
- `apps/web/src/lib/ai/providers.ts` — transporte e a fila de reserva.

Se você importar um SDK de provedor em qualquer outro lugar, está errado.

`apps/web/src/lib/ai/agent-runtime.ts` também é Gateway — aplica política, valida saída e mede custo —
mas **não nomeia provedor nem modelo**: a escolha continua sendo da fila. Ele mora separado porque as
outras tarefas são uma chamada e uma validação, e esta é um laço com efeito no meio.

Três consequências práticas: prompt novo vai em `apps/web/src/lib/ai/prompts.ts` **com versão** (e ao
mudar o texto, suba a versão — é o que permite atribuir queda de qualidade); o que a IA vê é decidido
em `apps/web/src/lib/ai/context.ts` e em nenhum outro lugar; e `AiRunMeta` (modelo, tokens, latência,
custo, versão do prompt) chega à interface porque a seção 16.4 cobra essas métricas.

**A reserva é de disponibilidade, não de qualidade.** A fila é Gemini (`gemini-2.5-flash`) e, atrás
dele, OpenAI (`gpt-4.1-mini`). A troca acontece **só** em `indisponivel`, `limite_excedido` e
`sem_credencial` — os códigos em `FALLBACK_CODES`. Recusa de conteúdo (`invalido`) e saída que não
validou (`falha`) **não** trocam de provedor: a primeira seria recusada igual do outro lado, e a segunda
é problema de prompt, que já tem passo de reparo próprio. Mudar modelo por qualidade é decisão de gente
com o conjunto de avaliação da seção 16.4 na mão, não de um `catch`.

Três armadilhas ao mexer nisso:

1. **No fluxo, a reserva só vale antes do primeiro byte.** Passado o primeiro trecho, o atendente já
   está lendo; recomeçar em outro provedor reescreveria a tela. Queda no meio sobe como erro, com o
   parcial preservado.
2. **O freio de uso em memória usa `limite_excedido`, que é código de reserva.** Funciona porque a rota
   o chama **antes** de entrar na fila. Movê-lo para dentro transformaria o nosso próprio limite em
   porta de entrada para a OpenAI.
3. **Schema é traduzido, não duplicado.** O formato canônico é o do Gemini; `toStrictSchema` converte
   para o modo estrito da OpenAI, onde não existe campo opcional — o que era opcional vira anulável e
   todo objeto ganha `additionalProperties: false`. Campo opcional **com `enum`** quebraria essa
   conversão (o `enum` não incluiria `null`); hoje nenhum é, e vale conferir antes de criar um.

**Cor sai de token.** Tudo vem de `packages/ui/src/styles/tokens.css` via Tailwind (`bg-primary`,
`text-accent`). Componente não escreve hexadecimal. Duas exceções, ambas com um único dono:

1. **Cores derivadas de dado** (`hue` de tag, avatar, canal próprio e bloco de fluxo): o componente
   informa só a matiz e lê saturação, luminosidade e opacidade de `--hue-bg-l`, `--hue-bg-a` e
   `--hue-fg-l` — é isso que faz o tema escuro funcionar sem duplicar código.
2. **Marcas de terceiros** (WhatsApp, Instagram, Messenger): a cor faz parte do glifo. Todos os
   valores ficam em `apps/web/src/lib/brand-icons.tsx` e em nenhum outro arquivo.

**A borda é exceção — mas exceção precisa ser vista.** Cartão separa por superfície branca sobre o
plano azulado, mais `shadow-card`. Hairline (`shadow-inset-hairline` ou `border-b`) só onde duas
regiões roláveis se encontram. Se você está escrevendo `border border-border` num cartão, provavelmente
está errado.

Os três níveis de traço têm **piso de contraste**, não estimativa a olho:

| Token             | Contra branco | Regra                                                      |
| ----------------- | ------------- | ---------------------------------------------------------- |
| `--border`        | 1,86:1        | hairline estrutural: separador, divisória, moldura de menu |
| `--border-strong` | 2,68:1        | onde a divisão precisa de peso                             |
| `--input`         | 3,41:1        | **limite de componente** — WCAG 1.4.11 exige 3:1           |
| `--focus-ring`    | 3,43:1        | indicador de foco — mesma exigência                        |

**Campo usa `border-input`, nunca `border-border`.** A distinção não é estética: caixa de texto, caixa
de seleção, gatilho de select e a moldura do compositor são limites de componente de interface e têm
piso obrigatório de 3:1. Foi exatamente esse o erro da primeira versão — a moldura do compositor usava
o traço estrutural e o campo desaparecia quando o texto de exemplo saía.

**O foco não usa `--accent`.** A laranja da marca rende 2,13:1 contra branco: serve para preencher
botão (onde o contraste que importa é o do texto sobre ela), não para desenhar um traço de 2 px. Daí o
token separado. Ao mexer em qualquer um destes valores, **refaça a conta de contraste** — a razão é
`(Lmaior + 0,05) / (Lmenor + 0,05)` sobre luminância relativa, e o alvo é a pior superfície onde o
traço aparece, não a mais favorável.

**A conversa tem plano próprio.** O Inbox não usa `surface-sunken`: usa `--chat-canvas`, um bege
azulado texturizado (`.chat-canvas`), com `--chat-in` e `--chat-out` nas bolhas. A textura é a mesma
sensação do WhatsApp, a cor é Arena CF, e o desenho entra como **máscara** — o SVG em
`--chat-doodle-mask` carrega só a forma, a tinta sai de `--chat-doodle`. É assim que a mesma textura
serve aos dois temas sem duplicar arquivo e sem hexadecimal em componente. As bolhas se separam por
matiz, não por peso: texto escuro nas duas.

**Um acento por tela.** O laranja marca o que precisa de ação. Selo de estado usa fundo suave sem
traço; gravidade vira filete lateral, não fundo colorido.

**Gráfico segue o método.** As primitivas estão em `packages/ui/src/components/chart.tsx` e já
carregam as regras: linha de 2 px, topo de barra em 4 px, 2 px entre preenchimentos, grade recessiva,
texto em tinta de texto (nunca na cor da série), hover por padrão e legenda a partir de duas séries.
A paleta `--chart-1..6` foi validada para daltonismo e contraste nas duas superfícies — não invente
uma sétima cor: dobre em "Outros" ou facete.

**Tempo é ancorado.** `packages/core/src/utils/datetime.ts` expõe `now()`, `offsetIso()` e os
formatadores, todos presos a `REFERENCE_NOW_ISO` e ao fuso `America/Sao_Paulo`. Nunca use
`Date.now()`, `new Date()` ou `toLocaleString` sem `timeZone` em código renderizado — servidor e
cliente divergem e a hidratação quebra.

**Server Component por padrão.** `"use client"` só onde há interação ou estado.

**Desempenho se mede antes de mexer.** O gargalo deste front **não é JavaScript** — é recálculo de
estilo e layout. Num perfil de sete trocas de conversa no Inbox: ~300 ms de script contra ~800 ms de
estilo mais layout. Duas consequências:

1. Antes de memorizar qualquer coisa, tire um perfil (`agent-browser profiler start/stop`) e olhe
   `Document::recalcStyle` e `LocalFrameView::UpdateStyleAndLayout`. Memorizar componente que não
   estava no caminho crítico já rendeu 3,5 ms de ganho aqui — trabalho perdido.
2. Meça latência com **Event Timing** (`processingEnd - processingStart`), nunca com `requestAnimationFrame`
   duplo: no navegador sem GPU do ambiente de teste, dois quadros custam ~27 ms e afogam o número que
   você quer ver. Foi assim que uma tecla "de 26 ms" acabou medindo 4 ms de script.

**Não monte de novo o que pode atualizar.** `key` numa subárvore grande é remontagem: destrói e recria
DOM, raízes de Radix e todo o estilo associado. Se a intenção é só zerar estado, faça isso num efeito
preso ao identificador — como o compositor faz com `conversationId`. E `scrollIntoView` força passe
síncrono de layout: chame apenas quando a seleção veio do teclado, porque num clique o item já estava
visível.

Números de referência do Inbox, medidos em build de produção (script, mediana): trocar de conversa
**16 ms**, digitar uma tecla **2 ms**. Se uma mudança levar isso acima de ~25 ms e ~5 ms, algo regrediu.

**Toda superfície de dados tem quatro estados**: vazio, carregando, erro e sucesso.

**Multiempresa desde o tipo.** Toda entidade de negócio carrega `organizationId` (`BaseEntity`).
Quando o back-end entrar, a RLS valida a associação do usuário à organização.

## Identidade visual — Arena CF

| Papel            | Cor       | HSL           |
| ---------------- | --------- | ------------- |
| Azul principal   | `#102850` | `218 67% 19%` |
| Azul secundário  | `#212D51` | `225 42% 22%` |
| Branco           | `#FFFFFF` | superfícies   |
| Laranja (acento) | `#FF9933` | `30 100% 60%` |

O laranja carrega ação primária, foco e destaque de estado. O azul carrega navegação, marca e
superfícies profundas. Tema claro e escuro compartilham os mesmos nomes de token.

Tipografia: **Sora** (`font-display`, classe `.figure`) nos números e títulos de seção; **Inter** no
resto. Ambas auto-hospedadas via `@fontsource` — nenhuma requisição externa.

Movimento: uma orquestração por página. `<Reveal index={n}>` sobe a seção com 60 ms de atraso por
índice; `<AnimatedNumber>` conta até o valor em 700 ms; `.lift` e `.press` cuidam do hover e do
clique. Nada em laço infinito. `prefers-reduced-motion` anula tudo no CSS.

**"Por página" é aplicado, não só recomendado.** `Reveal` anima na montagem, e o Radix desmonta o
painel de aba inativo — então trocar de aba reexecutava a orquestração inteira. Toda tela com abas é
envolvida por `<RevealScope>`, que marca a entrada como concluída após 1,2 s; a partir daí `Reveal`
nasce **sem** a classe, visível no primeiro quadro. Não há salto na troca porque `.reveal` termina em
`opacity: 1` (a animação é `forwards`), que é o mesmo estado do elemento sem a classe.

O motivo é medido, não estético. Em build de produção, trocar de aba na Administração custa **menos de
2 ms de script** — nem chega ao piso de 16 ms do Event Timing. O que a pessoa esperava era a animação:
`6 × 60 ms` de escalonamento mais `550 ms` de duração dão **910 ms** com o conteúdo já em memória,
escondido em `opacity: 0`. Depois do ajuste, medido pelo DOM logo após o clique, todas as abas
mostram `opacity: 1` e zero animações em curso; a entrada da página continua animando.

Duas armadilhas ao mexer nisso:

1. **Fora de um `RevealScope`, nada muda** — o contexto vale `false` e toda montagem anima, que é o
   certo para tela sem abas. Adicionar o escopo é opt-in por superfície.
2. **`settleMs` cobre o pior caso com folga.** Encurtar demais faz a última seção da primeira
   orquestração perder a animação no meio; alongar faz a primeira troca de aba ainda animar.

## Equipe de agentes

`.claude/agents/` traz onze especialistas mapeados aos papéis da seção 24 do plano:

| Agente           | Escopo                                                          |
| ---------------- | --------------------------------------------------------------- |
| `crm-produto`    | requisitos, backlog, critérios de aceite, priorização MVP/P1/P2 |
| `crm-ux`         | design system, tokens, densidade, acessibilidade                |
| `crm-frontend`   | telas Next.js/React, estado de cliente, formulários             |
| `crm-backend`    | Supabase, modelo de dados, RLS, eventos, outbox, filas          |
| `crm-canais`     | WhatsApp, e-mail, webhooks, entregabilidade, DLQ                |
| `crm-builders`   | Chatbot Builder, Journey Builder e seus runtimes                |
| `crm-ia`         | AI Gateway, RAG, prompts, avaliação, custo                      |
| `crm-qa`         | testes, CI/CD, observabilidade, runbooks                        |
| `crm-dados`      | catálogo de eventos, métricas, dashboards, reconciliação        |
| `crm-seguranca`  | LGPD, consentimento, retenção, auditoria, segredos              |
| `crm-salesforce` | coexistência, propriedade de campos, migração por domínio       |
| `crm-revisor`    | revisão adversarial antes de fechar entrega                     |

## Próximos passos (roadmap, seção 28)

O front das fases 2 a 5 está construído. O que falta:

- **Fundação de back-end** — Supabase, auth, organizações, RLS, auditoria, event store, outbox,
  filas, workers, CI/CD e observabilidade. É o que transforma as telas atuais em produto.
- **Executor de distribuição** — a regra existe e é pura (`utils/distribution.ts`), a configuração
  grava e a prévia funciona; falta quem **execute**: gravar a atribuição, contar o tempo da oferta,
  passar ao próximo, devolver ao transbordo e avançar o cursor da roleta (`store.rotations` nasce
  vazio e ninguém escreve nele ainda). Depende da camada de escrita de conversas. Não "termine" isso
  com um `setTimeout` no servidor — oferta expirada precisa sobreviver a reinício, o que é fila.
- **Camada de escrita** — hoje as mutações vivem em estado local do componente. Entram junto com
  idempotência, outbox e auditoria reais.
- **Mídia (seção 11)** — upload, antivírus, armazenamento, expiração, miniatura no servidor e URL
  assinada. A interface de anexo já existe e já trata `url` ausente como "processando mídia".
- **Resto da fase 6** — o AI Gateway existe; o copiloto, a redação de e-mail e o **agente de
  atendimento** funcionam. A 16.3 está feita para o agente (allowlist por versão, leitura executada,
  escrita sob confirmação) e a 16.4 ganhou o conjunto de avaliação **executável**. Falta: RAG com
  pgvector (16.2 — a busca é léxica em memória e a extração de PDF/Word depende do caminho de mídia da
  seção 11), controle de cota por organização, e histórico de rodadas de avaliação para comparar
  versões ao longo do tempo — hoje o resultado vive só na tela. O freio de uso atual é em memória, por
  instância. **O bloco de IA do chatbot continua declarando `acoes` em `node.config` sem executor** —
  o executor existe, mas atende o agente; ligá-lo ao bloco de fluxo é trabalho pendente. A confirmação
  de escrita no Inbox registra a decisão sem gravar, e a nota de satisfação vive na sessão em memória:
  os dois dependem da camada de escrita.

Escreva sempre em português correto e direto.

## Barramento de eventos (seção 8)

**O webhook faz duas coisas: valida e publica.** Não resolve contato, não abre conversa, não acorda o
agente. Antes, um arquivo que a Meta chama teria seis dependências, e qualquer uma lenta derrubaria o
recebimento — que rebaixa a qualidade do número. Publicar é rápido; o resto acontece depois, em outra
transação, com retentativa própria.

**Evento e entrada de outbox são coisas diferentes.** O evento é o fato: imutável, existe uma vez. A
entrada é a intenção de entregar aquele fato a **um** destino, e existe uma por destino, com contador
próprio. Um contador no evento faria a falha no analytics reprocessar o Inbox, que já tinha entregue —
e a conversa apareceria duas vezes na tela. Coberto por teste.

**A chave de idempotência vem do provedor, nunca do conteúdo.** `waMessageId` no WhatsApp; a sessão no
webchat. Um resumo do corpo parece atraente e quebra no caso real: duas pessoas mandando "ok" no mesmo
minuto gerariam a mesma chave e a segunda mensagem sumiria. Perder mensagem é pior que duplicar. Status
leva o estado na chave — `wamid:entregue` —, senão "lida" seria descartada como repetição de "enviada".

**A deduplicação devolve o evento original, não erro.** Para quem chama, "já publiquei" e "publiquei
agora" têm o mesmo desfecho: responder 200. Tratar reentrega como falha faria a Meta reentregar para
sempre.

**`nextAttemptAt` é o que faz o recuo existir.** Sem ele, a entrada que falha volta na passada seguinte
e queima as seis tentativas em segundos. O relógio da drenagem é o **real**, não o ancorado — mesma
distinção das sessões do webchat, e o mesmo defeito se for confundida.

**Este repositório tem testes agora**, e começam aqui de propósito: até então o que existia era front —
errado, aparece na tela. O barramento é a primeira peça cujo defeito é **invisível**. `pnpm test`.

**`supabase/migrations/0001_fundacao_eventos.sql` nunca foi executado.** Não há Postgres, Docker nem
CLI do Supabase no ambiente onde foi escrito. É artefato para revisão e primeira execução assistida —
rode em projeto descartável antes de qualquer coisa. O que está verificado é a camada acima.

Duas linhas do SQL não têm equivalente em memória e são o motivo de ele existir: o índice único parcial
sobre `(organization_id, idempotency_key)`, porque dois workers passariam juntos pelo "já existe?" da
aplicação antes de qualquer um inserir; e `for update skip locked` em `claim_outbox`, que impede dois
workers de entregarem a mesma entrada — e aí a idempotência do evento não protege, porque a duplicação
estaria na **entrega**.
