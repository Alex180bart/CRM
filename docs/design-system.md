# Design system — CRM CF

Identidade **Arena CF** aplicada a um produto de uso contínuo. O sistema vive em `packages/ui` e é
consumido por `@crm/ui`.

## 1. A ideia central: densidade calma

Um CRM mostra muita informação. O erro comum é tratar cada elemento como igualmente importante —
traço em tudo, selo colorido em tudo, rótulo em caixa alta em tudo. O resultado é ruído.

Três regras evitam isso:

1. **A borda é exceção.** Cartão separa por superfície branca sobre um plano azulado, mais uma sombra
   de um degrau (`shadow-card`). Hairline só onde duas regiões roláveis se encontram.
2. **Um acento por tela.** O laranja marca o que precisa de ação. Nada mais.
3. **A tipografia carrega a hierarquia**, não a caixa. Sora nos números e títulos, Inter no resto.

## 2. Paleta

| Papel           | Hex       | Token HSL     | Uso                                      |
| --------------- | --------- | ------------- | ---------------------------------------- |
| Azul principal  | `#102850` | `218 67% 19%` | navegação, marca, ações primárias, texto |
| Azul secundário | `#212D51` | `225 42% 22%` | gradientes e profundidade                |
| Branco          | `#FFFFFF` | `0 0% 100%`   | superfícies de conteúdo                  |
| Laranja         | `#FF9933` | `30 100% 60%` | acento, foco, destaque de estado         |

Cores de estado: `success 158 62% 30%`, `warning 36 92% 42%`, `destructive 0 68% 47%`,
`info 210 88% 44%`. Cada uma tem variante `-soft` (fundo de selo) e `-foreground` (texto sobre a cor
cheia). O laranja tem `accent-ink` para texto legível sobre `accent-soft`.

**Componente não escreve hexadecimal.** Tudo sai de `packages/ui/src/styles/tokens.css` via Tailwind:
`bg-primary`, `text-accent`, `border-border`, `ring-accent`.

### Cores derivadas de dado

Tag, avatar, canal e bloco de fluxo têm matiz vinda do dado. O componente informa **só a matiz**; o
resto vem de tokens:

