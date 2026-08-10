import { notFound } from "next/navigation";
import { CURRENT_USER_ID, activeVerticalId, repositories } from "@elora/core";

import { AppSidebar } from "@/components/shell/app-sidebar";
import { currentAdmin } from "@/lib/site/auth";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [organization, users, appearance, admin] = await Promise.all([
    repositories.directory.getOrganization(),
    repositories.directory.listUsers(),
    repositories.directory.getAppearance(),
    /**
     * O seletor de base só aparece para a equipe comercial.
     *
     * O cliente que estiver assistindo à demonstração não deve encontrar o botão
     * que troca os dados no meio dela — e, como a troca vale para a instância
     * inteira, também não deve conseguir chamá-la. A `openVerticalAction` faz a
     * mesma checagem; esta só decide o que desenhar.
     */
    currentAdmin(),
  ]);

  const currentUser = users.find((user) => user.id === CURRENT_USER_ID);
  if (!currentUser) notFound();

  return (
    <div className="flex h-full overflow-hidden">
      <AppSidebar
        organization={organization}
        currentUser={currentUser}
        allowThemeChoice={appearance.allowPersonalOverride}
        demoVertical={admin ? activeVerticalId() : undefined}
      />
      <main className="bg-background flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
