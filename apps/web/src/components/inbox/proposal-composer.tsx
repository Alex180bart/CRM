"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@elora/core";
import {
  RECURRENCE_SUFFIX,
  buildProposalItem,
  checkDiscount,
  computeTotals,
  formatCurrencyCents,
  searchProducts,
  statusAfterSubmit,
} from "@elora/core";
import {
  Badge,
  Button,
  Callout,
  Dialog,
  DialogContent,
  Input,
  Label,
  Textarea,
  cn,
} from "@elora/ui";
import { Check, Minus, Plus, Search, ShieldAlert, Sparkles, Trash2, X } from "lucide-react";

import { ProductArt } from "@/components/commerce/product-art";

/**
 * Montagem de proposta.
 *
 * ## Duas colunas, e a da direita não rola junto
 *
 * A versão anterior era uma lista única com o total no fim: para conferir o
 * valor, o vendedor rolava até embaixo, e para trocar um item rolava de volta.
 * Num diálogo aberto na frente do cliente, esse vaivém é justamente o momento em
 * que se erra a quantidade. Agora o catálogo rola à esquerda e o resumo fica
 * parado à direita — o total muda enquanto se escolhe, sem sair do lugar.
 *
 * No celular a mesma informação empilha: catálogo, depois resumo. Duas colunas
 * de 20 rem não cabem em 390 px, e espremer produziria a linha de preço quebrada
 * em três.
 *
 * ## Por que a busca não é `filter`
 *
 * Está em `utils/product-search.ts`, com o porquê e com teste. O que importa
 * aqui é o que ela devolve além dos itens: **o motivo** de cada um ter
 * aparecido. Uma busca que ordena por relevância sem dizer por quê é uma caixa
 * preta que o vendedor aprende a ignorar.
 *
 * A conversa aberta entra como contexto. Sem nada digitado, o que sobe é o que
 * casa com o assunto — e o chip "sugerido" declara isso, em vez de fingir que é
 * a ordem natural do catálogo.
 *
 * ## O total anima do valor anterior, não do zero
 *
 * `AnimatedNumber` do design system conta sempre a partir de zero, o que é certo
 * numa entrada de página e errado aqui: a cada item somado, o número piscaria de
 * zero até o novo total. `AnimatedCurrency` interpola do valor que estava na
 * tela, que é o que faz a mudança ser lida como "somou R$ 329", e não como um
 * contador reiniciando.
 */

export interface ProposalDraftLine {
  productId: string;
  quantity: number;
  discountPct: number;
}

/* Total que se move ------------------------------------------------------------ */

function AnimatedCurrency({ cents, className }: { cents: number; className?: string }) {
  const [display, setDisplay] = useState(cents);
  const fromRef = useRef(cents);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      fromRef.current = cents;
      setDisplay(cents);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    const duration = 420;

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (cents - from) * eased));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = cents;
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
    };
  }, [cents]);

  return <span className={className}>{formatCurrencyCents(display)}</span>;
}

/* Linha do catálogo ------------------------------------------------------------- */

