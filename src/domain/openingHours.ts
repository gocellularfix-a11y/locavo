import type { DayHours, OpeningHours, TimeInterval } from './place';

/**
 * Evaluador determinista de horarios.
 *
 * Toda la evaluación se hace en hora local de Culiacán, Sinaloa
 * (zona `America/Mazatlan`). México eliminó el horario de verano en 2022,
 * por lo que el desfase es fijo: UTC-7 durante todo el año. Se usa un
 * desfase fijo en lugar de `Intl` para que el resultado sea idéntico en
 * Hermes (Android/iOS), navegadores y Node (pruebas).
 */
export const CULIACAN_UTC_OFFSET_MINUTES = -7 * 60;

export type OpenState = 'open' | 'closed' | 'unknown';

export interface OpenStatus {
  state: OpenState;
  /** Hora local 'HH:mm' a la que cierra el intervalo actual (solo si `open`). */
  closesAt?: string;
}

const MINUTES_PER_DAY = 24 * 60;

/** Convierte 'HH:mm' a minutos desde medianoche. Lanza error si es inválido. */
export function parseTimeToMinutes(time: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    throw new Error(`Hora inválida: "${time}" (se espera HH:mm)`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Día de la semana (0 = domingo) y minutos locales de Culiacán para un instante dado. */
export function toCuliacanLocal(now: Date): { day: number; minutes: number } {
  const shifted = new Date(now.getTime() + CULIACAN_UTC_OFFSET_MINUTES * 60_000);
  return {
    day: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function intervalCrossesMidnight(interval: TimeInterval): boolean {
  return parseTimeToMinutes(interval.close) <= parseTimeToMinutes(interval.open);
}

/**
 * Evalúa el estado de apertura en el instante `now`.
 *
 * Reglas:
 * - `hours` nulo → `unknown` (horario no confirmado).
 * - Día actual `null` → `unknown`, salvo que un intervalo del día anterior
 *   que cruza medianoche siga activo.
 * - Día actual `[]` → cerrado ese día.
 * - Un intervalo cuyo cierre es ≤ apertura cruza la medianoche
 *   (p. ej. 20:00–02:00) y sigue abierto en la madrugada del día siguiente.
 */
export function evaluateOpenStatus(hours: OpeningHours | null, now: Date): OpenStatus {
  if (!hours || hours.weekly.length !== 7) {
    return { state: 'unknown' };
  }

  const { day, minutes } = toCuliacanLocal(now);
  const today: DayHours = hours.weekly[day];
  const yesterday: DayHours = hours.weekly[(day + 6) % 7];

  // 1. Intervalos de ayer que cruzan medianoche y siguen activos hoy.
  if (yesterday) {
    for (const interval of yesterday) {
      if (intervalCrossesMidnight(interval) && minutes < parseTimeToMinutes(interval.close)) {
        return { state: 'open', closesAt: interval.close };
      }
    }
  }

  // 2. Día actual sin información.
  if (today === null) {
    return { state: 'unknown' };
  }

  // 3. Intervalos del día actual.
  for (const interval of today) {
    const open = parseTimeToMinutes(interval.open);
    const close = parseTimeToMinutes(interval.close);
    if (intervalCrossesMidnight(interval)) {
      // Abre hoy y cierra mañana (o abre 24 h si open === close).
      if (minutes >= open || open === close) {
        return { state: 'open', closesAt: interval.close };
      }
    } else if (minutes >= open && minutes < close) {
      return { state: 'open', closesAt: interval.close };
    }
  }

  return { state: 'closed' };
}

/** Formatea 'HH:mm' (24 h) como hora legible de 12 horas: '11:00 p. m.'. */
export function formatTime12h(time: string): string {
  const total = parseTimeToMinutes(time);
  const hours24 = Math.floor(total / 60);
  const mins = total % 60;
  const suffix = hours24 < 12 ? 'a. m.' : 'p. m.';
  let hours12 = hours24 % 12;
  if (hours12 === 0) {
    hours12 = 12;
  }
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/** Texto accesible y visible del estado: 'Abierto hasta las 11:00 p. m.', 'Cerrado', 'Horario no confirmado'. */
export function describeOpenStatus(status: OpenStatus): string {
  switch (status.state) {
    case 'open':
      return status.closesAt
        ? `Abierto hasta las ${formatTime12h(status.closesAt)}`
        : 'Abierto';
    case 'closed':
      return 'Cerrado';
    case 'unknown':
      return 'Horario no confirmado';
  }
}

/** Utilidad para minutos-del-día → 'HH:mm' (usada en datos y pruebas). */
export function minutesToTime(minutes: number): string {
  const clamped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
