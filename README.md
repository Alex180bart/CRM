# CRM CF

CRM omnichannel interno da **Contabilidade Facilitada** — atendimento, CRM 360º, automação visual e
inteligência artificial em uma única plataforma.

> Estado atual: **front-end das fases 2 a 4 do roadmap**, com base de demonstração local. Não há
> back-end, Supabase, autenticação real nem integração com canais.
>
> Exceção: o **copiloto do atendente já é real**. O AI Gateway (`/api/ai/copilot`) chama o modelo de
> verdade, com prompt versionado, saída validada por schema, custo medido e **reserva de provedor**:
> Gemini atende, OpenAI entra se ele cair. Depende de `GEMINI_API_KEY` no `.env` da raiz
> (`OPENAI_API_KEY` é opcional) — sem nenhuma das duas o Inbox funciona e o painel do copiloto mostra o
> estado "desligado".

## O que já existe

| Tela                  | Rota                 | O que faz                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Início**            | `/inicio`            | Fila "precisa de você agora" reunindo SLA em risco, tarefas vencidas, aprovações paradas, execuções com erro e canais degradados; pulso do dia por hora; origem das conversas; cartões de atendimento, tempo de resposta, funil e automação                                                                                                                                         |
| **Inbox omnichannel** | `/inbox`             | Filas, filtros, busca, SLA com prazo vivo, conversa sobre plano texturizado com bolha, rabicho e agrupamento por autor, anexos (arrastar, colar, galeria com lightbox, áudio com transcrição), emojis com busca em português, citação de mensagem, notas internas, respostas rápidas, atribuição, transferência, janela de 24 h do WhatsApp, status de entrega e **copiloto de IA** |
| **Contatos**          | `/contatos`          | Tabela com busca, filtros por estágio, proprietário e tag, detecção de duplicidade, seleção múltipla e ações em massa                                                                                                                                                                                                                                                               |
| **Contato 360º**      | `/contatos/[id]`     | Visão geral, linha do tempo filtrável por tipo/canal/período, conversas, negócios, identificadores e consentimentos com base legal                                                                                                                                                                                                                                                  |
| **Pipeline**          | `/pipeline`          | Kanban com arrastar e soltar entre etapas, dois funis, valor ponderado, negócios parados, detalhe do negócio                                                                                                                                                                                                                                                                        |
| **Campanhas**         | `/campanhas`         | Lista com progresso de envio, construtor de segmentos com motivos de exclusão, biblioteca de templates com status do provedor                                                                                                                                                                                                                                                       |
| **Campanha**          | `/campanhas/[id]`    | Funil do envio, lotes, teste A/B, público elegível e excluído, proteções (consentimento, supressão, quiet hours, frequência, cancelamento automático), velocidade e fluxo de aprovação                                                                                                                                                                                              |
| **Chatbot Builder**   | `/chatbots/[id]`     | Editor de blocos, catálogo, inspetor, validação de publicação, versionamento imutável e simulador interativo                                                                                                                                                                                                                                                                        |
| **Journey Builder**   | `/jornadas/[id]`     | Editor de jornada, política de reentrada, janela de envio, participantes com nó atual e próxima execução, publicação versionada                                                                                                                                                                                                                                                     |
| **E-mail Studio**     | `/email-studio`      | Templates com métricas de abertura e bounce, módulos de marca travados, brand kits e a aba de entregabilidade (domínios, SPF/DKIM/DMARC, aquecimento e lista de supressão)                                                                                                                                                                                                          |
| **Editor de e-mail**  | `/email-studio/[id]` | Montagem por blocos com prévia real, alternância computador/celular, merge tags, inspetor por tipo de bloco, checagem antes do envio, versionamento imutável e teste interno                                                                                                                                                                                                        |
| **Analytics**         | `/analytics`         | Atendimento, comercial, campanhas e automação por período, mais o dicionário de métricas com definição, fonte e dono                                                                                                                                                                                                                                                                |
| **Administração**     | `/administracao`     | Pessoas e times, filas com SLA, canais com qualidade e limite diário, matriz de permissões por perfil, trilha de auditoria, feature flags e políticas de retenção                                                                                                                                                                                                                   |

