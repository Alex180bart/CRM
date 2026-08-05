import type { Metadata } from "next";
import { repositories } from "@crm/core";
import { Button } from "@crm/ui";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { WidgetList } from "@/components/webchat/widget-list";

export const metadata: Metadata = { title: "Webchat" };

export default async function WebchatPage() {
  const [widgets, queues, users] = await Promise.all([
    repositories.webchat.list(),
    repositories.directory.listQueues(),
    repositories.directory.listUsers(),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        compact
        title="Webchat"
        description="O chat que vive no site do cliente: cor da marca, o que perguntar antes e qual fila recebe."
        actions={
          <Button size="sm" disabled>
            <Plus />
            Novo widget
          </Button>
        }
      />
      <WidgetList widgets={widgets} queues={queues} users={users} />
    </div>
  );
}
