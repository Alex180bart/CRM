# Elora — instruções do repositório

**Elora** é a plataforma omnichannel da Contabilidade Facilitada: atendimento, CRM 360º, automação e
inteligência artificial em uma plataforma só. O nome junta _elo_ (o vínculo com o cliente) e _ágora_
(a praça onde tudo acontece no mesmo lugar), e fecha em _agora_.

**Elora é o produto; Contabilidade Facilitada é a empresa.** A distinção decide renomeações: onde o
texto é o escritório falando com o cliente dele — cabeçalho do widget, rodapé de e-mail, papel do
agente de IA —, o nome que aparece é o da Contabilidade Facilitada, nunca o da plataforma.

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
  a sombra do lançador compensa em parte — é onde cai o próprio âmbar da marca, com 2,63:1.
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
pnpm dev          # http://localhost:3200 (Turbopack)
pnpm typecheck    # tsc --noEmit nos 3 pacotes
pnpm lint         # eslint com --max-warnings=0
pnpm build        # next build
pnpm format
```

Node ≥ 20.11, pnpm 9.

**O `pnpm dev` roda em Turbopack, e a lentidão que ele resolve é a de compilação, não a de
renderização.** A medida que motivou a troca: abrir oito telas num servidor recém-iniciado custava
40,9 s no webpack e custa 12,6 s hoje; a primeira rota, que paga o shell compartilhado sozinha, caiu
de 18,9 s para 6,4 s. **Nada disso é problema de produção** — o mesmo HTML sai em 8 a 25 ms no
servidor de produção, e a navegação entre telas no navegador leva 39 a 68 ms. Antes de "otimizar o
carregamento", confira em qual dos dois servidores o número foi medido: cache de servidor para uma
resposta de 10 ms é trabalho perdido, e foi essa a conclusão de medir antes de mexer.

`pnpm dev:webpack` continua existindo para quando o Turbopack for suspeito de um defeito — o `next
build` de produção continua no webpack, então divergência entre os dois é possível e o jeito de
provar é rodar o mesmo caso nos dois compiladores.

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
  src/app/(site)/    site público: landing page, preços, pedido de proposta e área do cliente
  src/app/(workspace)/  o produto
packages/core/       tipos canônicos, utilitários, base de demonstração e repositórios
  src/demo/          verticais de demonstração (overlay sobre a base contábil)
  src/pricing/       tabela de preços e motor de cálculo (simulador em /admin)
packages/ui/         design system (@elora/ui) — tokens, componentes, primitivas Radix
packages/config/     preset Tailwind compartilhado
docs/referencia/     Plano Completo (fonte da verdade)
.claude/agents/      equipe de agentes especializados
```

## Site público, preço e verticais de demonstração

**A raiz `/` deixou de redirecionar: agora é a landing page.** O grupo `(site)` em
`apps/web/src/app/(site)` traz `/`, `/precos`, `/orcamento`, `/entrar`, `/cadastrar`, `/conta` e
`/admin` (restrita); o produto continua em `(workspace)`. Grupo de rotas, e não um segundo
Next: o site usa os mesmos tokens, os mesmos componentes e o mesmo motor de preço que o produto —
dois aplicativos duplicariam o design system em dois pacotes e produziriam a divergência que
aparece meses depois, quando o botão da landing page deixa de ser o botão do produto.

**O cabeçalho do site é `sticky`, e o layout não pode ter `overflow`.** A primeira versão copiou o
`overflow-y-auto` do workspace por simetria, e o cabeçalho deixava de grudar — sem erro, sem aviso.
A causa é a regra de contexto: **um ancestral com `overflow` diferente de `visible` vira o contexto
de rolagem do `sticky`**. Como aquele contêiner tem `min-height` (e não `height`), ele cresce com o
conteúdo e nunca rola por dentro, então o cabeçalho grudava no topo de uma caixa que subia junto com
a página. No site quem rola é o documento; no produto, o painel. São exigências opostas, e agora
estão escritas assim nos dois layouts.

**No celular a navegação desce, e o corte é `lg`, não `md`.** `components/site/mobile-tab-bar.tsx`
é uma barra fixa no rodapé com quatro destinos e a marca no centro; o cabeçalho fica com marca e ação
primária, e o menu sanfonado deixou de existir. A faixa superior de um telefone é a região mais
distante do polegar, e o menu anterior custava dois toques para qualquer lugar. O corte é `lg`
porque o cabeçalho completo precisa de 827 px só de conteúdo: ligado em `md`, ele estourava uma
janela de 768 e dava **59 px de rolagem horizontal à página inteira** — defeito anterior à barra,
que só ficou visível quando a navegação ganhou um segundo lugar para morar.

Três consequências que valem enunciar:

1. **Cabem quatro destinos, não cinco.** A barra leva os três primeiros links do conteúdo,
   descartando o que repete o botão de ação, mais conta/entrada. O que sobra vive no rodapé — que
   por isso deixou de ser opcional nesta página. A `<MobileTabBar>` é montada **antes** do `<main>`
   no layout: sendo `fixed`, a ordem no DOM não decide onde ela aparece, decide a ordem de leitura e
   de foco, e abaixo de `lg` ela é a única `nav` da página.
2. **O item ativo tem dois regimes.** Rota sai de `usePathname`; âncora da mesma página sai da seção
   visível, por `IntersectionObserver` com faixa estreita (`-45% 0px -45% 0px`). Sem o segundo, rolar
   a landing page inteira deixaria o indicador parado — e indicador que nunca se move é lido como
   quebrado. Só conta como âncora o que aponta para a raiz: `/precos#tabela` tem fragmento e não é
   seção daqui.
3. **O ícone é derivado do endereço** (`lib/site/nav-icons.ts`), não guardado. `ContentLink` não tem
   campo de ícone e o normalizador é o mesmo do rodapé, onde ícone não faz sentido; endereço
   desconhecido cai numa bússola, que é feio e funciona — melhor que quadrado vazio.

**Onde a lista é longa, o celular ganha trilho com encaixe.** As oito abas do "Por dentro" ocupavam
quatro linhas e 180 px antes da primeira prévia; as quatro edições empilhadas somavam mais de 2.400
px de rolagem para uma comparação que exige lembrar da tela anterior. As duas viraram `.rail` com
`.rail-snap` abaixo de `md`/`lg` e voltam a ser fila e grade acima. Três decisões: o encaixe é
`proximity`, não `mandatory` — obrigatório, um item mais largo que a tela prende a rolagem e o gesto
briga com o dedo; o cartão tem 82% da largura para o **seguinte aparecer pela borda**, que é a única
affordance de carrossel; e o indicador de posição fica **antes** dos cartões, contra a convenção,
porque cartão de plano tem mais de mil pixels e depois dele é duas telas longe do dedo.

**`.rail` mora em `@layer components`, e o motivo é cascata.** As duas peças desligam o trilho com
utilitário (`lg:grid`, `md:overflow-visible`), e regra solta no fim da folha tem a mesma
especificidade de utilitário — venceria por ordem, e o carrossel nunca viraria grade no desktop.

**A entrada por rolagem é opt-in e degrada para o que já existia.** `<Reveal onView>` acrescenta
`.reveal-on-view`, que só faz algo dentro de `@supports (animation-timeline: view())`: com suporte, a
mesma animação passa a ser percorrida pela rolagem; sem, continua animando na montagem. Foi escolhido
sobre `IntersectionObserver` por uma razão de risco — a alternativa exigiria nascer em `opacity: 0` e
depender de script para revelar, e numa página pública isso põe o conteúdo inteiro atrás de um
`if` que pode falhar. Aqui não existe estado em que algo fique invisível. O parallax do herói
(`.hero-parallax`) segue a mesma regra e some sob `prefers-reduced-motion`.

