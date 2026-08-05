import { notFound } from "next/navigation";
import { CURRENT_USER_ID, repositories } from "@crm/core";

import { AppSidebar } from "@/components/shell/app-sidebar";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [organization, users] = await Promise.all([
    repositories.directory.getOrganization(),
    repositories.directory.listUsers(),
  ]);

  const currentUser = users.find((user) => user.id === CURRENT_USER_ID);
  if (!currentUser) notFound();

  return (
    <div className="flex h-full overflow-hidden">
      <AppSidebar organization={organization} currentUser={currentUser} />
      <main className="bg-background flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
