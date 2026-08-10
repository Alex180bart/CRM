"use client";

import { useMemo, useState, useTransition } from "react";
import type { Product, Proposal, ProposalStatus } from "@elora/core";
import {
  PROPOSAL_STATUS_LABEL,
  RECURRENCE_SUFFIX,
  computeTotals,
  formatCurrencyCents,
  formatRelative,
  statusAfterSubmit,
} from "@elora/core";
import { Badge, Button, Callout, Tooltip, cn } from "@elora/ui";
import {
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  Info,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ProductArt } from "@/components/commerce/product-art";
import { ProposalComposerDialog } from "./proposal-composer";
import { ProposalMessageDialog } from "./proposal-message-dialog";

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

type Submit = (
  body: Record<string, unknown>,
) => Promise<{ ok: boolean; reason?: string; data?: Proposal }>;

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
  conversationContext,
  onSendMessage,
}: {
  conversationId: string;
  contactId: string;
  contactName: string;
  products: Product[];
  proposals: Proposal[];
  currentUserId: string;
  /** Assunto e últimas mensagens — a busca do catálogo usa como sugestão. */
  conversationContext?: string;
  /** Publica a mensagem na conversa. Vem do Inbox, que é dono do histórico. */
  onSendMessage?: (body: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  /**
   * Proposta cujo estado mudou e cuja mensagem ainda não foi ao cliente.
   *
   * Mudar o estado e mandar a mensagem são dois atos, e a ordem é essa. No pior
   * caso sobra uma proposta marcada como enviada sem mensagem — visível aqui e
   * corrigível. O inverso deixaria o preço na mão do cliente sem registro no
   * funil.
   */
  const [delivering, setDelivering] = useState<{ id: string; needsApproval: boolean } | null>(null);

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
      const result = (await response.json()) as {
        ok: boolean;
        reason?: string;
        data?: Proposal;
      };
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
    return result;
  }

  /** Abre a revisão da mensagem depois de a proposta mudar de estado. */
  async function actAndDeliver(
    body: Record<string, unknown>,
    success: string,
    input: { id: string; needsApproval: boolean },
  ) {
    const result = await act(body, success);
    if (result.ok) setDelivering(input);
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
            onActAndDeliver={actAndDeliver}
          />
        ))}
      </div>

      {composing ? (
        <ProposalComposerDialog
          open
          onOpenChange={setComposing}
          products={products}
          contactName={contactName}
          conversationContext={conversationContext}
          onCreate={async (items, message, validForDays, wantsSubmit) => {
            const created = await submit({
              action: "criar",
              data: { conversationId, contactId, items, message, validForDays },
            });

            if (!created.ok) return created;
            setComposing(false);

            if (!wantsSubmit) {
              toast.success("Rascunho salvo", {
                description: "Está aqui na lista. Nada saiu para o cliente.",
              });
              return created;
            }

            const id = created.data?.id;
            if (!id) return created;

            const sent = await submit({ action: "enviar", id });
            if (!sent.ok) {
              toast.error("Orçamento criado, mas não enviado", {
                description: `${sent.reason ?? "O envio foi recusado."} O rascunho ficou na lista.`,
              });
              return created;
            }

            setDelivering({ id, needsApproval: sent.data?.status === "aguardando_aprovacao" });
            return created;
          }}
        />
      ) : null}

      {delivering ? (
        <ProposalMessageDialog
          open
          onOpenChange={(next) => {
            if (!next) setDelivering(null);
          }}
          proposalId={delivering.id}
          needsApproval={delivering.needsApproval}
          onConfirm={(message) => {
            onSendMessage?.(message);
            toast.success(
              delivering.needsApproval
                ? "Cliente avisado — o orçamento está com o gestor"
                : "Orçamento enviado na conversa",
            );
            setDelivering(null);
            return true;
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
  onActAndDeliver,
}: {
  proposal: Proposal;
  index: number;
  currentUserId: string;
  busy: boolean;
  onAct: (body: Record<string, unknown>, success: string) => Promise<{ ok: boolean }>;
  onActAndDeliver: (
    body: Record<string, unknown>,
    success: string,
    input: { id: string; needsApproval: boolean },
  ) => Promise<void>;
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

      <ul className="space-y-1.5">
        {proposal.items.map((item) => (
          <li key={item.productId} className="flex items-center gap-2 text-xs">
            {/*
              A miniatura repete a do catálogo de propósito: é ela que permite
              conferir o item de relance, sem ler o nome inteiro numa coluna de
              280 px. A arte é derivada da própria linha da proposta — que é uma
              fotografia do produto, não um ponteiro para ele — então continua
              existindo mesmo depois de o produto ser desativado.
            */}
            <ProductArt
              product={{
                key: item.productKey,
                name: item.name,
                kind: item.kind,
                recurrence: item.recurrence,
                /*
                 * A linha da proposta não guarda o resumo, e não deveria: ela é
                 * a fotografia do que foi vendido, e resumo é texto de vitrine,
                 * não de contrato. A arte usa chave, nome e tipo; o campo entra
                 * vazio em vez de repetir o nome, que é o que produziria uma
                 * legenda duplicada na miniatura.
                 */
                summary: "",
              }}
              size="sm"
              className="size-7 rounded-md"
            />
            <span className="min-w-0 flex-1 truncate">
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
            <span className="text-muted-foreground figure shrink-0">
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
                onActAndDeliver(
                  { action: "enviar", id: proposal.id },
                  willAsk
                    ? "Enviada para aprovação do gestor"
                    : "Orçamento registrado como enviado",
                  { id: proposal.id, needsApproval: willAsk },
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
                  onActAndDeliver(
                    { action: "aprovar", id: proposal.id },
                    "Aprovada — agora é só mandar a mensagem",
                    { id: proposal.id, needsApproval: false },
                  )
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
