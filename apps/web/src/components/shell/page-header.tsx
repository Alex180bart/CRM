import { cn } from "@crm/ui";

/**
 * Cabeçalho de página.
 *
 * Uma faixa de vidro, sem traço inferior duro: a separação vem do desfoque
 * sobre o conteúdo que rola por baixo. O título usa a face de exibição; a
 * descrição existe só quando acrescenta algo que o título não diz.
 */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
  compact,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <header
      className={cn(
        "glass shadow-inset-hairline sticky top-0 z-30 flex shrink-0 items-center justify-between gap-4 px-5",
        compact ? "h-16" : "min-h-16 py-3.5",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-foreground truncate text-[1.0625rem] font-semibold tracking-tight">
            {title}
          </h1>
          {meta}
        </div>
        {description ? (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
