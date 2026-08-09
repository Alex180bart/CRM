"use client";

import { useEffect, useRef, useState } from "react";
import type { FlowPort } from "@elora/core";
import { Badge, Button, Input, KeyValue, Separator, cn } from "@elora/ui";
import { Bot, Play, RotateCcw, Send, TerminalSquare, User } from "lucide-react";

import type { SimulatorEntry, SimulatorStatus } from "./use-simulator";

const STATUS_LABEL: Record<SimulatorStatus, string> = {
  parado: "Parado",
  executando: "Executando",
  aguardando: "Aguardando resposta",
  encerrado: "Encerrado",
  limite: "Interrompido pelo limite",
};

const STATUS_TONE: Record<SimulatorStatus, "neutral" | "info" | "warning" | "success" | "danger"> =
  {
    parado: "neutral",
    executando: "info",
    aguardando: "warning",
    encerrado: "success",
    limite: "danger",
  };

export function SimulatorPanel({
  entries,
  status,
  awaiting,
  variables,
  steps,
  maxSteps,
  onStart,
  onAnswer,
  onReset,
  onClose,
}: {
  entries: SimulatorEntry[];
  status: SimulatorStatus;
  awaiting: { nodeId: string; options: FlowPort[]; freeText: boolean } | null;
  variables: Record<string, string>;
  steps: number;
  maxSteps: number;
  onStart: () => void;
  onAnswer: (text: string, portId?: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [entries.length]);

  return (
    <aside className="border-border bg-surface flex w-80 shrink-0 flex-col border-l">
      <div className="border-border flex items-center gap-2 border-b px-3 py-2">
        <TerminalSquare className="text-muted-foreground size-4" aria-hidden />
        <span className="text-xs font-semibold">Simulador</span>
        <Badge variant={STATUS_TONE[status]} className="ml-auto">
          {STATUS_LABEL[status]}
        </Badge>
        <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Fechar simulador">
          ×
        </Button>
      </div>

      <div className="border-border flex items-center gap-1.5 border-b px-3 py-2">
        <Button size="xs" variant="accent" onClick={onStart} disabled={status === "aguardando"}>
          <Play />
          {entries.length === 0 ? "Iniciar" : "Reiniciar"}
        </Button>
        <Button size="xs" variant="ghost" onClick={onReset} disabled={entries.length === 0}>
          <RotateCcw />
          Limpar
        </Button>
        <span className="text-muted-foreground ml-auto text-[11px] tabular-nums">
          {steps}/{maxSteps} passos
        </span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {entries.length === 0 ? (
          <p className="text-muted-foreground px-2 py-8 text-center text-[11px] leading-relaxed">
            Inicie a simulação para percorrer o fluxo bloco a bloco, inspecionar variáveis e ver
            qual caminho seria seguido em produção.
          </p>
        ) : (
          entries.map((entry) => {
            if (entry.role === "sistema") {
              return (
                <div
                  key={entry.id}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-[11px] leading-relaxed",
                    entry.tone === "alerta"
                      ? "border-warning/30 bg-warning-soft"
                      : entry.tone === "sucesso"
                        ? "border-success/25 bg-success-soft"
                        : "border-border bg-muted",
                  )}
                >
                  <p className="text-foreground font-medium">{entry.text}</p>
                  {entry.detail ? (
                    <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                      {entry.detail}
                    </p>
                  ) : null}
                </div>
              );
            }

            const fromBot = entry.role === "bot";
            return (
              <div
                key={entry.id}
                className={cn("flex gap-2", fromBot ? "justify-start" : "justify-end")}
              >
                {fromBot ? (
                  <Bot className="text-muted-foreground mt-1.5 size-3.5 shrink-0" aria-hidden />
                ) : null}
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed",
                    fromBot
                      ? "border-border bg-card rounded-tl-sm border"
                      : "bg-primary text-primary-foreground rounded-tr-sm",
                  )}
                >
                  <p className="whitespace-pre-wrap">{entry.text}</p>
                  {entry.detail ? (
                    <p className="mt-1 text-[10px] opacity-70">{entry.detail}</p>
                  ) : null}
                </div>
                {fromBot ? null : (
                  <User className="text-muted-foreground mt-1.5 size-3.5 shrink-0" aria-hidden />
                )}
              </div>
            );
          })
        )}
      </div>

      {awaiting ? (
        <div className="border-border space-y-2 border-t p-3">
          {awaiting.options.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {awaiting.options.map((port) => (
                <Button
                  key={port.id}
                  size="xs"
                  variant="outline"
                  onClick={() => onAnswer(port.label, port.id)}
                >
                  {port.label}
                </Button>
              ))}
            </div>
          ) : (
            <form
              className="flex gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                if (!draft.trim()) return;
                onAnswer(draft.trim());
                setDraft("");
              }}
            >
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Responda como o contato"
                className="text-xs"
                aria-label="Resposta simulada do contato"
              />
              <Button
                size="icon-sm"
                type="submit"
                disabled={!draft.trim()}
                aria-label="Enviar resposta"
              >
                <Send />
              </Button>
            </form>
          )}
        </div>
      ) : null}

      {Object.keys(variables).length > 0 ? (
        <>
          <Separator />
          <div className="p-3">
            <p className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wide">
              Variáveis da sessão
            </p>
            <dl>
              {Object.entries(variables).map(([key, value]) => (
                <KeyValue key={key} label={key} value={value} mono />
              ))}
            </dl>
          </div>
        </>
      ) : null}
    </aside>
  );
}
