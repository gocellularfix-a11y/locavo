/**
 * Primitivas compartidas del dominio.
 *
 * El modelo canónico de lugar vive en `domain/places/LocavoPlace.ts` (V3).
 * Aquí quedan los tipos transversales que usan horarios, distancia,
 * categorías y ubicación.
 */

export type CategoryId =
  | 'food'
  | 'beer'
  | 'coffee'
  | 'lodging'
  | 'pharmacy'
  | 'gas'
  | 'store'
  | 'nightlife';

/**
 * Intervalo de apertura en hora local de Culiacán, formato 'HH:mm' (24 h).
 * Si `close` es menor o igual que `open`, el intervalo cruza la medianoche
 * (por ejemplo 20:00–02:00).
 */
export interface TimeInterval {
  open: string;
  close: string;
}

/**
 * Horario de un día:
 * - `TimeInterval[]` con elementos → abre en esos intervalos.
 * - `[]` → permanece cerrado ese día.
 * - `null` → horario no confirmado para ese día.
 */
export type DayHours = TimeInterval[] | null;

/**
 * Horario semanal. `weekly` tiene exactamente 7 entradas, índice 0 = domingo
 * (igual que `Date.getUTCDay()`).
 */
export interface OpeningHours {
  weekly: DayHours[];
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}
