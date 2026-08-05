"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger, SearchInput, Tooltip, cn } from "@crm/ui";
import { Clock, Smile } from "lucide-react";

import {
  EMOJI_GROUPS,
  pushRecentEmoji,
  readRecentEmojis,
  searchEmojis,
  type EmojiEntry,
} from "@/lib/emoji";

const RECENTS_ID = "recentes";

/**
 * Seletor de emojis.
 *
 * Três decisões que definem a velocidade de uso: a busca em português vem
 * primeiro (o atendente digita "polegar", não rola atrás do ícone); os recentes
 * abrem por padrão quando existem, porque atendimento repete os mesmos dez
 * emojis; e a inserção acontece **na posição do cursor**, não no fim do texto —
 * quem já escreveu a frase quer o emoji onde parou.
 */
export function EmojiPicker({
  onSelect,
  disabled,
}: {
  onSelect: (char: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [recents, setRecents] = useState<string[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>(EMOJI_GROUPS[0]?.id ?? "trabalho");
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // O localStorage só existe no cliente: ler depois da montagem evita
  // divergência entre o HTML do servidor e a primeira renderização.
  useEffect(() => {
    if (!open) return;
    const stored = readRecentEmojis();
    setRecents(stored);
    setActiveGroup(stored.length > 0 ? RECENTS_ID : (EMOJI_GROUPS[0]?.id ?? "trabalho"));
    setTerm("");
    // O foco no campo de busca é o que torna o teclado o caminho mais rápido.
    const focus = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => window.clearTimeout(focus);
  }, [open]);

  const results = useMemo(() => searchEmojis(term), [term]);
  const searching = term.trim().length > 0;

  const groups = useMemo(() => {
    if (recents.length === 0) return EMOJI_GROUPS;
    return [
      {
        id: RECENTS_ID,
        label: "Recentes",
        icon: "🕘",
        emojis: recents.map((char) => ({ char, keywords: "" }) satisfies EmojiEntry),
      },
      ...EMOJI_GROUPS,
    ];
  }, [recents]);

  function choose(char: string) {
    onSelect(char);
    setRecents(pushRecentEmoji(char));
    // O painel fica aberto: mandar dois ou três emojis seguidos é comum, e
    // reabrir a cada um transformaria três cliques em nove.
  }

  function scrollToGroup(id: string) {
    setActiveGroup(id);
    const target = scrollRef.current?.querySelector<HTMLElement>(`[data-emoji-group="${id}"]`);
    target?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip content="Emoji">
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Inserir emoji"
            className={cn(
              "press text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-50",
              open && "bg-muted text-accent-ink",
            )}
          >
            <Smile className="size-4" aria-hidden />
          </button>
        </PopoverTrigger>
      </Tooltip>

      <PopoverContent align="start" side="top" className="w-[21rem] p-0">
        <div className="p-2">
          <SearchInput
            ref={searchRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onClear={() => setTerm("")}
            placeholder="Buscar: polegar, gráfico, prazo…"
            aria-label="Buscar emoji"
            className="h-8 text-xs"
          />
        </div>

        {searching ? (
          <div className="max-h-64 overflow-y-auto px-2 pb-2">
            {results.length === 0 ? (
              <p className="text-muted-foreground px-1 py-6 text-center text-xs">
                Nenhum emoji para “{term.trim()}”.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider">
                  {results.length} {results.length === 1 ? "resultado" : "resultados"}
                </p>
                <Grid emojis={results} onChoose={choose} />
              </>
            )}
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              className="max-h-64 overflow-y-auto px-2 pb-2"
              // A rolagem manual também precisa atualizar a aba ativa, senão a
              // barra de categorias passa a mentir sobre onde o usuário está.
              onScroll={(event) => {
                const container = event.currentTarget;
                const headings = container.querySelectorAll<HTMLElement>("[data-emoji-group]");
                let current = activeGroup;
                for (const heading of headings) {
                  if (heading.offsetTop - container.scrollTop <= 12) {
                    current = heading.dataset.emojiGroup ?? current;
                  }
                }
                if (current !== activeGroup) setActiveGroup(current);
              }}
            >
              {groups.map((group) => (
                <section key={group.id} data-emoji-group={group.id} className="pt-1">
                  <p className="bg-popover text-muted-foreground sticky top-0 z-10 flex items-center gap-1.5 px-1 py-1 text-[10px] font-semibold uppercase tracking-wider">
                    {group.id === RECENTS_ID ? <Clock className="size-3" aria-hidden /> : null}
                    {group.label}
                  </p>
                  <Grid emojis={group.emojis} onChoose={choose} />
                </section>
              ))}
            </div>

            <div className="border-border flex items-center gap-0.5 border-t p-1">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => scrollToGroup(group.id)}
                  aria-label={group.label}
                  aria-current={activeGroup === group.id}
                  title={group.label}
                  className={cn(
                    "hover:bg-muted relative flex h-7 flex-1 items-center justify-center rounded-md text-base leading-none transition-colors",
                    activeGroup === group.id && "bg-muted",
                  )}
                >
                  <span aria-hidden>{group.icon}</span>
                  {activeGroup === group.id ? (
                    <span
                      className="bg-accent absolute inset-x-1.5 -bottom-px h-0.5 rounded-full"
                      aria-hidden
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Grid({ emojis, onChoose }: { emojis: EmojiEntry[]; onChoose: (char: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-0.5">
      {emojis.map((entry, index) => (
        <button
          // Um mesmo emoji pode aparecer em recentes e na categoria: o índice
          // entra na chave para as duas listas coexistirem.
          key={`${entry.char}_${index}`}
          type="button"
          onClick={() => onChoose(entry.char)}
          className="hover:bg-muted flex size-9 items-center justify-center rounded-md text-xl leading-none transition-transform hover:scale-125 focus-visible:scale-125"
          title={entry.keywords.split(" ")[0]}
        >
          <span aria-hidden>{entry.char}</span>
          <span className="sr-only">{entry.keywords || entry.char}</span>
        </button>
      ))}
    </div>
  );
}