**`.aurora` corta com `overflow: clip`, com `hidden` antes como queda.** `hidden` torna o elemento
contêiner de rolagem, e é esse contêiner que uma `animation-timeline: view()` toma como referência —
o parallax media progresso contra uma caixa parada. `clip-path: inset(0)` foi tentado no lugar e
**reintroduziu 79 px de rolagem horizontal**: recorta a pintura, mas o pseudo-elemento continua
ocupando área. Mesma família do `sticky` acima: `overflow` decide quem é o contexto, e o sintoma
nunca é erro.

**Dois defeitos silenciosos foram corrigidos no caminho, e há teste para os dois**
(`apps/web/src/lib/tokens-css.test.ts`). O `tokens.css` começava com **BOM**, e como `@tailwind base`
é a primeira diretiva, o byte invisível colou no primeiro seletor do CSS gerado — justamente
`*, ::before, ::after`, onde o Tailwind reseta `--tw-translate-x`, `--tw-scale-x` e o resto. Seletor
inválido invalida a regra inteira, então **todo utilitário de transform do produto estava morto**:
`scale-*`, `translate-*`, `rotate-*`, inclusive o `data-[state=checked]:translate-x-*` de qualquer
switch. E `-webkit-backdrop-filter` escrito à mão ao lado da propriedade padrão fazia o prefixador
descartar **as duas** — `.glass` (cabeçalho do Inbox, do E-mail Studio, `page-header`) não desfocava.
Nenhum dos dois produz aviso; quem acrescenta prefixo é o autoprefixer, pelo browserslist.

**As telas do produto na landing page são desenhadas, não capturadas.**
`components/site/module-previews.tsx` traz oito prévias em JSX — Inbox, Pipeline, Contato 360º,
Chatbot, Automações, Campanhas, Analytics e agente de IA — exibidas em abas por
`product-showcase.tsx`. Captura de tela envelhece na primeira mudança de espaçamento, vira retângulo
branco no tema escuro e não anima; desenhada, a prévia herda token, funciona nos dois temas e o texto
dentro dela é texto de verdade. O custo é conhecido: **estas prévias precisam ser revistas quando a
tela real mudar de forma**, e nenhuma delas pode inventar recurso que o produto não tem.

**Todas se movem, e o movimento é o gesto que o módulo resolve.** O pipeline arrasta um negócio de
etapa; o contato preenche a linha do tempo em ordem; o chatbot desenha o fluxo nó a nó; a automação
acende o trilho entre gatilho, condição e ações; a campanha enche os lotes; o agente executa os
passos e escreve a resposta; o analytics conta os números. Uma tela parada comunica "imagem de um
produto"; a mesma em movimento comunica "produto funcionando", que é o que a seção existe para
produzir. As classes vivem em `tokens.css` (`.preview-*`), porque é lá que o corte de
`prefers-reduced-motion` alcança — um `<style>` no componente escaparia dele.

**Laço decorativo repousa invisível, e a opacidade precisa estar no estilo base.** O cartão fantasma
do pipeline e o cursor do agente declaram `opacity: 0` fora dos quadros-chave. Sem isso o corte de
movimento reduzido termina a animação, o elemento volta ao estilo base e reaparece **aceso**: o
fantasma congelado por cima do cartão real, parecendo duplicata, e o cursor piscando ao lado de um
texto completo, lido como campo em foco. Foi verificado no navegador com o meio emulado, e a
primeira versão reprovava — declarar a opacidade só dentro do `@keyframes` não basta.

**O fantasma existe porque o cartão real não pode viajar.** Um laço que tira o cartão do lugar precisa
devolvê-lo, e o instante do retorno é um salto visível; e o quadro final teria de ser "fora do lugar",
que é o estado que pareceria defeito para quem pediu menos movimento. A cópia decorativa resolve os
dois: não pisca ao reiniciar, e some em repouso.

**Barra que cresce anima `scaleX` com a fração em `--bar-fill`.** O valor final precisa estar no
quadro final: sob movimento reduzido a animação é cortada para lá, e uma barra que terminasse em
`scaleX(1)` mostraria 100% em toda linha — inclusive nos lotes de campanha que ainda nem começaram.

Duas armadilhas de largura, ambas já cobradas uma vez: item de grade nasce com `min-width: auto`, e
os pontos de corte do Tailwind medem a **janela**, não o contêiner. Foi assim que o painel do
copiloto apareceu cortado dentro do cartão, sem rolagem horizontal na página para denunciar. A
coluna de texto da galeria tem largura fixa e a prévia fica com o resto; as colunas internas do
Inbox só aparecem a partir de `lg` e `xl`.

**O preço tem dois eixos, e isso é a decisão central.** Do Salesforce vem a edição por assento; do
RD Station, a escada por volume. Sozinho, o primeiro pune operação enxuta de volume alto; o
segundo, base grande e adormecida. A Elora cobra os dois separados — assinatura + assento +
consumo medido. A tabela inteira mora em `packages/core/src/pricing/catalog.ts` e **não há um único
número em `calculator.ts`**: reajustar preço não deveria exigir ler lógica de cálculo.

Dez consequências que valem enunciar:

1. **Repasse de provedor viaja separado da margem.** A conversa de WhatsApp tem o custo da Meta
   (sem margem) e a taxa da plataforma. Somá-los produziria a linha que ninguém consegue auditar
   quando a Meta reajusta — e a Meta reajusta. Por isso o desconto comercial **não incide sobre o
   repasse**: descontá-lo sairia do nosso bolso a cada mensagem, e o prejuízo cresceria justamente
   com quem mais dispara. Coberto por teste.
2. **A margem sobre WhatsApp existe, e é a segunda linha.** O repasse continua sendo repasse; o que
   ganhamos é a **taxa de envio por mensagem de modelo** (`whatsappTemplateFeeMicros`), com franquia
   por edição (`includedWhatsappTemplates`). É valor fixo, não percentual sobre o custo da Meta:
   nosso custo de entregar um modelo é o mesmo em marketing e em utilidade, e percentual
   reprecificaria sozinho a cada reajuste dela — o acoplamento que separar o repasse existe para
   evitar. Mensagem de **serviço** não paga, porque já foi cobrada como conversa tratada, e cobrá-la
   de novo faturaria o mesmo atendimento duas vezes com dois nomes. Na análise de margem a taxa cai
   na receita sozinha, por estar no total mensal e fora de `passthroughCents` — é por isso que as
   duas precisam viver em linhas separadas desde o cálculo. Tudo coberto por teste.
3. **A escada é progressiva nos dois lugares.** Na nossa tabela de contatos e na escada de volume da
   própria Meta (utilidade acima de 250 mil, autenticação acima de 500 mil). Cada fatia paga o preço
   da própria faixa; aplicar o preço da faixa final ao total cria o degrau em que consumir mais
   **reduz** a fatura — o tipo de tabela que o cliente descobre uma vez e nunca mais confia. Há teste
   de monotonicidade nos dois.
4. **Tarifa por mensagem mora em micros de real, não em centavos.** A Meta publica com quatro casas:
   utilidade custa `R$ 0,0350`, e em centavos inteiros esse número não existe. Foi esse
   arredondamento que escondeu uma tarifa de autenticação errada por **seis vezes** — `R$ 0,20` é um
   preço plausível, e nada acusou. Campo em micros tem sufixo `Micros` no nome, e é o único jeito de
   não somar centavo com micro por engano. Os totais de linha continuam em centavos: a conversão
   acontece uma vez, no total, nunca na tarifa unitária.
5. **Colaborador ilimitado existe só na edição de cima.** "Ilimitado" numa edição barata é preço
   por assento escondido num número redondo, e quebra no dia em que o cliente cadastra a operação
   inteira.
