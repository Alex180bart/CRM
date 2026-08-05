"use client";

import { useRef, useState } from "react";
import type { BrandKit, EmailBlock, EmailBlockKind, EmailValidationIssue } from "@crm/core";
import { applyMergeTags, EMAIL_BLOCK_LABEL, EMAIL_MERGE_TAGS } from "@crm/core";
import { cn } from "@crm/ui";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  CircleAlert,
  Copy,
  GripVertical,
  Lock,
  Play,
  Trash2,
  TriangleAlert,
} from "lucide-react";

/** Tipos de arraste. Separados para o canvas saber se cria um bloco ou move um existente. */
export const EMAIL_BLOCK_DRAG = "application/email-block";
export const EMAIL_MOVE_DRAG = "application/email-move";

/**
 * Prévia do e-mail.
 *
 * Renderiza o documento de blocos com as cores da marca — em hexadecimal, não
 * em token, porque é assim que o HTML compilado vai sair. Este componente é a
 * fonte de verdade visual do editor: o que se vê aqui é o que o contato recebe.
 *
 * Em modo de edição, cada bloco ganha contorno e uma barra de ações. Em modo de
 * prévia, as merge tags viram os valores de amostra e o contorno some — é a
 * leitura do destinatário.
 */

const ALIGN_CSS = {
  esquerda: "left",
  centro: "center",
  direita: "right",
} as const;

const SOCIAL_LABEL: Record<string, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  facebook: "Facebook",
};

function renderText(value: string, preview: boolean): string {
  return preview ? applyMergeTags(value, EMAIL_MERGE_TAGS) : value;
}

