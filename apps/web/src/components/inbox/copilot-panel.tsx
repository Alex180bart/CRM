"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  AiConversationAnalysis,
  AiConversationContext,
  AiResolvedProposal,
  AiRunMeta,
  Contact,
} from "@crm/core";
import { AI_SENTIMENT_LABEL, AI_URGENCY_LABEL } from "@crm/core";
import { Badge, Button, Callout, EmptyState, Reveal, Skeleton, Tooltip, cn } from "@crm/ui";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  CornerDownLeft,
  ListChecks,
  Loader2,
  Quote,
  RefreshCw,
  Send,
  Sparkles,
  Tag as TagIcon,
  TriangleAlert,
} from "lucide-react";

import { TabulationPanel } from "./tabulation-panel";
import type { AskTurn, CopilotController } from "./use-copilot";

/**
 * Ligação da tabulação com o estado da conversa.
 *
 * Chega inteira do workspace porque é lá que vivem o contato e as alterações
 * aplicadas. O painel não sabe gravar nada — só desenha e devolve o clique.
 */
export interface TabulationBinding {
  contact?: Contact;
  applied: Record<string, string>;
  dismissed: string[];
  onApply: (resolved: AiResolvedProposal) => void;
  onDismiss: (proposalId: string) => void;
}

/**
 * Painel do copiloto.
 *
 * Ordem deliberada: resumo, sentimento e urgência primeiro, porque é o que
 * permite decidir se esta conversa é a próxima; depois o próximo passo e o
 * checklist, que é o que fazer; e só então os dados extraídos e a conversa livre.
 * Um painel de IA que abre pela caixa de perguntas força o atendente a saber o
 * que perguntar antes de saber o que está acontecendo.
 *
 * Nada é chamado sem clique. A análise fica em cache por conversa e reabrir não
 * gasta de novo — mas mensagem nova marca o resultado como desatualizado, porque
 * resumo velho com aparência de atual é pior que resumo nenhum.
 */
