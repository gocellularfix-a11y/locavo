/**
 * Motor de CONTEXTO determinista (V5.2).
 *
 * Independiente del motor de recomendación: NO conoce lugares ni resultados.
 * Deriva, de forma determinista y offline, la franja horaria y el perfil activo
 * a partir de un instante inyectado, usando la hora local canónica de Culiacán
 * (offset fijo, sin `Intl`) para que el resultado sea idéntico en cualquier
 * entorno. Arquitectura lista para feriados (aún no implementados).
 */
import { toCuliacanLocal } from '../domain/openingHours';

export type ContextTimeBand =
  | 'lateNight'
  | 'breakfast'
  | 'lunch'
  | 'afternoon'
  | 'dinner'
  | 'nightlife';

export type ContextProfile =
  | 'breakfast'
  | 'coffee'
  | 'lunch'
  | 'dinner'
  | 'nightlife'
  | 'shopping'
  | 'familyAfternoon'
  | 'quickStop'
  | 'lateNight';

export interface ContextSnapshot {
  /** Minutos desde medianoche (hora local de Culiacán). */
  minutesOfDay: number;
  /** 0 = domingo … 6 = sábado (hora local). */
  dayOfWeek: number;
  isWeekend: boolean;
  timeBand: ContextTimeBand;
  profile: ContextProfile;
  /** Extensibilidad futura: siempre `false` en V5.2 (feriados no implementados). */
  isHoliday: boolean;
}

/** Franja horaria por minutos del día (fronteras deterministas y cerradas). */
export function bandOfMinutes(minutes: number): ContextTimeBand {
  if (minutes < 360) return 'lateNight'; // 00:00–05:59
  if (minutes < 660) return 'breakfast'; // 06:00–10:59
  if (minutes < 960) return 'lunch'; // 11:00–15:59
  if (minutes < 1140) return 'afternoon'; // 16:00–18:59
  if (minutes < 1320) return 'dinner'; // 19:00–21:59
  return 'nightlife'; // 22:00–23:59
}

/** Perfil activo a partir de la franja y si es fin de semana (determinista). */
export function profileOf(band: ContextTimeBand, isWeekend: boolean): ContextProfile {
  switch (band) {
    case 'lateNight':
      return 'lateNight';
    case 'breakfast':
      return 'breakfast';
    case 'lunch':
      return 'lunch';
    case 'afternoon':
      return isWeekend ? 'familyAfternoon' : 'shopping';
    case 'dinner':
      return 'dinner';
    case 'nightlife':
      return 'nightlife';
  }
}

/** Evalúa el contexto para un instante. Puro y determinista. */
export function evaluateContext(now: Date): ContextSnapshot {
  const { day, minutes } = toCuliacanLocal(now);
  const isWeekend = day === 0 || day === 6;
  const timeBand = bandOfMinutes(minutes);
  return {
    minutesOfDay: minutes,
    dayOfWeek: day,
    isWeekend,
    timeBand,
    profile: profileOf(timeBand, isWeekend),
    isHoliday: false,
  };
}
