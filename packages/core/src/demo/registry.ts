/**
 * Catálogo das verticais de demonstração.
 *
 * A mescla é rasa e proposital: uma vertical **substitui a coleção inteira** ou
 * não a declara. Mesclar item a item produziria a base híbrida que ninguém
 * escreveu — metade dos contatos falando de tributação e metade de rastreio —
 * e o defeito apareceria só na demonstração, com o cliente na frente.
 */

import type { DemoDataset, DemoOverlay, DemoVerticalId, DemoVerticalMeta } from "./types";
import { baseDataset } from "./base";
import { ecommerceOverlay } from "./verticais/ecommerce";
import { clinicaOverlay } from "./verticais/clinica";
import { imobiliariaOverlay } from "./verticais/imobiliaria";
import { buildDemoProposals, catalogFor } from "./comercio";

const OVERLAYS: DemoOverlay[] = [ecommerceOverlay, clinicaOverlay, imobiliariaOverlay];

/**
 * Mescla o overlay sobre a base e acrescenta o comércio.
 *
 * Catálogo e propostas entram **aqui**, e não dentro de cada arquivo de
 * vertical, por dois motivos. A proposta depende das conversas já mescladas —
 * dentro do overlay ela veria as conversas daquele arquivo, mas não saberia se a
 * mescla as manteve. E concentrar num ponto significa que a quinta vertical
 * ganha catálogo e propostas de graça: basta declarar o catálogo em
 * `comercio.ts`.
 */
function merge(overlay: DemoOverlay): DemoDataset {
  const merged: DemoDataset = { ...baseDataset, ...overlay };
  const id = overlay.meta.id;

  if (id === "contabilidade") return merged;

  const products = catalogFor(id, merged.organization.id);

  return {
    ...merged,
    products,
    proposals: buildDemoProposals({
      orgId: merged.organization.id,
      products,
      conversations: merged.conversations,
      contacts: merged.contacts,
      users: merged.users,
    }),
  };
}

const DATASETS: Record<DemoVerticalId, DemoDataset> = {
  contabilidade: baseDataset,
  ecommerce: merge(ecommerceOverlay),
  clinica: merge(clinicaOverlay),
  imobiliaria: merge(imobiliariaOverlay),
};

export const DEFAULT_VERTICAL: DemoVerticalId = "contabilidade";

/** Ordem de exibição na vitrine e no seletor. A base vem primeiro. */
export const DEMO_VERTICALS: DemoVerticalMeta[] = [
  baseDataset.meta,
  ...OVERLAYS.map((overlay) => overlay.meta),
];

export function datasetFor(id: DemoVerticalId): DemoDataset {
  return DATASETS[id] ?? baseDataset;
}

export function isDemoVerticalId(value: unknown): value is DemoVerticalId {
  return typeof value === "string" && value in DATASETS;
}

export function verticalMeta(id: DemoVerticalId): DemoVerticalMeta {
  return datasetFor(id).meta;
}