6. **O assento custa o mesmo em toda edição que o cobra, e a parcela fixa é que muda.** Subia por
   edição (R$ 79, R$ 129, R$ 189) e produzia o efeito invertido: a pessoa a mais saía mais caro
   justamente para quem já pagava mais. Ao uniformizar em R$ 79, a parcela fixa foi recomposta para
   o mínimo de cada edição ficar **idêntico** — a página publica o total e o valor da pessoa
   adicional, nunca a divisão entre os dois, e é isso que permitiu mexer sem mudar preço. O custo
   está na escala e é conhecido: o assento deixou de subsidiar a franquia das edições grandes, e
   quem cresce em time paga menos por pessoa do que pagaria antes. Quem cresce em volume paga no
   consumo, que é onde a conta deve crescer.
7. **A tabela publicada é verificada contra o custo de servir.** `pricing/margem-tabela.test.ts`
   reprova o build se alguma edição de preço público custar mais do que cobra com a franquia cheia,
   ficar no prejuízo depois do imposto ou não alcançar o piso da política no uso típico. Foi assim
   que apareceu o furo do Corporativo — R$ 3.900 anunciados contra ~R$ 4.700 de custo estimado —,
   que virou `priceOnRequest` e "sob medida" no cartão. O teste **não** cobra a margem alvo no uso
   pleno: franquia é teto, não média, e exigir o alvo ali reprovaria uma tabela sadia.
8. **O imposto sai da receita, e o Simples tributa faturamento.** `pricing/taxes.ts` modela os
   Anexos III e V com alíquota **efetiva** — `(RBT12 × nominal − dedução) / RBT12`, nunca a nominal,
   que superestima em vários pontos. O regime sai do **Fator R** (folha ÷ receita ≥ 28%), e a
   diferença na primeira faixa é de 6% para 15,5%: quase dez pontos de margem que somem sem nenhuma
   mudança de produto. Na **sexta faixa o ISS sai do DAS** e é recolhido à parte — a fórmula devolve
   15,00% contra 17,51% da quinta, e quem ler só o DAS conclui que crescer barateia o imposto. Não
   barateia; `issOutsideDas` soma o ISS por fora, e há teste para ninguém "consertar" o degrau.
   **O preço de tabela é com imposto embutido**: o anunciado é o que sai na fatura.
   Consequência que decide contrato: cada real de repasse da Meta que passa pela nossa nota paga
   imposto sem gerar margem **e** empurra a RBT12, elevando a alíquota de toda a receita —
   `passthroughTaxDrag` põe esse prejuízo em reais por ano, e acima de R$ 1.000 ele vira aviso.
9. **A implantação tem porte, e o porte é linha.** `setup.ts` enquadra a empresa do cliente por
   faturamento anual **e** por número de colaboradores, e vale o **maior** dos dois — multiplicar
   cobraria em dobro de quem é grande nas duas pontas, somar diluiria quem é grande em uma só. O
   acréscimo incide **só sobre a base** da edição: aplicá-lo ao total cobraria porte em cima de
   migração de contatos, que é trabalho de máquina. Unidades/CNPJs e setor regulado são parcelas
   próprias. `ResolvedSize.drivenBy` declara qual critério mandou, porque "média empresa pelo número
   de colaboradores" é frase que o cliente confere e "média empresa" sozinho é classificação que ele
   contesta.
10. **O cálculo roda no navegador, e é a única cópia que existe.** O simulador precisa ser
   instantâneo — arrastar o volume vinte vezes procurando o ponto em que a edição vira é o gesto
   central da ferramenta. Antes havia um segundo cálculo, no servidor, refazendo a conta que o
   formulário de orçamento trazia em campos ocultos: aceitar o total enviado pelo navegador
   permitiria pedir proposta de R$ 1. Esse caminho deixou de existir junto com o cenário no
   formulário — hoje o pedido não carrega total nenhum, então não há total a forjar.

## A janela do WhatsApp é decisão de quem atende, não linha de fatura

**`utils/whatsapp-janela.ts` responde duas perguntas antes do clique:** dá para responder sem
template, e quanto a Meta cobra por isso. A segunda virou decisão de operação quando a cobrança
passou a ser **por mensagem** — antes, o número de mensagens dentro de uma conversa não mudava a
conta. Uma plataforma que só repassa a fatura entrega essa informação um mês depois, quando não dá
mais para escolher.

**São três janelas, e confundi-las custa dinheiro.** A de **atendimento** abre 24 h a cada mensagem
do cliente e isenta resposta livre e template de utilidade. A **FEP** dura 72 h, nasce quando o
cliente chegou por anúncio Click-to-WhatsApp ou botão da Página **e** a empresa respondeu dentro das
primeiras 24 h, e isenta **tudo** — inclusive marketing, que custa nove vezes a utilidade. Fechada,
só template, sempre cobrado. A FEP é conferida primeiro por ser mais permissiva: na ordem inversa,
uma conversa de anúncio no segundo dia apareceria como fechada e o produto cobraria do cliente o que
a Meta entrega de graça.

**A FEP conta da primeira entrada, não da última.** Renovar a cada mensagem do cliente prometeria
de graça o que a Meta cobra — e o erro só apareceria na fatura. Pelo mesmo motivo, saída anterior à
primeira entrada não gera FEP: disparo de campanha não é resposta a nada, e contá-lo faria conversa
fria parecer elegível.

**A data do fim da gratuidade não está escrita no código.** Sai da primeira tabela de
`META_RATE_TABLES_ANUNCIADAS` em que o repasse de serviço deixa de ser zero — a mesma fonte da
página de preços. Há teste provando que a mesma resposta é grátis em 30/09 e cobrada em 01/10, sem
ninguém editar nada: é o que garante que a estrutura de vigência não é só enfeite de documentação.

**A janela é derivada das mensagens, não de `lastMessageAt`.** Aquele campo é a última mensagem de
**qualquer** lado: usá-lo faria o atendente responder, o carimbo avançar, e a janela parecer aberta
enquanto ele conversa sozinho. Quem abre a janela é mensagem de entrada. Quando o back-end entrar,
vale materializar `lastInboundAt` para a lista não carregar mensagem — mas o cálculo continua sendo
este, e a coluna passa a ser cache, não segunda verdade.

**O selo do compositor diz o estado inteiro, não só o impedimento.** Antes ele só aparecia quando a
janela fechava, e o caso mais comum ficava sem informação nenhuma — o atendente não sabia que estava
respondendo de graça, nem que isso tem prazo. O relógio usado é o ancorado, como no resto do Inbox:
com o real, servidor e navegador renderizariam tempos diferentes e a hidratação quebraria em toda
conversa aberta.

**A origem da conversa ainda não é guardada, e o padrão subestima o benefício.** No WhatsApp ela vem
do campo `referral` do webhook, que identifica anúncio. Sem essa informação a conta é a da janela
comum — prometer FEP que a Meta não deu seria pior que deixar de mostrar um desconto real.
## O que a Meta muda, e como o produto se prepara

**Mudança anunciada vive em lista própria, não na tabela vigente.** `CURRENT_META_RATES` é o
primeiro item de `META_RATE_TABLES`, e `catalog.ts` lê dele o repasse de cada categoria na carga do
módulo — pôr uma vigência futura na posição zero passaria a cobrar hoje um preço de amanhã, e o
sintoma não seria erro, seria fatura maior sem explicação. Daí `META_RATE_TABLES_ANUNCIADAS`, e a
promoção para a lista principal como ato consciente: mover a entrada, apagar o `provisional`,
conferir o número contra a página da Meta.