Todos os módulos do MVP ampliado estão construídos. O que falta é a fundação de back-end e o resto da
camada de IA da fase 6 (RAG, ferramentas e avaliação automatizada).

### Copiloto do atendente

Implementa a linha "Copiloto do atendente" da seção 16.1 do plano. Fica no painel da direita do Inbox,
em aba ao lado do contexto do contato, e no compositor.

| Onde                                | O que faz                                                                                                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Painel · **Analisar conversa**      | Uma chamada devolve resumo, intenção, sentimento, urgência, dados do caso com o trecho que os sustenta, próximo passo, checklist marcável, resposta sugerida, assuntos sugeridos e o que a IA não resolve |
| Painel · **Perguntar ao copiloto**  | Pergunta livre sobre o atendimento, com resposta em fluxo (texto aparece conforme é gerado) e memória dos turnos anteriores                                                                               |
| Compositor · **Sugerir / Melhorar** | Escreve a resposta do zero ou melhora o rascunho já digitado                                                                                                                                              |
| Compositor · **Ajustar tom**        | Reescreve em sete direções: cordial, formal, direto, empático, encurtar, detalhar, revisar português                                                                                                      |

Três decisões que valem registro:

1. **Nada roda sem clique.** A análise fica em cache por conversa, então reabrir não gasta de novo —
   mas mensagem nova marca o resultado como desatualizado e oferece reanalisar, porque resumo velho
   com aparência de atual é pior que resumo nenhum.
2. **A sugestão nunca sobrescreve o rascunho.** Entra numa faixa acima do campo, com _Usar_ e
   _Usar e editar_. Quem envia continua sendo o atendente.
3. **Custo, latência, modelo e versão do prompt aparecem na tela** (seção 16.4). Um copiloto cujo
   custo ninguém vê é um copiloto que ninguém otimiza.

### Anexos

Duas origens, com pendências diferentes e avisos diferentes.

| Origem      | Como entra                                                   | O que a bolha mostra                                                                            |
| ----------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **Arquivo** | Botão do clipe, arrastar sobre a conversa ou colar um print  | Imagem em galeria com lightbox, documento em ficha com download, áudio com player e transcrição |
| **Link**    | Botão de link: endereço direto de imagem, vídeo ou documento | O mesmo, mais o selo de origem externa e "abrir" no lugar de "baixar"                           |

**Link do YouTube entra com capa e título.** `/api/media/preview` resolve o vídeo por oEmbed e a bolha
mostra a capa em 16:9 com o botão do provedor e o título sobre um véu. Clicar **abre em aba nova** em
vez de embutir o player: incorporar o quadro do YouTube carregaria script de terceiro na tela que
exibe conversa de cliente, e a capa já resolve o que o atendente precisa — saber qual vídeo é.

A verificação do link é do servidor, não do navegador, por dois motivos concretos: o CORS impede ler o
`Content-Type` de outro domínio, e o título do vídeo só o provedor tem. Um endereço terminado em `.jpg`
que serve HTML é recusado com o motivo explícito.

> **A rota `/api/media/preview` busca URL informada pelo cliente, e por isso carrega guarda contra
> SSRF**: só http e https, só portas 80 e 443, resolução de DNS com **todos** os endereços conferidos,
> faixas privadas/loopback/link-local/CGNAT bloqueadas, IPv6 expandido byte a byte (para pegar
> `::ffff:10.0.0.1` e 6to4, que a normalização de URL esconde em hexadecimal), e cada salto de
> redirecionamento revalidado. O corpo da resposta remota nunca chega ao cliente — só metadados.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind 3** com preset próprio e tokens em HSL
- **Radix UI** para primitivas acessíveis
- **@xyflow/react** para os construtores visuais
- **@dnd-kit** para o kanban
- Gráficos em **SVG próprio** (sem biblioteca), com paleta validada para daltonismo
- Tipografia **Sora** (números e títulos) + **Inter** (interface), auto-hospedadas
- Monorepo **pnpm + Turborepo**

