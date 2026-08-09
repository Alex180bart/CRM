import type { Metadata } from "next";
import { repositories } from "@elora/core";
import { Button } from "@elora/ui";
import { Plus } from "lucide-react";

import { JourneyList } from "@/components/journeys/journey-list";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Jornadas" };

export default async function JornadasPage() {
  const journeys = await repositories.automations.listJourneys();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        compact
        title="Jornadas"
        description="Acompanham o contato por dias ou meses. Para reagir a um clique agora, a ferramenta é Automações."
        actions={
          <Button size="sm" disabled>
            <Plus />
            Nova jornada
          </Button>
        }
      />
      <JourneyList journeys={journeys} />
    </div>
  );
}