export function CopilotPanel({
  conversationId,
  signature,
  buildContext,
  controller,
  available,
  onUseReply,
  onApplyTag,
  tabulation,
}: {
  conversationId: string | null;
  /** Assinatura curta do estado da conversa — barata de recalcular a cada troca. */
  signature: string;
  /**
   * Monta o contexto completo no momento da chamada.
   *
   * Chega como função, não como valor: montá-lo custa mapear e ordenar todo o
   * histórico, e isso só se paga quando o atendente de fato aciona a IA.
   */
  buildContext: () => AiConversationContext | null;
  controller: CopilotController;
  available: boolean;
  onUseReply: (text: string) => void;
  onApplyTag?: (tag: string) => void;
  tabulation?: TabulationBinding;
}) {
  const { status, error, asking, streamingAnswer, analyze, ask, clearError, stateFor } = controller;
  const { analysis, stale, turns } = stateFor(conversationId, signature);

  const runAnalysis = () => {
    const context = buildContext();
    if (context) void analyze(context);
  };

  const [question, setQuestion] = useState("");
  const answersRef = useRef<HTMLDivElement>(null);

  const loading = status === "carregando";

  // A resposta em fluxo cresce de baixo para cima: sem isto o texto novo
  // aparece fora da vista e o atendente acha que a geração parou.
  useEffect(() => {
    const element = answersRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [streamingAnswer, turns.length]);

  if (!available) {
    return (
      <div className="p-4">
        <Callout variant="neutral" icon={<Sparkles />} title="Copiloto desligado">
          Falta a credencial do provedor de IA no ambiente do servidor (
          <code className="font-mono text-[11px]">GEMINI_API_KEY</code>). O restante do Inbox
          funciona normalmente.
        </Callout>
      </div>
    );
  }

  if (!conversationId) {
    return (
      <EmptyState
        compact
        icon={<Sparkles />}
        title="Nenhuma conversa aberta"
        description="Escolha uma conversa para o copiloto ler o histórico e resumir o caso."
      />
    );
  }

  function submitQuestion() {
    const trimmed = question.trim();
    if (!trimmed || asking) return;
    const context = buildContext();
    if (!context) return;
    setQuestion("");
    void ask(context, trimmed);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Análise ------------------------------------------------------- */}
        {analysis === null ? (
          <div className="p-4">
            {loading ? (
              <AnalysisSkeleton />
            ) : (
              <div className="bg-accent-soft/50 rounded-lg p-4 text-center">
                <span className="bg-surface text-accent-ink shadow-card mx-auto mb-2 flex size-10 items-center justify-center rounded-full">
                  <Sparkles className="size-5" aria-hidden />
                </span>
                <p className="text-sm font-semibold">Copiloto pronto</p>
                <p className="text-muted-foreground mx-auto mt-1 max-w-64 text-[11px] leading-relaxed">
                  Uma chamada devolve resumo, intenção, sentimento, dados do caso, próximo passo,
                  checklist e uma resposta sugerida.
                </p>
                <Button size="sm" variant="accent" className="mt-3" onClick={runAnalysis}>
                  <Sparkles />
                  Analisar conversa
                </Button>
              </div>
            )}

            {status === "erro" && error ? (
              <Callout variant="danger" icon={<AlertTriangle />} className="mt-3">
                {error}
              </Callout>
            ) : null}
          </div>
        ) : (
          <Analysis
            analysis={analysis}
            stale={stale}
            loading={loading}
            onReanalyze={runAnalysis}
            onUseReply={onUseReply}
            onApplyTag={onApplyTag}
            tabulation={tabulation}
          />
        )}

        {/* Conversa com o copiloto -------------------------------------- */}
        <div className="border-border border-t p-3" ref={answersRef}>
          <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
            <Quote className="size-3" aria-hidden />
            Perguntar ao copiloto
          </p>

          {turns.length === 0 && !asking ? (
            <div className="mb-2 flex flex-col gap-1">
              {[
                "Qual a melhor forma de explicar isso ao cliente?",
                "O que eu preciso conferir antes de responder?",
                "Há risco de reclamação aqui?",
              ].map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => {
                    setQuestion("");
                    const context = buildContext();
                    if (context) void ask(context, hint);
                  }}
                  className="bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-2 py-1.5 text-left text-[11px] transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            {turns.map((turn, index) => (
              <Turn key={`${turn.role}_${index}`} turn={turn} />
            ))}

            {asking ? (
              <div className="bg-accent-soft/50 rounded-lg px-2.5 py-2">
                {streamingAnswer ? (
                  <MarkdownText text={streamingAnswer} className="text-xs" />
                ) : (
                  <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                    <span className="flex gap-0.5" aria-hidden>
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="animate-typing-dot bg-accent-ink size-1.5 rounded-full"
                          style={{ animationDelay: `${dot * 140}ms` }}
                        />
                      ))}
                    </span>
                    Lendo a conversa
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {error && status !== "erro" ? (
            <Callout variant="danger" icon={<AlertTriangle />} className="mt-2">
              <span className="flex items-start justify-between gap-2">
                {error}
                <button
                  type="button"
                  onClick={clearError}
                  className="shrink-0 font-medium underline-offset-2 hover:underline"
                >
                  ok
                </button>
              </span>
            </Callout>
          ) : null}

          <div className="mt-2 flex items-end gap-1.5">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitQuestion();
                }
              }}
              rows={2}
              placeholder="Pergunte sobre este atendimento…"
              aria-label="Pergunta ao copiloto"
              className="border-input bg-surface placeholder:text-muted-foreground/70 focus:border-accent focus:ring-accent/25 min-h-[3.25rem] flex-1 resize-none rounded-md border px-2.5 py-2 text-xs leading-relaxed focus:outline-none focus:ring-2"
            />
            <Button
              size="icon-sm"
              variant="accent"
              onClick={submitQuestion}
              disabled={asking || question.trim().length === 0}
              aria-label="Enviar pergunta"
            >
              {asking ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </div>
          <p className="text-muted-foreground mt-1 text-[10px]">
            Enter envia · Shift + Enter quebra linha. O cliente não vê nada daqui.
          </p>
        </div>
      </div>
    </div>
  );
}

