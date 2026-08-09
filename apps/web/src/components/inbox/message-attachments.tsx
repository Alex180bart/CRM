"use client";

import { useState } from "react";
import type { Attachment } from "@elora/core";
import { ATTACHMENT_KIND_LABEL, formatBytes } from "@elora/core";
import { Badge, Dialog, DialogContent, DialogTitle, Tooltip, cn } from "@elora/ui";
import {
  Download,
  ExternalLink,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Film,
  ImageOff,
  Link2,
  Mic,
  Paperclip,
  Play,
  type LucideIcon,
} from "lucide-react";

import { YouTubePlayGlyph } from "@/lib/brand-icons";

/**
 * Anexos dentro da bolha.
 *
 * A regra é uma: **imagem se olha, documento se identifica**. Imagem entra
 * grande e clicável, porque num atendimento ela costuma ser a mensagem — o
 * print do erro, a tela bloqueada, o boleto. Documento entra como ficha com
 * nome, tipo e tamanho, porque é o nome do arquivo que diz se é o certo.
 *
 * Quando não há URL, a interface diz que o arquivo está sendo processado em vez
 * de mostrar uma imagem quebrada: o registro do anexo existe desde o
 * recebimento, mas o link assinado só nasce depois do processamento de mídia
 * (seção 11 do plano).
 */

