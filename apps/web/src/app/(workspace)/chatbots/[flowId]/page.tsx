import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { repositories } from "@elora/core";

import { BotBuilder } from "@/components/chatbots/bot-builder";

interface PageProps {
  params: Promise<{ flowId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { flowId } = await params;
  const flow = await repositories.automations.getBotFlowById(flowId);
  return { title: flow?.name ?? "Chatbot" };
}

export default async function BotFlowPage({ params }: PageProps) {
  const { flowId } = await params;
  const flow = await repositories.automations.getBotFlowById(flowId);
  if (!flow) notFound();

  return <BotBuilder flow={flow} />;
}
