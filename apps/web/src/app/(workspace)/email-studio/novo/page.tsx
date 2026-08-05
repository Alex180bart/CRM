import type { Metadata } from "next";
import { repositories } from "@crm/core";

import { EmailCreate } from "@/components/email/email-create";
import { PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Novo e-mail" };

export default async function NovoEmailPage() {
  const [brandKits, modules] = await Promise.all([
    repositories.emailStudio.listBrandKits(),
    repositories.emailStudio.listModules(),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        compact
        title="Novo e-mail"
        description="Descreva para a IA, cole o HTML pronto ou monte bloco a bloco."
      />
      <EmailCreate brandKits={brandKits} modules={modules} />
    </div>
  );
}
