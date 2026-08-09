"use client";

import { useState } from "react";
import type { AiProposal, AiResolvedProposal, Contact } from "@elora/core";
import { formatDateTime, resolveProposals } from "@elora/core";
import { Badge, Button, Tooltip, cn } from "@elora/ui";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  CircleAlert,
  IdCard,
  Route,
  X,
} from "lucide-react";

/**
 * Tabulação — o que a conversa revelou e o cadastro ainda não sabe.
 *
 * O bloco existe porque atendente não preenche cadastro. Não por preguiça: no
 * meio de uma conversa, abrir o contato, achar o campo e digitar custa mais
 * atenção do que o dado vale naquele instante — então o CPF que o cliente
 * mandou fica só na conversa, e seis meses depois ninguém acha.
 *
 * A separação entre **lacuna** e **divergência** é a decisão central do desenho.
 * Preencher campo vazio é barato e reversível; trocar um valor existente pode
 * apagar o certo com o errado (o cliente ditou o telefone do sócio). Por isso os
 * dois nunca compartilham botão, e a divergência sempre mostra os dois lados.
 *
 * Nada aqui grava sozinho. Seção 16.3: o modelo propõe, a aplicação valida, a
 * pessoa decide.
 */

const KIND_META = {
  preencher_campo: { icon: IdCard, hue: 208 },
  vincular_empresa: { icon: Building2, hue: 280 },
  criar_tarefa: { icon: CalendarClock, hue: 38 },
  mover_etapa: { icon: Route, hue: 30 },
} as const;

export interface TabulationHandlers {
  onApply: (resolved: AiResolvedProposal) => void;
  onDismiss: (proposalId: string) => void;
}