## Como rodar

```bash
pnpm install
cp .env.example .env      # preencha GEMINI_API_KEY para ligar o copiloto
pnpm dev
```

A aplicação sobe em <http://localhost:3100>. A rota `/` redireciona para `/inicio`; `/login` mostra a
tela de entrada com seleção de perfil de demonstração.

O `.env` fica na **raiz** do repositório, não em `apps/web`: é um valor por repositório, e
`apps/web/next.config.mjs` carrega a raiz para o segredo não existir em dois lugares. Nenhuma variável
de IA usa o prefixo `NEXT_PUBLIC_` — a chave do provedor nunca chega ao navegador.

Outros comandos:

```bash
pnpm typecheck    # tsc --noEmit nos três pacotes
pnpm lint         # eslint, zero avisos tolerados
pnpm build        # build de produção
pnpm format       # prettier
```

Requisitos: Node ≥ 20.11 e pnpm 9.

## Estrutura

```
CRM CF/
├─ apps/web/                 aplicação Next.js
│  └─ src/
│     ├─ app/                rotas (App Router)
│     ├─ components/         inbox, contacts, pipeline, chatbots, journeys, flow, shell
│     └─ lib/                navegação e aparência por canal
├─ packages/
│  ├─ core/                  tipos canônicos, utilitários, base de demonstração, repositórios
│  ├─ ui/                    design system @crm/ui
│  └─ config/                preset Tailwind
├─ docs/
│  ├─ referencia/            Plano Completo do CRM (fonte da verdade)
│  ├─ arquitetura.md         decisões desta onda e o que muda na próxima
│  └─ design-system.md       tokens, componentes e regras visuais
└─ .claude/agents/           equipe de agentes especializados
```

## Base de demonstração

Tudo é fictício e determinístico. Nenhum dado real de contato, mensagem ou documento é usado.

- 1 organização, 7 usuários, 4 times, 4 filas, 5 contas de canal
- 26 contatos (incluindo uma duplicidade proposital), 6 empresas, 10 tags
- 16 conversas com histórico completo, notas internas, anexos e falhas de entrega
- 18 negócios em 2 funis, 8 tarefas
- 2 chatbots e 2 jornadas, com versões publicadas, rascunhos e participantes
- 6 campanhas em estados diferentes, 4 segmentos e 6 templates de mensagem (um reprovado)
- 4 e-mails montados em blocos, 5 módulos de marca, 2 brand kits, 2 domínios e 10 supressões
- séries de 14 dias, pulso por hora, saúde das automações, custos e 10 entradas de auditoria

A fila da página inicial é **derivada** dos demais dados — SLA em risco vem das conversas, aprovações
vêm das campanhas, erros vêm das jornadas. Nada aparece ali sem um evento por trás.

O conjunto é ancorado num instante fixo (`REFERENCE_NOW_ISO`), de modo que os prazos de SLA e os
rótulos relativos permanecem coerentes e idênticos entre servidor e navegador.

## Camada de dados

As telas consomem **repositórios**, nunca a origem do dado:

```
ContactRepository · ConversationRepository · DealRepository
AutomationRepository · DirectoryRepository · CampaignRepository
EmailStudioRepository · InsightsRepository · GovernanceRepository
AiRepository
```

Hoje resolvem para a implementação em memória. Quando o Supabase entrar, muda apenas
`packages/core/src/repositories/index.ts` — nenhuma tela precisa ser reescrita.

