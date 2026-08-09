"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  BrandKit,
  EmailBlock,
  EmailBlockKind,
  EmailDesignTemplate,
  EmailModule,
  EmailTemplateVersion,
} from "@elora/core";
import {
  EMAIL_BLOCK_LABEL,
  EMAIL_VALIDATION_LABEL,
  estimateEmailBytes,
  FLOW_STATUS_LABEL,
  formatDate,
  formatPercent,
  hasBlockingEmailIssue,
  offsetIso,
  validateEmailTemplate,
} from "@elora/core";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Eyebrow,
  Input,
  KeyValue,
  Tooltip,
  cn,
} from "@elora/ui";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Columns3,
  Eye,
  GripVertical,
  History,
  Image as ImageIcon,
  Layers,
  Link2,
  Minus,
  MousePointerClick,
  Monitor,
  Play,
  Rocket,
  Send,
  Share2,
  Smartphone,
  SquareCode,
  Type,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Metric, MetricStrip } from "@/components/shell/metric-strip";
import { BlockInspector } from "./block-inspector";
import { EMAIL_BLOCK_DRAG, EmailCanvas } from "./email-canvas";

const BLOCK_ICON: Record<EmailBlockKind, LucideIcon> = {
  texto: Type,
  imagem: ImageIcon,
  botao: MousePointerClick,
  divisor: Minus,
  espacador: Layers,
  colunas: Columns3,
  menu: Link2,
  social: Share2,
  video: Play,
  rodape: Layers,
  html: SquareCode,
};

/** Blocos oferecidos na paleta. Rodapé fica de fora: vem do módulo de marca. */
const PALETTE: EmailBlockKind[] = [
  "texto",
  "imagem",
  "botao",
  "colunas",
  "video",
  "divisor",
  "espacador",
  "html",
];

const STATUS_TONE = {
  rascunho: "neutral",
  em_revisao: "warning",
  aprovado: "info",
  publicado: "success",
  arquivado: "neutral",
} as const;

function createBlock(kind: EmailBlockKind, sequence: number): EmailBlock {
  const id = `blk_novo_${sequence}`;
  switch (kind) {
    case "texto":
      return {
        id,
        kind,
        content: "Escreva aqui o texto do e-mail.",
        align: "esquerda",
        scale: "corpo",
      };
    case "imagem":
      return { id, kind, source: "nova-imagem.png", alt: "", ratio: "16:9" };
    case "botao":
      return {
        id,
        kind,
        label: "Clique aqui",
        href: "https://",
        align: "centro",
        variant: "primario",
      };
    case "divisor":
      return { id, kind };
    case "espacador":
      return { id, kind, height: 24 };
    case "colunas":
      return {
        id,
        kind,
        columns: [
          { id: `${id}_c1`, title: "Título", body: "Texto da coluna." },
          { id: `${id}_c2`, title: "Título", body: "Texto da coluna." },
        ],
      };
    case "video":
      return {
        id,
        kind,
        title: "Título do vídeo",
        href: "https://",
        fallbackText: "Assistir ao vídeo",
      };
    case "html":
      return { id, kind, html: "<p>HTML controlado</p>" };
    case "menu":
      return { id, kind, items: [{ id: `${id}_i1`, label: "Item", href: "https://" }] };
    case "social":
      return { id, kind, networks: ["instagram", "linkedin"] };
    case "rodape":
      return {
        id,
        kind,
        address: "Endereço da empresa",
        legal: "Base legal do envio.",
        unsubscribeLabel: "Cancelar inscrição",
      };
  }
}

