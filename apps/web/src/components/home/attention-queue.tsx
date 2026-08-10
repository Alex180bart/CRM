"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AttentionItem } from "@elora/core";
import { formatCountdown, minutesUntil } from "@elora/core";
import { Badge, Button, EmptyState, cn } from "@elora/ui";
import {
  AlarmClock,
  ArrowRight,
  Bot,
  CheckCircle2,
  CheckSquare,
  Copy,
  Radio,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { ChannelIcon } from "@/lib/channel";

const KIND_META: Record<AttentionItem["kind"], { icon: LucideIcon; label: string }> = {
  sla: { icon: AlarmClock, label: "SLA" },
  tarefa: { icon: CheckSquare, label: "Tarefa" },
  aprovacao: { icon: ShieldCheck, label: "Aprovação" },
  automacao: { icon: Bot, label: "Automação" },
  canal: { icon: Radio, label: "Canal" },
  dados: { icon: Copy, label: "Dados" },
};

const FILTERS: Array<{ id: "todos" | AttentionItem["kind"]; label: string }> = [
  { id: "todos", label: "Tudo" },
  { id: "sla", label: "SLA" },
  { id: "tarefa", label: "Tarefas" },
  { id: "aprovacao", label: "Aprovações" },
  { id: "automacao", label: "Automação" },
];

/**
 * A fila do dia.
 *
 * Um CRM tem dezenas de indicadores; nenhum deles responde à única pergunta que
 * importa às 9 da manhã — *o que precisa de mim agora*. Esta lista junta SLA
 * estourando, tarefa vencida, aprovação parada, execução com erro, canal
 * degradado e duplicidade num só lugar, ordenados por gravidade e prazo.
 */
export function AttentionQueue({ items }: { items: AttentionItem[] }) {
  const [filter, setFilter] = useState<"todos" | AttentionItem["kind"]>("todos");
  const [done, setDone] = useState<string[]>([]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) map.set(item.kind, (map.get(item.kind) ?? 0) + 1);
    return map;
  }, [items]);

  const visible = items.filter(
    (item) => !done.includes(item.id) && (filter === "todos" || item.kind === filter),
  );

  const overdue = visible.filter((item) => item.dueAt && minutesUntil(item.dueAt) < 0).length;

  return (
    <section className="bg-card shadow-card flex max-h-[32rem] min-h-0 flex-col rounded-lg">
      <header className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Precisa de você agora
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {overdue > 0
              ? `${overdue} ${overdue === 1 ? "item vencido" : "itens vencidos"} · ${visible.length} no total`
              : `${visible.length} ${visible.length === 1 ? "item" : "itens"} · nada vencido`}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          {FILTERS.map((option) => {
            const active = filter === option.id;
            const count = option.id === "todos" ? items.length : (counts.get(option.id) ?? 0);
            if (option.id !== "todos" && count === 0) return null;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                aria-pressed={active}
                className={cn(
                  "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {option.label}
                <span className={cn("ml-1.5 tabular-nums", active ? "opacity-70" : "opacity-60")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {visible.length === 0 ? (
          <EmptyState
            compact
            icon={<CheckCircle2 />}
            title="Fila zerada"
            description="Nenhum SLA em risco, tarefa vencida ou aprovação pendente neste recorte. Bom trabalho."
          />
        ) : (
          <ul className="space-y-0.5">
            {visible.map((item, index) => {
              const meta = KIND_META[item.kind];
              const Icon = meta.icon;
              const late = item.dueAt ? minutesUntil(item.dueAt) < 0 : false;

              return (
                <li
                  key={item.id}
                  /**
                   * `.stagger` no lugar de `.reveal`: mesma ideia, cadência de
                   * lista. A orquestração da página escalona a 60 ms porque são
                   * poucas seções; aqui são linhas, e a 60 ms a última chegaria
                   * meio segundo depois de a pessoa já ter clicado na primeira.
                   */
                  className="stagger hover:bg-muted/60 group relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
                  style={{ "--stagger-index": Math.min(index, 8) } as React.CSSProperties}
                >
                  {/* Gravidade como filete, não como fundo colorido. */}
                  <span
                    className={cn(
                      "absolute inset-y-2 left-0 w-[3px] rounded-r-full",
                      item.severity === "critico"
                        ? "bg-destructive"
                        : item.severity === "alto"
                          ? "bg-accent"
                          : "bg-border-strong",
                    )}
                    aria-hidden
                  />

                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      item.severity === "critico"
                        ? "bg-destructive-soft text-destructive"
                        : item.severity === "alto"
                          ? "bg-accent-soft text-accent-ink"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-foreground truncate text-sm font-medium">{item.title}</p>
                      {item.channel ? <ChannelIcon kind={item.channel} withBackground /> : null}
                    </div>
                    <p className="text-muted-foreground truncate text-xs">{item.detail}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {item.dueAt ? (
                      <Badge
                        variant={late ? "danger" : item.severity === "alto" ? "warning" : "neutral"}
                      >
                        {formatCountdown(item.dueAt)}
                      </Badge>
                    ) : (
                      <Badge variant="neutral">{meta.label}</Badge>
                    )}

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDone((current) => [...current, item.id])}
                      aria-label={`Marcar "${item.title}" como tratado`}
                      className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <CheckCircle2 />
                    </Button>

                    <Button asChild size="xs" variant="outline">
                      <Link href={item.href}>
                        {item.actionLabel}
                        <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {done.length > 0 ? (
        <footer className="shadow-inset-hairline flex items-center gap-2 px-5 py-2.5">
          <span className="text-muted-foreground text-xs">
            {done.length} {done.length === 1 ? "item tratado" : "itens tratados"} nesta sessão
          </span>
          <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setDone([])}>
            Mostrar novamente
          </Button>
        </footer>
      ) : null}
    </section>
  );
}