export function TabulationPanel({
  proposals,
  contact,
  applied,
  dismissed,
  onApply,
  onDismiss,
}: {
  proposals: AiProposal[];
  contact?: Contact;
  /** Ids já aplicados nesta sessão — a linha vira confirmação em vez de sumir. */
  applied: Record<string, string>;
  dismissed: string[];
  onApply: TabulationHandlers["onApply"];
  onDismiss: TabulationHandlers["onDismiss"];
}) {
  const [showDiscarded, setShowDiscarded] = useState(false);
  const { actionable, discarded } = resolveProposals(proposals, contact);

  // Sem contato não existe cadastro para conferir nem para gravar. Mostrar
  // propostas aqui ofereceria um botão que não teria onde escrever.
  if (!contact) {
    return proposals.length > 0 ? <TabulationUnavailable /> : null;
  }

  const pending = actionable.filter(
    (item) => !dismissed.includes(item.proposal.id) && !(item.proposal.id in applied),
  );

  /**
   * As já aplicadas saem de `proposals`, não de `actionable`.
   *
   * Depois de gravado, o cadastro passa a ter o valor — e a resolução, que é
   * justamente a comparação com o cadastro, classifica a proposta como `igual`
   * e a remove de `actionable`. Filtrar ali produzia uma confirmação que nunca
   * aparecia: a linha simplesmente sumia, e o atendente ficava sem saber se o
   * clique valeu.
   */
  const done = proposals.filter((proposal) => proposal.id in applied);

  if (actionable.length === 0 && done.length === 0 && discarded.length === 0) return null;

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
          <IdCard className="size-3" aria-hidden />
          Tabulação
        </span>
        {pending.length > 0 ? (
          <Badge variant="accent">{pending.length} a conferir</Badge>
        ) : done.length > 0 ? (
          <Badge variant="success">
            <Check aria-hidden />
            registrado
          </Badge>
        ) : null}
      </div>

      {pending.length === 0 && done.length === 0 ? (
        <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
          Nada novo para registrar nesta conversa.
        </p>
      ) : null}

      <ul className="space-y-1.5">
        {pending.map((item) => (
          <ProposalRow
            key={item.proposal.id}
            item={item}
            onApply={() => onApply(item)}
            onDismiss={() => onDismiss(item.proposal.id)}
          />
        ))}

        {done.map((proposal) => (
          <li
            key={proposal.id}
            className="bg-success-soft flex items-center gap-2 rounded-md px-2 py-1.5"
          >
            <Check className="text-success size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[11px]">
              <span className="text-muted-foreground">{proposal.label}</span>{" "}
              <span className="font-medium">{applied[proposal.id]}</span>
            </span>
          </li>
        ))}
      </ul>

      {/* O que foi recusado. Fechado por padrão: é diagnóstico, não trabalho. */}
      {discarded.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setShowDiscarded((value) => !value)}
            className="text-muted-foreground hover:text-foreground mt-1.5 flex items-center gap-1 text-[10px]"
          >
            <ChevronDown
              className={cn("size-2.5 transition-transform", showDiscarded && "rotate-180")}
            />
            {discarded.length} {discarded.length === 1 ? "recusada" : "recusadas"}
          </button>

          {showDiscarded ? (
            <ul className="animate-fade-up mt-1 space-y-1">
              {discarded.map((item) => (
                <li
                  key={item.proposal.id}
                  className="bg-muted/50 text-muted-foreground rounded-md px-2 py-1.5 text-[10px] leading-relaxed"
                >
                  <span className="text-foreground font-medium">{item.proposal.label}</span>{" "}
                  {item.proposal.value} — {item.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      <p className="text-muted-foreground mt-1.5 text-[10px] leading-relaxed">
        Proposta do modelo, conferida contra o cadastro. Quem grava é você.
      </p>
    </section>
  );
}

function ProposalRow({
  item,
  onApply,
  onDismiss,
}: {
  item: AiResolvedProposal;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const { proposal, status, normalized, current } = item;
  const meta = KIND_META[proposal.kind];
  const Icon = meta.icon;
  const divergent = status === "divergente";

  return (
    <li className={cn("rounded-md px-2 py-1.5", divergent ? "bg-warning-soft/70" : "bg-muted/50")}>
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded"
          style={{
            backgroundColor: `hsl(${meta.hue} 62% var(--hue-bg-l) / var(--hue-bg-a))`,
            color: `hsl(${meta.hue} 55% var(--hue-fg-l))`,
          }}
        >
          <Icon className="size-3" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground shrink-0 text-[11px]">{proposal.label}</span>
            <span className="min-w-0 truncate text-right text-[11px] font-medium">
              {normalized}
            </span>
          </div>

          {/* A divergência mostra os dois lados: trocar sem ver o que sai é apagar às cegas. */}
          {divergent && current ? (
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[10px]">
              <span className="line-through">{current}</span>
              <ArrowRight className="size-2.5 shrink-0" aria-hidden />
              <span className="text-foreground font-medium">{normalized}</span>
            </p>
          ) : null}

          {proposal.kind === "criar_tarefa" && proposal.dueAt ? (
            <p className="text-muted-foreground mt-0.5 text-[10px]">
              vence {formatDateTime(proposal.dueAt)}
            </p>
          ) : null}

          <div className="mt-1 flex items-center gap-1.5">
            <Tooltip
              content={
                divergent
                  ? "O cadastro já tem outro valor. Substituir apaga o atual."
                  : "Grava no cadastro do contato."
              }
            >
              <Button
                size="xs"
                variant={divergent ? "outline" : "primary"}
                className="h-6 px-2 text-[10px]"
                onClick={onApply}
              >
                {divergent
                  ? "Substituir"
                  : proposal.kind === "criar_tarefa"
                    ? "Criar"
                    : "Preencher"}
              </Button>
            </Tooltip>

            <Button
              size="xs"
              variant="ghost"
              className="h-6 px-1.5 text-[10px]"
              onClick={onDismiss}
            >
              <X className="size-3" aria-hidden />
              Ignorar
            </Button>

            <button
              type="button"
              onClick={() => setShowEvidence((value) => !value)}
              className="text-muted-foreground hover:text-foreground ml-auto flex items-center gap-0.5 text-[10px]"
            >
              <ChevronDown
                className={cn("size-2.5 transition-transform", showEvidence && "rotate-180")}
              />
              de onde veio
            </button>
          </div>

          {showEvidence ? (
            <p className="animate-fade-up border-chat-quote text-muted-foreground mt-1 border-l-2 pl-2 text-[10px] italic leading-relaxed">
              “{proposal.evidence}”
              <span className="not-italic"> · confiança {proposal.confidence}%</span>
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** Aviso de proposta sem contato associado — não há onde gravar. */
export function TabulationUnavailable() {
  return (
    <p className="text-muted-foreground flex items-start gap-1.5 text-[10px] leading-relaxed">
      <CircleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
      Esta conversa não tem contato vinculado; não há cadastro para tabular.
    </p>
  );
}
