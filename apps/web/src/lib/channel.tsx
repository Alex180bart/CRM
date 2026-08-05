import type { ChannelKind } from "@crm/core";
import { cn } from "@crm/ui";
import { AtSign, FileText, Globe, Lock, Phone, type LucideIcon } from "lucide-react";

import {
  BRAND_INK,
  BRAND_SURFACE,
  InstagramGlyph,
  MessengerGlyph,
  WhatsAppGlyph,
  type BrandGlyphProps,
} from "./brand-icons";

/**
 * Aparência por canal.
 *
 * Canais de terceiros usam a **marca real** — o atendente varre a lista pelo
 * ícone, e um balão genérico não distingue WhatsApp de Messenger. Canais nossos
 * (e-mail, webchat, formulário, telefone, interno) usam ícone do sistema com a
 * cor derivada de matiz: a diferença entre marca e ícone neutro também informa
 * de quem é o canal.
 *
 * O canal continua sendo um adaptador (seção 3.2 do plano) — a marca é
 * identificação visual, não acoplamento de regra de negócio.
 */
type ChannelStyle =
  | { brand: true; glyph: (props: BrandGlyphProps) => React.ReactElement; label: string }
  | { brand: false; icon: LucideIcon; hue: number; label: string };

const CHANNEL_STYLE: Record<ChannelKind, ChannelStyle> = {
  whatsapp: { brand: true, glyph: WhatsAppGlyph, label: "WhatsApp" },
  instagram: { brand: true, glyph: InstagramGlyph, label: "Instagram" },
  messenger: { brand: true, glyph: MessengerGlyph, label: "Messenger" },
  email: { brand: false, icon: AtSign, hue: 208, label: "E-mail" },
  webchat: { brand: false, icon: Globe, hue: 30, label: "Webchat" },
  form: { brand: false, icon: FileText, hue: 280, label: "Formulário" },
  phone: { brand: false, icon: Phone, hue: 190, label: "Telefone" },
  internal: { brand: false, icon: Lock, hue: 218, label: "Interno" },
};

export function channelStyle(kind: ChannelKind) {
  return CHANNEL_STYLE[kind];
}

export function channelLabel(kind: ChannelKind): string {
  return CHANNEL_STYLE[kind].label;
}

export function ChannelIcon({
  kind,
  className,
  withBackground = false,
}: {
  kind: ChannelKind;
  className?: string;
  withBackground?: boolean;
}) {
  const style = CHANNEL_STYLE[kind];

  /* Marca de terceiro ----------------------------------------------------- */
  if (style.brand) {
    const Glyph = style.glyph;

    if (!withBackground) {
      return <Glyph className={cn("size-4", BRAND_INK[kind], className)} />;
    }

    return (
      <span
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-md"
        style={{ background: BRAND_SURFACE[kind] }}
        title={style.label}
        aria-label={style.label}
        role="img"
      >
        <Glyph className="size-3 text-white" />
      </span>
    );
  }

  /* Canal próprio --------------------------------------------------------- */
  const Icon = style.icon;

  if (!withBackground) {
    return (
      <Icon
        className={className}
        style={{ color: `hsl(${style.hue} 55% var(--hue-fg-l))` }}
        aria-hidden
      />
    );
  }

  return (
    <span
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-md"
      style={{
        backgroundColor: `hsl(${style.hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
        color: `hsl(${style.hue} 55% var(--hue-fg-l))`,
      }}
      title={style.label}
      aria-label={style.label}
      role="img"
    >
      <Icon className="size-3" aria-hidden />
    </span>
  );
}