`AiRepository` é a exceção: já aponta para o AI Gateway real. Inteligência não tem versão em memória
que valha algo — uma resposta fixa não ensina nada sobre latência, custo ou qualidade do prompt.
Só dois arquivos conhecem o nome de um provedor — `lib/ai/gateway.ts` (política, prompt, validação) e
`lib/ai/providers.ts` (transporte e reserva); nenhum componente de tela sabe que existe Gemini.

### Reserva de provedor

A seção 16.1 do plano exige que o Gateway "ofereça fallback". Com um provedor só, não havia nenhum: se
o Gemini caísse, o copiloto morria com ele.

| Ordem | Provedor | Modelo             | Papel                                       |
| ----- | -------- | ------------------ | ------------------------------------------- |
| 1º    | Google   | `gemini-2.5-flash` | atende sempre; é a qualidade do dia a dia   |
| 2º    | OpenAI   | `gpt-4.1-mini`     | entra só quando o primário não pode atender |

**A troca é por disponibilidade, nunca por qualidade.** Só `indisponivel`, `limite_excedido` e
`sem_credencial` acionam a reserva. Recusa de conteúdo seria a mesma dos dois lados, e falha de schema
é problema de prompt — trocar de modelo aí mudaria a qualidade do caminho normal sem ninguém decidir.

`AiRunMeta.provider` e `AiRunMeta.model` passam a registrar **quem atendeu**, não quem devia atender: o
rodapé do painel do copiloto mostra outro modelo quando a reserva entra, e a operação percebe a queda
sem abrir log.

O modelo de reserva foi escolhido por teste, não por catálogo: `gpt-4.1-mini` aceita `temperature` e
`max_tokens` (a mesma forma que a política de tarefa já monta), atende saída estruturada com `strict` e
respondeu em 2,2 s contra 3,3 s do `gpt-5.4-mini`, que ainda recusa `max_tokens`. Numa reserva — que já
é caminho degradado — latência conta.

## Identidade visual

Paleta Arena CF: azul `#102850`, branco `#FFFFFF` e laranja `#FF9933`.

Três regras de composição sustentam a interface:

1. **A borda é exceção — e exceção precisa ser vista.** Superfícies se separam por cor e sombra;
   hairline só onde duas regiões roláveis se encontram. Mas o traço tem piso de contraste: `--border`
   em 1,86:1, `--border-strong` em 2,68:1 e `--input` em **3,41:1**, porque limite de componente de
   interface é exigência da WCAG 1.4.11, não preferência. O foco tem token próprio (`--focus-ring`,
   3,43:1) — a laranja da marca rende 2,13:1 contra branco e não serve para traço fino.
2. **Um acento por tela.** O laranja marca o que precisa de ação — não decora.
3. **A tipografia carrega a hierarquia.** Sora nos números e títulos, Inter na interface.

Movimento é uma orquestração única: as seções sobem 10 px em sequência de 60 ms, os números contam
até o valor final em 700 ms, cartões interativos levantam 2 px no hover. Nada pisca em laço.
`prefers-reduced-motion` anula tudo.

### O plano da conversa

O Inbox tem uma superfície própria, com tokens próprios (`--chat-canvas`, `--chat-in`, `--chat-out`).
A textura de rabiscos vem do WhatsApp — ela existe porque o olho precisa de um plano com "grão" para
as bolhas descolarem. A cor, não: é a Arena CF, em bege azulado no tema claro e azul profundo no
escuro, com glifos do ofício (documento, calculadora, apuração, prazo) em vez de corações e pizzas.

O desenho entra como **máscara** e não como imagem colorida: o SVG carrega só a forma, a tinta sai de
`--chat-doodle`. É o que permite a mesma textura servir aos dois temas sem duplicar arquivo e sem
quebrar a regra de que cor sai de token.

As duas bolhas se separam por matiz, não por peso: branco de um lado, azul claro do outro, texto
escuro nos dois. Bolha escura sobre plano bege briga com a textura e some no tema escuro.

