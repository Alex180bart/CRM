/**
 * Séries e resumos analíticos.
 * Referência: Plano Completo, seção 30 (indicadores por área).
 *
 * Cada métrica exibida em tela precisa de definição escrita: fonte, filtro,
 * janela, unidade e dono. `MetricDefinition` carrega isso junto do número, para
 * que o dashboard nunca mostre um valor sem caminho de volta ao evento.
 */

import type { ChannelKind, Id, IsoDateTime } from "./common";

export interface TimePoint {
  /** Rótulo curto para o eixo: "03/08", "14h". */
  label: string;
  value: number;
  at?: IsoDateTime;
}

export interface MetricDefinition {
  key: string;
  label: string;
  /** Como o número é calculado, em uma frase. */
  definition: string;
  source: string;
  owner: string;
  unit: "quantidade" | "percentual" | "minutos" | "reais";
}

export interface MetricSummary {
  key: string;
  label: string;
  value: number;
  unit: MetricDefinition["unit"];
  /** Variação percentual contra o período anterior. */
  changePct?: number;
  /** `true` quando subir é bom. Usado para colorir a variação. */
  higherIsBetter?: boolean;
  target?: number;
  series?: TimePoint[];
}

/** Item da fila "precisa de você agora" — o coração da página inicial. */
export interface AttentionItem {
  id: Id;
  kind: "sla" | "tarefa" | "aprovacao" | "automacao" | "canal" | "dados";
  title: string;
  detail: string;
  /** Prazo. Vencido aparece primeiro. */
  dueAt?: IsoDateTime;
  severity: "critico" | "alto" | "medio";
  href: string;
  actionLabel: string;
  contactId?: Id;
  channel?: ChannelKind;
}

export interface ChannelVolume {
  channel: ChannelKind;
  received: number;
  sent: number;
}

export interface AutomationHealth {
  label: string;
  runs: number;
  success: number;
  errors: number;
  retries: number;
  avgLatencySeconds: number;
  backlog: number;
}

export interface OperationCost {
  label: string;
  amountCents: number;
  changePct: number;
  unit: string;
}
