/**
 * Derivación de VENTANAS de tiempo (V5.8) — puro, determinista, SIN hora actual.
 *
 * Reutiliza `parseTimeToMinutes` del evaluador canónico de horarios (no crea un
 * segundo parser ni redefine abierto/cerrado). Determina, de forma amplia y
 * orientada a la experiencia, en qué bandas del día está ABIERTO el lugar y si
 * abre en día de semana o fin de semana. Preserva intervalos que cruzan
 * medianoche y el comportamiento de horario ausente. Nunca usa `Date`/`now`.
 */
import { parseTimeToMinutes } from '../../domain/openingHours';
import type { OpeningHours, TimeInterval } from '../../domain/place';

export type TimeBandCode =
  | 'EARLY_MORNING'
  | 'MORNING'
  | 'BREAKFAST'
  | 'LUNCH'
  | 'AFTERNOON'
  | 'SUNSET'
  | 'DINNER'
  | 'EVENING'
  | 'LATE_NIGHT';

/** Bandas amplias en minutos locales (fin ≤ inicio ⇒ cruza medianoche). */
const BANDS: Readonly<Record<TimeBandCode, readonly [number, number]>> = {
  EARLY_MORNING: [5 * 60, 8 * 60],
  MORNING: [6 * 60, 11 * 60],
  BREAKFAST: [7 * 60, 11 * 60],
  LUNCH: [13 * 60, 16 * 60],
  AFTERNOON: [16 * 60, 19 * 60],
  SUNSET: [18 * 60, 20 * 60],
  DINNER: [19 * 60, 22 * 60 + 30],
  EVENING: [18 * 60, 23 * 60],
  LATE_NIGHT: [22 * 60, 2 * 60], // cruza medianoche
};

const DAY_MINUTES = 24 * 60;

/** Segmentos lineales [0,1440) de un rango (parte los que cruzan medianoche). */
function segmentsOf(start: number, end: number): [number, number][] {
  if (end > start) {
    return [[start, end]];
  }
  if (end === start) {
    return [[0, DAY_MINUTES]]; // 24 h
  }
  return [[start, DAY_MINUTES], [0, end]];
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

/** Minutos de un 'HH:mm' válido, o `null` si es malformado (nunca lanza). */
function safeMinutes(time: string): number | null {
  try {
    return parseTimeToMinutes(time);
  } catch {
    return null;
  }
}

function intervalOverlapsBand(interval: TimeInterval, band: readonly [number, number]): boolean {
  const open = safeMinutes(interval.open);
  const close = safeMinutes(interval.close);
  if (open === null || close === null) {
    return false;
  }
  const iSegs = segmentsOf(open, close);
  const bSegs = segmentsOf(band[0], band[1]);
  return iSegs.some((i) => bSegs.some((bb) => overlaps(i, bb)));
}

export interface HoursWindows {
  /** El objeto de horario está estructuralmente presente (7 días). */
  readonly hasHours: boolean;
  /** Existe AL MENOS un intervalo con `open`/`close` válidos y parseables. */
  readonly hasUsableInterval: boolean;
  readonly openBands: ReadonlySet<TimeBandCode>;
  readonly openWeekday: boolean;
  readonly openWeekend: boolean;
}

const EMPTY: HoursWindows = {
  hasHours: false,
  hasUsableInterval: false,
  openBands: new Set(),
  openWeekday: false,
  openWeekend: false,
};

/** Un intervalo es usable si ambos extremos parsean a minutos válidos. */
function isUsableInterval(interval: TimeInterval): boolean {
  return safeMinutes(interval.open) !== null && safeMinutes(interval.close) !== null;
}

/** Índices 0 = domingo … 6 = sábado (igual que el dominio de horarios). */
const WEEKDAY_INDEXES = [1, 2, 3, 4, 5];
const WEEKEND_INDEXES = [0, 6];

export function deriveHoursWindows(hours: OpeningHours | null | undefined): HoursWindows {
  if (!hours || !Array.isArray(hours.weekly) || hours.weekly.length !== 7) {
    return EMPTY;
  }
  const openBands = new Set<TimeBandCode>();
  let hasUsableInterval = false;
  for (const day of hours.weekly) {
    if (!day) {
      continue;
    }
    for (const interval of day) {
      if (isUsableInterval(interval)) {
        hasUsableInterval = true;
      }
      for (const code of Object.keys(BANDS) as TimeBandCode[]) {
        if (intervalOverlapsBand(interval, BANDS[code])) {
          openBands.add(code);
        }
      }
    }
  }
  // Día "abierto" solo si tiene al menos un intervalo USABLE (parseable).
  const hasUsableIntervals = (indexes: number[]): boolean =>
    indexes.some((d) => {
      const day = hours.weekly[d];
      return Array.isArray(day) && day.some(isUsableInterval);
    });

  return {
    hasHours: true,
    hasUsableInterval,
    openBands,
    openWeekday: hasUsableIntervals(WEEKDAY_INDEXES),
    openWeekend: hasUsableIntervals(WEEKEND_INDEXES),
  };
}
