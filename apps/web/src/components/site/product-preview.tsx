import { cn } from "@elora/ui";
import { Bot, CheckCheck, Clock3, Sparkles, Users } from "lucide-react";

/**
 * A janela de produto do herói.
 *
 * ## Por que é desenho, e não captura de tela
 *
 * Três motivos, e nenhum é estético. Captura envelhece — a primeira mudança de
 * espaçamento no Inbox deixa a landing page mostrando uma versão que não existe
 * mais. Captura não acompanha o tema: num visitante em modo escuro, um PNG claro
 * vira retângulo branco no meio da página. E captura não anima: aqui as bolhas
 * entram em sequência, que é o que comunica "isto é uma conversa acontecendo"
 * em vez de "isto é uma imagem de uma conversa".
 *
 * O custo é conhecido e aceito: este arquivo precisa ser revisto quando o Inbox
 * mudar de forma. É o mesmo compromisso do `widget-preview.tsx`, e pelo mesmo
 * motivo — a prévia é o produto para quem ainda não entrou.
 *
 * ## Cores
 *
 * Tudo sai de token, inclusive as bolhas: `--chat-in` e `--chat-out` são as
 * mesmas do Inbox de verdade. A diferença em relação ao `widget-preview` é
 * justamente essa — lá a prévia mostra como o widget fica **no site do cliente**,
 * onde nossos tokens não existem; aqui a prévia mostra o nosso produto, no nosso
 * domínio, e usar token é o que mantém as duas telas iguais.
 */

interface Bubble {
  from: "contato" | "agente" | "bot";
  author: string;
  body: string;
  time: string;
  status?: "entregue" | "lida";
}

const BUBBLES: Bubble[] = [
  {
    from: "contato",
    author: "Aline Castilho",
    body: "Oi! Meu pedido 248-9910 está parado no rastreio desde sexta.",
    time: "14:02",
  },
  {
    from: "bot",
    author: "Agente de IA",
    body: "Localizei o pedido: retido em Cajamar, com reentrega registrada para amanhã.",
    time: "14:02",
    status: "entregue",
  },
  {
    from: "contato",
    author: "Aline Castilho",
    body: "Amanhã não tem ninguém em casa. Consigo mudar o endereço?",
    time: "14:03",
  },
  {
    from: "agente",
    author: "Priscila",
    body: "Consigo sim, Aline. Vou trocar para o endereço comercial e confirmo em 10 minutos.",
    time: "14:04",
    status: "lida",
  },
];

function Bubble({ bubble, index }: { bubble: Bubble; index: number }) {
  const incoming = bubble.from === "contato";

  return (
    <div
      className={cn("bubble-in flex", incoming ? "justify-start" : "justify-end")}
      style={{ ["--bubble-index" as string]: index }}
    >
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-3 py-2 text-[13px] leading-snug shadow-sm",
          incoming
            ? "bg-chat-in text-chat-in-foreground rounded-bl-sm"
            : "bg-chat-out text-chat-out-foreground rounded-br-sm",
        )}
      >
        {bubble.from === "bot" ? (
          <span className="text-accent-ink mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
            <Bot className="size-3" aria-hidden />
            {bubble.author}
          </span>
        ) : null}
        <p>{bubble.body}</p>
        <span className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-60">
          {bubble.time}
          {bubble.status ? <CheckCheck className="size-3" aria-hidden /> : null}
        </span>
      </div>
    </div>
  );
}

