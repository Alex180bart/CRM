"use client";

import { useEffect, useRef, useState } from "react";
import type { Attachment } from "@crm/core";
import { classifyUrl, formatBytes } from "@crm/core";
import {
  Badge,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  cn,
} from "@crm/ui";
import { AlertTriangle, Check, Film, Image as ImageIcon, Link2, Loader2 } from "lucide-react";

import { LinkError, resolveLink, toLinkAttachment } from "@/lib/attachments";

/**
 * Anexar por link.
 *
 * Existe porque metade do material que um atendente manda já está na internet:
 * o vídeo da aula, o print hospedado, o guia em PDF no site. Obrigá-lo a baixar
 * e subir de novo é trabalho inventado.
 *
 * A verificação é do servidor. O palpite local (`classifyUrl`) serve só para dar
 * retorno imediato enquanto ele digita — quem decide o que o link é de fato é a
 * rota, que lê o `Content-Type` real e resolve título e capa de vídeo.
 */
export function LinkAttachButton({
  onAttach,
  disabled,
}: {
  onAttach: (attachment: Attachment) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue("");
    setError(null);
    const focus = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(focus);
  }, [open]);

  // Palpite local, sem rede: adianta ao atendente que reconhecemos um vídeo.
  const guess = value.trim().length > 6 ? classifyUrl(value) : null;

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const resolved = await resolveLink(value);
      onAttach(toLinkAttachment(resolved));
      setOpen(false);
    } catch (failure) {
      setError(failure instanceof LinkError ? failure.message : "Não foi possível usar este link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Anexar por link (imagem, vídeo, YouTube)">
        <PopoverTrigger asChild disabled={disabled}>
          <Button variant="ghost" size="icon-sm" aria-label="Anexar por link">
            <Link2 />
          </Button>
        </PopoverTrigger>
      </Tooltip>

      <PopoverContent align="start" side="top" className="w-80 p-3">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold">
          <Link2 className="text-muted-foreground size-3.5" aria-hidden />
          Anexar por link
        </p>
        <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
          Endereço direto de imagem, vídeo ou documento. Link do YouTube entra com a capa e o
          título.
        </p>

        <Input
          ref={inputRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="https://…"
          aria-label="Endereço do link"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          className="h-8 text-xs"
        />

        {guess?.provider === "youtube" ? (
          <Badge variant="info" className="mt-2">
            <Film aria-hidden />
            Vídeo do YouTube reconhecido
          </Badge>
        ) : guess?.kind === "imagem" ? (
          <Badge variant="info" className="mt-2">
            <ImageIcon aria-hidden />
            Parece uma imagem
          </Badge>
        ) : null}

        {error ? (
          <p className="bg-destructive-soft text-destructive mt-2 flex items-start gap-1.5 rounded-md px-2 py-1.5 text-[11px] leading-relaxed">
            <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}

        <div className="mt-2.5 flex items-center justify-end gap-1.5">
          <Button variant="ghost" size="xs" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant="accent"
            size="xs"
            onClick={() => void submit()}
            disabled={busy || value.trim().length === 0}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
            {busy ? "Verificando" : "Anexar"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Ficha do anexo por link já resolvido, na bandeja do compositor.
 *
 * Mostra a capa quando existe, e o aviso de origem externa quando não: o
 * atendente precisa saber que aquele conteúdo mora em servidor de terceiro antes
 * de mandá-lo a um cliente.
 */
export function LinkChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  return (
    <div className="animate-scale-in bg-muted/80 shadow-card group relative flex items-center gap-2 overflow-hidden rounded-md pr-7">
      {attachment.previewUrl ? (
        // Capa vinda de host de terceiro: sem host conhecido em tempo de build, o
        // otimizador de imagem do Next não se aplica.
        <img src={attachment.previewUrl} alt="" className="size-10 shrink-0 object-cover" />
      ) : (
        <span className="bg-surface text-muted-foreground flex size-10 shrink-0 items-center justify-center">
          <Link2 className="size-4" aria-hidden />
        </span>
      )}

      <span className="min-w-0 max-w-44 py-1">
        <span className="block truncate text-[11px] font-medium">{attachment.fileName}</span>
        <span className={cn("text-muted-foreground block truncate text-[10px]")}>
          {attachment.provider === "youtube"
            ? "YouTube · link externo"
            : attachment.sizeBytes
              ? `link externo · ${formatBytes(attachment.sizeBytes)}`
              : "link externo"}
        </span>
      </span>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover ${attachment.fileName}`}
        className="text-muted-foreground hover:bg-surface hover:text-foreground absolute right-1 top-1 rounded p-0.5 transition-colors"
      >
        <span aria-hidden>×</span>
      </button>
    </div>
  );
}
