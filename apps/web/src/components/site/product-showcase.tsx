"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@elora/ui";
import {
  BarChart3,
  Bot,
  Building2,
  GitBranch,
  Inbox,
  Megaphone,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import {
  AgentPreview,
  AnalyticsPreview,
  AutomationPreview,
  CampaignPreview,
  ChatbotPreview,
  ContactPreview,
  PipelinePreview,
} from "./module-previews";
import { ProductPreview } from "./product-preview";

/**
 * A galeria de telas do produto.
 *
 * ## Por que abas, e não uma pilha de imagens
 *
 * Oito telas empilhadas viram seis rolagens de página que ninguém percorre até
 * o fim — e as últimas, que costumam ser as mais decisivas na venda (campanha e
 * agente), nunca são vistas. Em abas, todas ficam a um clique da primeira dobra
 * da seção, e quem quer só o Inbox não paga o pedágio das outras.
 *
 * ## O que cada aba precisa carregar junto
 *
 * O título da tela não basta: "Pipeline" não diz nada a quem nunca usou CRM. Ao
 * lado de cada prévia vai **a frase do que aquela tela resolve** e três fatos
 * verificáveis. É o que transforma imagem em argumento.
 *
 * ## Nenhuma aba é montada antes de ser aberta
 *
 * O Radix desmonta o painel inativo, então as sete prévias não abertas não
 * custam DOM nem estilo. Isso importa aqui mais que no produto: esta é a página
 * que abre em rede de celular, e o recálculo de estilo é o gargalo medido deste
 * front — não o JavaScript.
 *
 * A desmontagem tem um efeito colateral que aqui é **desejado**: as animações de
 * entrada de cada prévia rodam de novo a cada vez que a aba é aberta. Quem volta
 * ao Pipeline vê o negócio mudar de etapa outra vez, em vez de encontrar uma
 * tela parada que já animou uma vez e nunca mais.
 */

interface Module {
  key: string;
  label: string;
  icon: LucideIcon;
  headline: string;
  body: string;
  facts: string[];
  preview: React.ReactNode;
}

const MODULES: Module[] = [
  {
    key: "inbox",
    label: "Inbox",
    icon: Inbox,
    headline: "Uma fila, todos os canais, um relógio só",
    body: "WhatsApp, e-mail, Instagram, Messenger e webchat chegam na mesma lista, com responsável, fila, SLA e histórico do contato ao lado da conversa. O copiloto lê o que já aconteceu e propõe o que gravar.",
    facts: [
      "SLA de primeira resposta e de resolução por política de fila",
      "Nota interna com menção, sem sair da conversa",
      "Tabulação proposta pela IA e gravada por clique de gente",
    ],
    preview: <ProductPreview />,
  },
  {
    key: "pipeline",
    label: "Pipeline",
    icon: Building2,
    headline: "O funil que mostra o que está parado, não só o que está aberto",
    body: "Vários pipelines por processo, com etapa, probabilidade, valor ponderado e tempo máximo por etapa. Cartão parado além do limite aparece marcado — antes de o gestor perguntar.",
    facts: [
      "Valor ponderado pela probabilidade de cada etapa",
      "Alerta de negócio parado por tempo de permanência",
      "Motivo de perda obrigatório, para o relatório fazer sentido",
    ],
    preview: <PipelinePreview />,
  },
  {
    key: "contato",
    label: "Contato 360º",
    icon: Sparkles,
    headline: "Tudo que aconteceu com a pessoa, em ordem",
    body: "Mensagem, negócio, campanha, consentimento e automação na mesma linha do tempo — derivada dos eventos de domínio, não digitada à mão. A resolução de identidade junta telefone, e-mail e identificador de canal no mesmo cadastro.",
    facts: [
      "Duplicidade suspeita sinalizada, com mesclagem sob revisão",
      "Consentimento por finalidade, com base legal e versão do texto",
      "Campo sensível existe, e a IA só sabe que ele está preenchido",
    ],
    preview: <ContactPreview />,
  },
  {
    key: "chatbot",
    label: "Chatbot",
    icon: GitBranch,
    headline: "O fluxo que você aprova é o fluxo que o visitante recebe",
    body: "Construtor visual de nós e arestas, com validação antes de publicar e versão publicada imutável. O simulador do editor e o webchat em produção rodam o mesmo motor — não há duas implementações para divergirem.",
    facts: [
      "Validação recusa caminho sem fim e nó órfão",
      "Variáveis do formulário entram preenchidas — o bot não repergunta o nome",
      "Transferência para humano leva o resumo do que já foi dito",
    ],
    preview: <ChatbotPreview />,
  },
  {
    key: "automacoes",
    label: "Automações",
    icon: Workflow,
    headline: "Aconteceu isto, confira aquilo, faça isso — e acabou",
    body: "Regra com gatilho por evento de domínio, condição sobre o cadastro e ações com atraso opcional. Cada execução fica registrada com o que disparou, o que bateu e o que rodou — inclusive quando a condição não bateu e nada aconteceu.",
    facts: [
      "Gatilho é evento de domínio, não varredura periódica da base",
      "Histórico por execução: dá para responder 'por que ele recebeu isso?'",
      "Acompanhamento por semanas é jornada, com estado próprio por participante",
    ],
    preview: <AutomationPreview />,
  },
  {
    key: "campanhas",
    label: "Campanhas",
    icon: Megaphone,
    headline: "Disparo em massa com freio de mão",
    body: "Segmento dinâmico recalculado no disparo, envio em lotes com vazão configurada e aprovação obrigatória acima de um tamanho de público. Cada contato excluído do envio aparece com o motivo.",
    facts: [
      "Janela silenciosa e limite de frequência aplicados por padrão",
      "Cancelamento automático acima da taxa de erro configurada",
      "Custo por campanha calculado com o repasse do provedor à parte",
    ],
    preview: <CampaignPreview />,
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: BarChart3,
    headline: "Número com definição escrita, não painel bonito",
    body: "SLA por fila, volume por canal, resolução por IA e custo por atendimento — cada métrica com a fórmula registrada no dicionário. Painel que ninguém sabe explicar vira discussão sobre o painel, não sobre a operação.",
    facts: [
      "Custo por atendimento com o repasse do provedor separado da assinatura",
      "Séries por hora, para enxergar o pico onde a fila estoura",
      "Fila de atenção: o que precisa de gente agora, não o retrato do mês",
    ],
    preview: <AnalyticsPreview />,
  },
  {
    key: "agente",
    label: "Agente de IA",
    icon: Bot,
    headline: "Autonomia com a fronteira desenhada na tela",
    body: "Ferramenta de leitura o agente executa; ferramenta de escrita vira pendência com o parâmetro à vista de quem confirma. Cada passo é registrado com decisão, confiança, custo e versão do prompt.",
    facts: [
      "Allowlist de ferramentas por versão do agente",
      "Piso de confiança e teto de custo conferidos pela aplicação",
      "Conjunto de avaliação executável, com nota por dimensão",
    ],
    preview: <AgentPreview />,
  },
];

export function ProductShowcase() {
  const [active, setActive] = React.useState(MODULES[0].key);
  const current = MODULES.find((module) => module.key === active) ?? MODULES[0];
  const listRef = React.useRef<HTMLDivElement>(null);

  /**
   * A aba escolhida vai para o centro do trilho.
   *
   * O repositório manda evitar `scrollIntoView` — ele força um passe síncrono de
   * layout — e a regra escrita lá é "só quando a seleção veio do teclado, porque
   * num clique o item já estava visível". Num trilho horizontal a segunda metade
   * dessa frase deixa de valer: o item clicado costuma estar **na borda**, meio
   * cortado, e é justamente por isso que o dedo o alcançou por último.
   *
   * Sem isto, tocar na última aba visível deixa a seleção encostada na margem e
   * as próximas escondidas — a pessoa não descobre que existem oito. O custo é
   * um layout por toque de aba, que é raro por definição.
   */
  function selecionar(key: string) {
    setActive(key);
    const alvo = listRef.current?.querySelector<HTMLElement>(`[data-value="${key}"]`);
    alvo?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  return (
    <Tabs value={active} onValueChange={selecionar}>
      {/*
        No celular as abas viram trilho; a partir de `md` voltam a ser uma fila
        que quebra em linhas.

        Oito abas em 390 px ocupavam **quatro linhas** e 180 px de altura antes
        de a primeira prévia aparecer — a seção inteira começava com um bloco de
        rótulos que se lê como sumário, não como controle. Em trilho, elas
        ocupam uma linha e o corte no meio do último item visível é o que diz
        "há mais para o lado", que é a única affordance que um carrossel tem.

        O sangramento (`-mx-4` com `px-4` de volta) faz o trilho encostar na
        borda da tela mantendo o primeiro item alinhado ao texto da seção. Sem
        ele, o item cortado morreria numa margem branca e pareceria erro de
        layout em vez de continuação.
      */}
      <TabsList
        ref={listRef}
        className="rail rail-snap -mx-4 w-[calc(100%+2rem)] gap-1 px-4 md:mx-0 md:w-full md:snap-none md:flex-wrap md:justify-start md:overflow-visible md:px-0"
      >
        {MODULES.map((module) => (
          <TabsTrigger
            key={module.key}
            value={module.key}
            data-value={module.key}
            className="shrink-0 gap-1.5 whitespace-nowrap"
          >
            <module.icon className="size-3.5" aria-hidden />
            {module.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/*
        A coluna de texto tem largura fixa e a prévia fica com o resto.
        
        Com duas frações (`1fr 1.35fr`), a prévia recebia ~650 px em 1440 e o
        painel do copiloto do Inbox era cortado na borda — item de grade nasce
        com `min-width: auto`, então o corte acontecia **dentro** do cartão, sem
        rolagem horizontal na página para denunciar. Largura fixa à esquerda
        resolve na origem: a prévia sempre sabe com quanto pode contar.
      */}
      {/*
        No celular a prévia sobe para cima do texto.

        A ordem da leitura em duas colunas é texto → imagem, porque os dois
        chegam ao olho juntos. Empilhado, não: com o texto primeiro, tocar numa
        aba muda algo que está **abaixo da dobra**, e o gesto parece não ter
        feito nada. Com a prévia colada nas abas, o resultado do toque acontece
        onde o dedo acabou de sair.
      */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* O texto fica fora do painel de aba de propósito: trocar de aba não
            deve remontar a coluna inteira, só a prévia. */}
        <div className="order-2 min-w-0 lg:order-none lg:pt-4">
          <h3 className="font-display text-xl font-semibold leading-snug tracking-tight md:text-2xl">
            {current.headline}
          </h3>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{current.body}</p>

          <ul className="mt-5 space-y-2.5">
            {current.facts.map((fact) => (
              <li key={fact} className="flex gap-2.5 text-sm leading-snug">
                <span className="bg-accent mt-1.5 size-1.5 shrink-0 rounded-full" aria-hidden />
                <span className="text-muted-foreground">{fact}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="order-1 min-w-0 lg:order-none">
          {MODULES.map((module) => (
            <TabsContent
              key={module.key}
              value={module.key}
              className={cn("m-0 focus-visible:outline-none")}
            >
              {module.preview}
            </TabsContent>
          ))}
        </div>
      </div>
    </Tabs>
  );
}
