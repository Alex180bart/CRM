"use client";

import type { EmailAlign, EmailBlock, EmailValidationIssue } from "@crm/core";
import { EMAIL_BLOCK_LABEL, EMAIL_MERGE_TAGS } from "@crm/core";
import { Badge, Button, EmptyState, Eyebrow, Input, Label, Textarea, Tooltip, cn } from "@crm/ui";
import {
  CircleAlert,
  Lock,
  MousePointerSquareDashed,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";

/**
 * Inspetor do bloco selecionado.
 *
 * Cada tipo de bloco tem os seus campos — não há formulário genérico, porque
 * um botão e uma imagem não pedem as mesmas decisões. Bloco travado pela marca
 * aparece somente para leitura: quem edita é o administrador, no módulo.
 */

const ALIGN_OPTIONS: Array<{ value: EmailAlign; label: string }> = [
  { value: "esquerda", label: "Esquerda" },
  { value: "centro", label: "Centro" },
  { value: "direita", label: "Direita" },
];

function AlignPicker({
  value,
  onChange,
  disabled,
}: {
  value: EmailAlign;
  onChange: (value: EmailAlign) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {ALIGN_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "h-7 flex-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50",
            value === option.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MergeTagPicker({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div>
      <Eyebrow className="mb-1.5">Merge tags</Eyebrow>
      <div className="flex flex-wrap gap-1">
        {EMAIL_MERGE_TAGS.map((tag) => (
          <Tooltip key={tag.token} content={`Prévia: ${tag.sample}`}>
            <button
              type="button"
              onClick={() => onInsert(tag.token)}
              className="bg-muted text-muted-foreground hover:bg-accent-soft hover:text-accent-ink rounded-md px-1.5 py-1 font-mono text-[10px] transition-colors"
            >
              {tag.label}
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

export function BlockInspector({
  block,
  issues,
  onChange,
  onDelete,
}: {
  block: EmailBlock | null;
  issues: EmailValidationIssue[];
  onChange: (block: EmailBlock) => void;
  onDelete: () => void;
}) {
  if (!block) {
    return (
      <aside className="bg-surface flex w-80 shrink-0 flex-col">
        <EmptyState
          compact
          icon={<MousePointerSquareDashed />}
          title="Nenhum bloco selecionado"
          description="Clique em um bloco da prévia para ajustar o conteúdo, o alinhamento e os links."
        />
      </aside>
    );
  }

  const locked = Boolean(block.locked);
  const blockIssues = issues.filter((issue) => issue.blockId === block.id);

  /** Acrescenta a tag ao fim do campo principal do bloco. */
  function insertTag(token: string) {
    if (locked) return;
    if (block?.kind === "texto") onChange({ ...block, content: `${block.content}${token}` });
    if (block?.kind === "botao") onChange({ ...block, label: `${block.label}${token}` });
  }

  return (
    <aside className="bg-surface flex w-80 shrink-0 flex-col overflow-y-auto">
      <div className="shadow-inset-hairline flex items-center gap-2 p-4">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold tracking-tight">
            {EMAIL_BLOCK_LABEL[block.kind]}
          </p>
          <p className="text-muted-foreground truncate font-mono text-[10px]">{block.id}</p>
        </div>
        {locked ? (
          <Badge variant="neutral">
            <Lock aria-hidden />
            marca
          </Badge>
        ) : null}
      </div>

      {locked ? (
        <p className="text-muted-foreground px-4 py-3 text-[11px] leading-relaxed">
          Este bloco vem de um módulo de marca. Ele mantém cabeçalho, base legal e descadastro
          iguais em todos os e-mails — alterá-lo é tarefa do administrador, no módulo de origem.
        </p>
      ) : null}

      {blockIssues.length > 0 ? (
        <div className="space-y-1.5 px-4 pb-3">
          {blockIssues.map((issue) => (
            <div
              key={issue.id}
              className={cn(
                "flex items-start gap-2 rounded-md px-2.5 py-2 text-[11px] leading-relaxed",
                issue.severity === "erro" ? "bg-destructive-soft" : "bg-warning-soft",
              )}
            >
              {issue.severity === "erro" ? (
                <CircleAlert className="text-destructive mt-0.5 size-3.5 shrink-0" aria-hidden />
              ) : (
                <TriangleAlert className="text-warning mt-0.5 size-3.5 shrink-0" aria-hidden />
              )}
              {issue.message}
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-4 p-4">
        {block.kind === "texto" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="txt-content">Conteúdo</Label>
              <Textarea
                id="txt-content"
                value={block.content}
                readOnly={locked}
                onChange={(event) => onChange({ ...block, content: event.target.value })}
                className="min-h-32 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estilo</Label>
              <div className="grid grid-cols-2 gap-1">
                {(["titulo", "subtitulo", "corpo", "legenda"] as const).map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    disabled={locked}
                    onClick={() => onChange({ ...block, scale })}
                    aria-pressed={block.scale === scale}
                    className={cn(
                      "h-7 rounded-md text-[11px] font-medium capitalize transition-colors disabled:opacity-50",
                      block.scale === scale
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {scale}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Alinhamento</Label>
              <AlignPicker
                value={block.align}
                disabled={locked}
                onChange={(align) => onChange({ ...block, align })}
              />
            </div>
            {locked ? null : <MergeTagPicker onInsert={insertTag} />}
          </>
        ) : null}

        {block.kind === "imagem" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="img-source">Arquivo</Label>
              <Input
                id="img-source"
                value={block.source}
                readOnly={locked}
                onChange={(event) => onChange({ ...block, source: event.target.value })}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="img-alt">Texto alternativo</Label>
              <Textarea
                id="img-alt"
                value={block.alt}
                readOnly={locked}
                onChange={(event) => onChange({ ...block, alt: event.target.value })}
                className="min-h-16 text-xs"
              />
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Boa parte dos clientes bloqueia imagem por padrão. Sem este texto, o leitor vê um
                retângulo vazio.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="img-caption">Legenda</Label>
              <Input
                id="img-caption"
                value={block.caption ?? ""}
                readOnly={locked}
                onChange={(event) => onChange({ ...block, caption: event.target.value })}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Proporção</Label>
              <div className="flex gap-1">
                {(["16:9", "4:3", "1:1"] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    disabled={locked}
                    onClick={() => onChange({ ...block, ratio })}
                    aria-pressed={block.ratio === ratio}
                    className={cn(
                      "h-7 flex-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50",
                      block.ratio === ratio
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="img-href">Link ao clicar</Label>
              <Input
                id="img-href"
                value={block.href ?? ""}
                readOnly={locked}
                placeholder="https://"
                onChange={(event) => onChange({ ...block, href: event.target.value || undefined })}
                className="text-xs"
              />
            </div>
          </>
        ) : null}

        {block.kind === "botao" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="btn-label">Texto do botão</Label>
              <Input
                id="btn-label"
                value={block.label}
                readOnly={locked}
                onChange={(event) => onChange({ ...block, label: event.target.value })}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="btn-href">Link</Label>
              <Input
                id="btn-href"
                value={block.href}
                readOnly={locked}
                placeholder="https://"
                onChange={(event) => onChange({ ...block, href: event.target.value })}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estilo</Label>
              <div className="flex gap-1">
                {(["primario", "secundario"] as const).map((variant) => (
                  <button
                    key={variant}
                    type="button"
                    disabled={locked}
                    onClick={() => onChange({ ...block, variant })}
                    aria-pressed={block.variant === variant}
                    className={cn(
                      "h-7 flex-1 rounded-md text-[11px] font-medium capitalize transition-colors disabled:opacity-50",
                      block.variant === variant
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {variant}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Alinhamento</Label>
              <AlignPicker
                value={block.align}
                disabled={locked}
                onChange={(align) => onChange({ ...block, align })}
              />
            </div>
          </>
        ) : null}

        {block.kind === "espacador" ? (
          <div className="space-y-1.5">
            <Label htmlFor="spacer">Altura: {block.height} px</Label>
            <input
              id="spacer"
              type="range"
              min={8}
              max={64}
              step={4}
              value={block.height}
              disabled={locked}
              onChange={(event) => onChange({ ...block, height: Number(event.target.value) })}
              className="w-full accent-[hsl(var(--accent))]"
            />
          </div>
        ) : null}

        {block.kind === "colunas" ? (
          <div className="space-y-3">
            {block.columns.map((column, index) => (
              <div key={column.id} className="bg-muted/50 space-y-1.5 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <Eyebrow>Coluna {index + 1}</Eyebrow>
                  {block.columns.length > 1 && !locked ? (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remover coluna ${index + 1}`}
                      onClick={() =>
                        onChange({
                          ...block,
                          columns: block.columns.filter((item) => item.id !== column.id),
                        })
                      }
                    >
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
                <Input
                  value={column.title}
                  readOnly={locked}
                  aria-label={`Título da coluna ${index + 1}`}
                  onChange={(event) =>
                    onChange({
                      ...block,
                      columns: block.columns.map((item) =>
                        item.id === column.id ? { ...item, title: event.target.value } : item,
                      ),
                    })
                  }
                  className="text-xs"
                />
                <Textarea
                  value={column.body}
                  readOnly={locked}
                  aria-label={`Texto da coluna ${index + 1}`}
                  onChange={(event) =>
                    onChange({
                      ...block,
                      columns: block.columns.map((item) =>
                        item.id === column.id ? { ...item, body: event.target.value } : item,
                      ),
                    })
                  }
                  className="min-h-16 text-xs"
                />
              </div>
            ))}
            {!locked && block.columns.length < 3 ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  onChange({
                    ...block,
                    columns: [
                      ...block.columns,
                      {
                        id: `col_${block.columns.length + 1}_${block.id}`,
                        title: "Título",
                        body: "Texto da coluna.",
                      },
                    ],
                  })
                }
              >
                <Plus />
                Adicionar coluna
              </Button>
            ) : null}
          </div>
        ) : null}

        {block.kind === "video" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="vid-title">Título</Label>
              <Input
                id="vid-title"
                value={block.title}
                readOnly={locked}
                onChange={(event) => onChange({ ...block, title: event.target.value })}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vid-href">Link</Label>
              <Input
                id="vid-href"
                value={block.href}
                readOnly={locked}
                onChange={(event) => onChange({ ...block, href: event.target.value })}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vid-fallback">Texto alternativo</Label>
              <Input
                id="vid-fallback"
                value={block.fallbackText}
                readOnly={locked}
                onChange={(event) => onChange({ ...block, fallbackText: event.target.value })}
                className="text-xs"
              />
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Quase nenhum cliente de e-mail reproduz vídeo. O bloco vira capa clicável, e este
                texto é o que o leitor entende.
              </p>
            </div>
          </>
        ) : null}

        {block.kind === "html" ? (
          <div className="space-y-1.5">
            <Label htmlFor="html-content">HTML</Label>
            <Textarea
              id="html-content"
              value={block.html}
              readOnly={locked}
              onChange={(event) => onChange({ ...block, html: event.target.value })}
              className="min-h-40 font-mono text-[11px]"
            />
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Este bloco não passa pelo compilador de compatibilidade. Teste em Outlook antes de
              publicar.
            </p>
          </div>
        ) : null}

        {block.kind === "rodape" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="ft-address">Endereço</Label>
              <Textarea
                id="ft-address"
                value={block.address}
                readOnly={locked}
                onChange={(event) => onChange({ ...block, address: event.target.value })}
                className="min-h-16 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ft-legal">Base legal</Label>
              <Textarea
                id="ft-legal"
                value={block.legal}
                readOnly={locked}
                onChange={(event) => onChange({ ...block, legal: event.target.value })}
                className="min-h-16 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ft-unsub">Rótulo do descadastro</Label>
              <Input
                id="ft-unsub"
                value={block.unsubscribeLabel}
                readOnly={locked}
                onChange={(event) => onChange({ ...block, unsubscribeLabel: event.target.value })}
                className="text-xs"
              />
            </div>
          </>
        ) : null}

        {block.kind === "divisor" || block.kind === "social" || block.kind === "menu" ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {block.kind === "divisor"
              ? "O divisor usa a cor da marca e não tem configuração própria."
              : "Este bloco vem do módulo de marca. Edite no módulo para valer em todos os e-mails."}
          </p>
        ) : null}
      </div>

      {!locked ? (
        <div className="mt-auto p-4">
          <Button variant="danger" size="sm" className="w-full" onClick={onDelete}>
            <Trash2 />
            Remover bloco
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