**A data em vigor hoje: 1º de outubro de 2026.** A Meta passa a cobrar **mensagem de serviço** por
mensagem, e templates de utilidade perdem a gratuidade dentro da janela de 24 h. A tarifa declarada
é a mesma de utilidade e autenticação, e os valores exatos saem até 01/09/2026 — por isso a entrada
anunciada é `provisional`: o número é **derivado do anúncio**, não transcrito de rate card. Sem essa
marca, estimativa e valor conferido ficam indistinguíveis, que é como uma estimativa vira preço
praticado sem ninguém decidir.

**`mudancasDeTarifa` transforma a data num aviso, e usa o relógio real.** Antes da vigência avisa com
os dias restantes; depois dela, acusa **atraso** — o produto cobrando por uma tabela que a Meta já
substituiu. O `offsetIso` ancorado não serve aqui: a contagem ficaria parada para sempre, pela mesma
razão que o carimbo de publicação do conteúdo usa `new Date()`.

**A página declara a data, e ela sai do dado.** A linha de serviço dizia "não é cobrada"; hoje diz
"cobrada a partir de 01/10/2026", com a data derivada de `billableFrom` — que some sozinho quando a
tabela for promovida, porque a condição que o alimenta deixa de valer. Publicar gratuidade sem prazo
às vésperas da mudança é a diferença entre o cliente saber que a fatura vai crescer e descobrir no
mês seguinte.

**Data de calendário não passa por `formatDate`.** Ela converte para `America/Sao_Paulo`, e sobre uma
string sem hora devolve o **dia anterior** — `2026-10-01` sai como `30/09/2026`. Para vigência existe
`formatDateOnly`, que reordena o texto. O erro é de um dia numa data plausível: ninguém confere.

**A política de "AI Providers" da Meta não alcança a Elora.** Ela cobre provedor terceirizado de
assistente de propósito geral oferecido dentro do WhatsApp, não empresa que usa IA para atender os
próprios clientes por CRM ou BSP. Fica registrado porque a leitura contrária custaria uma linha de
custo por mensagem que não existe.
**O simulador é da área comercial, e o site publica a tabela sem a calculadora.** Ele já esteve na
landing page e em `/precos`; hoje vive só na aba de `/admin`. A distinção que sustenta a decisão:
saiu a **calculadora**, não a **informação** — franquia por edição, preço de excedente e o repasse
da Meta continuam abertos em `/precos`, que é o oposto de um "consulte-nos". O dimensionamento passa
pela conversa porque é nela que se descobre que a operação precisa de menos do que imaginava, e uma
calculadora pública devolve o número cheio sem essa conversa acontecer.

Três consequências que valem enunciar, porque cada uma já foi um defeito na primeira tentativa:

1. **`/orcamento` virou pedido de contato qualificado**, e `QuoteRequest` perdeu `QuoteSnapshot`.
   Guardar a fotografia do cálculo exigiria o simulador público para preenchê-la, ou nasceria
   sempre zerada — e um número ao lado da palavra "orçamento" é lido como preço mesmo quando é só o
   padrão de um campo que ninguém preencheu. O que restou pergunta o que o interessado responde sem
   calculadora: edição de interesse e tamanho do time, **ambos opcionais**.
2. **O simulador não tem mais botão de "solicitar orçamento".** Quem o opera é quem emite a
   proposta: o botão faria o vendedor pedir orçamento a si mesmo, e criaria um pedido com o nome
   dele na fila que ele próprio atende.
3. **`lib/site/quote-params.ts` deixou de existir.** O cenário viajava na URL para ser colado num
   grupo — não há mais para onde colar, porque nenhuma página pública lê aquele parâmetro. Manter o
   módulo deixaria uma serialização sem leitor, que é o tipo de código que alguém reativa por
   engano meses depois.

**A conta do site é autenticação de verdade no que faz e de demonstração no que guarda.** `scrypt`
com sal por conta, comparação em tempo constante, cookie com HMAC e vencimento **dentro** da
assinatura (confiar no `maxAge` deixaria um cookie copiado valendo para sempre). E as contas vivem
no armazém em memória: somem no reinício, e a tela diz isso **antes** do formulário. `SiteAccount`
não reaproveita `Contact` porque o interessado é anterior à organização que ele talvez contrate; e
`QuoteRequest` não reaproveita `Proposal`, que é a proposta que o cliente da Elora envia ao cliente
_dele_. O orçamento guarda **fotografia** do cálculo, pela mesma razão de `ProposalItem`.

**A vertical de demonstração é um overlay, não um banco paralelo.** `packages/core/src/demo/`
reescreve o que carrega narrativa — organização, times, filas, contatos, conversas, funis,
campanhas — e herda o resto da base contábil. A mescla em `registry.ts` é **rasa por coleção**:
mesclar item a item produziria a base híbrida que ninguém escreveu, metade falando de tributação e
metade de rastreio.

Três famílias de identificador **não mudam** entre verticais, e o motivo é concreto: `queue_*`,
`chan_*` e as chaves de habilidade são citadas por módulos que a vertical não reescreve —
`mock/agents.ts` aponta a fila de transbordo, `mock/webchat.ts` a fila do widget, `mock/bots.ts`
exige competência. Trocar o identificador junto com o rótulo deixaria essas referências penduradas,
e o sintoma seria discreto do pior jeito: nome de fila em branco no meio da demonstração, sem erro
no console. O mesmo vale para `usr_*`, porque `CURRENT_USER_ID` é constante consumida por componente
de cliente.

**A leitura passou a ser por função, não por `import`.** `memory.ts` chama `dataset()` dentro de
cada método: um `import` é resolvido uma vez e congela o arranjo daquele instante, então o Inbox
continuaria mostrando a base anterior depois da troca. O que descreve a **plataforma** (fluxos,
jornadas, regras, e-mail, analytics, agentes) continua vindo do `mock/` — não muda com o segmento do
cliente.

**A troca recarrega o armazém no lugar, e preserva duas coleções.** `reseedStore()` muta `store`
por dentro porque dezenas de módulos já guardaram aquela referência — trocá-la por outro objeto
deixaria metade da aplicação lendo o armazém antigo, sem erro nenhum. `siteAccounts` e
`quoteRequests` sobrevivem: quem se cadastrou não deixa de existir porque alguém abriu a
demonstração de e-commerce.

**A vertical não troca a paleta, e isso foi revertido de propósito.** A primeira versão aplicava uma
paleta por segmento; ficava bonito dentro do produto e virava defeito no site, porque a landing page
é a marca da Elora e mudava de cor quando alguém abria a demonstração de e-commerce. A cor da
vertical vive no cartão da vitrine, onde é decoração.

**A vertical escolhida vive num cookie, não no processo.** `setActiveVerticalId` grava no
`globalThis`, e isso bastava num servidor só — em serverless a requisição seguinte cai noutra
instância, que nunca ouviu falar da troca e serve a base padrão. O sintoma foi observado em
produção: clicar em "abrir esta demonstração" levava para dentro do produto e o produto continuava
mostrando contabilidade, sem erro nenhum. `lib/site/vertical.ts` grava a escolha no cookie e
`aplicarVerticalEscolhida()` alinha o armazém no começo de toda superfície que lê dado de
demonstração — o layout do `(workspace)` e a mesa de `/admin`. A comparação com `activeVerticalId()`
evita re-semear quando a instância já está certa; sem ela, toda requisição descartaria o armazém.

O efeito colateral é a melhoria que a operação esperava: a escolha passou a ser **por navegador**.
Dois vendedores podem demonstrar verticais diferentes ao mesmo tempo. O armazém continua único por
instância, então cada requisição realinha a base antes de responder — o que não dá para fazer sem
back-end é manter duas bases vivas simultaneamente na mesma memória.

