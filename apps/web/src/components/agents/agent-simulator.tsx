"use client";

import { useRef, useState } from "react";
import type {
  AgentPendingAction,
  AgentTraceStep,
  AgentTurnResult,
  AiAgentVersion,
  Queue,
} from "@elora/core";
import { AGENT_ACTION_LABEL, agentTool, formatTime, offsetIso } from "@elora/core";
import { Badge, Button, Callout, Input, Switch, Textarea, Tooltip, cn } from "@elora/ui";
import {
  ArrowRightLeft,
  Bug,
  CircleAlert,
  CircleCheck,
  Clock,
  CornerDownLeft,
  Loader2,
  RotateCcw,
  Send,
  ShieldAlert,
  Wrench,
} from "lucide-react";

/**
 * Simulador do agente, com rastro.
 *
 * A diferença entre este simulador e o do Chatbot Builder é o que se precisa
 * ver. Num fluxo, a dúvida é "por qual aresta ele saiu" — e a aresta está
 * desenhada na tela. Num agente, a dúvida é "por que ele disse isso", e a
 * resposta não está em lugar nenhum a menos que alguém a registre: qual
 * ferramenta foi chamada, com que parâmetro, o que voltou, quanta confiança ele
 * declarou e quanto custou.
 *
 * Sem esse painel, depurar agente vira troca de adjetivos — "ficou estranho",
 * "melhorou" — e o prompt passa a ser ajustado no escuro.
 */

interface Turn {
  role: "contato" | "agente" | "sistema";
  body: string;
  at: string;
}

const SUGGESTIONS = [
  "Quero abrir uma empresa. O que preciso ter em mãos?",
  "Qual dia vence o DAS do MEI?",
  "Quanto custa a mensalidade de vocês?",
  "Não quero falar com robô, me passa para uma pessoa.",
];