A paleta de dados (seis séries) foi validada com o script do sistema de visualização: banda de
luminosidade, piso de croma, separação para daltonismo (ΔE ≥ 8 em pares adjacentes) e contraste
contra as duas superfícies. Detalhes em [docs/design-system.md](docs/design-system.md).

## Desempenho

Medido em build de produção, com **Event Timing** (`processingEnd - processingStart`, isto é, o
trabalho de script — sem a latência de quadro do navegador de teste):

| Interação                   | Antes   | Depois  |
| --------------------------- | ------- | ------- |
| Trocar de conversa, mediana | 64,1 ms | 15,9 ms |
| Trocar de conversa, pior    | 76,3 ms | 24,2 ms |
| Digitar uma tecla, mediana  | 4,0 ms  | 2,1 ms  |
| Digitar uma tecla, pior     | 16,8 ms | 3,5 ms  |

O que o perfil de CPU mostrou, e que orientou as três mudanças: **o custo não estava em JavaScript.**
Em sete trocas de conversa havia ~300 ms de script contra ~800 ms de recálculo de estilo e layout.

1. **A conversa não é mais remontada.** `key={selected.id}` no `ConversationThread` destruía e recriava
   a subárvore inteira a cada troca — todas as bolhas, o compositor e as seis raízes de Radix que ele
   carrega. Foi a mudança que rendeu quase todo o ganho. O compositor descarta o rascunho por efeito
   preso a `conversationId`, que é o que a remontagem garantia de graça.
2. **`scrollIntoView` só na navegação por teclado.** Ele força um passe síncrono de layout e aparecia
   com 48 ms de tempo próprio no perfil — inteiramente desperdiçados nos cliques, onde o item estava
   sob o ponteiro e portanto já visível.
3. **Contexto do copiloto sob demanda.** Montá-lo percorre e ordena todo o histórico; era refeito a
   cada troca para algo que só a chamada ao provedor consome. O painel recebe uma assinatura curta para
   saber se a análise em cache envelheceu, e o contexto é construído no clique.

Duas coisas que **não** foram alteradas, de propósito:

- **O `/inbox` desce 281 kB de HTML** porque o servidor serializa o histórico das dezesseis conversas.
  Em máquina local isso custa ~14 ms de transferência e o servidor responde em 11 ms — não é o gargalo
  hoje. O conserto certo é carregar a conversa sob demanda, e ele pertence à entrada do back-end:
  fazê-lo agora **acrescentaria** uma ida à rede a cada troca, piorando justamente o número que
  acabamos de melhorar.
- **A memorização das linhas da lista** rendeu 3,5 ms sozinha. Ficou porque não custa nada e passa a
  valer com fila real de centenas de conversas, mas ela não era o problema — e é o exemplo de por que a
  regra do repositório é medir antes de otimizar.

## Próximos passos

**Fundação de back-end** — Supabase, auth, RLS, event store, outbox, workers e CI/CD — que substitui a
base local pelos dados reais sem alterar as telas.

**Mídia (seção 11).** O anexo escolhido **do computador** não sai do navegador: fica num `File` em
memória, com prévia por object URL. Falta o caminho real — upload, antivírus, armazenamento, expiração,
miniatura no servidor e URL assinada. A interface já trata a ausência de URL como estado legítimo
("processando mídia"), então o back-end entra sem redesenho.

O anexo **por link** já funciona de ponta a ponta, porque o endereço é público e o navegador o carrega
direto. O que falta nele é o back-end baixar e verificar o conteúdo antes de despachar pelo canal —
o WhatsApp não aceita "mande o que está nesta URL". Por isso `Attachment.source` distingue `arquivo`
de `link`: as duas origens têm pendências diferentes, e a interface avisa cada uma pelo que ela é.

**Resto da fase 6** — RAG com pgvector sobre base de conhecimento (16.2), ferramentas com function
calling e allowlist por agente (16.3) e conjunto de avaliação automatizado antes de publicar prompt
(16.4). O AI Gateway já existe e é onde essas três coisas entram.