**E é exatamente por isso que a demonstração é restrita.** As bases saíram da landing page e vivem
atrás de conta de administrador: quem carrega uma base troca os dados de todo mundo, e um visitante
curioso derrubaria a apresentação de outra pessoa. A vitrine aparece em `/admin` — a mesa de
trabalho de quem vende — e na área da conta; o seletor da barra lateral do produto só é desenhado
para quem tem o papel.

**`/admin` junta demonstração e simulador em abas**, e a razão é o uso: as duas ferramentas são
alternadas na mesma reunião — mostra a tela, o cliente pergunta o preço, calcula com os números
dele, volta para a tela. Em páginas separadas, cada pergunta custa duas navegações. É também o
**único** lugar onde o simulador existe, desde que ele saiu do site público. O componente e a função
de cálculo continuam sendo os mesmos que alimentam a tabela de `/precos`: uma cópia "de vendedor"
divergiria no primeiro reajuste, com os dois lados olhando telas diferentes na mesma chamada.

A checagem existe em **dois lugares, e nenhum é redundante**: a tela não desenha o botão, e
`openVerticalAction` recusa a chamada. Server Action tem endereço próprio — um `POST` montado à mão
nunca passa pela função que renderiza a página. Esconder a peça protege contra o clique; validar a
ação protege contra a requisição.

**Não há autocadastro de administrador.** A conta nasce de `ELORA_ADMIN_EMAIL` e
`ELORA_ADMIN_PASSWORD`, semeadas por `ensureAdminAccount` no login (e não na carga do módulo: o
`next dev` recarrega módulos e o armazém morre no reinício, então a semeadura precisa acontecer no
instante em que a conta é necessária). Sem as duas variáveis, **nenhuma conta é criada** e a área
fica inacessível — um administrador com senha conhecida por omissão seria abrir a porta e escrever
"não use" ao lado. A senha nunca aparece no código: este repositório é publicado, e o que entra no
histórico do Git não sai.

**A tela de entrada avisa quando o servidor está sem administrador configurado.** Sem as variáveis,
o login responde "e-mail ou senha incorretos" — a mesma mensagem de quem errou a senha, porque
distinguir as duas transformaria o formulário em oráculo de cadastro. O efeito colateral é alguém
digitar a credencial certa cinco vezes achando que errou. `adminConfigured()` responde uma pergunta
de **configuração**, não de credencial: se as variáveis existem, nunca o que elas valem.

**O destino após o login aceita `?proximo=`, e só caminho interno.** Aceitar qualquer string
transformaria o formulário em redirecionador aberto — mandar a vítima para
`/entrar?proximo=https://site-falso` e devolvê-la autenticada em outro domínio. Duas barras no
início também são recusadas: `//site-falso` é URL absoluta com o protocolo herdado.

## Conteúdo editável do site

**A terceira aba de `/admin` edita o texto do site público, e ela grava em disco — não na memória.**
É a única escrita do repositório que sobrevive ao reinício, e a exceção tem motivo: dado de
demonstração é recarregado a cada apresentação de qualquer forma, texto de marketing não. Perder a
tarde de ajuste do título do herói porque alguém salvou um arquivo e o `next dev` reiniciou é o que
faz uma ferramenta ser usada uma vez só. O efeito colateral é o motivo real da escolha: o arquivo
**entra no Git**, então mudança de texto passa a ter histórico, autor e reversão.

O conteúdo vive em `apps/web/content/site-content.json`, lido por
`apps/web/src/lib/site/content-store.ts`. **Sem arquivo, as páginas servem `DEFAULT_SITE_CONTENT`** —
o texto original, palavra por palavra, extraído do JSX. É o que garante que a extração não mudou o
site: uma cópia recém-clonada renderiza o que renderizava antes.

**O modelo é dado; o desenho continua em JSX.** `types/content.ts` descreve herói, marquise,
problemas, módulos, notas de preço, seção de IA, implantação, segurança, FAQ, preços, cabeçalho e
rodapé; as páginas só compõem. Consequência que vale enunciar: **lista vazia esconde a seção
inteira**, com cabeçalho e sobrelinha junto — quem apaga todos os cartões não fica com um título
órfão sobre espaço em branco.

**Número de preço não é editável, e isso não é esquecimento.** Franquia, excedente, tarifa da Meta e
valor de assento continuam vindo de `pricing/catalog.ts`. Onde o texto precisa citar um número, ele
usa **marcador** — `{precoUtilidade}`, `{vigencia}`, `{premioMensal}` —, resolvido na renderização por
`content/placeholders.ts`. Digitar `R$ 0,0350` no campo criaria a segunda cópia do preço, e no dia do
reajuste um dos dois lados ficaria para trás: o site anunciando o que a proposta não confirma.
Marcador sem valor **fica visível** em vez de virar vazio — `{precoUtilidade}` na página é feio e
corrigido no mesmo dia; um buraco no meio da frase passa meses.

**Ênfase é Markdown mínimo, e não existe `dangerouslySetInnerHTML` neste caminho.** `utils/markup.ts`
analisa `**negrito**`, `*itálico*` e `[texto](/link)` e devolve **árvore de nós**; `rich-text.tsx`
monta elementos React a partir dela. Um analisador de biblioteca traria a saída em HTML, que só serve
se for injetada — exatamente o que não se quer numa página pública alimentada por campo de
formulário. A conferência de `href` mora no analisador porque é o único ponto por onde todo link
passa: `javascript:`, `data:` e `//outro-dominio` não viram link, viram o texto do rótulo. Coberto por
teste, e foi o teste que achou o defeito do parêntese — o fechamento pegava o primeiro `)` e cortava
endereço que contém parêntese.

**A leitura tolera; a escrita recusa.** `content/normalize.ts` nunca lança: campo ausente ou de tipo
errado cai no padrão, e o resto do documento continua valendo. Uma biblioteca de schema devolveria
erro, que é o comportamento errado aqui — não interessa recusar o documento porque um ícone foi
digitado errado, interessa desenhar a página com o ícone padrão. A recusa tem lugar, e é a gravação:
lá a mensagem volta para quem pode consertar.

**Ícone viaja como nome, e o tipo é o que impede o quadrado vazio.** O `core` declara `CONTENT_ICONS`
(strings) porque não conhece React; `lib/site/icons.tsx` mapeia nome → componente com
`Record<ContentIcon, LucideIcon>`, então acrescentar nome sem o par **não compila**. Sem a amarra, o
esquecimento apareceria como espaço em branco no meio de um cartão, em produção, sem erro no console.

**Três guardas na gravação, e nenhuma é redundante.** A tela não desenha a aba para quem não é
administrador; `content-actions.ts` confere o papel de novo, porque Server Action tem endereço próprio
e um `POST` montado à mão nunca passa pela função que renderiza a página; e a gravação leva o carimbo
da versão carregada — se o arquivo mudou nesse meio-tempo, alguém publicou junto, e continuar apagaria
o texto dessa pessoa sem aviso.

**O carimbo de publicação usa o relógio real, não o ancorado.** Mesma distinção de `lastActivityAt` e
`touchedAtMs` no webchat. Com `offsetIso({})` a tela diria "última publicação em 27/07/2026" para
sempre — e, pior, a conferência de conflito compararia dois valores idênticos e deixaria de proteger
sem nada indicar isso.

**Exportar e importar existem por causa da hospedagem somente leitura.** Onde o sistema de arquivos
recusa escrita — Vercel e a maioria das serverless —, publicar falha, e a tela diz isso **antes** com
o caminho do arquivo. Sem a exportação, o trabalho ficaria preso na aba do navegador; com ela, o
caminho é baixar, comitar, subir pelo repositório. `saveSiteContent` nunca lança pelo mesmo motivo:
recusa do ambiente é resposta, não exceção, e precisa chegar com o texto ainda na mão de quem editou.