function CatalogRow({
  product,
  reasons,
  suggested,
  line,
  index,
  onToggle,
  onChange,
}: {
  product: Product;
  reasons: string[];
  suggested: boolean;
  line?: ProposalDraftLine;
  index: number;
  onToggle: () => void;
  onChange: (patch: Partial<ProposalDraftLine>) => void;
}) {
  const selected = Boolean(line);
  const overCap = (line?.discountPct ?? 0) > product.maxDiscountPct;

  return (
    <li
      className="stagger"
      style={{ "--stagger-index": Math.min(index, 10) } as React.CSSProperties}
    >
      <div
        className={cn(
          "rounded-xl border p-2.5 transition-[background-color,border-color,box-shadow]",
          selected
            ? "border-accent bg-accent-soft/60 shadow-card"
            : "hover:bg-muted/60 border-transparent",
        )}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={selected}
            className="flex min-w-0 flex-1 items-start gap-3 text-left"
          >
            <span className="relative">
              <ProductArt product={product} size="md" />
              {selected ? (
                <span className="bg-accent text-accent-foreground absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full">
                  <Check className="size-2.5" aria-hidden />
                </span>
              ) : null}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium">{product.name}</span>
                {product.kind === "servico" ? (
                  <span className="text-muted-foreground shrink-0 text-[10px] uppercase tracking-wide">
                    serviço
                  </span>
                ) : null}
              </span>
              <span className="text-muted-foreground line-clamp-1 text-xs">{product.summary}</span>

              {suggested || reasons.length > 0 ? (
                <span className="mt-1 flex flex-wrap items-center gap-1">
                  {suggested ? (
                    <Badge variant="accent" size="sm">
                      <Sparkles className="size-2.5" aria-hidden />
                      sugerido
                    </Badge>
                  ) : null}
                  {/*
                    Com o selo de sugerido, os motivos somem: "sugerido" +
                    "assunto da conversa" dizem a mesma coisa duas vezes, e três
                    chips por linha transformam a lista num mural. Os motivos
                    valem quando alguém digitou — ali eles explicam por que
                    aquele item veio para uma consulta que não bate com o nome.
                  */}
                  {(suggested ? [] : reasons.slice(0, 2)).map((reason) => (
                    <span
                      key={reason}
                      className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-[10px]"
                    >
                      {reason}
                    </span>
                  ))}
                </span>
              ) : null}
            </span>
          </button>

          <span className="figure shrink-0 text-right text-sm">
            {formatCurrencyCents(product.priceCents)}
            <span className="text-muted-foreground block text-[10px] leading-none">
              {RECURRENCE_SUFFIX[product.recurrence] || "à vista"}
            </span>
          </span>
        </div>

        {line ? (
          <div className="rise-in mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 pl-[3.75rem]">
            <div className="flex items-center gap-1">
              <Button
                size="icon-xs"
                variant="outline"
                aria-label="Diminuir quantidade"
                onClick={() => onChange({ quantity: Math.max(1, line.quantity - 1) })}
              >
                <Minus />
              </Button>
              <span className="figure w-7 text-center text-sm">{line.quantity}</span>
              <Button
                size="icon-xs"
                variant="outline"
                aria-label="Aumentar quantidade"
                onClick={() => onChange({ quantity: line.quantity + 1 })}
              >
                <Plus />
              </Button>
            </div>

            <div className="flex min-w-[11rem] flex-1 items-center gap-2">
              <Label className="text-[11px]" htmlFor={`desc-${product.id}`}>
                Desconto
              </Label>
              <input
                id={`desc-${product.id}`}
                type="range"
                min={0}
                max={Math.max(product.maxDiscountPct * 2, 30)}
                value={line.discountPct}
                onChange={(event) => onChange({ discountPct: Number(event.target.value) })}
                className="accent-accent min-w-0 flex-1"
              />
              <span
                className={cn(
                  "figure w-9 text-right text-xs",
                  overCap ? "text-warning font-semibold" : "text-muted-foreground",
                )}
              >
                {line.discountPct}%
              </span>
            </div>

            <span
              className={cn(
                "text-[10px] leading-tight",
                overCap ? "text-warning" : "text-muted-foreground",
              )}
            >
              {overCap
                ? `Acima do teto de ${product.maxDiscountPct}% — vai ao gestor`
                : `teto ${product.maxDiscountPct}%`}
            </span>

            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Remover ${product.name}`}
              onClick={onToggle}
              className="ml-auto"
            >
              <Trash2 />
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

/* Diálogo ------------------------------------------------------------------------ */

export function ProposalComposerDialog({
  open,
  onOpenChange,
  products,
  contactName,
  conversationContext,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  contactName: string;
  /** Assunto e últimas mensagens, para a busca sugerir sem ninguém digitar. */
  conversationContext?: string;
  /**
   * `submit: true` cria **e** envia num passo.
   *
   * O rascunho deixou de ser o caminho principal. Quem monta um orçamento na
   * frente do cliente quer que ele saia; parar num rascunho obriga a encontrar o
   * painel da direita, achar o cartão e clicar de novo — três passos entre a
   * decisão e o envio, cada um deles um lugar para esquecer. O rascunho continua
   * existindo como saída secundária, para quem monta agora e envia depois.
   */
  onCreate: (
    items: ProposalDraftLine[],
    message: string,
    validForDays: number,
    submit: boolean,
  ) => Promise<{ ok: boolean; reason?: string }>;
}) {
  const [lines, setLines] = useState<Record<string, ProposalDraftLine>>({});
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [validForDays, setValidForDays] = useState("7");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Abrir de novo começa do zero.
   *
   * Sem isto, o carrinho da proposta anterior reaparece na conversa seguinte —
   * e é o tipo de erro que só é percebido depois de enviado.
   */
  useEffect(() => {
    if (!open) return;
    setLines({});
    setQuery("");
    setMessage("");
    setValidForDays("7");
    setRefusal(null);
  }, [open]);

  const matches = useMemo(
    () => searchProducts(products, query, { context: conversationContext }),
    [products, query, conversationContext],
  );

  /**
   * O que já está no carrinho nunca some da lista.
   *
   * Digitar um termo novo depois de escolher três itens escondia os três, e a
   * única forma de conferir era limpar a busca. Aqui o selecionado sobe para o
   * topo e permanece — a busca filtra o que **falta** escolher.
   */
  const visible = useMemo(() => {
    const selectedIds = new Set(Object.keys(lines));
    const shown = matches.filter((match) => !selectedIds.has(match.product.id));
    const pinned = products
      .filter((product) => selectedIds.has(product.id))
      .map((product) => ({ product, reasons: [], score: 0, fromContext: false }));
    return [...pinned, ...shown];
  }, [matches, lines, products]);

  const selected = products.filter((product) => lines[product.id]);
  const items = selected.map((product) =>
    buildProposalItem(product, lines[product.id]!.quantity, lines[product.id]!.discountPct),
  );
  const totals = computeTotals(items);
  const discount = checkDiscount(items);

  /**
   * O rótulo diz para onde a proposta vai **antes** do clique.
   *
   * `statusAfterSubmit` é a mesma função que o repositório usa para decidir.
   * Descobrir só depois de gravar que o orçamento parou no gestor é o que produz
   * "achei que tinha enviado" — e, com o cliente esperando, é a pior hora de
   * descobrir.
   */
  const willAskApproval = items.length > 0 && statusAfterSubmit(items) === "aguardando_aprovacao";
  const primaryLabel = willAskApproval
    ? "Enviar para aprovação do gestor"
    : `Enviar orçamento · ${items.length} ${items.length === 1 ? "item" : "itens"}`;

  async function send(submit: boolean) {
    setBusy(true);
    setRefusal(null);
    const result = await onCreate(Object.values(lines), message, Number(validForDays) || 7, submit);
    setBusy(false);
    if (!result.ok) setRefusal(result.reason ?? "Não foi possível criar.");
  }

  function toggle(product: Product) {
    setLines((current) => {
      const next = { ...current };
      if (next[product.id]) delete next[product.id];
      else next[product.id] = { productId: product.id, quantity: 1, discountPct: 0 };
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,58rem)] p-0">
        <header className="border-border shrink-0 border-b px-5 py-4 pr-12">
          <h2 className="font-display text-base font-semibold">
            Montar proposta para {contactName}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            Você revisa a mensagem antes de ela ir para a conversa — e o orçamento com desconto
            acima do teto passa pelo gestor antes do cliente.
          </p>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_21rem]">
          {/* Catálogo -------------------------------------------------------- */}
          <div className="flex min-h-0 flex-col">
            <div className="border-border shrink-0 border-b p-3">
              <div className="relative">
                <Search
                  className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por nome, o que inclui ou o que o cliente disse…"
                  className="pl-8"
                  aria-label="Buscar no catálogo"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Limpar busca"
                    className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              <p className="text-muted-foreground mt-1.5 text-[11px]">
                {query
                  ? `${matches.length} resultado(s) — ordenados por onde o termo casou.`
                  : conversationContext
                    ? "Sem busca, o que aparece primeiro é o que casa com o assunto da conversa."
                    : "Busque ou escolha na lista."}
              </p>
            </div>

            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2 lg:max-h-[52vh]">
              {visible.length === 0 ? (
                <li className="text-muted-foreground px-3 py-10 text-center text-xs leading-relaxed">
                  Nada no catálogo casa com <strong>{query}</strong>.
                  <br />
                  Tente uma palavra do que o produto inclui — a busca também olha ali.
                </li>
              ) : null}

              {visible.map((match, index) => (
                <CatalogRow
                  key={match.product.id}
                  product={match.product}
                  reasons={match.reasons}
                  suggested={match.fromContext}
                  line={lines[match.product.id]}
                  index={index}
                  onToggle={() => toggle(match.product)}
                  onChange={(patch) =>
                    setLines((current) => ({
                      ...current,
                      [match.product.id]: { ...current[match.product.id]!, ...patch },
                    }))
                  }
                />
              ))}
            </ul>
          </div>

          {/* Resumo ---------------------------------------------------------- */}
          <aside className="border-border bg-surface-sunken flex min-h-0 flex-col border-t lg:border-l lg:border-t-0">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                Proposta
              </p>

              {items.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-xs leading-relaxed">
                  Nenhum item ainda.
                  <br />
                  {/* Sem "à esquerda": no celular o catálogo fica acima, e a
                      instrução apontaria para o lugar errado. */}
                  Escolha um produto da lista para começar.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {items.map((item) => (
                    <li
                      key={item.productId}
                      className="bubble-in flex items-baseline justify-between gap-2 text-xs"
                      style={{ "--bubble-index": 0 } as React.CSSProperties}
                    >
                      <span className="min-w-0 truncate">
                        {item.quantity > 1 ? `${item.quantity}× ` : ""}
                        {item.name}
                        {item.discountPct > 0 ? (
                          <span
                            className={cn(
                              "ml-1 font-medium",
                              item.discountPct > item.maxDiscountPct
                                ? "text-warning"
                                : "text-muted-foreground",
                            )}
                          >
                            −{item.discountPct}%
                          </span>
                        ) : null}
                      </span>
                      <span className="figure text-muted-foreground shrink-0">
                        {formatCurrencyCents(item.totalCents)}
                        {RECURRENCE_SUFFIX[item.recurrence]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-border space-y-1 border-t pt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <AnimatedCurrency
                    cents={totals.totalCents}
                    className="figure text-lg font-semibold"
                  />
                </div>
                {totals.recurringCents > 0 && totals.oneOffCents > 0 ? (
                  <p className="text-muted-foreground text-[11px] leading-snug">
                    {formatCurrencyCents(totals.recurringCents)} por mês, mais{" "}
                    {formatCurrencyCents(totals.oneOffCents)} de entrada — os dois não se somam num
                    número só.
                  </p>
                ) : null}
              </div>

              {discount.requiresApproval ? (
                <Callout variant="warning" icon={<ShieldAlert className="size-4" />}>
                  {discount.reason} Ao enviar, esta proposta vai para o gestor antes de chegar ao
                  cliente.
                </Callout>
              ) : null}

              <div className="space-y-2 pt-1">
                <Textarea
                  rows={2}
                  placeholder="Uma linha para o cliente (opcional)."
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <div className="flex items-center gap-2">
                  <Label className="text-xs" htmlFor="validade">
                    Validade
                  </Label>
                  <Input
                    id="validade"
                    className="h-7 w-16 text-xs"
                    inputMode="numeric"
                    value={validForDays}
                    onChange={(event) => setValidForDays(event.target.value.replace(/\D/g, ""))}
                  />
                  <span className="text-muted-foreground text-xs">dias</span>
                </div>
              </div>

              {refusal ? (
                <Callout variant="danger" icon={<ShieldAlert className="size-4" />}>
                  {refusal}
                </Callout>
              ) : null}
            </div>

            <div className="border-border bg-surface shrink-0 space-y-1 border-t p-3">
              <Button
                className="press w-full"
                disabled={items.length === 0 || busy}
                loading={busy}
                onClick={() => void send(true)}
              >
                {items.length === 0 ? "Escolha ao menos um item" : primaryLabel}
              </Button>

              {/*
                O rascunho fica como saída secundária, não como caminho padrão.
                Continua útil para quem monta antes da reunião — e some do
                caminho de quem está com o cliente na linha.
              */}
              <Button
                variant="ghost"
                className="w-full"
                size="sm"
                disabled={items.length === 0 || busy}
                onClick={() => void send(false)}
              >
                Salvar como rascunho
              </Button>

              <Button
                variant="ghost"
                className="text-muted-foreground w-full"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
