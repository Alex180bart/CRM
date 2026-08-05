# Arquitetura — front das fases 2 a 4

Este documento registra o que foi decidido para o front-end do CRM CF e o que muda quando a fundação
de back-end entrar. Referências entre parênteses apontam para as seções do Plano Completo em
`docs/referencia/plano-completo-crm-v2.txt`.

## 1. Monorepo

`pnpm` + `Turborepo`, no mesmo padrão já usado no CF Forms.

```
apps/web        Next.js 15 (App Router), React 19, Tailwind 3
packages/core   domínio: tipos, utilitários, base de demonstração, repositórios
packages/ui     design system
packages/config preset Tailwind
```

Os pacotes internos publicam **TypeScript puro** (`main: ./src/index.ts`) e são transpilados pelo
Next via `transpilePackages`. Não há passo de build para bibliotecas — menos cerimônia enquanto o
projeto é pequeno, e o custo de reverter é baixo.

Quando entrarem a API dedicada e os workers (seção 7.2), eles nascem como `apps/api` e
`apps/workers` no mesmo workspace.

## 2. Camada de dados

A regra estruturante desta onda: **a aplicação não conhece a origem do dado**.

```ts
// packages/core/src/repositories/types.ts
interface ConversationRepository {
  list(filter?: ConversationFilter): Promise<Conversation[]>;
  getById(id: Id): Promise<Conversation | null>;
  listMessages(conversationId: Id): Promise<Message[]>;
  // ...
}
```

Toda leitura é assíncrona **de propósito**, mesmo sendo um array em memória. Quando a implementação
Supabase entrar, a assinatura não muda e nenhuma tela precisa ser reescrita — troca-se apenas o que
`packages/core/src/repositories/index.ts` exporta.

O que **não** foi feito: escrita. Repositórios expõem só leitura. As mutações das telas (enviar
mensagem, mover negócio, publicar versão) vivem em estado local do componente, com feedback via
toast. Isso é honesto sobre o estágio do projeto e evita construir uma camada de escrita que seria
descartada quando as regras reais de idempotência, outbox e auditoria (seções 8 e 17.2) entrarem.

## 3. Tempo determinístico

`packages/core/src/utils/datetime.ts` ancora tudo em `REFERENCE_NOW_ISO`.

Motivo: com Server Components, o mesmo componente renderiza no servidor e hidrata no navegador. Se o
tempo vier de `Date.now()`, os dois lados divergem e o React descarta a hidratação. Ancorar resolve
isso e mantém a base de demonstração coerente — os prazos de SLA continuam fazendo sentido, e "há 3
min" significa a mesma coisa nas duas pontas.

Formatação sempre com `Intl` explícito: locale `pt-BR`, fuso `America/Sao_Paulo`.

Quando os dados forem reais, `now()` passa a devolver `new Date()` e o resto do código não muda.

## 4. Multiempresa desde o tipo

`BaseEntity` já exige `organizationId` (seção 17.1). Nenhuma entidade de negócio existe fora de uma
organização. Quando o Supabase entrar, a política RLS valida a associação do usuário à organização —
e o tipo já obriga o campo a estar lá.

## 5. Documento de fluxo versionado

Chatbots e jornadas compartilham a mesma estrutura (`FlowNode`, `FlowEdge`, `FlowPort`) e o mesmo
canvas (`components/flow/`). A diferença está no catálogo de blocos e nas regras de validação.

Três decisões:

1. **O editor não executa regra de negócio.** Ele produz um documento; quem interpreta é o runtime.
2. **Publicar congela.** A versão publicada é imutável; editar cria uma nova versão e não altera
   execuções já iniciadas (seções 12 e 15.3). A interface implementa isso: ao publicar, a versão
   atual vira `publicado`, a anterior vira `arquivado` e um novo rascunho é criado.
3. **Validação antes de publicar.** `validateFlow()` detecta caminho sem saída, nó inalcançável,
   destino inexistente e ausência de transbordo humano. Erro bloqueia a publicação; alerta apenas
   informa (seção 12.2).

O simulador (`use-simulator.ts`) percorre o documento com a mesma semântica do runtime: um bloco por
vez, escolhendo a porta de saída, respeitando o limite de passos e parando em bloco terminal. Não é
o runtime real, mas testa o desenho antes da publicação.

## 6. Estados canônicos da conversa

`nova → em_triagem → em_atendimento → aguardando_cliente → aguardando_interno → resolvida →
encerrada` (seção 10.1). A operação pode criar estados adicionais no futuro, mas este conjunto é
preservado para manter relatórios comparáveis.

O SLA é derivado, não armazenado: enquanto não há primeira resposta, vale o prazo de primeira
resposta; depois, o de resolução. `aguardando_cliente` pausa o relógio — o tempo de espera do
contato não conta contra o time.

## 6.1 A fila de atenção é derivada, não escrita

A página inicial abre com "precisa de você agora": SLA em risco, tarefa vencida, aprovação parada,
execução com erro, canal degradado e duplicidade, ordenados por gravidade e prazo.

