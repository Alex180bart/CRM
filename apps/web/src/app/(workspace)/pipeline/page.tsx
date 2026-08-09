import type { Metadata } from "next";
import { repositories } from "@elora/core";
import type { Deal } from "@elora/core";
import { Button } from "@elora/ui";
import { Settings2 } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const [pipelines, contacts, companies, users, tags] = await Promise.all([
    repositories.deals.listPipelines(),
    repositories.contacts.list(),
    repositories.contacts.listCompanies(),
    repositories.directory.listUsers(),
    repositories.directory.listTags(),
  ]);

  const dealsByPipeline: Record<string, Deal[]> = {};
  await Promise.all(
    pipelines.map(async (pipeline) => {
      dealsByPipeline[pipeline.id] = await repositories.deals.listByPipeline(pipeline.id);
    }),
  );

  return (
    <>
      <PageHeader
        compact
        title="Pipeline"
        description="Funis de vendas e matrículas com etapas, probabilidade, previsão e tempo máximo por etapa."
        actions={
          <Button variant="outline" size="sm">
            <Settings2 />
            Configurar funil
          </Button>
        }
      />
      <PipelineBoard
        pipelines={pipelines}
        dealsByPipeline={dealsByPipeline}
        contacts={contacts}
        companies={companies}
        users={users}
        tags={tags}
      />
    </>
  );
}