export function ProductPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "border-border/60 bg-surface shadow-overlay overflow-hidden rounded-2xl border",
        className,
      )}
      role="img"
      aria-label="Prévia do Inbox da Elora: conversa de WhatsApp com agente de IA e atendente, painel de SLA e proposta de tabulação."
    >
      {/* Barra do navegador — dá a escala de "isto é um aplicativo web". */}
      <div className="border-border bg-surface-sunken flex items-center gap-2 border-b px-3 py-2">
        <span className="flex gap-1.5">
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
          <span className="bg-muted-foreground/25 size-2.5 rounded-full" />
        </span>
        <span className="bg-surface border-border text-muted-foreground ml-2 flex-1 truncate rounded-md border px-2 py-1 text-[11px]">
          app.elora.com.br/inbox
        </span>
      </div>

      <div className="grid lg:grid-cols-[168px_minmax(0,1fr)] xl:grid-cols-[168px_minmax(0,1fr)_190px]">
        {/* Filas */}
        <aside className="border-border bg-surface-sunken hidden border-r p-3 lg:block">
          <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
            Filas
          </p>
          <ul className="mt-2 space-y-1">
            {[
              { name: "Pedidos e rastreio", count: 24, active: true },
              { name: "Trocas e devoluções", count: 9 },
              { name: "Atacado", count: 3 },
              { name: "Procon", count: 1 },
            ].map((queue) => (
              <li
                key={queue.name}
                className={cn(
                  "flex items-center justify-between rounded-lg px-2 py-1.5 text-[11px]",
                  queue.active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                <span className="truncate">{queue.name}</span>
                <span className="figure ml-2 shrink-0 text-[10px]">{queue.count}</span>
              </li>
            ))}
          </ul>

          <p className="text-muted-foreground mt-5 text-[10px] font-semibold uppercase tracking-wide">
            Time
          </p>
          <div className="mt-2 space-y-1.5">
            {[
              { name: "Priscila A.", load: "3/5" },
              { name: "Caio S.", load: "7/12" },
              { name: "Nina O.", load: "10/10" },
            ].map((person) => (
              <div key={person.name} className="flex items-center gap-1.5 text-[11px]">
                <Users className="text-muted-foreground size-3" aria-hidden />
                <span className="text-foreground flex-1 truncate">{person.name}</span>
                <span className="figure text-muted-foreground">{person.load}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Conversa */}
        <div className="flex min-h-[320px] min-w-0 flex-col">
          <div className="border-border flex items-center gap-2 border-b px-4 py-2.5">
            <span className="bg-accent-soft text-accent-ink flex size-7 items-center justify-center rounded-full text-[11px] font-semibold">
              AC
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">Aline Castilho</p>
              <p className="text-muted-foreground truncate text-[10px]">
                WhatsApp · Pedidos e rastreio · cliente desde 2025
              </p>
            </div>
            <span className="bg-warning-soft text-warning inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
              <Clock3 className="size-3" aria-hidden />
              SLA 4 min
            </span>
          </div>

          <div className="chat-canvas flex-1 space-y-2 px-4 py-4">
            {BUBBLES.map((bubble, index) => (
              <Bubble key={bubble.body} bubble={bubble} index={index} />
            ))}
          </div>

          <div className="border-border border-t p-3">
            <div className="border-input text-muted-foreground rounded-lg border px-3 py-2 text-[11px]">
              Escreva a resposta ou use{" "}
              <span className="text-foreground font-medium">/rastreio</span>…
            </div>
          </div>
        </div>

        {/* Painel de IA */}
        <aside className="border-border hidden border-l p-3 xl:block">
          <p className="text-accent-ink flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
            <Sparkles className="size-3" aria-hidden />
            Copiloto
          </p>
          <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
            Cliente recorrente, 11 pedidos no ano. Pedido retido na transportadora. Intenção:
            alteração de endereço de entrega.
          </p>

          <div className="border-border bg-surface-sunken mt-3 rounded-lg border p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide">Tabulação proposta</p>
            <ul className="mt-1.5 space-y-1.5 text-[11px]">
              <li className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground truncate">Endereço alternativo</span>
                <span className="bg-success-soft text-success shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
                  novo
                </span>
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground truncate">Retorno até 14:15</span>
                <span className="bg-info-soft text-info shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium">
                  tarefa
                </span>
              </li>
            </ul>
          </div>

          <p className="text-muted-foreground mt-3 text-[10px] leading-relaxed">
            A IA propõe. A gravação continua sendo clique de gente.
          </p>
        </aside>
      </div>
    </div>
  );
}