export function EmailEditor({
  template: initialTemplate,
  brandKits,
  modules,
}: {
  template: EmailDesignTemplate;
  brandKits: BrandKit[];
  modules: EmailModule[];
}) {
  const [versions, setVersions] = useState<EmailTemplateVersion[]>(initialTemplate.versions);
  const [activeVersionId, setActiveVersionId] = useState(initialTemplate.activeVersionId);
  const [viewVersionId, setViewVersionId] = useState(initialTemplate.draftVersionId);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [preview, setPreview] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testAddress, setTestAddress] = useState("infra@contabilidadefacilitada.com");
  const [sequence, setSequence] = useState(0);

  const version = versions.find((item) => item.id === viewVersionId) ?? versions[0]!;
  const readOnly = version.status !== "rascunho";

  const brand =
    brandKits.find((kit) => kit.id === initialTemplate.brandKitId) ??
    brandKits.find((kit) => kit.isDefault) ??
    brandKits[0]!;

  const issues = useMemo(() => validateEmailTemplate(version), [version]);
  const blocked = hasBlockingEmailIssue(issues);
  const errors = issues.filter((issue) => issue.severity === "erro");
  const warnings = issues.filter((issue) => issue.severity === "alerta");
  const bytes = estimateEmailBytes(version);

  const selectedBlock = version.blocks.find((block) => block.id === selectedBlockId) ?? null;

  function updateVersion(updater: (current: EmailTemplateVersion) => EmailTemplateVersion) {
    setVersions((current) =>
      current.map((item) => (item.id === version.id ? updater(item) : item)),
    );
  }

  function updateBlock(next: EmailBlock) {
    updateVersion((current) => ({
      ...current,
      blocks: current.blocks.map((block) => (block.id === next.id ? next : block)),
    }));
  }

  function addBlock(kind: EmailBlockKind) {
    const nextSequence = sequence + 1;
    setSequence(nextSequence);
    const block = createBlock(kind, nextSequence);

    // O bloco novo entra antes do rodapé — ninguém quer conteúdo depois da
    // base legal e do descadastro.
    updateVersion((current) => {
      const footerIndex = current.blocks.findIndex((item) => item.kind === "rodape");
      const insertAt = footerIndex === -1 ? current.blocks.length : footerIndex - 1;
      const blocks = [...current.blocks];
      blocks.splice(Math.max(insertAt, 0), 0, block);
      return { ...current, blocks };
    });

    setSelectedBlockId(block.id);
    toast.info(`Bloco "${EMAIL_BLOCK_LABEL[kind]}" adicionado`);
  }

  function addModule(module: EmailModule) {
    const nextSequence = sequence + 1;
    setSequence(nextSequence);
    // Ids são reescritos: o mesmo módulo pode entrar duas vezes no e-mail.
    const blocks = module.blocks.map((block, index) => ({
      ...block,
      id: `${block.id}_${nextSequence}_${index}`,
    })) as EmailBlock[];

    updateVersion((current) => {
      const footerIndex = current.blocks.findIndex((item) => item.kind === "rodape");
      const insertAt = footerIndex === -1 ? current.blocks.length : footerIndex - 1;
      const next = [...current.blocks];
      next.splice(Math.max(insertAt, 0), 0, ...blocks);
      return { ...current, blocks: next };
    });

    toast.info(`Módulo "${module.name}" inserido`, {
      description: module.locked
        ? "Os blocos de marca entram travados: mudança acontece no módulo, não aqui."
        : undefined,
    });
  }

  function moveBlock(blockId: string, direction: -1 | 1) {
    updateVersion((current) => {
      const index = current.blocks.findIndex((block) => block.id === blockId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= current.blocks.length) return current;
      const blocks = [...current.blocks];
      const [moved] = blocks.splice(index, 1);
      if (moved) blocks.splice(target, 0, moved);
      return { ...current, blocks };
    });
  }

  /** Bloco novo largado numa posição exata do canvas. */
  function insertBlockAt(kind: EmailBlockKind, index: number) {
    const nextSequence = sequence + 1;
    setSequence(nextSequence);
    const block = createBlock(kind, nextSequence);

    updateVersion((current) => {
      const blocks = [...current.blocks];
      blocks.splice(Math.min(Math.max(index, 0), blocks.length), 0, block);
      return { ...current, blocks };
    });

    setSelectedBlockId(block.id);
    toast.info(`Bloco "${EMAIL_BLOCK_LABEL[kind]}" adicionado`);
  }

  /**
   * Reordenação por arraste.
   *
   * O índice de destino vem contado com o bloco ainda na lista. Depois de tirá-lo,
   * tudo o que vinha depois anda uma casa para trás — daí o ajuste antes do
   * `splice`, sem o qual arrastar para baixo erra sempre por uma posição.
   */
  function reorderBlock(blockId: string, targetIndex: number) {
    updateVersion((current) => {
      const from = current.blocks.findIndex((block) => block.id === blockId);
      if (from === -1) return current;

      const blocks = [...current.blocks];
      const [moved] = blocks.splice(from, 1);
      if (!moved) return current;

      const adjusted = targetIndex > from ? targetIndex - 1 : targetIndex;
      blocks.splice(Math.min(Math.max(adjusted, 0), blocks.length), 0, moved);
      return { ...current, blocks };
    });
    setSelectedBlockId(blockId);
  }

  function duplicateBlock(blockId: string) {
    const nextSequence = sequence + 1;
    setSequence(nextSequence);
    updateVersion((current) => {
      const index = current.blocks.findIndex((block) => block.id === blockId);
      const source = current.blocks[index];
      if (!source) return current;
      const copy = {
        ...source,
        id: `${source.id}_copia_${nextSequence}`,
        locked: false,
      } as EmailBlock;
      const blocks = [...current.blocks];
      blocks.splice(index + 1, 0, copy);
      return { ...current, blocks };
    });
  }

  function deleteBlock(blockId: string) {
    updateVersion((current) => ({
      ...current,
      blocks: current.blocks.filter((block) => block.id !== blockId),
    }));
    setSelectedBlockId(null);
    toast.success("Bloco removido");
  }

  function publish() {
    if (blocked) {
      toast.error("Publicação bloqueada", {
        description: `${errors.length} ${errors.length === 1 ? "erro impede" : "erros impedem"} o envio. Corrija antes de publicar.`,
      });
      return;
    }

    const publishedAt = offsetIso({});
    const nextVersionNumber = Math.max(...versions.map((item) => item.version)) + 1;

    setVersions((current) => [
      ...current.map((item) =>
        item.id === version.id
          ? { ...item, status: "publicado" as const, publishedAt }
          : item.status === "publicado"
            ? { ...item, status: "arquivado" as const }
            : item,
      ),
      {
        ...version,
        id: `${initialTemplate.id}_v${nextVersionNumber}_draft`,
        version: nextVersionNumber,
        status: "rascunho",
        publishedAt: undefined,
        publishedBy: undefined,
        changeNote: "Novo rascunho criado a partir da versão publicada.",
      },
    ]);

    setActiveVersionId(version.id);
    setViewVersionId(version.id);
    setPublishOpen(false);

    toast.success(`Versão ${version.version} publicada`, {
      description: "Campanhas e jornadas passam a usar esta versão. A anterior foi arquivada.",
    });
  }

  function sendTest() {
    setTestOpen(false);
    toast.success(`Teste enviado para ${testAddress}`, {
      description:
        "As merge tags foram trocadas pelos valores de amostra e o envio ficou na auditoria.",
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Cabeçalho */}
      <header className="glass shadow-inset-hairline sticky top-0 z-30 shrink-0 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Voltar para o E-mail Studio">
            <Link href="/email-studio">
              <ArrowLeft />
            </Link>
          </Button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display truncate text-sm font-semibold tracking-tight">
                {initialTemplate.name}
              </h1>
              <Badge variant={STATUS_TONE[version.status]}>
                {FLOW_STATUS_LABEL[version.status]}
              </Badge>
              {version.id === activeVersionId ? <Badge variant="success">em produção</Badge> : null}
            </div>
            <p className="text-muted-foreground truncate text-xs">
              Marca: {brand.name} · {version.blocks.length} blocos
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Dispositivo */}
            <div className="bg-muted flex items-center gap-0.5 rounded-md p-0.5">
              {(
                [
                  { id: "desktop", icon: Monitor, label: "Computador" },
                  { id: "mobile", icon: Smartphone, label: "Celular" },
                ] as const
              ).map((option) => {
                const Icon = option.icon;
                return (
                  <Tooltip key={option.id} content={option.label}>
                    <button
                      type="button"
                      onClick={() => setDevice(option.id)}
                      aria-pressed={device === option.id}
                      aria-label={option.label}
                      className={cn(
                        "rounded p-1.5 transition-colors",
                        device === option.id
                          ? "bg-surface text-foreground shadow-card"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </button>
                  </Tooltip>
                );
              })}
            </div>

            <Button
              variant={preview ? "accent" : "outline"}
              size="sm"
              onClick={() => {
                setPreview((value) => !value);
                setSelectedBlockId(null);
              }}
            >
              <Eye />
              {preview ? "Editando prévia" : "Prévia"}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <History />v{version.version}
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Histórico de versões</DropdownMenuLabel>
                {[...versions]
                  .sort((a, b) => b.version - a.version)
                  .map((item) => (
                    <DropdownMenuItem
                      key={item.id}
                      onSelect={() => {
                        setViewVersionId(item.id);
                        setSelectedBlockId(null);
                      }}
                    >
                      <span className="flex-1 truncate">
                        v{item.version} · {FLOW_STATUS_LABEL[item.status]}
                      </span>
                      {item.publishedAt ? (
                        <span className="text-muted-foreground text-[11px] tabular-nums">
                          {formatDate(item.publishedAt)}
                        </span>
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuSeparator />
                <p className="text-muted-foreground px-2 py-1.5 text-[11px] leading-relaxed">
                  A versão publicada é imutável. Editar cria uma nova e não altera envios já
                  disparados.
                </p>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={() => setTestOpen(true)}>
              <Send />
              Teste
            </Button>

            <Tooltip
              content={
                blocked
                  ? "Corrija os erros da checagem para liberar a publicação."
                  : readOnly
                    ? "Esta versão já está publicada."
                    : "Publica esta versão e cria um novo rascunho."
              }
            >
              <span>
                <Button
                  size="sm"
                  disabled={readOnly || blocked}
                  onClick={() => setPublishOpen(true)}
                >
                  <Rocket />
                  Publicar
                </Button>
              </span>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Indicadores */}
      <MetricStrip
        trailing={
          <span className="text-muted-foreground text-[11px]">
            {Math.round(bytes / 1024)} KB estimados · corte do Gmail em 102 KB
          </span>
        }
      >
        <Metric label="Envios (30 d)" value={initialTemplate.stats.sends30d} />
        <Metric
          label="Abertura"
          value={formatPercent(initialTemplate.stats.openPct, 1)}
          tone="success"
        />
        <Metric label="Clique" value={formatPercent(initialTemplate.stats.clickPct, 1)} />
        <Metric
          label="Descadastro"
          value={formatPercent(initialTemplate.stats.unsubscribePct, 2)}
          tone={initialTemplate.stats.unsubscribePct > 0.5 ? "danger" : "neutral"}
        />
        <Metric
          label="Bounce"
          value={formatPercent(initialTemplate.stats.bouncePct, 1)}
          tone={initialTemplate.stats.bouncePct > 2 ? "warning" : "neutral"}
        />
      </MetricStrip>

      <div className="flex min-h-0 flex-1">
        {/* Paleta */}
        {preview ? null : (
          <div className="bg-surface flex w-56 shrink-0 flex-col overflow-y-auto">
            <div className="p-3">
              <Eyebrow className="mb-2">Blocos</Eyebrow>
              <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
                Arraste até o ponto exato ou clique para entrar antes do rodapé.
              </p>
              <ul className="space-y-0.5">
                {PALETTE.map((kind) => {
                  const Icon = BLOCK_ICON[kind];
                  return (
                    <li key={kind}>
                      <button
                        type="button"
                        disabled={readOnly}
                        draggable={!readOnly}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(EMAIL_BLOCK_DRAG, kind);
                          event.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => addBlock(kind)}
                        className={cn(
                          "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                          readOnly
                            ? "text-muted-foreground/50 cursor-not-allowed"
                            : "text-foreground hover:bg-muted active:cursor-grabbing",
                        )}
                      >
                        <span className="bg-primary-soft text-primary flex size-5 shrink-0 items-center justify-center rounded">
                          <Icon className="size-3" aria-hidden />
                        </span>
                        <span className="flex-1 truncate">{EMAIL_BLOCK_LABEL[kind]}</span>
                        <GripVertical className="text-muted-foreground size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="p-3 pt-0">
              <Eyebrow className="mb-2">Módulos</Eyebrow>
              <ul className="space-y-1">
                {modules.map((module) => (
                  <li key={module.id}>
                    <Tooltip side="right" content={module.description}>
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => addModule(module)}
                        className={cn(
                          "w-full rounded-md px-2 py-1.5 text-left transition-colors",
                          readOnly ? "cursor-not-allowed opacity-50" : "hover:bg-muted",
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-medium">{module.name}</span>
                          {module.locked ? <Badge variant="neutral">marca</Badge> : null}
                        </span>
                        <span className="text-muted-foreground mt-0.5 block text-[10px]">
                          {module.blocks.length} blocos · usado {module.usageCount}×
                        </span>
                      </button>
                    </Tooltip>
                  </li>
                ))}
              </ul>
            </div>

            {readOnly ? (
              <p className="text-muted-foreground mt-auto p-3 text-[11px] leading-relaxed">
                Versão publicada é imutável. Troque para o rascunho para editar.
              </p>
            ) : null}
          </div>
        )}

        {/* Assunto + prévia */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="bg-surface shadow-inset-hairline shrink-0 space-y-2 px-4 py-3">
            <div className="flex items-center gap-2">
              <label htmlFor="subject" className="text-muted-foreground w-20 shrink-0 text-xs">
                Assunto
              </label>
              <Input
                id="subject"
                value={version.subject}
                readOnly={readOnly}
                placeholder="O que aparece na lista de e-mails"
                onChange={(event) =>
                  updateVersion((current) => ({ ...current, subject: event.target.value }))
                }
                className="text-xs"
              />
              <span
                className={cn(
                  "w-14 shrink-0 text-right text-[11px] tabular-nums",
                  version.subject.length > 60 ? "text-warning" : "text-muted-foreground",
                )}
              >
                {version.subject.length}/60
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="preheader" className="text-muted-foreground w-20 shrink-0 text-xs">
                Preheader
              </label>
              <Input
                id="preheader"
                value={version.preheader}
                readOnly={readOnly}
                placeholder="A prévia que aparece ao lado do assunto"
                onChange={(event) =>
                  updateVersion((current) => ({ ...current, preheader: event.target.value }))
                }
                className="text-xs"
              />
              <span className="text-muted-foreground w-14 shrink-0 text-right text-[11px] tabular-nums">
                {version.preheader.length}/110
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <EmailCanvas
              blocks={version.blocks}
              brand={brand}
              preheader={version.preheader}
              preview={preview || readOnly}
              device={device}
              selectedBlockId={selectedBlockId}
              issues={issues}
              onSelect={setSelectedBlockId}
              onMove={moveBlock}
              onDuplicate={duplicateBlock}
              onDelete={deleteBlock}
              onInsert={insertBlockAt}
              onReorder={reorderBlock}
            />
          </div>
        </div>

        {/* Inspetor */}
        {preview ? null : (
          <BlockInspector
            block={selectedBlock}
            issues={issues}
            onChange={updateBlock}
            onDelete={() => selectedBlock && deleteBlock(selectedBlock.id)}
          />
        )}
      </div>

      {/* Checagem antes do envio */}
      <div className="bg-surface shrink-0">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          {issues.length === 0 ? (
            <>
              <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
              <span className="text-xs font-medium">Checagem sem pendências</span>
              <span className="text-muted-foreground text-[11px]">
                assunto, alternativos, links, descadastro e peso verificados
              </span>
            </>
          ) : (
            <>
              {errors.length > 0 ? (
                <CircleAlert className="text-destructive size-4 shrink-0" aria-hidden />
              ) : (
                <TriangleAlert className="text-warning size-4 shrink-0" aria-hidden />
              )}
              <span className="text-xs font-medium">Checagem antes do envio</span>
              {errors.length > 0 ? <Badge variant="danger">{errors.length} erros</Badge> : null}
              {warnings.length > 0 ? (
                <Badge variant="warning">{warnings.length} alertas</Badge>
              ) : null}

              <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
                {issues.slice(0, 3).map((issue) => (
                  <li key={issue.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (issue.blockId) {
                          setPreview(false);
                          setSelectedBlockId(issue.blockId);
                        }
                      }}
                      className={cn(
                        "truncate text-[11px]",
                        issue.blockId ? "text-foreground hover:underline" : "text-muted-foreground",
                      )}
                      title={issue.message}
                    >
                      {EMAIL_VALIDATION_LABEL[issue.rule]}
                    </button>
                  </li>
                ))}
                {issues.length > 3 ? (
                  <li className="text-muted-foreground text-[11px]">+{issues.length - 3}</li>
                ) : null}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Publicação */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar versão {version.version}</DialogTitle>
            <DialogDescription>
              Campanhas e jornadas passam a usar esta versão nos próximos envios. O que já saiu não
              muda.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5">
            <dl>
              <KeyValue label="Assunto" value={version.subject || "—"} />
              <KeyValue label="Blocos" value={String(version.blocks.length)} />
              <KeyValue label="Peso estimado" value={`${Math.round(bytes / 1024)} KB`} />
              <KeyValue label="Alertas" value={String(warnings.length)} />
              <KeyValue label="Erros" value={String(errors.length)} />
            </dl>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPublishOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={publish}>
              <Rocket />
              Publicar versão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Envio de teste */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar teste interno</DialogTitle>
            <DialogDescription>
              O teste usa os valores de amostra das merge tags e sai pelo domínio transacional, sem
              contar nas métricas da campanha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 p-5">
            <div className="space-y-1.5">
              <label htmlFor="test-address" className="text-muted-foreground text-xs font-medium">
                Endereço de destino
              </label>
              <Input
                id="test-address"
                type="email"
                value={testAddress}
                onChange={(event) => setTestAddress(event.target.value)}
                className="text-xs"
              />
            </div>
            {blocked ? (
              <p className="bg-warning-soft text-foreground rounded-md px-2.5 py-2 text-[11px] leading-relaxed">
                O e-mail ainda tem {errors.length} {errors.length === 1 ? "erro" : "erros"} de
                checagem. O teste sai assim mesmo — é justamente para isso que ele serve.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTestOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={sendTest} disabled={!testAddress.includes("@")}>
              <Send />
              Enviar teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
