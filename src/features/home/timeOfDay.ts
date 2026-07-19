import type { CategoryId } from '../../domain/place';

/**
 * Contexto horario del asistente de decisión (V4A.2).
 *
 * Reglas deterministas y locales: la franja se deriva de la hora LOCAL del
 * dispositivo (sin red, sin IA, sin servicios remotos). Las categorías
 * preferidas por franja usan únicamente el catálogo canónico.
 */

export type TimeOfDay = 'morning' | 'lunch' | 'afternoon' | 'evening' | 'lateNight';

/** Franja horaria según la hora local del dispositivo. */
export function getTimeOfDayContext(now: Date): TimeOfDay {
  const hour = now.getHours();
  if (hour >= 5 && hour < 11) {
    return 'morning';
  }
  if (hour >= 11 && hour < 15) {
    return 'lunch';
  }
  if (hour >= 15 && hour < 18) {
    return 'afternoon';
  }
  if (hour >= 18 && hour < 23) {
    return 'evening';
  }
  return 'lateNight';
}

/**
 * Categorías canónicas preferidas por franja, en orden de relevancia.
 * "Entretenimiento" nocturno se mapea a la categoría canónica `nightlife`.
 */
const PREFERRED_CATEGORIES: Record<TimeOfDay, readonly CategoryId[]> = {
  morning: ['coffee', 'food', 'pharmacy'],
  lunch: ['food', 'coffee'],
  afternoon: ['coffee', 'food', 'beer'],
  evening: ['food', 'beer', 'nightlife', 'lodging'],
  lateNight: ['food', 'beer', 'lodging', 'pharmacy', 'gas'],
};

export function getPreferredCategories(timeOfDay: TimeOfDay): CategoryId[] {
  return [...PREFERRED_CATEGORIES[timeOfDay]];
}