export function AgentSimulator({
  agentId,
  version,
  queues,
  stale,
}: {
  agentId: string;
  version: AiAgentVersion;
  queues: Queue[];
  /** Verdadeiro quando há edição local que o simulador não enxerga. */
  stale: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [steps, setSteps] = useState<AgentTraceStep[]>([]);
  const [pending, setPending] = useState<AgentPendingAction[]>([]);
  const [draft, setDraft] = useState("");
  const [contactName, setContactName] = useState("Rafael Souza");
  const [openHours, setOpenHours] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [spent, setSpent] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queueById = new Map(queues.map((queue) => [queue.id, queue]));

  function reset() {
    setTurns([]);
    setSteps([]);
    setPending([]);
    setError(null);
    setEnded(false);
    setSpent(0);
    setDraft("");
  }

  async function send(text: string) {
    const body = text.trim();
    if (!body || busy || ended) return;

    const mine: Turn = { role: "contato", body, at: offsetIso({}) };
    const history = [...turns, mine];

    setTurns(history);
    setDraft("");
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          versionId: version.id,
          contactName,
          channel: "webchat",
          withinBusinessHours: openHours,
          turnsUsed: turns.filter((turn) => turn.role === "contato").length,
          spentUsdCents: spent,
          messages: history
            .filter((turn) => turn.role !== "sistema")
            .map((turn) => ({ role: turn.role, body: turn.body, at: turn.at })),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(payload?.error?.message ?? "O agente não respondeu.");
        return;
      }

      const result = (await response.json()) as AgentTurnResult;

      setSteps((current) => [...current, ...result.steps]);
      setPending((current) => [...current, ...result.pending]);
      setSpent((current) => current + result.costUsdCents);

      const next: Turn[] = [];
      if (result.reply) {
        next.push({ role: "agente", body: result.reply, at: offsetIso({}) });
      }
      if (result.handoff) {
        const queue = queueById.get(result.handoff.queueId);
        next.push({
          role: "sistema",
          body: `Transferido para ${queue?.name ?? result.handoff.queueId} — ${result.handoff.reason}`,
          at: offsetIso({}),
        });
      }

      setTurns([...history, ...next]);
      setEnded(result.ended);
    } catch {
      setError("Não foi possível falar com o agente.");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {stale ? (
        <Callout variant="warning" title="O simulador roda a versão salva">
          As alterações que você fez nesta tela ainda vivem só no navegador — não existe camada de
          escrita neste protótipo. O teste abaixo usa a versão como está gravada.
        </Callout>
      ) : null}

      {/* Condições do teste ------------------------------------------------ */}
      <div className="bg-card shadow-card rounded-lg p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-40 flex-1 space-y-1">
            <label
              htmlFor="sim-nome"
              className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide"
            >
              Quem está falando
            </label>
            <Input
              id="sim-nome"
              value={contactName}
              className="h-8 text-xs"
              onChange={(event) => setContactName(event.target.value)}
            />
          </div>
          {/**
           * O horário é condição de teste, não detalhe: fora do expediente o
           * agente não pode prometer transferência imediata, e esse é
           * exatamente o comportamento que ninguém lembra de verificar.
           */}
          <label className="flex h-8 items-center gap-2 text-xs">
            <Switch checked={openHours} onCheckedChange={setOpenHours} />
            <Clock className="text-muted-foreground size-3.5" aria-hidden />
            {openHours ? "Dentro do expediente" : "Fora do expediente"}
          </label>
          <Button variant="ghost" size="sm" onClick={reset} disabled={turns.length === 0}>
            <RotateCcw />
            Recomeçar
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 gap-3 xl:grid-cols-2">
        {/* Conversa --------------------------------------------------------- */}
        <div className="bg-card shadow-card flex min-h-96 flex-col rounded-lg">
          <div className="shadow-inset-hairline flex items-center gap-2 px-4 py-2.5">
            <h3 className="text-xs font-semibold">Conversa de teste</h3>
            <Badge variant="neutral">v{version.version}</Badge>
            {spent > 0 ? (
              <span className="text-muted-foreground ml-auto text-[11px] tabular-nums">
                {spent.toFixed(3)}¢ · teto {version.limits.costCeilingCents}¢
              </span>
            ) : null}
          </div>

          <div className="chat-canvas min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
            {turns.length === 0 ? (
              <div className="text-muted-foreground py-6 text-center text-xs">
                <p className="mb-3">Escreva como um cliente escreveria.</p>
                <ul className="mx-auto flex max-w-sm flex-col gap-1.5">
                  {SUGGESTIONS.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        className="bg-card hover:bg-muted w-full rounded-md px-3 py-2 text-left text-[11px] transition-colors"
                        onClick={() => void send(suggestion)}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              turns.map((turn, index) => (
                <div
                  key={`${turn.at}-${index}`}
                  className={cn(
                    "flex",
                    turn.role === "contato" ? "justify-end" : "justify-start",
                    turn.role === "sistema" && "justify-center",
                  )}
                >
                  {turn.role === "sistema" ? (
                    <p className="bg-muted text-muted-foreground flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px]">
                      <ArrowRightLeft className="size-3" aria-hidden />
                      {turn.body}
                    </p>
                  ) : (
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed",
                        turn.role === "contato" ? "bg-chat-out" : "bg-chat-in",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{turn.body}</p>
                      <span className="text-muted-foreground mt-1 block text-[10px]">
                        {formatTime(turn.at)}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}

            {busy ? (
              <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                <Loader2 className="size-3 animate-spin" aria-hidden />O agente está decidindo…
              </p>
            ) : null}
          </div>

          {error ? <p className="text-destructive px-4 pb-2 text-[11px]">{error}</p> : null}

          <div className="border-input border-t p-2">
            <div className="flex items-end gap-2">
              <Textarea
                ref={inputRef}
                rows={2}
                value={draft}
                disabled={busy || ended}
                placeholder={
                  ended
                    ? "A conversa terminou. Recomece para testar de novo."
                    : "Escreva como cliente"
                }
                className="min-h-0 resize-none text-xs"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
              />
              <Button
                size="icon"
                disabled={busy || ended || !draft.trim()}
                aria-label="Enviar mensagem de teste"
                onClick={() => void send(draft)}
              >
                {busy ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </div>
            <p className="text-muted-foreground mt-1 flex items-center gap-1 text-[10px]">
              <CornerDownLeft className="size-2.5" aria-hidden />
              Enter envia · Shift+Enter quebra linha
            </p>
          </div>
        </div>

        {/* Rastro ----------------------------------------------------------- */}
        <div className="bg-card shadow-card flex min-h-96 flex-col rounded-lg">
          <div className="shadow-inset-hairline flex items-center gap-2 px-4 py-2.5">
            <Bug className="text-muted-foreground size-3.5" aria-hidden />
            <h3 className="text-xs font-semibold">Rastro da decisão</h3>
            {steps.length > 0 ? (
              <span className="text-muted-foreground ml-auto text-[11px]">
                {steps.length} passos
              </span>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {steps.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                Cada decisão do agente aparece aqui: a ferramenta pedida, o que voltou, a confiança
                declarada e o custo. É o que permite corrigir o prompt com evidência em vez de
                impressão.
              </p>
            ) : (
              steps.map((step, index) => <TraceCard key={`${step.index}-${index}`} step={step} />)
            )}

            {pending.length > 0 ? (
              <div className="border-warning/40 bg-warning/5 mt-3 rounded-lg border p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold">
                  <ShieldAlert className="text-warning size-3.5" aria-hidden />
                  Esperando confirmação de uma pessoa
                </p>
                <ul className="space-y-2">
                  {pending.map((action) => (
                    <li key={action.id} className="text-[11px]">
                      <p className="font-medium">{action.label}</p>
                      <p className="text-muted-foreground font-mono">
                        {Object.entries(action.params)
                          .map(([name, value]) => `${name}: ${value}`)
                          .join(" · ") || "sem parâmetros"}
                      </p>
                      {action.evidence ? (
                        <p className="text-muted-foreground mt-0.5 italic">“{action.evidence}”</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="text-muted-foreground mt-2 text-[10px] leading-relaxed">
                  Nada disso foi gravado. O agente propõe; quem confirma é uma pessoa no Inbox
                  (seção 16.4).
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const STATUS_META = {
  ok: { icon: CircleCheck, tone: "text-success", label: "executado" },
  recusado: { icon: ShieldAlert, tone: "text-warning", label: "recusado" },
  pendente: { icon: Clock, tone: "text-warning", label: "aguardando confirmação" },
  falha: { icon: CircleAlert, tone: "text-destructive", label: "falhou" },
} as const;

function TraceCard({ step }: { step: AgentTraceStep }) {
  const meta = STATUS_META[step.status];
  const Icon = meta.icon;
  const spec = step.toolId ? agentTool(step.toolId) : undefined;

  return (
    <div className="bg-muted/40 rounded-lg p-2.5">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("size-3.5 shrink-0", meta.tone)} aria-hidden />
        <span className="text-[11px] font-semibold">{AGENT_ACTION_LABEL[step.action]}</span>
        {spec ? (
          <Tooltip content={spec.description}>
            <Badge variant={spec.impact === "escrita" ? "warning" : "neutral"}>
              <Wrench aria-hidden />
              {spec.label}
            </Badge>
          </Tooltip>
        ) : null}
        <span className="text-muted-foreground ml-auto shrink-0 text-[10px] tabular-nums">
          confiança {step.confidence}
        </span>
      </div>

      {step.rationale ? (
        <p className="text-muted-foreground mt-1.5 text-[11px] italic leading-relaxed">
          {step.rationale}
        </p>
      ) : null}

      {step.params && Object.keys(step.params).length > 0 ? (
        <p className="text-muted-foreground mt-1 font-mono text-[10px]">
          {Object.entries(step.params)
            .map(([name, value]) => `${name}: ${value}`)
            .join(" · ")}
        </p>
      ) : null}

      {step.result ? (
        <p className="text-muted-foreground bg-card mt-1.5 max-h-28 overflow-y-auto whitespace-pre-wrap rounded px-2 py-1.5 text-[10px] leading-relaxed">
          {step.result}
        </p>
      ) : null}

      {step.meta ? (
        <p className="text-muted-foreground mt-1.5 text-[10px] tabular-nums">
          {step.meta.model} · {step.meta.inputTokens + step.meta.outputTokens} tokens ·{" "}
          {step.meta.latencyMs} ms · {step.meta.costUsdCents.toFixed(4)}¢ ·{" "}
          {step.meta.promptVersion}
        </p>
      ) : null}
    </div>
  );
}
