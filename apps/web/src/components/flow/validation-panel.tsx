"use client";

import { useState } from "react";
import type { FlowValidationIssue } from "@crm/core";
import { FLOW_VALIDATION_LABEL } from "@crm/core";
import { Badge, Button, cn } from "@crm/ui";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, CircleAlert } from "lucide-react";

/**
 * Painel de validação da publicação (seção 12.2 do plano). Erro bloqueia a
 * publicação; alerta apenas informa. Clicar em um achado seleciona o bloco.
 */
export function ValidationPanel({
  issues,
  onFocusNode,
}: {
  issues: FlowValidationIssue[];
  onFocusNode: (nodeId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const errors = issues.filter((issue) => issue.severity === "erro");
  const warnings = issues.filter((issue) => issue.severity === "alerta");

  return (
    <div className="border-border bg-surface shrink-0 border-t">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left"
        aria-expanded={open}
      >
        {issues.length === 0 ? (
          <>
            <CheckCircle2 className="text-success size-4" aria-hidden />
            <span className="text-xs font-medium">Validação sem pendências</span>
            <span className="text-muted-foreground text-[11px]">
              caminhos, alcançabilidade e transbordo verificados
            </span>
          </>
        ) : (
          <>
            {errors.length > 0 ? (
              <CircleAlert className="text-destructive size-4" aria-hidden />
            ) : (
              <AlertTriangle className="text-warning size-4" aria-hidden />
            )}
            <span className="text-xs font-medium">Validação da publicação</span>
            {errors.length > 0 ? <Badge variant="danger">{errors.length} erros</Badge> : null}
            {warnings.length > 0 ? (
              <Badge variant="warning">{warnings.length} alertas</Badge>
            ) : null}
          </>
        )}
        <span className="text-muted-foreground ml-auto">
          {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </span>
      </button>

      {open && issues.length > 0 ? (
        <ul className="divide-border border-border max-h-44 divide-y overflow-y-auto border-t">
          {[...errors, ...warnings].map((issue) => (
            <li key={issue.id}>
              <button
                type="button"
                onClick={() => issue.nodeId && onFocusNode(issue.nodeId)}
                disabled={!issue.nodeId}
                className={cn(
                  "flex w-full items-start gap-2 px-4 py-2 text-left transition-colors",
                  issue.nodeId ? "hover:bg-muted" : "cursor-default",
                )}
              >
                {issue.severity === "erro" ? (
                  <CircleAlert className="text-destructive mt-0.5 size-3.5 shrink-0" aria-hidden />
                ) : (
                  <AlertTriangle className="text-warning mt-0.5 size-3.5 shrink-0" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block text-xs">{issue.message}</span>
                  <span className="text-muted-foreground block text-[11px]">
                    {FLOW_VALIDATION_LABEL[issue.rule]}
                  </span>
                </span>
                {issue.nodeId ? (
                  <Button variant="ghost" size="xs" asChild>
                    <span>Ver bloco</span>
                  </Button>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
