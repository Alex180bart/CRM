import { notFound } from "next/navigation";
import { CURRENT_USER_ID, repositories } from "@elora/core";

import { AppSidebar } from "@/components/shell/app-sidebar";
import { currentAdmin } from "@/lib/site/auth";
import { aplicarVerticalEscolhida } from "@/lib/site/vertical";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  /**
   * A base é alinhada **antes** de qualquer leitura.
   *
   * O armazém vive na memória da instância, e em serverless a instância que
   * responde não é necessariamente a que atendeu o clique em "abrir esta
   * demonstração". Sem este passo, o produto abre na base padrão e a troca
   * parece não ter funcionado. Precisa vir antes do `Promise.all`: a organização
   * e os usuários abaixo saem justamente da base que esta linha escolhe.
   */
  const vertical = await aplicarVerticalEscolhida();

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
        demoVertical={admin ? vertical : undefined}
      />
      <main className="bg-background flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
