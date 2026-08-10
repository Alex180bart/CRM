import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { DEFAULT_APP_HOST, repositories } from "@elora/core";

import { WidgetEditor } from "@/components/webchat/widget-editor";

export const metadata: Metadata = { title: "Personalizar webchat" };

export default async function WebchatWidgetPage({
  params,
}: {
  params: Promise<{ widgetId: string }>;
}) {
  const { widgetId } = await params;

  const [widget, queues, botFlows, agents, headerList] = await Promise.all([
    repositories.webchat.getById(widgetId),
    repositories.directory.listQueues(),
    repositories.automations.listBotFlows(),
    repositories.agents.list(),
    headers(),
  ]);

  if (!widget) notFound();

  /**
   * A origem do trecho de incorporação vem do cabeçalho, não de constante.
   *
   * O script que o cliente cola aponta para o nosso domínio, e ele muda entre
   * ambientes. Fixar "https://app.crmcf.com.br" faria o trecho copiado em
   * desenvolvimento apontar para produção — e o widget carregaria a configuração
   * errada sem nenhum erro visível.
   */
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? DEFAULT_APP_HOST;
  const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";

  return (
    <WidgetEditor
      widget={widget}
      queues={queues}
      botFlows={botFlows}
      agents={agents}
      origin={`${protocol}://${host}`}
    />
  );
}
