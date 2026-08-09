import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { repositories } from "@elora/core";

import { JourneyBuilder } from "@/components/journeys/journey-builder";

interface PageProps {
  params: Promise<{ journeyId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { journeyId } = await params;
  const journey = await repositories.automations.getJourneyById(journeyId);
  return { title: journey?.name ?? "Jornada" };
}

export default async function JourneyPage({ params }: PageProps) {
  const { journeyId } = await params;
  const journey = await repositories.automations.getJourneyById(journeyId);
  if (!journey) notFound();

  const [enrollments, contacts] = await Promise.all([
    repositories.automations.listEnrollments(journey.id),
    repositories.contacts.list(),
  ]);

  return <JourneyBuilder journey={journey} enrollments={enrollments} contacts={contacts} />;
}
