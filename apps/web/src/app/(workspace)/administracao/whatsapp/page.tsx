import type { Metadata } from "next";
import Link from "next/link";
import { repositories } from "@crm/core";
import { Button } from "@crm/ui";
import { ArrowLeft } from "lucide-react";

import { WhatsappSetup } from "@/components/admin/whatsapp-setup";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Conectar WhatsApp" };

export default async function WhatsappSetupPage() {
  const [channelAccounts, queues] = await Promise.all([
    repositories.directory.listChannelAccounts(),
    repositories.directory.listQueues(),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        compact
        title="Conectar um número de WhatsApp"
        description="O caminho na Meta, o que colar no painel e o teste que prova que o webhook está de pé."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link href="/administracao">
              <ArrowLeft />
              Administração
            </Link>
          </Button>
        }
      />
      <WhatsappSetup accounts={channelAccounts} queues={queues} />
    </div>
  );
}