**Publicar vai ao ar na hora, e a tela diz isso antes do clique.** Não há rascunho nem aprovação. É
uma decisão, não uma lacuna: o editor existe para quem acabou de descobrir, numa demonstração, qual
frase não sustenta a pergunta do cliente — e um fluxo de aprovação entre descobrir e corrigir é o que
faz a correção não acontecer. O que existe é a rede do Git.

**Só a seção ativa existe no DOM.** `content-editor-shell.tsx` desenha um rail de seções à esquerda
e monta **uma** de cada vez; as abas do Radix desmontam o painel inativo. Com o documento inteiro em
estado controlado, cada tecla redesenha a raiz — manter montado o mínimo é o que segura a digitação
leve num formulário de centenas de campos. A versão anterior empilhava acordeões e tinha dois
defeitos que só aparecem com o formulário cheio: ir do Herói ao Rodapé exigia rolar por tudo o que
estava aberto no caminho, e nada respondia "quantas seções são, e onde estou".

**As seções se registram sozinhas.** `SectionedEditor` lê os próprios filhos — cada `<SectionBox>`
declara título, descrição, ícone e contagem, e o rail sai daí. Um arranjo de descritores ao lado do
JSX seriam duas listas para manter em sincronia, e a esquecida seria sempre a do rail, que é a que
ninguém edita ao acrescentar seção.

**Nada anima a raiz do editor, e o motivo é o `sticky`.** `.rise-in` termina em `transform:
translateY(0)` com `fill-mode: both` — o elemento fica com uma `transform` aplicada para sempre, e
ancestral com `transform` vira bloco de contenção do `position: sticky`. A barra de ações pararia de
grudar, sem erro e sem aviso: a mesma armadilha do `overflow` no layout do site. O movimento vive nas
peças de dentro — `.rise-in` no painel de seção, `.stagger` nas linhas de lista, `.glow-pulse` no
ponto de estado e `.sheen` no botão de publicar **só quando ele está habilitado**.

**O cache guarda o JSON cru, não o documento normalizado.** A primeira versão guardava o resultado de
`normalizeSiteContent`, e o defeito que isso produziu parece intermitente e não é: o `next dev`
recarrega módulos mas o `globalThis` sobrevive, então um campo acrescentado ao modelo (foi
`titleRoll`) nunca alcançava o objeto já normalizado que estava em memória. A tela quebrava com
`Cannot read properties of undefined (reading 'length')` apontando para um componente correto, e
reiniciar o servidor "resolvia". É a mesma armadilha que `repositories/store.ts` documenta ao mesclar
coleção nova em vez de usar `??=`. A saída aqui é mais simples: guardar o cru e normalizar a cada
leitura — a normalização é pura, idempotente (há teste) e custa microssegundos, enquanto o cache
continua evitando o disco e o `JSON.parse`, que é onde está o custo.

## Montagem de proposta na conversa

**A ação rápida fica na barra do compositor, ao lado do gravador de voz.** O
instante em que a proposta é montada é sempre o mesmo — logo depois de o cliente
perguntar o preço, com o cursor já dentro do compositor. Obrigar a viagem até a
aba do painel da direita nesse momento é o que faz o vendedor sair da conversa,
abrir a planilha e mandar o valor à mão, que é o caminho que este módulo existe
para substituir. No celular o painel nem está na tela.

**O compositor continua sem saber o que é uma proposta.** Ele recebe
`quickActions` como nó pronto e só desenha. É a mesma disciplina de ele receber
funções de IA em vez do gateway — e é o que permite reusá-lo fora do Inbox.

**O produto tem arte, e ela é derivada, não armazenada.** `utils/product-art.ts`
escolhe um motivo pelo que o produto é (texto tem precedência sobre tipo) e uma
matiz estável pela chave, via FNV-1a. Foto real depende do caminho de mídia da
seção 11 — e, quando existir, esta função vira o **fallback**, como as iniciais
não deixaram de existir quando a foto de perfil passou a existir. O desenho vive
em `components/commerce/product-art.tsx`, com `currentColor` e a matiz composta
com `--hue-bg-l` / `--hue-fg-l`: é a exceção documentada de cor derivada de dado,
a mesma de tag e avatar, e é o que faz o tema escuro funcionar sem segundo
arquivo.

Nada sorteia. Um `Math.random()` na cor mudaria o produto entre servidor e
navegador e quebraria a hidratação — o mesmo defeito que `datetime.ts` evita do
lado do tempo.

**A busca do catálogo é léxica, determinística e explica o resultado.**
`utils/product-search.ts` pontua por **onde** o termo casou (nome vale 10,
notas de venda valem 1) e por **como** casou (palavra inteira > começo > meio), e
exige que **todos** os termos casem — sem isso, o segundo termo amplia em vez de
refinar. Cada resultado carrega o motivo, porque uma lista ordenada por
relevância sem dizer por quê é caixa-preta que o vendedor aprende a ignorar.

**O contexto da conversa sugere, mas passa por frequência inversa.** A primeira
versão contava qualquer termo do assunto e das últimas mensagens, e o resultado
foi visto na tela: **todo** item ganhou o selo de "sugerido", porque palavras
como "produto" e "entrega" casam com quase tudo. Hoje o termo precisa ter ao
menos quatro letras e aparecer em no máximo 30% do catálogo — o que sobra é
vocabulário que aponta para poucos itens. Selo que aparece em tudo não sugere
nada. Coberto por teste.

Contexto **nunca** cria resultado quando há consulta: quem digitou "trilho" não
quer clareamento porque a conversa fala de estética. Ele entra como desempate,
ou sozinho quando a busca está vazia.

**O que já está no carrinho não some da lista.** Digitar um termo novo depois de
escolher três itens escondia os três, e conferir exigia limpar a busca. O
selecionado sobe para o topo e permanece; a busca filtra o que **falta**
escolher.

**O total interpola do valor anterior, não do zero.** `AnimatedNumber` do design
system conta sempre a partir de zero — certo numa entrada de página, errado
aqui: a cada item somado, o número piscaria de zero até o novo total.

## Envio do orçamento

**O montador cria e envia num passo.** O rascunho deixou de ser o caminho
principal: quem monta na frente do cliente quer que o orçamento saia, e parar num
rascunho obriga a achar o painel da direita, localizar o cartão e clicar de novo
— três passos entre a decisão e o envio, cada um um lugar para esquecer. O
rascunho continua como saída secundária, para quem monta antes da reunião.

**O rótulo do botão diz para onde vai antes do clique**, por `statusAfterSubmit`
— a mesma função que o repositório usa para decidir. Desconto dentro do teto:
"Enviar orçamento". Acima: "Enviar para aprovação do gestor". Descobrir depois de
gravar é o que produz "achei que tinha enviado".

**"Enviado" não era enviado, e esse era o defeito.** `submitProposal` mudava o
estado, publicava evento e gravava auditoria — e **nenhuma mensagem chegava à
conversa**. Do lugar de quem vende, clicar em "enviar ao cliente" não fazia nada
visível. Agora o estado muda e, em seguida, uma mensagem entra no histórico.

A ordem é deliberada: **estado primeiro, mensagem depois**. No pior caso sobra
uma proposta marcada como enviada sem mensagem — visível no painel e corrigível.
O inverso deixaria o preço na mão do cliente sem registro nenhum no funil.

**Os três passos são três chamadas porque falham por motivos diferentes.** Criar
recusa produto inativo; submeter recusa desconto acima do teto; a mensagem
depende da IA. Numa chamada só, a falha da terceira desfaria as duas primeiras e
o vendedor perderia o orçamento montado porque o modelo estava fora.

