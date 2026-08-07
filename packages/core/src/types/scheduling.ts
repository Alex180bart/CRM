/**
 * Escalas e horário de atendimento.
 * Referência: Plano Completo, seções 10 (filas e SLA) e 11 (horário por número).
 *
 * ## Por que não reaproveitar `WidgetSchedule`
 *
 * O horário do webchat é um par `from`/`to` por dia da semana, e não consegue
 * expressar a coisa mais comum de um escritório: **fechar para o almoço**. Com
 * uma faixa só por dia, "09:00–12:00 e 13:30–18:00" vira "09:00–18:00", e o
 * widget passa a prometer atendimento na hora em que não há ninguém.
 *
 * Daí `ranges` no plural. E daí também `exceptions`: feriado não é dia da
 * semana. Modelar feriado desligando a terça-feira funcionaria uma vez e
 * deixaria todas as terças seguintes fechadas — erro que só aparece na semana
 * seguinte, quando ninguém mais está olhando.
 *
 * ## O que esta escala ainda não faz
 *
 * Ela responde "está aberto?" e "quando abre?". Não escala plantão, não gera
 * turno por pessoa e não integra com folha. Escala de plantão exige rotação com
 * data, que é outro domínio — e inventá-la aqui produziria uma tela que parece
 * gerenciar jornada de trabalho sem nenhuma das garantias que isso exige.
 */

import type { BaseEntity } from "./common";

/** Faixa de expediente dentro de um dia. Horários em "HH:MM", 24 h. */
export interface TimeRange {
  from: string;
  to: string;
}

/** Um dia da semana e suas faixas. Lista vazia significa fechado. */
export interface ScheduleDay {
  /** 0 é domingo, como `Date.getDay()`. */
  weekday: number;
  ranges: TimeRange[];
}

/**
 * Data específica que não segue o dia da semana.
 *
 * Com `ranges` vazio é feriado — fechado o dia todo. Com faixas, é expediente
 * diferente: véspera de Natal até as 12h, sábado de mutirão fiscal.
 */
export interface ScheduleException {
  /** Data local no formato AAAA-MM-DD. */
  date: string;
  label: string;
  ranges: TimeRange[];
}

export interface BusinessSchedule extends BaseEntity {
  name: string;
  description: string;
  /** IANA. Fica na escala, e não só na organização, porque unidade em outro fuso é caso real. */
  timezone: string;
  days: ScheduleDay[];
  exceptions: ScheduleException[];
  /**
   * O que responder fora do expediente.
   *
   * Fica aqui, e não na fila, porque quem muda o horário é quem precisa mudar o
   * aviso junto — separá-los produz a escala nova com o texto antigo dizendo
   * "voltamos às 18h".
   */
  outsideMessage: string;
}

/** Resultado de consultar uma escala num instante. */
export interface ScheduleState {
  open: boolean;
  /** O que fechou: dia sem faixa, fora da faixa, feriado ou exceção. */
  reason: string;
  /** Rótulo da exceção quando foi ela que decidiu. */
  exceptionLabel?: string;
  /** Próxima abertura em ISO, quando existir dentro de 14 dias. */
  nextOpeningIso?: string;
}