/** O ícone sai da extensão, não do MIME: é o que o atendente reconhece. */
function documentIcon(attachment: Attachment): LucideIcon {
  const name = attachment.fileName.toLowerCase();
  if (/\.(xlsx?|csv|ods)$/.test(name)) return FileSpreadsheet;
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return FileArchive;
  if (/\.(pdf|docx?|txt|odt|xml)$/.test(name)) return FileText;
  return Paperclip;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function MessageAttachments({
  attachments,
  outbound,
}: {
  attachments: Attachment[];
  outbound: boolean;
}) {
  const [lightbox, setLightbox] = useState<Attachment | null>(null);

  const images = attachments.filter((item) => item.kind === "imagem");
  const others = attachments.filter((item) => item.kind !== "imagem");

  return (
    <>
      {images.length > 0 ? (
        <div
          className={cn(
            "mt-1 grid gap-1",
            // Uma imagem ocupa a largura toda; duas ou mais formam mosaico.
            images.length === 1 ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {images.map((attachment) => (
            <ImageTile
              key={attachment.id}
              attachment={attachment}
              alone={images.length === 1}
              onOpen={() => setLightbox(attachment)}
            />
          ))}
        </div>
      ) : null}

      {others.length > 0 ? (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {others.map((attachment) =>
            attachment.kind === "audio" ? (
              <AudioCard key={attachment.id} attachment={attachment} outbound={outbound} />
            ) : attachment.kind === "video" ? (
              <VideoCard key={attachment.id} attachment={attachment} />
            ) : (
              <DocumentCard key={attachment.id} attachment={attachment} outbound={outbound} />
            ),
          )}
        </div>
      ) : null}

      <Dialog open={lightbox !== null} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="bg-primary/95 w-[min(94vw,64rem)] max-w-none">
          <DialogTitle className="sr-only">{lightbox?.fileName ?? "Imagem"}</DialogTitle>
          {lightbox?.url ? (
            <div className="flex min-h-0 flex-col">
              {/* URL local ou assinada do provedor de mídia: host desconhecido em
                  tempo de build, então o otimizador de imagem não se aplica. */}
              <img
                src={lightbox.url}
                alt={lightbox.fileName}
                className="animate-scale-in max-h-[76vh] w-full object-contain"
              />
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="text-primary-foreground/80 min-w-0 truncate text-xs">
                  {lightbox.fileName}
                  {lightbox.sizeBytes === undefined ? "" : ` · ${formatBytes(lightbox.sizeBytes)}`}
                  {lightbox.source === "link" ? " · link externo" : ""}
                </p>
                {/**
                 * Conteúdo de outro domínio não pode ser baixado por `download`:
                 * o navegador ignora o atributo e navega, o que tiraria o
                 * atendente do CRM. Para link externo a ação é abrir em aba nova.
                 */}
                <a
                  href={lightbox.url}
                  {...(lightbox.source === "link"
                    ? { target: "_blank", rel: "noreferrer noopener" }
                    : { download: lightbox.fileName })}
                  className="bg-surface/15 text-primary-foreground hover:bg-surface/25 inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors"
                >
                  {lightbox.source === "link" ? (
                    <ExternalLink className="size-3.5" aria-hidden />
                  ) : (
                    <Download className="size-3.5" aria-hidden />
                  )}
                  {lightbox.source === "link" ? "Abrir original" : "Baixar"}
                </a>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ImageTile({
  attachment,
  alone,
  onOpen,
}: {
  attachment: Attachment;
  alone: boolean;
  onOpen: () => void;
}) {
  const source = attachment.previewUrl ?? attachment.url;

  if (!source) {
    return (
      <div
        className={cn(
          "bg-muted/70 text-muted-foreground flex flex-col items-center justify-center gap-1.5 rounded-lg",
          alone ? "h-40" : "h-28",
        )}
      >
        <ImageOff className="size-5" aria-hidden />
        <p className="max-w-full truncate px-3 text-[11px]">{attachment.fileName}</p>
        <p className="text-[10px]">Processando mídia</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "bg-muted/70 group relative block overflow-hidden rounded-lg",
        alone ? "max-h-72" : "h-28",
      )}
      aria-label={`Abrir imagem ${attachment.fileName}`}
    >
      {/* URL local ou assinada do provedor de mídia: host desconhecido em tempo
          de build, então o otimizador de imagem não se aplica. */}
      <img
        src={source}
        alt={attachment.fileName}
        className={cn(
          "w-full transition-transform duration-500 group-hover:scale-[1.03]",
          alone ? "max-h-72 object-contain" : "h-28 object-cover",
        )}
        loading="lazy"
      />
      {/* Véu de baixo para cima: sustenta o nome do arquivo sobre qualquer imagem. */}
      <span className="from-primary/70 pointer-events-none absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="text-primary-foreground truncate text-[11px] font-medium">
          {attachment.fileName}
        </span>
      </span>
    </button>
  );
}

function DocumentCard({ attachment, outbound }: { attachment: Attachment; outbound: boolean }) {
  const Icon = documentIcon(attachment);
  // Conteúdo de terceiro: o atendente precisa saber que o arquivo não é nosso e
  // pode mudar ou sair do ar sem aviso.
  const external = attachment.source === "link";

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2",
        outbound ? "bg-chat-in/70" : "bg-muted/70",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-md",
          outbound ? "bg-chat-out text-chat-out-foreground" : "bg-surface text-muted-foreground",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{attachment.fileName}</span>
        <span className="text-muted-foreground flex items-center gap-1 text-[11px] tabular-nums">
          {external ? <Link2 className="size-2.5 shrink-0" aria-hidden /> : null}
          {external ? "Link externo" : ATTACHMENT_KIND_LABEL[attachment.kind]}
          {attachment.sizeBytes === undefined ? "" : ` · ${formatBytes(attachment.sizeBytes)}`}
        </span>
      </span>

      {attachment.url ? (
        <Tooltip content={external ? "Abrir em nova aba" : "Baixar arquivo"}>
          <a
            href={attachment.url}
            {...(external
              ? { target: "_blank", rel: "noreferrer noopener" }
              : { download: attachment.fileName })}
            className="text-muted-foreground hover:bg-surface hover:text-foreground shrink-0 rounded-md p-1.5 transition-colors"
            aria-label={`${external ? "Abrir" : "Baixar"} ${attachment.fileName}`}
          >
            {external ? (
              <ExternalLink className="size-4" aria-hidden />
            ) : (
              <Download className="size-4" aria-hidden />
            )}
          </a>
        </Tooltip>
      ) : (
        <Badge variant="neutral" className="shrink-0">
          processando
        </Badge>
      )}
    </div>
  );
}

/**
 * Áudio.
 *
 * Usa o player nativo em vez de um desenho de onda próprio: a onda seria
 * decorativa, já que sem processamento no servidor não existe amostra de
 * amplitude para desenhar. A transcrição, quando a organização habilita, é o
 * que de fato acelera o atendimento — dá para ler em três segundos o que o
 * áudio leva um minuto para dizer.
 */
function AudioCard({ attachment, outbound }: { attachment: Attachment; outbound: boolean }) {
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div className={cn("rounded-lg px-2.5 py-2", outbound ? "bg-chat-in/70" : "bg-muted/70")}>
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full",
            outbound ? "bg-chat-out text-chat-out-foreground" : "bg-surface text-muted-foreground",
          )}
        >
          <Mic className="size-4" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          {attachment.url ? (
            <audio controls preload="none" src={attachment.url} className="h-8 w-full">
              <track kind="captions" />
            </audio>
          ) : (
            <p className="text-muted-foreground text-[11px]">Áudio em processamento</p>
          )}
        </div>

        {attachment.durationSeconds ? (
          <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
            {formatDuration(attachment.durationSeconds)}
          </span>
        ) : null}
      </div>

      {attachment.transcript ? (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setShowTranscript((value) => !value)}
            className="text-accent-ink text-[11px] font-medium underline-offset-2 hover:underline"
          >
            {showTranscript ? "Ocultar transcrição" : "Ver transcrição"}
          </button>
          {showTranscript ? (
            <p className="animate-fade-up text-muted-foreground mt-1 whitespace-pre-wrap text-[11px] leading-relaxed">
              {attachment.transcript}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function VideoCard({ attachment }: { attachment: Attachment }) {
  // Vídeo de provedor é página, não arquivo: tem capa e título, e não tem bytes
  // para um <video> tocar.
  if (attachment.provider === "youtube") {
    return <ProviderVideoCard attachment={attachment} />;
  }

  if (!attachment.url) {
    return (
      <div className="bg-muted/70 text-muted-foreground flex h-28 flex-col items-center justify-center gap-1.5 rounded-lg">
        <Film className="size-5" aria-hidden />
        <p className="max-w-full truncate px-3 text-[11px]">{attachment.fileName}</p>
        <p className="text-[10px]">Processando mídia</p>
      </div>
    );
  }

  return (
    <div className="bg-primary/90 relative overflow-hidden rounded-lg">
      <video
        controls
        preload="metadata"
        poster={attachment.previewUrl}
        src={attachment.url}
        className="max-h-64 w-full"
      >
        <track kind="captions" />
      </video>
      {attachment.durationSeconds ? (
        <span className="bg-primary/70 text-primary-foreground pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
          <Play className="size-2.5" aria-hidden />
          {formatDuration(attachment.durationSeconds)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Vídeo hospedado em provedor — hoje, YouTube.
 *
 * Mostra capa e título e **abre em aba nova** em vez de embutir o player. Não é
 * limitação: incorporar o quadro do YouTube carregaria script de terceiro dentro
 * da tela que exibe conversa de cliente, e isso não se justifica por conveniência
 * de reprodução. A capa já resolve o que o atendente precisa — saber qual vídeo é
 * antes de clicar.
 *
 * A capa em si vem de `i.ytimg.com`, então é uma requisição a terceiro. É
 * inevitável para haver capa, e é só uma imagem.
 */
function ProviderVideoCard({ attachment }: { attachment: Attachment }) {
  const href = attachment.externalUrl ?? attachment.url;
  const [coverFailed, setCoverFailed] = useState(false);
  const cover = coverFailed ? undefined : attachment.previewUrl;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="bg-primary/90 group relative block overflow-hidden rounded-lg"
      aria-label={`Abrir no YouTube: ${attachment.title ?? attachment.fileName}`}
    >
      {cover ? (
        // Capa do provedor: host de terceiro, fora do alcance do otimizador.
        <img
          src={cover}
          alt=""
          // A capa do YouTube vem em 4:3 com faixas pretas; recortar para 16:9
          // remove as faixas e devolve o enquadramento que o autor escolheu.
          className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <div className="text-primary-foreground/70 flex aspect-video w-full items-center justify-center">
          <Film className="size-6" aria-hidden />
        </div>
      )}

      {/**
       * Véu para o título ficar legível sobre qualquer capa.
       *
       * Opaco de propósito na base: capa de vídeo é imprevisível, e um véu leve
       * funciona no teste com miniatura escura e falha na primeira que tiver céu
       * claro atrás do texto.
       */}
      <span className="from-primary/95 via-primary/65 pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent p-2.5 pt-10">
        <span className="text-primary-foreground line-clamp-2 block text-xs font-semibold leading-snug">
          {attachment.title ?? attachment.fileName}
        </span>
        <span className="text-primary-foreground/75 mt-0.5 flex items-center gap-1 text-[10px]">
          <ExternalLink className="size-2.5" aria-hidden />
          YouTube · abre em nova aba
        </span>
      </span>

      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <YouTubePlayGlyph className="h-8 w-auto drop-shadow-lg transition-transform duration-300 group-hover:scale-110" />
      </span>
    </a>
  );
}
