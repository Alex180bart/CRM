import type { CampaignStatus } from "@crm/core";
import { CAMPAIGN_STATUS_LABEL } from "@crm/core";
import { Badge, StatusDot } from "@crm/ui";

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