Essa lista é **computada a partir dos demais dados** (`packages/core/src/mock/analytics.ts`), não
escrita à mão. O SLA em risco vem das conversas; a aprovação pendente vem das campanhas; o erro vem
das jornadas. É assim que a lista se comporta no produto real — nada aparece ali sem um evento por
trás — e evita que a página inicial e o resto do sistema contem histórias diferentes.

Quando o back-end entrar, a fila vira uma consulta sobre o event store com as mesmas regras de
ordenação.

## 6.2 Gráficos sem biblioteca

As primitivas de gráfico são SVG próprio em `packages/ui/src/components/chart.tsx`. Duas razões:

1. **Peso.** Recharts ou similares custariam 40–90 kB para desenhar sparkline, barra e funil.
2. **Controle das regras.** Espessura de marca, espaçamento entre preenchimentos, cor de texto e
   comportamento de hover são decisões do sistema, não defaults de uma biblioteca.

O componente mede o container com `ResizeObserver` e desenha em pixels reais, em vez de usar
`preserveAspectRatio="none"` — assim o traço de 2 px continua com 2 px em qualquer largura.

A paleta de séries foi validada por script (banda de luminosidade, croma, separação sob daltonismo e
contraste) nos dois temas. Se um dia entrar uma sétima série, a resposta não é gerar uma cor: é
dobrar em "Outros" ou facetar.

## 6.3 O e-mail é um documento de blocos

O E-mail Studio guarda o e-mail como uma lista de blocos tipados (`EmailBlock`), não como HTML. Três
consequências:

1. **A prévia é a fonte de verdade visual.** O que aparece no editor é o que o contato recebe,
   porque os dois saem do mesmo documento.
2. **A compilação é responsabilidade de quem renderiza**, não de quem escreve. Tabelas aninhadas e
   CSS embutido — o que faz o e-mail funcionar no Outlook — ficam fora do modelo.
3. **Validar é possível.** Com blocos tipados dá para afirmar "esta imagem não tem texto
   alternativo" ou "não existe rodapé com descadastro". Com HTML solto, não daria.

A seção 14.1 do plano recomenda **integrar** um editor incorporável na fase inicial e só depois
avaliar um próprio. Construímos o próprio agora porque não há back-end para hospedar plugin de
terceiro e porque a decisão de compra segue aberta: o documento de blocos é nosso e migra para
qualquer editor que aceite importar JSON. O que **não** foi construído é a compilação para HTML
compatível — é justamente a parte que justifica comprar em vez de fazer.

Cores do e-mail são hexadecimais vindas do brand kit, não tokens do sistema. Cliente de e-mail não
tem variável CSS nem tema; o que sai é valor literal.

## 6.4 Entrega é assunto separado do editor

Domínio, SPF/DKIM/DMARC, aquecimento, bounce, reclamação e supressão vivem fora do template e não
podem ser contornados por ele (seção 14.3). O editor decide como o e-mail se parece; a
entregabilidade decide se ele chega.

Dois domínios separados por propósito — transacional e marketing — porque uma campanha ruim não pode
derrubar a entrega de um boleto.

## 7. Responsividade das telas de trabalho

Inbox e construtores têm colunas fixas que somam mais do que cabe em 1280 px. A regra adotada:

- abaixo de 1280 px, a coluna de filtros do Inbox sai de cena;
- abaixo de 1536 px, o painel de contexto do contato sai de cena (o atendente usa "Abrir contato
  360º");
- os indicadores ocupam uma **faixa de uma linha**, não cartões — a altura da tela pertence à
  conversa e ao canvas.

Páginas de leitura (início, campanhas, analytics, administração) usam container de largura máxima
`86rem` centralizado. Sem isso, em monitores ultrawide a linha de texto fica longa demais e a
varredura visual custa mais do que deveria.

## 8. O que fica para a próxima onda

| Tema            | O que entra                                                                     |
| --------------- | ------------------------------------------------------------------------------- |
| Fundação        | Supabase, Auth, organizações, RLS, auditoria, secrets, ambientes, CI/CD         |
| Eventos         | event store, outbox, `correlation_id` ponta a ponta, catálogo de eventos        |
| Execução        | filas, workers, DLQ, reprocessamento assistido, idempotência                    |
| Canais          | número de WhatsApp piloto, webhooks, templates, status, mídia                   |
| Escrita         | mutações reais nas telas, substituindo o estado local do protótipo              |
| Observabilidade | logs estruturados, traces, métricas, alertas, painel operacional                |
| E-mail Studio   | editor incorporável, entrega, SPF/DKIM/DMARC, bounces e supressão (fase 5)      |
| IA              | AI Gateway, RAG com pgvector, agentes com allowlist, avaliação e custo (fase 6) |

## 9. Dívida técnica conhecida

- `noUncheckedIndexedAccess` está desligado no `tsconfig.base.json`. Ligar quando o volume de código
  estabilizar; hoje o custo de acesso indexado defensivo supera o ganho.
- Não há testes automatizados. A estratégia da seção 21 do plano começa a valer quando houver regra
  de negócio no servidor — hoje quase tudo é apresentação.
- O Inbox carrega o histórico completo de todas as conversas de uma vez. Com API real, vira
  carregamento sob demanda por conversa.
- Listas ainda não são virtualizadas. A seção 19 exige isso para listas grandes; a base de
  demonstração não chega perto do limite.
