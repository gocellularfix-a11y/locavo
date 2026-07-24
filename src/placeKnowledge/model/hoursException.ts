/**
 * EXCEPCIONES DE HORARIO (GEN-1 · Fase A) — cierres temporales y días festivos.
 *
 * El horario semanal canónico (`OpeningHours`) tiene exactamente siete
 * entradas y por construcción no puede expresar "cerrado del 24 al 26 de
 * diciembre" ni "el 1 de enero abre 10:00–14:00". Esta estructura modela
 * ANULACIONES por rango de fechas SOBRE ese horario semanal, sin sustituirlo.
 *
 * Reutiliza `DayHours` del dominio (intervalos / `[]` cerrado / `null` no
 * confirmado) en vez de introducir un segundo tipo de horario.
 *
 * Solo esquema. Decidir qué horario aplica en una fecha concreta pertenece a
 * una fase posterior y NO se implementa aquí. Nota de diseño para esa fase:
 * esa evaluación exige una zona horaria por ciudad, hoy fija en
 * `domain/openingHours.ts`.
 */
import type { DayHours } from '../../domain/place';

export type HoursExceptionKind = 'closed' | 'special_hours';

export interface HoursException {
  /** Primer día afectado, 'YYYY-MM-DD' (inclusivo). */
  readonly startDate: string;
  /** Último día afectado, 'YYYY-MM-DD' (inclusivo). */
  readonly endDate: string;
  readonly kind: HoursExceptionKind;
  /**
   * Horario aplicable cuando `kind === 'special_hours'`. Ausente en un cierre.
   */
  readonly hours?: DayHours;
  /** Etiqueta tal como la declara la fuente; nunca texto generado. */
  readonly label?: string;
}
