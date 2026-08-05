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
Analytics e Administração. Falta toda a camada de escrita/back-end.

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

**Busca de URL do cliente passa por `lib/net/safe-fetch.ts`.** A guarda de SSRF saiu da rota de mídia
quando a prévia de site passou a precisar dela. Ao mexer, leia antes: as duas rotas buscam endereço
informado pelo cliente, e afrouxar a validação transforma o servidor em procurador da rede interna.

Três coisas que o resto do produto não tem:

- **Domínios autorizados.** O trecho de incorporação é público — vive no HTML de quem visita. Quem
  autoriza é `allowedDomains`; sem ele a publicação fica bloqueada, porque o mesmo trecho copiado
  para outro site abriria conversas na fila da empresa.
- **Contraste calculado em duas frentes** (`utils/color.ts`). A primeira versão só media o rótulo
  contra a cor, e esse teste aprova tudo: como a tinta é escolhida pela máquina entre branco e
  escuro, a razão do texto nunca cai abaixo de ~4,03:1. O que reprova de verdade é a **peça contra a
  página branca** (WCAG 1.4.11, 3:1). Abaixo de 2:1 é erro e bloqueia; entre 2 e 3 é alerta, porque
  a sombra do lançador compensa em parte — é onde cai o próprio laranja da marca, com 2,13:1.
- **A prévia é o produto.** `widget-preview.tsx` não usa token nenhum: usa a cor configurada e
  neutros literais, porque no site do cliente não existe `--primary`. Um widget pintado com
  `bg-primary` mudaria junto com o nosso tema e mentiria sobre o resultado.

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
- **Camada de escrita** — hoje as mutações vivem em estado local do componente. Entram junto com
  idempotência, outbox e auditoria reais.
- **Mídia (seção 11)** — upload, antivírus, armazenamento, expiração, miniatura no servidor e URL
  assinada. A interface de anexo já existe e já trata `url` ausente como "processando mídia".
- **Resto da fase 6** — o AI Gateway existe; o copiloto do atendente e a redação de e-mail funcionam.
  Faltam RAG com pgvector sobre base de conhecimento (16.2), ferramentas com function calling e
  allowlist por agente (16.3), controle de cota por organização e conjunto de avaliação automatizado
  (16.4). O freio de uso atual é em memória, por instância — não substitui o controle compartilhado do
  back-end. **O bloco de IA do chatbot já declara as ferramentas que o modelo poderia chamar
  (`acoes` em `node.config`), mas nada as executa** — é contrato de interface esperando o 16.3.

Escreva sempre em português correto e direto.
