"use client";

import type { FlowNode, FlowPort, FlowValidationIssue } from "@crm/core";
import { Badge, Button, EmptyState, Input, Label, Separator, Textarea, cn } from "@crm/ui";
import { AlertTriangle, CircleAlert, MousePointerSquareDashed, Trash2 } from "lucide-react";

import { AiNodeConfig } from "./ai-node-config";
import type { NodeMeta } from "./node-meta";

function fieldLabel(key: string): string {
  const map: Record<string, string> = {
    gatilho: "Gatilho",
    canal: "Canal",
    numero: "Número",
    texto: "Texto",
    template: "Template",
    pergunta: "Pergunta",
    variavel: "Variável",
    tipo: "Tipo de resposta",
    opcoes: "Opções",
    timeoutMinutos: "Timeout (minutos)",
    campo: "Campo",
    operador: "Operador",
    valor: "Valor",
    simulationPort: "Caminho no simulador",
    acao: "Ação",
    tag: "Tag",
    fila: "Fila",
    prioridade: "Prioridade",
    incluirResumo: "Incluir resumo",
    metodo: "Método",
    url: "URL",
    timeoutSegundos: "Timeout (segundos)",
    credencial: "Credencial",
    tarefa: "Tarefa de IA",
    schema: "Schema de saída",
    custoMaximoCentavos: "Custo máximo (centavos)",
    resultado: "Resultado",
    resolverConversa: "Resolver conversa",
    duracaoHoras: "Duração (horas)",
    duracaoDias: "Duração (dias)",
    nome: "Nome",
    expressao: "Expressão",
    anexo: "Anexo",
    evento: "Evento",
    filtro: "Filtro",
    reentrada: "Reentrada",
    assunto: "Assunto",
    remetente: "Remetente",
    limiteFrequencia: "Limite de frequência",
    titulo: "Título",
    prazoDias: "Prazo (dias)",
    responsavel: "Responsável",
    funil: "Funil",
    etapa: "Etapa",
    proprietario: "Proprietário",
    time: "Time",
    janelaDias: "Janela (dias)",
    motivo: "Motivo",
  };
  return map[key] ?? key;
}

/**
 * Inspetor do bloco selecionado. No protótipo os campos são apresentados como
 * somente leitura quando a versão está publicada — a versão publicada é
 * imutável (seções 12 e 15.3 do plano).
 */
export function NodeInspector({
  node,
  meta,
  kindLabel,
  issues,
  readOnly,
  onChangeLabel,
  onChangeSummary,
  onChangeConfig,
  onChangeOutputs,
  onDelete,
}: {
  node: FlowNode | null;
  meta?: NodeMeta;
  kindLabel?: string;
  issues: FlowValidationIssue[];
  readOnly: boolean;
  onChangeLabel: (value: string) => void;
  onChangeSummary: (value: string) => void;
  onChangeConfig: (key: string, value: string | number | boolean | string[]) => void;
  /** O bloco de IA reescreve as próprias saídas conforme a tarefa configurada. */
  onChangeOutputs?: (outputs: FlowPort[]) => void;
  onDelete: () => void;
}) {
  if (!node || !meta) {
    return (
      <aside className="border-border bg-surface flex w-80 shrink-0 flex-col border-l">
        <EmptyState
          icon={<MousePointerSquareDashed />}
          title="Nenhum bloco selecionado"
          description="Clique em um bloco do canvas para ver e ajustar sua configuração, saídas e validações."
          compact
        />
      </aside>
    );
  }

  const Icon = meta.icon;
  const nodeIssues = issues.filter((issue) => issue.nodeId === node.id);

  return (
    <aside className="border-border bg-surface flex w-80 shrink-0 flex-col overflow-y-auto border-l">
      <div className="border-border border-b p-4">
        <div className="flex items-center gap-2">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-md"
            style={{
              backgroundColor: `hsl(${meta.hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
              color: `hsl(${meta.hue} 55% var(--hue-fg-l))`,
            }}
          >
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground truncate text-xs font-semibold uppercase tracking-wide">
              {kindLabel ?? node.kind}
            </p>
            <p className="text-muted-foreground truncate text-[11px]">{node.id}</p>
          </div>
        </div>
        <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">{meta.description}</p>
      </div>

      {nodeIssues.length > 0 ? (
        <div className="border-border space-y-1.5 border-b p-4">
          {nodeIssues.map((issue) => (
            <div
              key={issue.id}
              className={cn(
                "flex items-start gap-2 rounded-md border px-2.5 py-2 text-[11px] leading-relaxed",
                issue.severity === "erro"
                  ? "border-destructive/25 bg-destructive-soft text-foreground"
                  : "border-warning/30 bg-warning-soft text-foreground",
              )}
            >
              {issue.severity === "erro" ? (
                <CircleAlert className="text-destructive mt-0.5 size-3.5 shrink-0" aria-hidden />
              ) : (
                <AlertTriangle className="text-warning mt-0.5 size-3.5 shrink-0" aria-hidden />
              )}
              {issue.message}
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="node-label">Nome do bloco</Label>
          <Input
            id="node-label"
            value={node.label}
            readOnly={readOnly}
            onChange={(event) => onChangeLabel(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="node-summary">Descrição</Label>
          <Textarea
            id="node-summary"
            value={node.summary}
            readOnly={readOnly}
            onChange={(event) => onChangeSummary(event.target.value)}
            className="min-h-16 text-xs"
          />
        </div>
      </div>

      <Separator />

      {/* O bloco de IA tem painel próprio: a configuração muda a topologia do fluxo. */}
      {node.kind === "ia" && onChangeOutputs ? (
        <AiNodeConfig
          node={node}
          readOnly={readOnly}
          onChangeConfig={onChangeConfig}
          onChangeOutputs={onChangeOutputs}
        />
      ) : (
        <>
          <div className="space-y-3 p-4">
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
              Configuração
            </p>
            {Object.entries(node.config).length === 0 ? (
              <p className="text-muted-foreground text-xs">Este bloco não possui parâmetros.</p>
            ) : (
              Object.entries(node.config).map(([key, value]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`config-${key}`}>{fieldLabel(key)}</Label>
                  <Input
                    id={`config-${key}`}
                    value={Array.isArray(value) ? value.join(" · ") : String(value)}
                    readOnly={readOnly || Array.isArray(value)}
                    onChange={(event) => onChangeConfig(key, event.target.value)}
                    className="text-xs"
                  />
                </div>
              ))
            )}
          </div>

          <Separator />

          <div className="p-4">
            <p className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase tracking-wide">
              Saídas
            </p>
            {node.outputs.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Bloco terminal — encerra este caminho.
              </p>
            ) : (
              <ul className="space-y-1">
                {node.outputs.map((port) => (
                  <li
                    key={port.id}
                    className="bg-muted/50 flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5"
                  >
                    <span className="truncate text-xs">{port.label}</span>
                    {port.fallback ? (
                      <Badge variant="warning">exceção</Badge>
                    ) : (
                      <Badge variant="neutral">saída</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {!readOnly ? (
        <div className="border-border mt-auto border-t p-4">
          <Button variant="danger" size="sm" className="w-full" onClick={onDelete}>
            <Trash2 />
            Remover bloco
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
