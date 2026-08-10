import { DEMO_VERTICALS, type DemoVerticalMeta } from "@elora/core";
import { Badge, Button, Card, CardContent, cn } from "@elora/ui";
import { ArrowRight, Check } from "lucide-react";

import { openVerticalAction } from "@/app/(site)/actions";

/**
 * Vitrine das bases de demonstração.
 *
 * O botão **não** abre um vídeo nem um tour guiado: ele recarrega o armazém do
 * servidor com a vertical escolhida e joga a pessoa dentro do produto de
 * verdade, no Inbox, com contatos, conversas, funis e campanhas daquele
 * segmento. É a diferença entre "veja como seria" e "está aqui".
 *
 * A consequência honesta disso está escrita no rodapé do bloco: a troca vale
 * para a instância inteira. Sem back-end e com repositório em memória único, não
 * existe versão "só para o meu navegador" — e esconder isso produziria a cena em
 * que dois vendedores demonstram ao mesmo tempo e um vê a base do outro.
 */

const HUE_STYLE = (hue: number) =>
  ({
    ["--vertical-hue" as string]: String(hue),
    backgroundColor: `hsl(${hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
    color: `hsl(${hue} 68% var(--hue-fg-l))`,
  }) as React.CSSProperties;

export function VerticalCard({
  vertical,
  index,
  compact = false,
}: {
  vertical: DemoVerticalMeta;
  index: number;
  compact?: boolean;
}) {
  return (
    <Card
      id={vertical.id}
      className={cn("lift-3d flex h-full scroll-mt-24 flex-col", compact && "text-sm")}
    >
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span
              className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={HUE_STYLE(vertical.hue)}
            >
              {vertical.name}
            </span>
            <h3 className="font-display mt-3 text-lg font-semibold leading-tight">
              {vertical.company}
            </h3>
            <p className="text-muted-foreground text-sm">{vertical.tagline}</p>
          </div>
          <span className="figure text-muted-foreground/40 text-2xl">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>

        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">{vertical.description}</p>

        <ul className="mt-4 space-y-2">
          {vertical.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-2 text-sm leading-snug">
              <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>

        <dl className="border-border mt-5 grid grid-cols-3 gap-3 border-t pt-4">
          {vertical.stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-muted-foreground text-[10px] uppercase leading-tight tracking-wide">
                {stat.label}
              </dt>
              <dd className="figure mt-0.5 text-base font-semibold">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {vertical.channels.map((channel) => (
            <Badge key={channel} variant="neutral" size="sm">
              {channel}
            </Badge>
          ))}
        </div>

        <form action={openVerticalAction} className="mt-5 pt-1">
          <input type="hidden" name="vertical" value={vertical.id} />
          <Button type="submit" className="w-full" variant="outline">
            Abrir esta demonstração
            <ArrowRight />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function VerticalGallery({ compact = false }: { compact?: boolean }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {DEMO_VERTICALS.map((vertical, index) => (
        <VerticalCard key={vertical.id} vertical={vertical} index={index} compact={compact} />
      ))}
    </div>
  );
}
