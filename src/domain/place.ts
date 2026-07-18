/**
 * Modelo de dominio central de Locavo.
 *
 * Un `Place` es un lugar de Culiacán con la información mínima necesaria
 * para decidir: dónde está, si está abierto, qué tan confiable es su
 * información y cómo contactarlo.
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

/** Nivel de precio aproximado: 1 = económico, 3 = alto. */
export type PriceLevel = 1 | 2 | 3;

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Place {
  id: string;
  name: string;
  category: CategoryId;
  latitude: number;
  longitude: number;
  address: string;
  /** `null` cuando el horario completo se desconoce. */
  openingHours: OpeningHours | null;
  phone: string | null;
  website: string | null;
  priceLevel: PriceLevel | null;
  /** Origen del dato. En Fase 1 siempre `demo-seed`. */
  source: string;
  /** Fecha ISO (UTC) de la última verificación del dato. */
  lastVerifiedAt: string;
  confidence: ConfidenceLevel;
  /** Palabras clave adicionales para búsqueda local. */
  keywords: string[];
  /** Marca explícita de dato de demostración (Fase 1). */
  isDemo: boolean;
}