**A mensagem é escrita pela IA e conferida pela aplicação.**
`/api/ai/proposta` monta o texto determinístico de `utils/proposal-message.ts` e
pede ao Gateway uma versão que retome a conversa. O prompt entrega os **valores
prontos** e proíbe recalcular; `runProposalMessage` confere que o total e cada
linha aparecem no texto, normalizando o espaço inquebrável do `Intl`. Saída que
alterou um valor é recusada, e o que vai à tela é o texto determinístico.

Um modelo somando três linhas erra de vez em quando, e o erro é o pior tipo:
plausível. O cliente lê um total que a cobrança não vai bater, e a conversa
seguinte é sobre confiança, não sobre preço.

**Falha de IA não vira erro para quem está vendendo.** Esta rota responde 200 com
o texto padrão e o motivo no corpo — inversão consciente em relação à rota de
e-mail, que falha quando o modelo falha. Lá o produto é o texto; aqui o produto é
o **orçamento**, e existe embalagem padrão que sempre serve.

**A pessoa envia, não a IA.** O texto abre num diálogo editável antes de ir para
a conversa. Aqui a regra pesa mais que no copiloto: o texto carrega preço, e
preço enviado não se desdiz.

## Publicação: o site é aberto, o produto pede administrador

**Em produção o middleware separa as duas coisas.** `lib/site/exposicao.ts`
nomeia os prefixos do produto — os segmentos de `(workspace)`, mais `/login`,
`/webchat` e `/api` inteiro — e um teste lê os diretórios do grupo para impedir a
lista de envelhecer: tela nova sem entrada ali nasceria pública, sem erro e sem
aviso. Exigir **administrador**, e não só login, é o que impede alguém de se
cadastrar em `/cadastrar` e entrar: o armazém é único por instância, e quem troca
a vertical troca a base debaixo de quem está apresentando.

**A conta de administrador é re-semeada na leitura da sessão.** O armazém nasce vazio em cada
instância nova, e a conta só era criada dentro de `signInAction` — então a pessoa entrava, era
redirecionada, e o cabeçalho da página seguinte mostrava "Entrar" outra vez. O cookie estava
correto o tempo todo; quem sumia era a conta. `currentAccount` agora recria o administrador a partir
do ambiente quando o token assinado declara o papel, e busca **por e-mail**, porque o identificador é
derivado da posição no armazém e não sobrevive a uma re-semeadura. Conta comum não tem esse resgate,
e não pode ter: ela existiu só na memória de uma instância que morreu.

**A base de demonstração não usa nome de empresa real.** A organização é `Contábil Aurora`, com
domínio `contabilaurora.com.br`, e as pessoas são fictícias. O rodapé do site público continua
citando a Contabilidade Facilitada — ali é a empresa falando de si, não dado de demonstração. Os
identificadores (`usr_alex`, `org_cf`) ficaram como estavam: não aparecem em tela, e trocá-los deixa
referências penduradas nos módulos que a vertical não reescreve.

**O papel viaja dentro do cookie porque o middleware não tem como perguntar.** Na
borda não há `node:crypto` nem repositório, então `issueToken` assina
`id.vencimento.papel` e `lib/site/sessao-edge.ts` confere com a Web Crypto API.
São dois códigos para o mesmo formato, e a divergência entre eles não produziria
erro — produziria porta destrancada ou sessão válida recusada. Daí o teste que
emite com `node:crypto` e lê com o módulo da borda.

**O pedido de proposta sai por e-mail, e isso não é enfeite.** Em serverless o
armazém não é compartilhado entre instâncias: gravar sem notificar significa lead
perdido com a tela prometendo retorno em um dia útil. `lib/site/notificacao.ts`
nunca lança — falha de envio é dado, e a tela avisa quem preencheu.

**`outputFileTracingIncludes` carrega `content/site-content.json` para todas as
rotas.** O arquivo é lido por caminho montado em tempo de execução, e o
rastreamento só o enxergava nas páginas que chamam `readSiteContent` diretamente:
`/orcamento`, `/entrar`, `/cadastrar` e `/conta` sairiam com cabeçalho e rodapé
padrão enquanto a home mostrava o texto editado.

**A hospedagem é o Netlify, e a razão de não ser a alternativa óbvia está
registrada em `docs/publicacao.md`** — junto com o erro que quase custou uma
implantação quebrada: `passengerapps: 1` na lista de features do cPanel é
permissão de interface, não runtime instalado. Verificação de runtime se faz
executando `node -v`, não lendo lista de features.

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
| `--focus-ring`    | 3,73:1        | indicador de foco — mesma exigência                        |

**Campo usa `border-input`, nunca `border-border`.** A distinção não é estética: caixa de texto, caixa
de seleção, gatilho de select e a moldura do compositor são limites de componente de interface e têm
piso obrigatório de 3:1. Foi exatamente esse o erro da primeira versão — a moldura do compositor usava
o traço estrutural e o campo desaparecia quando o texto de exemplo saía.

**O foco não usa `--accent`.** O âmbar da marca rende 2,63:1 contra branco: serve para preencher
botão (onde o contraste que importa é o do texto sobre ele), não para desenhar um traço de 2 px. Daí o
token separado — e ele existe em **todas** as paletas, com valor próprio em cada uma. Ao mexer em qualquer um destes valores, **refaça a conta de contraste** — a razão é
`(Lmaior + 0,05) / (Lmenor + 0,05)` sobre luminância relativa, e o alvo é a pior superfície onde o
traço aparece, não a mais favorável.

**A conversa tem plano próprio.** O Inbox não usa `surface-sunken`: usa `--chat-canvas`, um
pergaminho texturizado (`.chat-canvas`), com `--chat-in` e `--chat-out` nas bolhas. A textura é a mesma
sensação do WhatsApp, a cor é Arena Elora, e o desenho entra como **máscara** — o SVG em
`--chat-doodle-mask` carrega só a forma, a tinta sai de `--chat-doodle`. É assim que a mesma textura
serve aos dois temas sem duplicar arquivo e sem hexadecimal em componente. As bolhas se separam por
matiz, não por peso: texto escuro nas duas.

**Um acento por tela.** O âmbar marca o que precisa de ação. Selo de estado usa fundo suave sem
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

## Identidade visual — Arena Elora

| Papel             | Cor       | HSL           |
| ----------------- | --------- | ------------- |
| Índigo principal  | `#1E1B4B` | `244 47% 20%` |
| Índigo secundário | `#312E81` | `242 48% 34%` |
| Branco            | `#FFFFFF` | superfícies   |
| Âmbar (acento)    | `#DC8F09` | `38 92% 45%`  |

O âmbar carrega ação primária e destaque de estado; o índigo carrega navegação, marca e superfícies
profundas. Tema claro e escuro compartilham os mesmos nomes de token.

**O acento mudou por acessibilidade, não por gosto.** A laranja anterior (`#FF9933`) rendia 2,13:1
contra branco. O âmbar rende 2,63:1 — ainda insuficiente para traço fino, e é por isso que
`--focus-ring` continua existindo, mas 23% melhor onde o acento de fato aparece.

**O logotipo é SVG e mora em `components/shell/logo.tsx`.** Um anel que não fecha, e a abertura é
preenchida pelas três hastes do E — "elo" e "Elora" na mesma forma. Não há mais PNG: a arte anterior
era da marca "Nexa", tinha texto branco que sumia em superfície clara e exigia um segundo arquivo por
tema. Sendo desenho, ele herda cor de token e acompanha a troca de paleta de graça. As coordenadas do
vão do anel e as alturas das hastes são solidárias — mexer numa sem a outra fecha o E dentro do anel.

