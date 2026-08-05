"use client";

import { useEffect, useRef, useState } from "react";
import type { FlowPort } from "@crm/core";
import { Badge, Button, KeyValue, cn } from "@crm/ui";
import {
  ArrowLeft,
  Battery,
  CheckCheck,
  ChevronDown,
  MoreVertical,
  Phone,
  Play,
  RotateCcw,
  Send,
  Signal,
  Smile,
  Video,
  Wifi,
  X,
} from "lucide-react";

import { WhatsAppGlyph } from "@/lib/brand-icons";
import type { SimulatorEntry, SimulatorStatus } from "./use-simulator";

/**
 * Simulador do fluxo em moldura de celular.
 *
 * Testar um chatbot numa lista de passos técnicos esconde o que importa: como a
 * conversa **soa** para quem está do outro lado. Aqui o teste acontece na forma
 * em que a mensagem vai chegar — bolhas, horário, tique de leitura, botões de
 * resposta rápida.
 *
 * Os passos internos (condição avaliada, variável definida, chamada HTTP)
 * continuam visíveis, mas como anotação de bastidor, fora da conversa.
 */

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

/** Três pontos que aparecem enquanto o bot "digita" antes de cada mensagem. */
function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-xl rounded-tl-sm bg-white px-3 py-2.5 shadow-sm">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="size-1.5 rounded-full bg-slate-400"
            style={{ animation: `typing-dot 1.2s ease-in-out ${index * 0.16}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}

export function PhoneSimulator({
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
  const [showBackstage, setShowBackstage] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [entries.length, awaiting]);

  const conversation = entries.filter((entry) => entry.role !== "sistema");
  const backstage = entries.filter((entry) => entry.role === "sistema");

  return (
    <aside className="bg-surface flex w-[23rem] shrink-0 flex-col">
      {/* Controles */}
      <div className="shadow-inset-hairline flex items-center gap-2 px-3 py-2">
        <WhatsAppGlyph className="size-4 text-[#128C7E] dark:text-[#25D366]" />
        <span className="text-xs font-semibold">Simulador</span>
        <Badge variant={STATUS_TONE[status]} className="ml-auto">
          {STATUS_LABEL[status]}
        </Badge>
        <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Fechar simulador">
          <X />
        </Button>
      </div>

      <div className="shadow-inset-hairline flex items-center gap-1.5 px-3 py-2">
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

      {/* Celular */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="shadow-overlay mx-auto w-full max-w-[19rem] overflow-hidden rounded-[2rem] bg-slate-900 p-2">
          <div className="overflow-hidden rounded-[1.6rem] bg-[#ECE5DD]">
            {/* Barra de status */}
            <div className="flex items-center justify-between bg-[#075E54] px-4 pb-1 pt-2 text-[10px] text-white/90">
              <span className="font-medium tabular-nums">14:32</span>
              <span className="flex items-center gap-1">
                <Signal className="size-3" />
                <Wifi className="size-3" />
                <Battery className="size-3" />
              </span>
            </div>

            {/* Cabeçalho da conversa */}
            <div className="flex items-center gap-2 bg-[#075E54] px-3 pb-2.5 pt-1 text-white">
              <ArrowLeft className="size-4 shrink-0 opacity-90" />
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-semibold">
                CF
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-tight">
                  Contabilidade Facilitada
                </span>
                <span className="block truncate text-[10px] leading-tight text-white/70">
                  {status === "executando" ? "digitando…" : "online"}
                </span>
              </span>
              <Video className="size-4 shrink-0 opacity-90" />
              <Phone className="size-3.5 shrink-0 opacity-90" />
              <MoreVertical className="size-4 shrink-0 opacity-90" />
            </div>

            {/* Conversa */}
            <div
              ref={scrollRef}
              className="chat-canvas flex h-[22rem] flex-col gap-1.5 overflow-y-auto px-3 py-3"
            >
              {conversation.length === 0 ? (
                <div className="m-auto max-w-[80%] rounded-lg bg-[#FFF3C4] px-3 py-2 text-center text-[10px] leading-relaxed text-[#5B5039]">
                  Inicie a simulação para ver a conversa como o contato veria, no aparelho dele.
                </div>
              ) : null}

              {conversation.map((entry) => {
                const fromBot = entry.role === "bot";
                return (
                  <div
                    key={entry.id}
                    className={cn("flex", fromBot ? "justify-start" : "justify-end")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-2.5 py-1.5 text-[12.5px] leading-relaxed shadow-sm",
                        fromBot
                          ? "rounded-tl-sm bg-white text-slate-800"
                          : "rounded-tr-sm bg-[#DCF8C6] text-slate-800",
                      )}
                      style={{ animation: "message-in 0.28s cubic-bezier(0.22,1,0.36,1) both" }}
                    >
                      <p className="whitespace-pre-wrap break-words">{entry.text}</p>
                      <span className="mt-0.5 flex items-center justify-end gap-1 text-[9px] text-slate-500">
                        14:32
                        {fromBot ? null : <CheckCheck className="size-3 text-[#4FC3F7]" />}
                      </span>
                      {entry.detail ? (
                        <span className="mt-1 block border-t border-slate-200 pt-1 text-[9px] text-slate-500">
                          {entry.detail}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {status === "executando" ? <TypingBubble /> : null}
            </div>

            {/* Campo de resposta */}
            <div className="flex items-center gap-1.5 bg-[#F0F0F0] px-2 py-2">
              {awaiting && awaiting.options.length > 0 ? (
                <div className="flex w-full flex-wrap gap-1">
                  {awaiting.options.map((port) => (
                    <button
                      key={port.id}
                      type="button"
                      onClick={() => onAnswer(port.label, port.id)}
                      className="flex-1 rounded-full bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#075E54] shadow-sm transition-transform active:scale-95"
                    >
                      {port.label}
                    </button>
                  ))}
                </div>
              ) : (
                <form
                  className="flex w-full items-center gap-1.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!draft.trim() || !awaiting) return;
                    onAnswer(draft.trim());
                    setDraft("");
                  }}
                >
                  <div className="flex flex-1 items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5">
                    <Smile className="size-3.5 shrink-0 text-slate-400" />
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      disabled={!awaiting}
                      placeholder={awaiting ? "Mensagem" : "Aguardando o fluxo…"}
                      aria-label="Resposta simulada do contato"
                      className="min-w-0 flex-1 bg-transparent text-[12px] text-slate-800 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!awaiting || !draft.trim()}
                    aria-label="Enviar resposta"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#128C7E] text-white transition-transform active:scale-95 disabled:opacity-40"
                  >
                    <Send className="size-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bastidor: o que o runtime fez entre uma mensagem e outra */}
      <div className="shadow-inset-hairline">
        <button
          type="button"
          onClick={() => setShowBackstage((value) => !value)}
          className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
          aria-expanded={showBackstage}
        >
          <span className="text-xs font-medium">Bastidor</span>
          <Badge variant="neutral">{backstage.length}</Badge>
          <span className="text-muted-foreground ml-auto">
            <ChevronDown
              className={cn("size-4 transition-transform", showBackstage && "rotate-180")}
            />
          </span>
        </button>

        {showBackstage ? (
          <div className="max-h-52 space-y-1.5 overflow-y-auto px-3 pb-3">
            {backstage.length === 0 ? (
              <p className="text-muted-foreground py-3 text-center text-[11px]">
                Nenhum passo interno ainda.
              </p>
            ) : (
              backstage.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[11px] leading-relaxed",
                    entry.tone === "alerta"
                      ? "bg-warning-soft"
                      : entry.tone === "sucesso"
                        ? "bg-success-soft"
                        : "bg-muted",
                  )}
                >
                  <p className="text-foreground font-medium">{entry.text}</p>
                  {entry.detail ? (
                    <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                      {entry.detail}
                    </p>
                  ) : null}
                </div>
              ))
            )}

            {Object.keys(variables).length > 0 ? (
              <div className="pt-1">
                <p className="text-muted-foreground mb-1 text-[11px] font-semibold uppercase tracking-wide">
                  Variáveis
                </p>
                <dl>
                  {Object.entries(variables).map(([key, value]) => (
                    <KeyValue key={key} label={key} value={value} mono className="py-0.5" />
                  ))}
                </dl>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