```tsx
backgroundColor: `hsl(${hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`;
color: `hsl(${hue} 52% var(--hue-fg-l))`;
```

No tema claro isso rende um fundo pastel opaco com tinta escura; no escuro, um fundo translúcido com
tinta clara. Uma regra, dois temas, zero duplicação.

## 3. Tema claro e escuro

Os dois compartilham os mesmos nomes de token; muda o valor. O tema é aplicado por um script no
`<head>` antes da primeira pintura, o que evita flash e divergência de hidratação.

No escuro o azul principal clareia para `213 70% 62%` — contraste sobre superfície escura. O laranja
permanece idêntico: é a âncora da marca.

## 4. Superfícies e elevação

| Token            | Papel                                              |
| ---------------- | -------------------------------------------------- |
| `background`     | plano de fundo levemente azulado                   |
| `surface`        | painéis, cabeçalhos, colunas                       |
| `surface-sunken` | áreas de leitura contínua (thread, canvas, kanban) |
| `card`           | cartões sobre superfície                           |
| `sidebar-*`      | barra lateral, sempre em azul profundo             |

Elevação em três degraus (`--elev-1/2/3`), expostos como `shadow-card`, `shadow-raised` e
`shadow-overlay`. Existe ainda `shadow-inset-hairline` para o filete de separação de linha de tabela
e rodapé de cartão.

## 5. Tipografia

**Sora** para números e títulos de seção; **Inter** para a interface. Ambas auto-hospedadas via
`@fontsource` — sem requisição externa, funciona offline.

- `font-display` aplica Sora.
- `.figure` aplica Sora + `tabular-nums` + `letter-spacing: -0.02em`. É a classe dos números grandes.
- `tabular-nums` em todo número que muda (contadores, valores, prazos), para o texto não "dançar".
- Rótulo em caixa alta só em eyebrow e eixo de gráfico. Nunca em cartão.

## 6. Movimento

Uma orquestração por página, não efeitos espalhados.

| Recurso              | O que faz                                            |
| -------------------- | ---------------------------------------------------- |
| `<Reveal index={n}>` | sobe 10 px e aparece, com 60 ms de atraso por índice |
| `<AnimatedNumber>`   | conta de 0 ao valor em 700 ms com `easeOutCubic`     |
| `.lift`              | levanta 2 px e sobe um degrau de sombra no hover     |
| `.press`             | encolhe 1,5% no clique                               |

Nada em laço infinito, exceto o `StatusDot pulse` de estado ao vivo (campanha enviando, canal
degradado). `prefers-reduced-motion` anula animação e transição globalmente.

## 7. Foco e acessibilidade

- Foco visível em laranja: `outline: 2px solid hsl(var(--accent))` com `outline-offset: 2px`.
- Navegação por teclado em toda ação; o Inbox aceita `↑ ↓` e `j k` para percorrer a lista.
- `aria-pressed` em filtros alternáveis, `aria-selected` em itens de lista, `role="listbox"` na lista
  de conversas, `role="progressbar"` com `aria-valuenow` nas barras.
- Ícone decorativo leva `aria-hidden`; ícone com significado leva `aria-label`.

## 8. Gráficos

As primitivas estão em `packages/ui/src/components/chart.tsx`: `Sparkline`, `BarSeries`,
`FunnelBars`, `ShareBar`, `ChartFrame` e `ChartLegend`. Elas já carregam as regras:

- linha de 2 px, ponto de 8 px, topo de barra arredondado em 4 px;
- 2 px de respiro entre preenchimentos vizinhos;
- grade e eixo recessivos — o dado é a única coisa saturada;
- **texto em tinta de texto, nunca na cor da série**; a cor fica na marca ao lado;
- camada de hover por padrão, com balão que vira de lado ao passar da metade;
- legenda sempre que houver duas séries ou mais.

### Paleta de dados

Seis séries, validadas com o script do sistema de visualização em ambos os temas:

| Slot | Matiz   | Claro     | Escuro    |
| ---- | ------- | --------- | --------- |
| 1    | azul    | `#2a6fd6` | `#4d90ea` |
| 2    | laranja | `#d96f14` | `#cf7220` |
| 3    | água    | `#0f9b8e` | `#12a094` |
| 4    | violeta | `#6b4fd0` | `#8f7ae8` |
| 5    | magenta | `#d94f86` | `#dc5f90` |
| 6    | verde   | `#3f8f2a` | `#5aab3f` |

Resultado da validação: banda de luminosidade e piso de croma aprovados nos dois modos; pior par
adjacente sob daltonismo ΔE 9,8 (claro) e 9,3 (escuro), acima do alvo de 8; pior par em visão normal
ΔE 23,6 e 18,1, acima do piso de 15; contraste ≥ 3:1 contra branco e contra `#161c27`.

As cores são expostas como `--chart-1` a `--chart-6` e consumidas por `seriesColor(index)`. A ordem é
fixa — **nunca cicle** para uma sétima série: dobre em "Outros" ou facete em múltiplos pequenos.

O funil usa rampa ordinal de um só tom (azul, claro → escuro): mais escuro é etapa mais avançada.
Cores de estado (`success`, `warning`, `destructive`) nunca viram "série 4".

## 9. Componentes

`packages/ui/src/components/`

| Arquivo            | Conteúdo                                                                  |
| ------------------ | ------------------------------------------------------------------------- |
| `button.tsx`       | 7 variantes e 7 tamanhos                                                  |
| `badge.tsx`        | selos sem traço + `TagChip` colorido por matiz                            |
| `card.tsx`         | `Card` (`raised` / `flat` / `outlined`, com `interactive`) e suas partes  |
| `avatar.tsx`       | avatar por iniciais e ponto de presença                                   |
| `input.tsx`        | `Input`, `Textarea`, `Label`, `SearchInput`                               |
| `primitives.tsx`   | Radix: tabs, tooltip, dropdown, dialog, popover, select, switch, checkbox |
| `feedback.tsx`     | `EmptyState`, `Skeleton`, `Callout`                                       |
| `data-display.tsx` | `StatTile`, `ProgressBar`, `KeyValue`, `StatusDot`, `Eyebrow`             |
| `motion.tsx`       | `Reveal`, `AnimatedNumber`                                                |
| `chart.tsx`        | primitivas de gráfico                                                     |

Regras de uso:

1. Antes de criar componente novo, procure equivalente. Duplicata é dívida.
2. Prefira composição a props booleanas acumuladas.
3. Toda superfície que busca dados precisa de estado **vazio, carregando, erro e sucesso**.
4. Estado vazio explica o que aconteceu e o que fazer — nunca só "nenhum resultado".

## 10. Aparência por canal e por bloco

O atendente varre o Inbox pelo ícone do canal. Um balão genérico não distingue WhatsApp de
Messenger — por isso canais de terceiros usam a **marca real**.

| Canal                                          | Tratamento                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| WhatsApp, Instagram, Messenger                 | glifo oficial em chip com a cor da marca (Instagram com o gradiente), glifo em branco |
| E-mail, webchat, formulário, telefone, interno | ícone do sistema com cor derivada de matiz, igual ao resto da interface               |

A diferença entre marca e ícone neutro também informa: marca é canal de terceiro, ícone do sistema é
canal nosso.

**Exceção documentada à regra de cor.** Marcas de terceiros são o único lugar onde hexadecimal é
permitido — a cor faz parte do glifo e não pode ser tokenizada. Todos os valores vivem em
`apps/web/src/lib/brand-icons.tsx`, e em nenhum outro arquivo. O glifo em branco sobre a cor cheia é
o que garante contraste e é o que as próprias diretrizes de cada plataforma especificam; no uso
monocromático (sem chip), a tinta tem degrau próprio por tema.

É uso nominativo: a marca identifica a origem da conversa. Nada ali sugere endosso ou parceria, e o
canal continua sendo um adaptador (seção 3.2 do plano) — a marca é identificação visual, não
acoplamento de regra de negócio.

`components/flow/node-meta.ts` faz o mesmo para os blocos de fluxo: entrada e mensagem em verde,
lógica em laranja, dados em azul, integração em ciano, IA em roxo, saída em rosa. Caminhos de exceção
— fallback, timeout, falha — são desenhados **tracejados e em amarelo**, para que fluxo de erro não
pareça fluxo normal.
