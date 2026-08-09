"use client";

import { useRef, useState } from "react";
import type { AgentKnowledgeSource } from "@elora/core";
import {
  AGENT_PENDING_EXTENSIONS,
  AGENT_SOURCE_KIND_LABEL,
  AGENT_SOURCE_STATUS_LABEL,
  AGENT_TEXT_EXTENSIONS,
  formatDate,
} from "@elora/core";
import { Badge, Button, Callout, Input, Label, Switch, Tooltip, cn } from "@elora/ui";
import { CircleAlert, Clock, FileText, Link2, Loader2, Paperclip, Trash2 } from "lucide-react";

/**
 * Gestor da base de conhecimento do agente.
 *
 * Três origens na mesma lista — artigo, link e arquivo — porque para quem
 * configura elas são a mesma coisa: material que o agente pode citar. O que
 * muda é como falham, e é isso que a coluna de estado carrega.
 *
 * O interruptor de cada linha é o que entra na versão do agente. Separar
 * "cadastrada" de "usada por este agente" permite manter uma biblioteca só e
 * dar a cada agente o recorte dele — o fiscal não precisa do artigo de cursos, e
 * dar acesso ao que não é dele piora a recuperação em vez de melhorar.
 */
export function KnowledgeManager({
  sources,
  selectedIds,
  readOnly,
  onToggle,
  onAdd,
  onRemove,
}: {
  sources: AgentKnowledgeSource[];
  selectedIds: string[];
  readOnly: boolean;
  onToggle: (id: string, enabled: boolean) => void;
  onAdd: (source: AgentKnowledgeSource) => void;
  onRemove: (id: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"link" | "arquivo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addLink() {
    const address = url.trim();
    if (!address || busy) return;

    setBusy("link");
    setError(null);

    try {
      const response = await fetch("/api/agents/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: address }),
      });

      const payload = (await response.json()) as
        { source: AgentKnowledgeSource } | { error: { message: string } };

      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error.message : "Não foi possível ler a página.");
        return;
      }

      onAdd(payload.source);
      setUrl("");
    } catch {
      setError("Não foi possível falar com o servidor.");
    } finally {
      setBusy(null);
    }
  }

  async function addFile(file: File) {
    setBusy("arquivo");
    setError(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const response = await fetch("/api/agents/knowledge", { method: "POST", body: form });
      const payload = (await response.json()) as
        { source: AgentKnowledgeSource } | { error: { message: string } };

      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error.message : "Não foi possível ler o arquivo.");
        return;
      }

      onAdd(payload.source);
    } catch {
      setError("Não foi possível enviar o arquivo.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      {/* Entrada por link ---------------------------------------------------- */}
      <div className="space-y-1.5">
        <Label htmlFor="kb-url">Endereço de uma página</Label>
        <div className="flex gap-2">
          <Input
            id="kb-url"
            value={url}
            disabled={readOnly || busy !== null}
            placeholder="https://contabilidadefacilitada.com/planos"
            className="text-xs"
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addLink();
              }
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={readOnly || !url.trim() || busy !== null}
            onClick={() => void addLink()}
          >
            {busy === "link" ? <Loader2 className="animate-spin" /> : <Link2 />}
            Ler
          </Button>
        </div>
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          O servidor busca a página e guarda o texto. Página montada por JavaScript no navegador
          volta quase vazia — nesse caso, cole o conteúdo como artigo.
        </p>
      </div>

      {/* Entrada por arquivo -------------------------------------------------- */}
      <div className="space-y-1.5">
        <Label htmlFor="kb-file">Arquivo</Label>
        <input
          ref={fileRef}
          id="kb-file"
          type="file"
          disabled={readOnly || busy !== null}
          accept={[...AGENT_TEXT_EXTENSIONS, ...AGENT_PENDING_EXTENSIONS].join(",")}
          className="text-muted-foreground file:bg-muted hover:file:bg-muted/70 file:border-input w-full text-[11px] file:mr-2 file:rounded-md file:border file:px-2 file:py-1 file:text-[11px]"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void addFile(file);
          }}
        />
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          <strong>TXT, Markdown, CSV e JSON</strong> são lidos aqui, na hora.{" "}
          <strong>PDF, Word e planilha</strong> ficam registrados aguardando o extrator do caminho
          de mídia — que é back-end. Enquanto isso o agente não os consulta, e a lista diz isso.
        </p>
      </div>

      {error ? (
        <Callout variant="danger" icon={<CircleAlert />}>
          {error}
        </Callout>
      ) : null}

      {/* Lista ---------------------------------------------------------------- */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Fontes disponíveis</Label>
          <span className="text-muted-foreground text-[11px]">
            {selectedIds.length} de {sources.length} em uso
          </span>
        </div>

        {sources.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Nenhuma fonte cadastrada. Sem base, o agente só responde pelo conhecimento geral — e no
            modo restrito não responde nada.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sources.map((source) => {
              const enabled = selectedIds.includes(source.id);
              const usable = source.status === "pronto";

              return (
                <li
                  key={source.id}
                  className={cn(
                    "rounded-lg p-2.5 transition-colors",
                    enabled ? "bg-muted/60" : "bg-muted/20",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Tooltip
                      content={
                        usable
                          ? "Liga esta fonte para o agente"
                          : "Sem texto extraído, ligar não adianta: a busca não encontraria nada."
                      }
                    >
                      <span>
                        <Switch
                          checked={enabled}
                          disabled={readOnly || !usable}
                          className="mt-0.5"
                          onCheckedChange={(checked) => onToggle(source.id, checked)}
                        />
                      </span>
                    </Tooltip>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <SourceIcon kind={source.kind} />
                        <span className="truncate text-xs font-medium">{source.title}</span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <Badge variant="neutral">{AGENT_SOURCE_KIND_LABEL[source.kind]}</Badge>
                        {source.status !== "pronto" ? (
                          <Badge variant={source.status === "falhou" ? "danger" : "warning"}>
                            {source.status === "processando" ? <Clock aria-hidden /> : null}
                            {AGENT_SOURCE_STATUS_LABEL[source.status]}
                          </Badge>
                        ) : null}
                        {source.fetchedAt ? (
                          <span className="text-muted-foreground text-[10px]">
                            lido em {formatDate(source.fetchedAt)}
                          </span>
                        ) : null}
                      </div>

                      {source.url ? (
                        <p className="text-muted-foreground mt-0.5 truncate font-mono text-[10px]">
                          {source.url}
                        </p>
                      ) : null}

                      {source.statusReason ? (
                        <p className="text-muted-foreground mt-1 text-[10px] leading-relaxed">
                          {source.statusReason}
                        </p>
                      ) : null}

                      {source.topics.length > 0 ? (
                        <p className="text-muted-foreground mt-1 text-[10px]">
                          {source.topics.slice(0, 6).join(" · ")}
                        </p>
                      ) : null}
                    </div>

                    {readOnly ? null : (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remover ${source.title}`}
                        onClick={() => onRemove(source.id)}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function SourceIcon({ kind }: { kind: AgentKnowledgeSource["kind"] }) {
  const Icon = kind === "link" ? Link2 : kind === "arquivo" ? Paperclip : FileText;
  return <Icon className="text-muted-foreground size-3 shrink-0" aria-hidden />;
}
