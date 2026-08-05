"use client";

import { cn } from "@crm/ui";
import {
  ArrowLeft,
  Battery,
  MoreVertical,
  Paperclip,
  Phone,
  Signal,
  Smile,
  Video,
  Wifi,
} from "lucide-react";

/**
 * Moldura de celular com a casca do WhatsApp.
 *
 * Aprovar uma mensagem lendo o texto cru esconde o que decide a leitura: onde
 * a quebra cai, quanto o cabeçalho ocupa, se o botão some abaixo da dobra. A
 * moldura devolve isso — o revisor vê o que o contato vai ver.
 *
 * As cores do WhatsApp são literais e não saem de token: é a casca de um
 * produto de terceiro, não a nossa interface.
 */
export function PhoneFrame({
  title = "Contabilidade Facilitada",
  subtitle = "online",
  children,
  footer,
  className,
  height = "26rem",
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  height?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[19.5rem]", className)}>
      <div className="shadow-overlay overflow-hidden rounded-[2rem] bg-slate-900 p-2">
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
              <span className="block truncate text-[13px] font-medium leading-tight">{title}</span>
              <span className="block truncate text-[10px] leading-tight text-white/70">
                {subtitle}
              </span>
            </span>
            <Video className="size-4 shrink-0 opacity-90" />
            <Phone className="size-3.5 shrink-0 opacity-90" />
            <MoreVertical className="size-4 shrink-0 opacity-90" />
          </div>

          {/* Conversa */}
          <div
            className="chat-canvas flex flex-col gap-1.5 overflow-y-auto px-3 py-3"
            style={{ height }}
          >
            {children}
          </div>

          {/* Campo de digitação — decorativo, só para fechar a moldura. */}
          {footer ?? (
            <div className="flex items-center gap-1.5 bg-[#F0F0F0] px-2 py-2">
              <div className="flex flex-1 items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5">
                <Smile className="size-3.5 shrink-0 text-slate-400" />
                <span className="text-[12px] text-slate-400">Mensagem</span>
                <Paperclip className="ml-auto size-3.5 shrink-0 text-slate-400" />
              </div>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#128C7E]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Bolha recebida — a que o contato vê quando a campanha chega. */
export function IncomingBubble({
  header,
  body,
  footer,
  buttons,
  timestamp = "14:32",
}: {
  header?: string;
  body: string;
  footer?: string;
  buttons?: string[];
  timestamp?: string;
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[88%] overflow-hidden rounded-xl rounded-tl-sm bg-white shadow-sm">
        <div className="px-2.5 py-1.5">
          {header ? (
            <p className="mb-1 text-[12.5px] font-bold leading-snug text-slate-900">{header}</p>
          ) : null}
          <p className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-slate-800">
            {body}
          </p>
          {footer ? (
            <p className="mt-1.5 text-[10.5px] leading-snug text-slate-500">{footer}</p>
          ) : null}
          <span className="mt-0.5 flex items-center justify-end text-[9px] text-slate-500">
            {timestamp}
          </span>
        </div>

        {buttons && buttons.length > 0 ? (
          <div className="border-t border-slate-200">
            {buttons.map((label) => (
              <div
                key={label}
                className="border-b border-slate-100 py-1.5 text-center text-[12px] font-medium text-[#0A7CFF] last:border-b-0"
              >
                {label}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
