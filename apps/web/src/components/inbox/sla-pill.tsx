import type { Conversation } from "@elora/core";
import { formatCountdown, SLA_STATUS_LABEL } from "@elora/core";
import { Badge, Tooltip, cn } from "@elora/ui";
import { AlarmClock, CheckCircle2, PauseCircle, TimerReset } from "lucide-react";

const SLA_TONE = {
  dentro: { variant: "success", icon: TimerReset },
  atencao: { variant: "warning", icon: AlarmClock },
  estourado: { variant: "danger", icon: AlarmClock },
  pausado: { variant: "neutral", icon: PauseCircle },
  cumprido: { variant: "neutral", icon: CheckCircle2 },
} as const;

/**
 * Selo de SLA. O prazo mostrado é o da primeira resposta enquanto ela não
 * ocorre e o de resolução depois disso — a mesma regra do motor (seção 10).
 */
export function SlaPill({
  conversation,
  showCountdown = true,
  className,
}: {
  conversation: Conversation;
  showCountdown?: boolean;
  className?: string;
}) {
  const tone = SLA_TONE[conversation.slaStatus];
  const Icon = tone.icon;

  const deadline = conversation.firstRespondedAt
    ? conversation.resolutionDueAt
    : conversation.firstResponseDueAt;

  const stage = conversation.firstRespondedAt ? "resolução" : "primeira resposta";
  const countdown = deadline ? formatCountdown(deadline) : "sem prazo";

  const label =
    conversation.slaStatus === "pausado"
      ? "SLA pausado"
      : conversation.slaStatus === "cumprido"
        ? "SLA cumprido"
        : showCountdown
          ? countdown
          : SLA_STATUS_LABEL[conversation.slaStatus];

  return (
    <Tooltip
      content={
        conversation.slaStatus === "pausado"
          ? "O relógio está parado enquanto a conversa aguarda o cliente."
          : `${SLA_STATUS_LABEL[conversation.slaStatus]} · prazo de ${stage} ${countdown}`
      }
    >
      <Badge variant={tone.variant} className={cn("tabular-nums", className)}>
        <Icon aria-hidden />
        {label}
      </Badge>
    </Tooltip>
  );
}