/** Destaca as merge tags em modo de edição, sem alterar o texto. */
function TextWithTags({ value, preview }: { value: string; preview: boolean }) {
  if (preview) return <>{applyMergeTags(value, EMAIL_MERGE_TAGS)}</>;

  const parts = value.split(/(\{\{[^}]+\}\})/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("{{") && part.endsWith("}}") ? (
          <span
            key={index}
            style={{
              backgroundColor: "rgba(255, 153, 51, 0.22)",
              borderRadius: 3,
              padding: "0 3px",
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.92em",
            }}
          >
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function BlockBody({
  block,
  brand,
  preview,
}: {
  block: EmailBlock;
  brand: BrandKit;
  preview: boolean;
}) {
  switch (block.kind) {
    case "texto": {
      const size = { titulo: 26, subtitulo: 19, corpo: 15, legenda: 13 }[block.scale];
      const weight = block.scale === "titulo" || block.scale === "subtitulo" ? 700 : 400;
      return (
        <p
          style={{
            margin: 0,
            padding: "10px 32px",
            color: block.scale === "legenda" ? "#6B7A90" : brand.textColor,
            fontSize: size,
            fontWeight: weight,
            lineHeight: block.scale === "corpo" ? 1.65 : 1.3,
            textAlign: ALIGN_CSS[block.align],
            whiteSpace: "pre-wrap",
          }}
        >
          <TextWithTags value={block.content} preview={preview} />
        </p>
      );
    }

    case "imagem": {
      const aspect = { "16:9": "16 / 9", "4:3": "4 / 3", "1:1": "1 / 1" }[block.ratio];
      return (
        <div style={{ padding: "10px 32px" }}>
          <div
            style={{
              aspectRatio: aspect,
              background: `linear-gradient(135deg, ${brand.primaryColor}14, ${brand.accentColor}22)`,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: brand.primaryColor,
              fontSize: 12,
              textAlign: "center",
              padding: 16,
            }}
          >
            {block.alt.trim().length > 0 ? block.alt : "Imagem sem texto alternativo"}
          </div>
          {block.caption ? (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6B7A90", textAlign: "center" }}>
              {renderText(block.caption, preview)}
            </p>
          ) : null}
        </div>
      );
    }

    case "botao": {
      const primary = block.variant === "primario";
      return (
        <div style={{ padding: "14px 32px", textAlign: ALIGN_CSS[block.align] }}>
          <span
            style={{
              display: "inline-block",
              backgroundColor: primary ? brand.accentColor : "transparent",
              color: primary ? "#12233D" : brand.primaryColor,
              border: primary ? "none" : `1px solid ${brand.primaryColor}44`,
              borderRadius: 8,
              padding: "13px 26px",
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            {renderText(block.label, preview)}
          </span>
        </div>
      );
    }

    case "divisor":
      return (
        <div style={{ padding: "6px 32px" }}>
          <div style={{ height: 1, backgroundColor: `${brand.primaryColor}1F` }} />
        </div>
      );

    case "espacador":
      return <div style={{ height: block.height }} />;

    case "colunas":
      return (
        <div
          style={{
            padding: "12px 32px",
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(block.columns.length, 3)}, minmax(0, 1fr))`,
            gap: 18,
          }}
        >
          {block.columns.map((column) => (
            <div key={column.id}>
              <p
                style={{
                  margin: "0 0 5px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: brand.primaryColor,
                }}
              >
                {renderText(column.title, preview)}
              </p>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: brand.textColor }}>
                {renderText(column.body, preview)}
              </p>
            </div>
          ))}
        </div>
      );

    case "menu":
      return (
        <div
          style={{
            padding: "10px 32px",
            display: "flex",
            flexWrap: "wrap",
            gap: 18,
            justifyContent: "center",
          }}
        >
          {block.items.map((item) => (
            <span
              key={item.id}
              style={{ fontSize: 13, color: brand.primaryColor, textDecoration: "underline" }}
            >
              {item.label}
            </span>
          ))}
        </div>
      );

    case "social":
      return (
        <div style={{ padding: "10px 32px", display: "flex", gap: 10, justifyContent: "center" }}>
          {block.networks.map((network) => (
            <span
              key={network}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: `${brand.primaryColor}14`,
                color: brand.primaryColor,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 700,
              }}
              title={SOCIAL_LABEL[network]}
            >
              {SOCIAL_LABEL[network]?.slice(0, 2).toUpperCase()}
            </span>
          ))}
        </div>
      );

    case "video":
      return (
        <div style={{ padding: "10px 32px" }}>
          <div
            style={{
              position: "relative",
              aspectRatio: "16 / 9",
              borderRadius: 8,
              background: `linear-gradient(135deg, ${brand.primaryColor}, ${brand.primaryColor}CC)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: "#FFFFFF",
              padding: 16,
              textAlign: "center",
            }}
          >
            <span
              style={{
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: brand.accentColor,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#12233D",
              }}
            >
              <Play className="size-5" aria-hidden />
            </span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{block.title}</span>
            <span style={{ fontSize: 12, opacity: 0.85 }}>{block.fallbackText}</span>
          </div>
        </div>
      );

    case "rodape":
      return (
        <div style={{ padding: "14px 32px 26px", textAlign: "center" }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, lineHeight: 1.6, color: "#6B7A90" }}>
            {block.address}
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 11, lineHeight: 1.6, color: "#6B7A90" }}>
            {block.legal}
          </p>
          <span
            style={{
              fontSize: 11,
              color: brand.primaryColor,
              textDecoration: "underline",
              fontWeight: 600,
            }}
          >
            {block.unsubscribeLabel}
          </span>
        </div>
      );

    case "html":
      return (
        <div style={{ padding: "10px 32px" }}>
          <div
            style={{
              border: "1px dashed #C6CFDD",
              borderRadius: 8,
              padding: 12,
              fontFamily: "ui-monospace, monospace",
              fontSize: 11,
              color: "#5A6A80",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 140,
              overflow: "hidden",
            }}
          >
            {block.html}
          </div>
        </div>
      );

    default:
      return null;
  }
}

