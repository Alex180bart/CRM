"use client";

import { useMemo, useState, useTransition } from "react";
import type { Product, Proposal, ProposalStatus } from "@elora/core";
import {
  PROPOSAL_STATUS_LABEL,
  RECURRENCE_SUFFIX,
  buildProposalItem,
  checkDiscount,
  computeTotals,
  formatCurrencyCents,
  formatRelative,
  statusAfterSubmit,
} from "@elora/core";
import {
  Badge,
  Button,
  Callout,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
  Tooltip,
  cn,
} from "@elora/ui";
import {
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  Info,
  Minus,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Propostas da conversa — seção 26.1 (P1).
 *
 * ## A ordem dos dois portões é o desenho inteiro
 *
 * Montar e enviar são atos separados: a proposta nasce em rascunho, e é no envio
 * que a aplicação decide se ela vai ao cliente ou fica esperando o gestor. O
 * botão diz isso **antes** do clique — "Enviar ao cliente" ou "Pedir aprovação"
 * — usando `statusAfterSubmit`, a mesma função que o repositório usa para
 * decidir. Descobrir só depois de gravar é o que produz "achei que tinha
 * enviado".
 *
 * O aceite do cliente é o que **gera** o link de pagamento. Enquanto a proposta
 * está apenas enviada, não há endereço nenhum para copiar, e a tela não finge o
 * contrário: o bloco do link simplesmente não existe ali.
 *
 * ## Por que registrar o aceite é botão de atendente
 *
 * O aceite pelo próprio cliente depende de o canal devolver o clique. O webchat
 * devolveria; o WhatsApp depende da camada de escrita de conversas, que ainda
 * não existe. Então hoje quem marca é quem atende, e a auditoria registra quem
 * marcou — o que não é a mesma coisa que "o cliente clicou", e o texto do painel
 * não confunde as duas.
 */

type Submit = (body: Record<string, unknown>) => Promise<{ ok: boolean; reason?: string }>;

const TONE: Record<ProposalStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  rascunho: "neutral",
  aguardando_aprovacao: "warning",
  reprovada_interna: "danger",
  enviada: "info",
  aceita: "success",
  recusada: "danger",
  expirada: "neutral",
  paga: "success",
  cancelada: "neutral",
};

