import type { CampaignStatus } from "@elora/core";
import { CAMPAIGN_STATUS_LABEL } from "@elora/core";
import { Badge, StatusDot } from "@elora/ui";

const TONE: Record<CampaignStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  rascunho: "neutral",
  em_aprovacao: "warning",
  agendada: "info",
  enviando: "accent",
  pausada: "warning",
  concluida: "success",
  cancelada: "neutral",
};

const DOT: Record<CampaignStatus, React.ComponentProps<typeof StatusDot>["tone"]> = {
  rascunho: "neutral",
  em_aprovacao: "warning",
  agendada: "info",
  enviando: "accent",
  pausada: "warning",
  concluida: "success",
  cancelada: "neutral",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <Badge variant={TONE[status]}>
      <StatusDot tone={DOT[status]} pulse={status === "enviando"} />
      {CAMPAIGN_STATUS_LABEL[status]}
    </Badge>
  );
}