export function EmailCanvas({
  blocks,
  brand,
  preheader,
  preview,
  device,
  selectedBlockId,
  issues,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onInsert,
  onReorder,
}: {
  blocks: EmailBlock[];
  brand: BrandKit;
  preheader: string;
  preview: boolean;
  device: "desktop" | "mobile";
  selectedBlockId: string | null;
  issues: EmailValidationIssue[];
  onSelect: (blockId: string | null) => void;
  onMove: (blockId: string, direction: -1 | 1) => void;
  onDuplicate: (blockId: string) => void;
  onDelete: (blockId: string) => void;
  /** Bloco novo vindo da paleta, largado na posição `index`. */
  onInsert: (kind: EmailBlockKind, index: number) => void;
  /** Bloco existente arrastado para a posição `index`. */
  onReorder: (blockId: string, index: number) => void;
}) {
  /**
   * Onde a linha de encaixe aparece. O estado desenha; a referência decide.
   *
   * Estado do React é confirmado depois do evento, e `drop` pode chegar no mesmo
   * quadro do `dragover` que definiu o alvo — nesse caso o estado ainda estaria
   * nulo e o bloco não iria para lugar nenhum. A referência é escrita na hora.
   */
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dropIndexRef = useRef<number | null>(null);

  function setDrop(next: number | null) {
    dropIndexRef.current = next;
    setDropIndex(next);
  }

  const issueByBlock = new Map<string, EmailValidationIssue["severity"]>();
  for (const issue of issues) {
    if (!issue.blockId) continue;
    if (issueByBlock.get(issue.blockId) === "erro") continue;
    issueByBlock.set(issue.blockId, issue.severity);
  }

  /**
   * Metade de cima encaixa antes do bloco, metade de baixo depois. É a convenção
   * de todo editor de página: o ponteiro decide, não o alvo.
   */
  function handleDragOver(event: React.DragEvent, index: number) {
    if (preview) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = event.dataTransfer.types.includes(EMAIL_MOVE_DRAG)
      ? "move"
      : "copy";
    const bounds = event.currentTarget.getBoundingClientRect();
    const after = event.clientY - bounds.top > bounds.height / 2;
    setDrop(after ? index + 1 : index);
  }

  function handleDrop(event: React.DragEvent) {
    const target = dropIndexRef.current;
    if (preview || target === null) return;
    event.preventDefault();
    event.stopPropagation();

    const movingId = event.dataTransfer.getData(EMAIL_MOVE_DRAG);
    if (movingId) {
      onReorder(movingId, target);
    } else {
      const kind = event.dataTransfer.getData(EMAIL_BLOCK_DRAG) as EmailBlockKind;
      if (kind) onInsert(kind, target);
    }
    setDrop(null);
  }

  /** Fio laranja de encaixe. Ocupa altura zero para não empurrar o layout. */
  function DropLine({ active }: { active: boolean }) {
    return (
      <div className="relative h-0" aria-hidden>
        <span
          className={cn(
            "bg-accent absolute inset-x-0 -top-px h-0.5 origin-left rounded-full transition-transform duration-150",
            active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
          )}
        />
      </div>
    );
  }

  return (
    <div
      className="bg-surface-sunken flex min-h-full justify-center overflow-y-auto p-6"
      onClick={() => onSelect(null)}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDrop(null);
      }}
      onDrop={handleDrop}
      onDragOver={(event) => {
        // Sem isto o navegador recusa o drop no espaço fora dos blocos.
        if (!preview) event.preventDefault();
      }}
    >
      <div
        className="transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ width: device === "desktop" ? 600 : 360 }}
      >
        {/* Linha de prévia da caixa de entrada */}
        {preheader.trim().length > 0 ? (
          <p className="text-muted-foreground mb-2 truncate text-center text-[11px] italic">
            Prévia na caixa: “{renderText(preheader, preview)}”
          </p>
        ) : null}

        <div
          className="shadow-raised overflow-hidden rounded-lg"
          style={{ backgroundColor: brand.backgroundColor, fontFamily: brand.fontStack }}
        >
          {blocks.length === 0 ? (
            <div
              className="px-8 py-16"
              onDragOver={(event) => {
                if (preview) return;
                event.preventDefault();
                setDrop(0);
              }}
            >
              <p className="text-muted-foreground text-center text-xs">
                E-mail vazio. Arraste um bloco da paleta até aqui.
              </p>
            </div>
          ) : (
            blocks.map((block, index) => {
              const selected = block.id === selectedBlockId;
              const severity = issueByBlock.get(block.id);
              const movable = !preview && !block.locked;

              return (
                <div
                  key={block.id}
                  className={cn("group/block relative", !preview && "cursor-pointer")}
                  draggable={movable}
                  onDragStart={(event) => {
                    if (!movable) return;
                    event.dataTransfer.setData(EMAIL_MOVE_DRAG, block.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDrop(null)}
                  onDragOver={(event) => handleDragOver(event, index)}
                  onClick={(event) => {
                    if (preview) return;
                    event.stopPropagation();
                    onSelect(block.id);
                  }}
                >
                  <DropLine active={dropIndex === index} />

                  {/* Alça de arraste — só aparece no hover, para não poluir a prévia do layout. */}
                  {movable ? (
                    <span
                      className="bg-card text-muted-foreground shadow-card absolute -left-7 top-2 z-10 cursor-grab rounded p-1 opacity-0 transition-opacity group-hover/block:opacity-100"
                      aria-hidden
                    >
                      <GripVertical className="size-3.5" />
                    </span>
                  ) : null}

                  {/* Contorno de seleção e de problema, só na edição */}
                  {!preview ? (
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-0 rounded-[3px] transition-colors",
                        selected
                          ? "ring-accent ring-2"
                          : severity === "erro"
                            ? "ring-destructive/60 ring-1"
                            : severity === "alerta"
                              ? "ring-warning/60 ring-1"
                              : "hover:ring-primary/25 ring-0 ring-transparent hover:ring-1",
                      )}
                    />
                  ) : null}

                  <BlockBody block={block} brand={brand} preview={preview} />

                  {/* Etiqueta e ações do bloco selecionado */}
                  {!preview && selected ? (
                    <div className="bg-primary text-primary-foreground shadow-overlay absolute -top-3 left-2 z-10 flex items-center gap-0.5 rounded-md px-1 py-0.5">
                      <span className="px-1.5 text-[10px] font-medium">
                        {EMAIL_BLOCK_LABEL[block.kind]}
                      </span>
                      {block.locked ? (
                        <span
                          className="px-1"
                          title="Bloco de marca travado. Só administradores alteram."
                        >
                          <Lock className="size-3" aria-hidden />
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="hover:bg-primary-foreground/15 rounded p-1 disabled:opacity-40"
                            disabled={index === 0}
                            onClick={(event) => {
                              event.stopPropagation();
                              onMove(block.id, -1);
                            }}
                            aria-label="Mover bloco para cima"
                          >
                            <ArrowUp className="size-3" />
                          </button>
                          <button
                            type="button"
                            className="hover:bg-primary-foreground/15 rounded p-1 disabled:opacity-40"
                            disabled={index === blocks.length - 1}
                            onClick={(event) => {
                              event.stopPropagation();
                              onMove(block.id, 1);
                            }}
                            aria-label="Mover bloco para baixo"
                          >
                            <ArrowDown className="size-3" />
                          </button>
                          <button
                            type="button"
                            className="hover:bg-primary-foreground/15 rounded p-1"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDuplicate(block.id);
                            }}
                            aria-label="Duplicar bloco"
                          >
                            <Copy className="size-3" />
                          </button>
                          <button
                            type="button"
                            className="text-destructive-foreground hover:bg-destructive rounded p-1"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete(block.id);
                            }}
                            aria-label="Remover bloco"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}

                  {/* Sinal de problema no canto do bloco */}
                  {!preview && severity && !selected ? (
                    <span
                      className={cn(
                        "absolute right-2 top-2 z-10 rounded-full p-0.5",
                        severity === "erro"
                          ? "bg-destructive text-destructive-foreground"
                          : "bg-warning text-warning-foreground",
                      )}
                      aria-hidden
                    >
                      {severity === "erro" ? (
                        <CircleAlert className="size-3" />
                      ) : (
                        <TriangleAlert className="size-3" />
                      )}
                    </span>
                  ) : null}

                  {index === blocks.length - 1 ? (
                    <DropLine active={dropIndex === blocks.length} />
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <p className="text-muted-foreground mt-3 flex items-center justify-center gap-1 text-[11px]">
          <ChevronRight className="size-3" aria-hidden />
          {device === "desktop" ? "600 px — largura padrão de e-mail" : "360 px — celular"}
        </p>
      </div>
    </div>
  );
}
