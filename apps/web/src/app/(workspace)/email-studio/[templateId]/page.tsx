import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { repositories } from "@crm/core";

import { EmailEditor } from "@/components/email/email-editor";

interface PageProps {
  params: Promise<{ templateId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { templateId } = await params;
  const template = await repositories.emailStudio.getTemplateById(templateId);
  return { title: template?.name ?? "E-mail" };
}

export default async function EmailTemplatePage({ params }: PageProps) {
  const { templateId } = await params;
  const template = await repositories.emailStudio.getTemplateById(templateId);
  if (!template) notFound();

  const [brandKits, modules] = await Promise.all([
    repositories.emailStudio.listBrandKits(),
    repositories.emailStudio.listModules(),
  ]);

  return <EmailEditor template={template} brandKits={brandKits} modules={modules} />;
}
