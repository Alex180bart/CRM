import type { Metadata } from "next";
import { repositories } from "@crm/core";
import { Button } from "@crm/ui";
import { Plus } from "lucide-react";

import { AgentList } from "@/components/agents/agent-list";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Agentes de IA" };

export default async function AgentsPage() {
  const [agents, queues, users] = await Promise.all([
    repositories.agents.list(),
    repositories.directory.listQueues(),
    repositories.directory.listUsers(),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        compact
        title="Agentes de IA"
        description="Atendimento conduzido por IA: o que ele resolve sozinho, o que consulta, o que grava sob confirmação e para qual fila transfere."
        actions={
          <Button size="sm" disabled>
            <Plus />
            Novo agente
          </Button>
        }
      />
      <AgentList agents={agents} queues={queues} users={users} />
    </div>
  );
}
