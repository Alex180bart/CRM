import type { Metadata } from "next";
import Link from "next/link";
import { repositories } from "@elora/core";
import { Button } from "@elora/ui";
import { Plus } from "lucide-react";

import { EmailStudioConsole } from "@/components/email/email-studio-console";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "E-mail Studio" };

export default async function EmailStudioPage() {
  const [templates, modules, brandKits, domains, suppressions, stats, users] = await Promise.all([
    repositories.emailStudio.listTemplates(),
    repositories.emailStudio.listModules(),
    repositories.emailStudio.listBrandKits(),
    repositories.emailStudio.listDomains(),
    repositories.emailStudio.listSuppressions(),
    repositories.emailStudio.deliveryStats(),
    repositories.directory.listUsers(),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        compact
        title="E-mail Studio"
        description="Montagem por blocos, módulos de marca e a infraestrutura que decide se o e-mail chega."
        actions={
          <Button asChild size="sm">
            <Link href="/email-studio/novo">
              <Plus />
              Novo e-mail
            </Link>
          </Button>
        }
      />
      <EmailStudioConsole
        templates={templates}
        modules={modules}
        brandKits={brandKits}
        domains={domains}
        suppressions={suppressions}
        stats={stats}
        users={users}
      />
    </div>
  );
}
