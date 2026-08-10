"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Callout, Dialog, DialogContent, Textarea } from "@elora/ui";
import { AlertTriangle, Loader2, Send, Sparkles } from "lucide-react";

/**
 * A mensagem que vai ao cliente, antes de ir.
 *
 * ## Por que existe uma tela entre o clique e o envio
 *
 * Porque a regra do produto é a mesma em todo lugar onde há modelo: **a IA
 * propõe, a pessoa envia**. Aqui ela pesa mais que no copiloto — o texto carrega
 * preço, e um preço enviado não se desdiz. O vendedor lê, ajusta se quiser, e é
 * o clique dele que solta a mensagem.
 *
 * ## O texto chega antes de a IA responder
 *
 * A rota devolve sempre uma mensagem: personalizada quando o modelo respondeu,
 * determinística quando não. O diálogo abre já com o campo preenchido e um
 * indicador de carregamento discreto — nunca com uma caixa vazia esperando. Sem
 * isso, uma chamada lenta transforma "enviar orçamento" em tela em branco no
 * meio da conversa com o cliente.
 *
 * ## Enviar ao cliente e marcar a proposta são dois atos
 *
 * A mensagem entra na conversa **e** a proposta muda de estado. Se o segundo
 * falhasse depois do primeiro, o cliente teria o orçamento e o funil não —
 * então a mudança de estado vem primeiro e a mensagem depois: no pior caso
 * sobra uma proposta marcada como enviada sem a mensagem, que é visível e
 * corrigível, em vez de um preço na mão do cliente sem registro nenhum.
 */
export function ProposalMessageDialog({
  open,
  onOpenChange,
  proposalId,
  needsApproval,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  /** `true` quando o orçamento ainda depende do gestor — muda o texto e o botão. */
  needsApproval: boolean;
  /** Envia a mensagem para a conversa. Devolve `false` para manter o diálogo. */
  onConfirm: (message: string) => Promise<boolean> | boolean;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [byAi, setByAi] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;

    let alive = true;
    setLoading(true);
    setNotice(null);

    void (async () => {
      try {
        const response = await fetch("/api/ai/proposta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalId, needsApproval }),
        });
        const data = (await response.json()) as {
          message?: string;
          generatedByAi?: boolean;
          reason?: string;
        };

        if (!alive) return;

        setMessage(data.message ?? "");
        setByAi(Boolean(data.generatedByAi));
        setNotice(data.reason ?? null);
      } catch {
        if (alive) setNotice("Não foi possível falar com o servidor. Escreva a mensagem à mão.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, proposalId, needsApproval]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(94vw,38rem)] p-0">
        <header className="border-border shrink-0 border-b px-5 py-4 pr-12">
          <h2 className="font-display flex items-center gap-2 text-base font-semibold">
            {needsApproval ? "Avisar o cliente sobre o orçamento" : "Enviar o orçamento ao cliente"}
            {byAi ? (
              <Badge variant="accent">
                <Sparkles className="size-2.5" aria-hidden />
                escrita pela IA
              </Badge>
            ) : null}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
            {needsApproval
              ? "Este orçamento ainda passa pelo gestor. A mensagem avisa o cliente sem afirmar que já está confirmado."
              : "Revise antes de enviar. O texto vai para a conversa como sua mensagem — os valores foram conferidos contra a proposta gravada."}
          </p>
        </header>

        <div className="space-y-3 p-5">
          {notice ? (
            <Callout variant="warning" icon={<AlertTriangle className="size-4" />}>
              {notice} O texto abaixo é o padrão, com os valores corretos.
            </Callout>
          ) : null}

          <div className="relative">
            <Textarea
              rows={12}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              aria-label="Mensagem para o cliente"
              className="text-sm leading-relaxed"
            />
            {loading ? (
              <span className="bg-surface/70 absolute inset-0 flex items-center justify-center rounded-md">
                <span className="text-muted-foreground flex items-center gap-2 text-xs">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Escrevendo com base na conversa…
                </span>
              </span>
            ) : null}
          </div>

          <p className="text-muted-foreground text-[11px] leading-relaxed">
            Os preços vêm da proposta gravada. Se você editar um valor aqui, a mensagem passa a
            divergir do que o funil registrou — prefira corrigir a proposta.
          </p>
        </div>

        <footer className="border-border bg-surface-sunken flex shrink-0 justify-end gap-2 border-t p-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            className="press"
            loading={sending}
            disabled={loading || sending || message.trim().length < 10}
            onClick={async () => {
              setSending(true);
              const done = await onConfirm(message.trim());
              setSending(false);
              if (done) onOpenChange(false);
            }}
          >
            <Send />
            {needsApproval ? "Avisar o cliente" : "Enviar na conversa"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