export function ProposalPanel({
  conversationId,
  contactId,
  contactName,
  products,
  proposals,
  currentUserId,
}: {
  conversationId: string;
  contactId: string;
  contactName: string;
  products: Product[];
  proposals: Proposal[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);

  const mine = useMemo(
    () =>
      proposals
        .filter((proposal) => proposal.conversationId === conversationId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [proposals, conversationId],
  );

  const submit: Submit = async (body) => {
    setBusy(true);
    try {
      const response = await fetch("/api/propostas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { ok: boolean; reason?: string };
      if (result.ok) startTransition(() => router.refresh());
      return result;
    } catch {
      return { ok: false, reason: "Não foi possível falar com o servidor." };
    } finally {
      setBusy(false);
    }
  };

  async function act(body: Record<string, unknown>, success: string) {
    const result = await submit(body);
    if (result.ok) {
      toast.success(success, result.reason ? { description: result.reason } : undefined);
    } else {
      toast.error("Não foi possível", { description: result.reason });
    }
  }

  const working = busy || pending;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
          Propostas
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="press h-7 text-xs"
          disabled={working || products.length === 0}
          onClick={() => setComposing(true)}
        >
          <Plus className="size-3.5" />
          Nova
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {products.length === 0 ? (
          <Callout icon={<Info className="size-4" />}>
            Nenhum produto cadastrado. Cadastre em Administração → Produtos para poder montar
            proposta nesta conversa.
          </Callout>
        ) : null}

        {mine.length === 0 && products.length > 0 ? (
          <p className="text-muted-foreground py-6 text-center text-xs leading-relaxed">
            Nenhuma proposta nesta conversa.
            <br />
            Monte uma com os produtos do catálogo.
          </p>
        ) : null}

        {mine.map((proposal, index) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            index={index}
            currentUserId={currentUserId}
            busy={working}
            onAct={act}
          />
        ))}
      </div>

      {composing ? (
        <ComposeDialog
          open
          onOpenChange={setComposing}
          products={products.filter((product) => product.active)}
          contactName={contactName}
          onCreate={async (items, message, validForDays) => {
            const result = await submit({
              action: "criar",
              data: { conversationId, contactId, items, message, validForDays },
            });
            if (result.ok) {
              setComposing(false);
              toast.success("Rascunho criado", {
                description: "Revise e envie — nada saiu para o cliente ainda.",
              });
            }
            return result;
          }}
        />
      ) : null}
    </div>
  );
}

/* Cartão ---------------------------------------------------------------------- */

function ProposalCard({
  proposal,
  index,
  currentUserId,
  busy,
  onAct,
}: {
  proposal: Proposal;
  index: number;
  currentUserId: string;
  busy: boolean;
  onAct: (body: Record<string, unknown>, success: string) => Promise<void>;
}) {
  const totals = computeTotals(proposal.items);
  const willAsk = statusAfterSubmit(proposal.items) === "aguardando_aprovacao";

  /**
   * Quem pediu a aprovação não aprova a própria proposta. A regra vive no
   * repositório — aqui ela só desabilita o botão, para que a recusa não chegue
   * como erro depois de um clique que parecia válido.
   */
  const isRequester = proposal.approval?.requestedBy === currentUserId;

  return (
    <article
      className="stagger bg-card shadow-card space-y-2.5 rounded-lg p-3"
      style={{ "--stagger-index": Math.min(index, 6) } as React.CSSProperties}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Badge variant={TONE[proposal.status]}>{PROPOSAL_STATUS_LABEL[proposal.status]}</Badge>
          <p className="text-muted-foreground mt-1 text-[11px]">
            {proposal.sellerName} · {formatRelative(proposal.createdAt)}
            {proposal.origin === "agente_ia" ? " · montada pela IA" : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="figure text-sm font-semibold">{formatCurrencyCents(totals.totalCents)}</p>
          {totals.recurringCents > 0 && totals.oneOffCents > 0 ? (
            <p className="text-muted-foreground text-[10px] leading-tight">
              {formatCurrencyCents(totals.recurringCents)}/mês +{" "}
              {formatCurrencyCents(totals.oneOffCents)}
            </p>
          ) : null}
        </div>
      </header>

      <ul className="space-y-1">
        {proposal.items.map((item) => (
          <li key={item.productId} className="flex items-baseline justify-between gap-2 text-xs">
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
            <span className="text-muted-foreground shrink-0 tabular-nums">
              {formatCurrencyCents(item.totalCents)}
              {RECURRENCE_SUFFIX[item.recurrence]}
            </span>
          </li>
        ))}
      </ul>

      {proposal.approval && proposal.status === "aguardando_aprovacao" ? (
        <Callout variant="warning" icon={<ShieldAlert className="size-4" />}>
          {proposal.approval.reason}
        </Callout>
      ) : null}

      {proposal.checkoutUrl ? <CheckoutLink url={proposal.checkoutUrl} /> : null}

      {proposal.status === "aceita" && !proposal.checkoutUrl ? (
        <Callout variant="warning" icon={<ShieldAlert className="size-4" />}>
          O cliente aceitou, mas o link não pôde ser gerado — a cobrança deste item é pela
          ferramenta financeira integrada, que ainda não está conectada. Envie o endereço de
          pagamento à mão.
        </Callout>
      ) : null}

      <footer className="flex flex-wrap gap-1.5">
        {proposal.status === "rascunho" ? (
          <>
            <Button
              size="sm"
              className="press h-7 text-xs"
              disabled={busy}
              onClick={() =>
                onAct(
                  { action: "enviar", id: proposal.id },
                  willAsk ? "Enviada para aprovação do gestor" : "Proposta enviada ao cliente",
                )
              }
            >
              <Send className="size-3.5" />
              {willAsk ? "Pedir aprovação" : "Enviar ao cliente"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="press h-7 text-xs"
              disabled={busy}
              onClick={() => onAct({ action: "cancelar", id: proposal.id }, "Rascunho cancelado")}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </>
        ) : null}

        {proposal.status === "aguardando_aprovacao" ? (
          <Tooltip
            content={
              isRequester
                ? "Quem pediu a aprovação não pode aprovar a própria proposta."
                : "Aprovar libera o envio ao cliente."
            }
          >
            <span className="flex gap-1.5">
              <Button
                size="sm"
                className="press h-7 text-xs"
                disabled={busy || isRequester}
                onClick={() =>
                  onAct({ action: "aprovar", id: proposal.id }, "Aprovada e enviada ao cliente")
                }
              >
                <BadgeCheck className="size-3.5" />
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="press h-7 text-xs"
                disabled={busy || isRequester}
                onClick={() => {
                  const note = window.prompt("Motivo da reprovação (quem montou precisa saber):");
                  if (!note?.trim()) return;
                  void onAct(
                    { action: "reprovar", id: proposal.id, data: { note } },
                    "Proposta reprovada",
                  );
                }}
              >
                <X className="size-3.5" />
                Reprovar
              </Button>
            </span>
          </Tooltip>
        ) : null}

        {proposal.status === "enviada" ? (
          <>
            <Button
              size="sm"
              className="press h-7 text-xs"
              disabled={busy}
              onClick={() =>
                onAct({ action: "aceitar", id: proposal.id }, "Aceite registrado — link gerado")
              }
            >
              <Check className="size-3.5" />
              Cliente aceitou
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="press h-7 text-xs"
              disabled={busy}
              onClick={() => onAct({ action: "recusar", id: proposal.id }, "Recusa registrada")}
            >
              <X className="size-3.5" />
              Recusou
            </Button>
          </>
        ) : null}

        {proposal.status === "aceita" ? (
          <Button
            size="sm"
            className="press h-7 text-xs"
            disabled={busy}
            onClick={() => onAct({ action: "pago", id: proposal.id }, "Pagamento confirmado")}
          >
            <BadgeCheck className="size-3.5" />
            Confirmar pagamento
          </Button>
        ) : null}
      </footer>
    </article>
  );
}

/**
 * Link de pagamento com o vendedor dentro.
 *
 * O endereço aparece **inteiro**, e não encurtado com reticências, porque a
 * primeira coisa que quem atende faz é conferir se o próprio nome está ali — é
 * por esse parâmetro que a comissão é atribuída depois.
 */
function CheckoutLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="bg-muted/60 space-y-1.5 rounded-md p-2">
      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        Link de pagamento
      </p>
      <p className="break-all font-mono text-[10px] leading-relaxed">{url}</p>
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="press h-6 text-[11px]"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            setCopied(true);
            toast.success("Link copiado");
            window.setTimeout(() => setCopied(false), 2_000);
          }}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          Copiar
        </Button>
        <Button size="sm" variant="ghost" className="press h-6 text-[11px]" asChild>
          <a href={url} target="_blank" rel="noreferrer noopener">
            <ExternalLink className="size-3" />
            Abrir
          </a>
        </Button>
      </div>
    </div>
  );
}

