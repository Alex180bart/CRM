"use client";

import type { TimePoint } from "@elora/core";
import { BarSeries, ChartFrame } from "@elora/ui";

/**
 * Pulso do dia.
 *
 * Uma operação de atendimento tem ritmo: abre às 8h, satura às 10h, respira no
 * almoço, volta às 14h. Mostrar esse ritmo — com a hora atual marcada — diz
 * mais sobre a carga do time do que qualquer total acumulado.
 */
export function DayPulse({
  data,
  currentHour,
  total,
}: {
  data: TimePoint[];
  currentHour: number;
  total: number;
}) {
  const peak = data.reduce((best, point) => (point.value > best.value ? point : best), data[0]!);
  const bars = data.map((point, hour) => ({
    label: point.label,
    value: point.value,
    emphasis: hour === currentHour,
  }));

  return (
    <div className="bg-card shadow-card rounded-lg p-5">
      <ChartFrame
        title="Pulso do dia"
        description={`${total.toLocaleString("pt-BR")} mensagens hoje · pico às ${peak.label} com ${peak.value}`}
        actions={
          <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <span className="bg-accent h-0.5 w-3 rounded-full" aria-hidden />
            agora ({String(currentHour).padStart(2, "0")}h)
          </span>
        }
      >
        <BarSeries
          data={bars}
          height={132}
          colorIndex={0}
          formatValue={(value) => `${value} mensagens`}
        />
      </ChartFrame>
    </div>
  );
}