/* Análise ------------------------------------------------------------------- */

const SENTIMENT_TONE = {
  positivo: "success",
  neutro: "neutral",
  impaciente: "warning",
  irritado: "danger",
} as const;

const URGENCY_TONE = {
  baixa: "neutral",
  normal: "info",
  alta: "warning",
  critica: "danger",
} as const;

function Analysis({
  analysis,
  stale,
  loading,
  onReanalyze,
  onUseReply,
  onApplyTag,
  tabulation,
}: {
  analysis: AiConversationAnalysis;
  stale: boolean;
  loading: boolean;
  onReanalyze: () => void;
  onUseReply: (text: string) => void;
  onApplyTag?: (tag: string) => void;
  tabulation?: TabulationBinding;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  return (
    <div className="p-3">
      {stale ? (
        <Callout variant="warning" icon={<RefreshCw />} className="mb-3">
          <span className="flex items-center justify-between gap-2">
            Chegou mensagem nova depois desta análise.
            <Button size="xs" variant="outline" onClick={onReanalyze} loading={loading}>
              Reanalisar
            </Button>
          </span>
        </Callout>
      ) : null}

      <Reveal index={0} className="space-y-3">
        {/* Resumo ------------------------------------------------------- */}
        <section>
          <SectionLabel>
            Resumo
            <Tooltip content="Gerar novamente">
              <button
                type="button"
                onClick={onReanalyze}
                disabled={loading}
                aria-label="Analisar novamente"
                className="text-muted-foreground hover:bg-muted hover:text-foreground ml-auto rounded p-0.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("size-3", loading && "animate-spin")} aria-hidden />
              </button>
            </Tooltip>
          </SectionLabel>
          <p className="text-foreground text-xs leading-relaxed">{analysis.summary}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1">
            <Badge variant="primary">{analysis.intent}</Badge>
            <Badge variant={SENTIMENT_TONE[analysis.sentiment]}>
              {AI_SENTIMENT_LABEL[analysis.sentiment]}
            </Badge>
            <Badge variant={URGENCY_TONE[analysis.urgency]}>
              urgência {AI_URGENCY_LABEL[analysis.urgency].toLowerCase()}
            </Badge>
          </div>
        </section>

        {/* Próximo passo ------------------------------------------------ */}
        <section className="bg-accent-soft/60 rounded-lg p-2.5">
          <p className="text-accent-ink mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
            <CornerDownLeft className="size-3" aria-hidden />
            Próximo passo
          </p>
          <p className="text-foreground text-xs font-medium leading-relaxed">{analysis.nextStep}</p>
        </section>

        {/* Checklist ---------------------------------------------------- */}
        {analysis.checklist.length > 0 ? (
          <section>
            <SectionLabel>
              <ListChecks className="size-3" aria-hidden />
              Checklist
            </SectionLabel>
            <ul className="space-y-1">
              {analysis.checklist.map((item, index) => {
                const key = `${index}_${item.label}`;
                // O modelo marca o que a conversa já mostra ter sido feito; o
                // atendente marca o resto. A marcação é da sessão, não some ao
                // trocar de aba, mas também não se confunde com dado persistido.
                const done = checked[key] ?? item.done;

                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setChecked((current) => ({ ...current, [key]: !done }))}
                      className="hover:bg-muted/60 flex w-full items-start gap-2 rounded-md px-1 py-1 text-left transition-colors"
                    >
                      <span
                        className={cn(
                          "mt-px flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                          done
                            ? "border-success bg-success text-success-foreground"
                            : "border-input",
                        )}
                        aria-hidden
                      >
                        {done ? <Check className="size-3" strokeWidth={3} /> : null}
                      </span>
                      <span
                        className={cn(
                          "text-xs leading-relaxed",
                          done ? "text-muted-foreground line-through" : "text-foreground",
                        )}
                      >
                        {item.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* Resposta sugerida ------------------------------------------- */}
        <section>
          <SectionLabel>Resposta sugerida</SectionLabel>
          <div className="bg-muted/60 rounded-lg p-2.5">
            <p className="text-foreground whitespace-pre-wrap text-xs leading-relaxed">
              {analysis.suggestedReply}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <Button
                size="xs"
                variant="accent"
                onClick={() => onUseReply(analysis.suggestedReply)}
              >
                <CornerDownLeft />
                Levar ao compositor
              </Button>
              <CopyButton text={analysis.suggestedReply} />
            </div>
          </div>
        </section>

        {/* Tabulação ---------------------------------------------------
            Vem antes dos dados extraídos de propósito: "dados do caso" é
            leitura, tabulação é trabalho pendente. O que exige ação fica
            acima do que só informa. */}
        {tabulation ? (
          <TabulationPanel
            proposals={analysis.proposals}
            contact={tabulation.contact}
            applied={tabulation.applied}
            dismissed={tabulation.dismissed}
            onApply={tabulation.onApply}
            onDismiss={tabulation.onDismiss}
          />
        ) : null}

        {/* Dados extraídos --------------------------------------------- */}
        {analysis.extracted.length > 0 ? (
          <section>
            <SectionLabel>Dados do caso</SectionLabel>
            <dl className="space-y-1">
              {analysis.extracted.map((field, index) => (
                <ExtractedRow key={`${field.label}_${index}`} field={field} />
              ))}
            </dl>
          </section>
        ) : null}

        {/* O que falta ------------------------------------------------- */}
        {analysis.openQuestions.length > 0 ? (
          <section>
            <SectionLabel>
              <TriangleAlert className="size-3" aria-hidden />O copiloto não resolve
            </SectionLabel>
            <ul className="space-y-1">
              {analysis.openQuestions.map((item, index) => (
                <li
                  key={index}
                  className="bg-warning-soft/60 text-foreground rounded-md px-2 py-1.5 text-[11px] leading-relaxed"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Tags sugeridas ---------------------------------------------- */}
        {analysis.suggestedTags.length > 0 ? (
          <section>
            <SectionLabel>
              <TagIcon className="size-3" aria-hidden />
              Assuntos sugeridos
            </SectionLabel>
            <div className="flex flex-wrap gap-1">
              {analysis.suggestedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onApplyTag?.(tag)}
                  disabled={!onApplyTag}
                  className="bg-muted text-muted-foreground enabled:hover:bg-primary-soft enabled:hover:text-primary inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground mt-1 text-[10px]">
              Proposta do modelo. A aplicação é sempre do atendente.
            </p>
          </section>
        ) : null}

        <RunFooter meta={analysis.meta} />
      </Reveal>
    </div>
  );
}

function ExtractedRow({ field }: { field: AiConversationAnalysis["extracted"][number] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-muted/50 rounded-md px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <dt className="text-muted-foreground shrink-0 text-[11px]">{field.label}</dt>
        <dd className="min-w-0 truncate text-right text-[11px] font-medium">{field.value}</dd>
      </div>
      {field.evidence ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="text-muted-foreground hover:text-foreground mt-0.5 flex items-center gap-1 text-[10px]"
          >
            <ChevronDown className={cn("size-2.5 transition-transform", open && "rotate-180")} />
            de onde veio
          </button>
          {open ? (
            <p className="animate-fade-up border-chat-quote text-muted-foreground mt-1 border-l-2 pl-2 text-[10px] italic leading-relaxed">
              “{field.evidence}”
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/**
 * Rodapé de execução.
 *
 * Modelo, latência, tokens e custo ficam visíveis porque a seção 16.4 do plano
 * cobra essas métricas — e porque um copiloto cujo custo ninguém vê é um
 * copiloto que ninguém otimiza. Discreto, mas presente.
 */
function RunFooter({ meta }: { meta: AiRunMeta }) {
  return (
    <div className="border-border text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t pt-2 text-[10px]">
      <span className="font-medium">{meta.model}</span>
      <span aria-hidden>·</span>
      <span className="tabular-nums">{(meta.latencyMs / 1000).toFixed(1)} s</span>
      <span aria-hidden>·</span>
      <span className="tabular-nums">{meta.inputTokens + meta.outputTokens} tokens</span>
      <span aria-hidden>·</span>
      <Tooltip content="Custo estimado desta execução, em centavos de dólar">
        <span className="tabular-nums">US$ {(meta.costUsdCents / 100).toFixed(4)}</span>
      </Tooltip>
      {meta.repaired ? (
        <Tooltip content="A primeira resposta não passou na validação e foi refeita.">
          <Badge variant="warning" className="h-4 px-1 text-[9px]">
            reparada
          </Badge>
        </Tooltip>
      ) : null}
      <span className="ml-auto font-mono">{meta.promptVersion}</span>
    </div>
  );
}

function Turn({ turn }: { turn: AskTurn }) {
  if (turn.role === "atendente") {
    return (
      <div className="bg-primary-soft ml-4 rounded-lg px-2.5 py-1.5">
        <p className="text-primary text-xs leading-relaxed">{turn.body}</p>
      </div>
    );
  }

  return (
    <div className="bg-accent-soft/50 rounded-lg px-2.5 py-2">
      <MarkdownText text={turn.body} className="text-xs" />
      <div className="mt-1.5 flex items-center gap-1.5">
        <CopyButton text={turn.body} />
        {turn.meta ? (
          <span className="text-muted-foreground ml-auto text-[10px] tabular-nums">
            {(turn.meta.latencyMs / 1000).toFixed(1)} s · US${" "}
            {(turn.meta.costUsdCents / 100).toFixed(4)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      size="xs"
      variant="ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        } catch {
          // Área de transferência bloqueada: nada a fazer numa ação secundária.
        }
      }}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
      {copied ? "Copiado" : "Copiar"}
    </Button>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
      {children}
    </p>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="ai-thinking animate-ai-sweep space-y-3 rounded-lg p-1">
      <div className="space-y-1.5">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-4/6" />
      </div>
      <div className="flex gap-1">
        <Skeleton className="h-5 w-24 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-md" />
      </div>
      <Skeleton className="h-14 w-full rounded-lg" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <p className="text-muted-foreground pt-1 text-center text-[11px]">
        Lendo a conversa e montando a análise…
      </p>
    </div>
  );
}

/**
 * Renderizador mínimo de Markdown.
 *
 * O modelo devolve `**negrito**` e listas com `-` ou `1.` mesmo instruído a não
 * formatar — e um asterisco cru no meio da frase parece defeito. Trata-se só
 * disso: negrito, código curto e itens de lista. Não é um parser de Markdown, e
 * não deve virar um: HTML arbitrário vindo de modelo não entra nesta tela.
 */
function MarkdownText({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/);

  return (
    <div className={cn("text-foreground space-y-1.5 leading-relaxed", className)}>
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").filter((line) => line.trim().length > 0);
        const bulleted =
          lines.length > 0 && lines.every((line) => /^\s*([-*•]|\d+[.)])\s/.test(line));

        if (bulleted) {
          return (
            <ul key={blockIndex} className="ml-3.5 list-disc space-y-0.5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{inline(line.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</li>
              ))}
            </ul>
          );
        }

        return <p key={blockIndex}>{inline(block)}</p>;
      })}
    </div>
  );
}

function inline(text: string): ReactNode[] {
  // Divide preservando os delimitadores para reconstruir com marcação segura.
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((piece, index) => {
    if (piece.startsWith("**") && piece.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold">
          {piece.slice(2, -2)}
        </strong>
      );
    }
    if (piece.startsWith("`") && piece.endsWith("`") && piece.length > 2) {
      return (
        <code key={index} className="bg-muted rounded px-1 font-mono text-[0.95em]">
          {piece.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{piece}</span>;
  });
}