/* Montagem --------------------------------------------------------------------- */

function ComposeDialog({
  open,
  onOpenChange,
  products,
  contactName,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  contactName: string;
  onCreate: (
    items: Array<{ productId: string; quantity: number; discountPct: number }>,
    message: string,
    validForDays: number,
  ) => Promise<{ ok: boolean; reason?: string }>;
}) {
  const [lines, setLines] = useState<Record<string, { quantity: number; discountPct: number }>>({});
  const [message, setMessage] = useState("");
  const [validForDays, setValidForDays] = useState("7");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = products.filter((product) => lines[product.id]);

  /**
   * A prévia usa as funções puras do núcleo, não uma soma escrita aqui.
   *
   * É o que garante que o total mostrado antes de gravar seja o mesmo que o
   * repositório vai calcular — inclusive no arredondamento, que é onde a
   * divergência de um centavo nasce.
   */
  const items = selected.map((product) =>
    buildProposalItem(product, lines[product.id]!.quantity, lines[product.id]!.discountPct),
  );
  const totals = computeTotals(items);
  const discount = checkDiscount(items);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,34rem)]">
        <DialogHeader>
          <DialogTitle>Montar proposta para {contactName}</DialogTitle>
          <DialogDescription>
            Nada sai para o cliente agora: a proposta nasce como rascunho e você revisa antes de
            enviar.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[46vh] space-y-1.5 overflow-y-auto">
          {products.map((product) => {
            const line = lines[product.id];
            return (
              <div
                key={product.id}
                className={cn(
                  "rounded-lg p-2.5 transition-colors",
                  line ? "bg-primary-soft" : "hover:bg-muted/60",
                )}
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      setLines((current) => {
                        const next = { ...current };
                        if (next[product.id]) delete next[product.id];
                        else next[product.id] = { quantity: 1, discountPct: 0 };
                        return next;
                      })
                    }
                  >
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <p className="text-muted-foreground truncate text-xs">{product.summary}</p>
                  </button>
                  <p className="figure shrink-0 text-sm">
                    {formatCurrencyCents(product.priceCents)}
                    <span className="text-muted-foreground text-[10px]">
                      {RECURRENCE_SUFFIX[product.recurrence]}
                    </span>
                  </p>
                </div>

                {line ? (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon-sm"
                        variant="outline"
                        className="size-6"
                        onClick={() =>
                          setLines((c) => ({
                            ...c,
                            [product.id]: { ...line, quantity: Math.max(1, line.quantity - 1) },
                          }))
                        }
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-6 text-center text-xs tabular-nums">{line.quantity}</span>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        className="size-6"
                        onClick={() =>
                          setLines((c) => ({
                            ...c,
                            [product.id]: { ...line, quantity: line.quantity + 1 },
                          }))
                        }
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Label className="text-[11px]">Desconto</Label>
                      <Input
                        className="h-6 w-14 text-xs"
                        inputMode="numeric"
                        value={String(line.discountPct)}
                        onChange={(event) =>
                          setLines((c) => ({
                            ...c,
                            [product.id]: {
                              ...line,
                              discountPct: Math.min(
                                100,
                                Number(event.target.value.replace(/\D/g, "")) || 0,
                              ),
                            },
                          }))
                        }
                      />
                      <span className="text-muted-foreground text-[11px]">
                        % · teto {product.maxDiscountPct}%
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <Textarea
            rows={2}
            placeholder="Uma linha para o cliente (opcional)."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <div className="flex items-center gap-2">
            <Label className="text-xs">Validade</Label>
            <Input
              className="h-7 w-16 text-xs"
              inputMode="numeric"
              value={validForDays}
              onChange={(event) => setValidForDays(event.target.value.replace(/\D/g, ""))}
            />
            <span className="text-muted-foreground text-xs">dias</span>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="border-border space-y-2 border-t pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Total</span>
              <span className="figure text-base font-semibold">
                {formatCurrencyCents(totals.totalCents)}
              </span>
            </div>
            {totals.recurringCents > 0 && totals.oneOffCents > 0 ? (
              <p className="text-muted-foreground text-xs">
                {formatCurrencyCents(totals.recurringCents)} por mês, mais{" "}
                {formatCurrencyCents(totals.oneOffCents)} de entrada — os dois não se somam num
                número só.
              </p>
            ) : null}
            {discount.requiresApproval ? (
              <Callout variant="warning" icon={<ShieldAlert className="size-4" />}>
                {discount.reason} Ao enviar, esta proposta vai para o gestor antes de chegar ao
                cliente.
              </Callout>
            ) : null}
          </div>
        ) : null}

        {refusal ? (
          <Callout variant="danger" icon={<ShieldAlert className="size-4" />}>
            {refusal}
          </Callout>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={items.length === 0 || busy}
            className="press"
            onClick={async () => {
              setBusy(true);
              setRefusal(null);
              const result = await onCreate(
                selected.map((product) => ({
                  productId: product.id,
                  quantity: lines[product.id]!.quantity,
                  discountPct: lines[product.id]!.discountPct,
                })),
                message,
                Number(validForDays) || 7,
              );
              setBusy(false);
              if (!result.ok) setRefusal(result.reason ?? "Não foi possível criar.");
            }}
          >
            Criar rascunho
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
