import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { repositories } from "@elora/core";
import { Button } from "@elora/ui";
import { ArrowLeft } from "lucide-react";

import { AgentEditor } from "@/components/agents/agent-editor";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Agente de IA" };

export default async function AgentPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;

  const [agent, queues, knowledge] = await Promise.all([
    repositories.agents.getById(agentId),
    repositories.directory.listQueues(),
    repositories.agents.listKnowledge(),
  ]);

  if (!agent) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        compact
        title={agent.name}
        description={agent.description}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/agentes">
              <ArrowLeft />
              Agentes
            </Link>
          </Button>
        }
      />
      <AgentEditor agent={agent} queues={queues} knowledge={knowledge} />
    </div>
  );
}
