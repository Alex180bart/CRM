"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Product, Proposal } from "@elora/core";
import { Button, Tooltip } from "@elora/ui";
import { Loader2, ReceiptText } from "lucide-react";
import { toast } from "sonner";

import { ProposalComposerDialog, type ProposalDraftLine } from "./proposal-composer";
import { ProposalMessageDialog } from "./proposal-message-dialog";

/**
 * Montar e enviar orçamento a partir da barra de digitação.
 *
 * ## Por que aqui, e não só no painel da direita
 *
 * O painel de propostas fica atrás de uma aba, e no celular ele nem está na
 * tela. Mas o instante em que a proposta é montada é sempre o mesmo: logo depois
 * de o cliente perguntar o preço, com o cursor já dentro do compositor. Obrigar
 * a viagem até o painel nesse momento é o que faz o vendedor sair da conversa,
 * abrir a planilha e mandar o valor à mão — que é exatamente o caminho que este
 * módulo existe para substituir.
 *
 * Fica ao lado do gravador de áudio porque é ação de **produzir conteúdo para
 * enviar**, como anexo e voz — não configuração da conversa.
 *
 * ## Os três passos, e por que eles são três
 *
 * Criar, submeter e mandar a mensagem são chamadas distintas porque falham por
 * motivos distintos. Criar recusa produto inativo; submeter recusa desconto
 * acima do teto; a mensagem depende da IA, que pode não responder. Junta-las
 * numa só faria a falha da terceira desfazer as duas primeiras — e o vendedor
 * perderia o orçamento montado porque o modelo estava fora.
 *
 * A ordem também é deliberada: o estado muda **antes** de a mensagem sair. No
 * pior caso sobra uma proposta marcada como enviada sem mensagem — visível no
 * painel e corrigível. O inverso deixaria o preço na mão do cliente sem registro
 * nenhum no funil.
 */
export function ProposalQuickAction({
  conversationId,
  contactId,
  contactName,
  products,
  conversationContext,
  disabled,
  onSendMessage,
}: {
  conversationId: string;
  contactId: string;
  contactName: string;
  products: Product[];
  conversationContext?: string;
  disabled?: boolean;
  /** Publica a mensagem na conversa. Vem do Inbox, que é dono do histórico. */
  onSendMessage?: (body: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  /** Proposta recém-enviada, aguardando a revisão da mensagem. */
  const [delivering, setDelivering] = useState<{ id: string; needsApproval: boolean } | null>(null);

  const noCatalog = products.filter((product) => product.active).length === 0;

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/propostas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json()) as { ok: boolean; reason?: string; data?: Proposal };
  }

  async function create(
    items: ProposalDraftLine[],
    message: string,
    validForDays: number,
    submit: boolean,
  ) {
    setBusy(true);
    try {
      const created = await post({
        action: "criar",
        data: { conversationId, contactId, items, message, validForDays },
      });

      if (!created.ok || !created.data) return created;

      if (!submit) {
        setOpen(false);
        startTransition(() => router.refresh());
        toast.success("Rascunho salvo", {
          description: "Está no painel de propostas, à direita. Nada saiu para o cliente.",
        });
        return created;
      }

      const sent = await post({ action: "enviar", id: created.data.id });
      startTransition(() => router.refresh());

      if (!sent.ok) {
        /**
         * A proposta ficou criada e o envio falhou — e é isso que a mensagem
         * diz. Sumir com o rascunho aqui apagaria o trabalho de montar; dizer
         * "não foi possível" sem explicar onde ele está faria o vendedor montar
         * tudo de novo.
         */
        setOpen(false);
        toast.error("Orçamento criado, mas não enviado", {
          description: `${sent.reason ?? "O envio foi recusado."} O rascunho está no painel de propostas.`,
        });
        return created;
      }

      const needsApproval = sent.data?.status === "aguardando_aprovacao";
      setOpen(false);
      setDelivering({ id: created.data.id, needsApproval });

      return created;
    } catch {
      return { ok: false, reason: "Não foi possível falar com o servidor." };
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Tooltip
        content={
          noCatalog
            ? "Nenhum produto ativo no catálogo. Cadastre em Administração → Produtos."
            : "Montar e enviar orçamento"
        }
      >
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Montar orçamento"
          disabled={disabled || noCatalog || busy || pending}
          onClick={() => setOpen(true)}
        >
          {busy || pending ? <Loader2 className="animate-spin" aria-hidden /> : <ReceiptText />}
        </Button>
      </Tooltip>

      {open ? (
        <ProposalComposerDialog
          open
          onOpenChange={setOpen}
          products={products}
          contactName={contactName}
          conversationContext={conversationContext}
          onCreate={create}
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
    </>
  );
}