**Onde a cor da marca aparece literal, ela deriva do token — e já derivou errado.** Três arquivos não
têm alternativa a hexadecimal, porque são lidos fora do documento, sem folha de estilo e sem tema:
`apps/web/src/app/icon.svg`, os arquivos de `apps/web/public/marca/` e o que os gera. O âmbar ficou
`#F59E0B` no ícone da aba com um comentário afirmando que batia com `--accent` — que vale `38 92% 45%`,
ou seja `#DC8F09`, cinco pontos mais escuro. Ao mexer, **converta o HSL do token**; copiar de outro
arquivo é como a deriva entrou.

**Os arquivos soltos da marca são gerados, não desenhados.** `scripts/gerar-marca.mjs` copia os quatro
traçados de `LogoMark` e converte "Elora" em contorno a partir do mesmo `@fontsource/sora` que o site
carrega, produzindo `apps/web/public/marca/` — símbolo e logotipo em versão clara, escura e
monocromática, o selo quadrado, a imagem de compartilhamento e os PNG. Sem o script, o caminho é
alguém redesenhar "parecido" no Figma, e seis meses depois o logotipo do slide não ser o do produto.
**Ao mexer no componente, rode o script de novo** — ele não tem como saber que o desenho mudou.

Três decisões dele valem enunciar. O nome vai em **contorno**, porque fora do site a fonte Sora não
existe e o editor cairia numa substituta. `opentype.js` e `sharp` **não** são dependências do projeto:
entram por `npm i --no-save --prefix scripts`, e o `--prefix` importa porque mandar o npm reconciliar a
árvore da raiz pode desfazer os vínculos do pnpm. E `apple-icon.png` e `opengraph-image.png` moram em
`app/`, não em `public/marca/`: é o **nome do arquivo naquele diretório** que faz o Next emitir as
tags, e movê-los desliga a prévia do link em silêncio.

**O componente continua sendo a marca dentro do produto.** Os arquivos gerados têm cor fixa; usá-los
numa tela traria de volta o defeito que derrubou o PNG da "Nexa" — o logotipo sumindo quando o fundo
muda.

Tipografia: **Sora** (`font-display`, classe `.figure`) nos números e títulos de seção; **Inter** no
resto. Ambas auto-hospedadas via `@fontsource` — nenhuma requisição externa.

Movimento: uma orquestração por página. `<Reveal index={n}>` sobe a seção com 60 ms de atraso por
índice; `<AnimatedNumber>` conta até o valor em 700 ms; `.lift`, `.lift-3d` e `.press` cuidam do hover
e do clique. `prefers-reduced-motion` anula tudo no CSS.

**Todo efeito é `transform` ou `opacity`, e isso não é preferência.** O perfil deste front mostra ~300
ms de script contra ~800 ms de recálculo de estilo e layout — o gargalo é o recálculo. Animar `width`,
`top`, `box-shadow` ou `filter` acrescenta trabalho exatamente onde já dói. Daí a forma de cada peça:
`.sheen` e `.brand-sheen` deslizam um pseudo-elemento em vez de mover posição de fundo; `.glow-pulse`
acende uma camada que já nasceu no tamanho final em vez de crescer uma sombra; `.underline-grow` usa
`scaleX` em vez de medir o gatilho ativo e reposicionar um indicador.

**Laço tem de parar em repouso.** O bloco de `prefers-reduced-motion` corta a duração para 0,01 ms e a
repetição para 1, o que leva toda animação ao **último quadro**. Então o último quadro de qualquer
laço é o estado parado — halo apagado, brilho fora da peça, cubo fechado. Um laço cujo quadro final
fosse o meio do efeito congelaria a tela num estado que parece defeito, e justamente para quem pediu
ao sistema para não animar. Efeito de `hover` não tem quadro final a que recorrer: `.sheen` e
`.brand-sheen` são desligados por `display: none` naquele bloco.

## Aparência: paleta da organização e preferência da pessoa

**São duas perguntas com donos diferentes.** "Qual é a cor desta instalação?" é da organização — numa
plataforma multiempresa a paleta é identidade, e por pessoa produziria uma captura de tela diferente
por atendente na hora de reportar problema. "Claro ou escuro? Denso ou espaçado?" é da pessoa: depende
do monitor, da luz da sala e da vista de quem olha oito horas por dia.

`OrganizationAppearance` (`types/appearance.ts`) guarda as duas coisas em campos distintos, e
`allowPersonalOverride` decide se a escolha individual existe. Desligada, ela é ignorada **também no
script do `<head>`** — esconder o controle não apaga o que já estava no `localStorage`, e sem a
conferência quem tinha valor gravado continuaria com ele para sempre.

**A paleta é servida, a preferência é do navegador.** `data-palette` sai do servidor já no HTML, pelo
layout raiz; resolvê-la no cliente pintaria a página inteira com a paleta padrão para repintá-la no
primeiro quadro — o flash mais caro possível, porque atinge todos os tokens de uma vez. Modo e
densidade não têm essa saída (dependem de `localStorage` e de `prefers-color-scheme`) e continuam no
único script inline da aplicação.

**Paleta redefine só tokens de marca.** Semântica (`--success`, `--warning`, `--destructive`) e as
seis séries de gráfico ficam de fora: as primeiras significam a mesma coisa em qualquer tema, e as
segundas foram validadas para daltonismo e não sobrevivem a serem trocadas por gosto. Cada paleta
carrega o seu `--focus-ring` acima de 3:1 — o piso não é negociável em nenhuma delas.

**Densidade escala a raiz tipográfica**, e não uma lista de utilitários. O Tailwind mede espaçamento
em `rem`, então mexer em `font-size` do `:root` move padding, gap, altura de linha e texto juntos e na
mesma proporção — que é o que densidade significa. Uma tabela de exceções por componente daria o
efeito só nas telas que alguém lembrasse de listar.

**A escrita da paleta segue a disciplina da Administração**: passa pelo `AdminRepository`, devolve
`AdminWriteResult` e registra auditoria com gravidade `atencao` — mudar a paleta muda a tela de todo
mundo ao mesmo tempo, e quem abrir chamado dizendo "o sistema está diferente hoje" precisa que a
auditoria responda em uma linha. A validação da chave mora no repositório porque `data-palette` com
valor inexistente **não produz erro nenhum**: o seletor não casa, a instalação volta ao padrão em
silêncio, e o sintoma chega como "escolhi petróleo e continua índigo".

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

`.claude/agents/` traz doze especialistas mapeados aos papéis da seção 24 do plano:

| Agente             | Escopo                                                          |
| ------------------ | --------------------------------------------------------------- |
| `elora-produto`    | requisitos, backlog, critérios de aceite, priorização MVP/P1/P2 |
| `elora-ux`         | design system, tokens, densidade, acessibilidade                |
| `elora-frontend`   | telas Next.js/React, estado de cliente, formulários             |
| `elora-backend`    | Supabase, modelo de dados, RLS, eventos, outbox, filas          |
| `elora-canais`     | WhatsApp, e-mail, webhooks, entregabilidade, DLQ                |
| `elora-builders`   | Chatbot Builder, Journey Builder e seus runtimes                |
| `elora-ia`         | AI Gateway, RAG, prompts, avaliação, custo                      |
| `elora-qa`         | testes, CI/CD, observabilidade, runbooks                        |
| `elora-dados`      | catálogo de eventos, métricas, dashboards, reconciliação        |
| `elora-seguranca`  | LGPD, consentimento, retenção, auditoria, segredos              |
| `elora-salesforce` | coexistência, propriedade de campos, migração por domínio       |
| `elora-revisor`    | revisão adversarial antes de fechar entrega                     |

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
