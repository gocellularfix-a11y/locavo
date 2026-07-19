import type { TranslationKey } from '../../i18n/locales/es';
import type { TimeOfDay } from './timeOfDay';

/**
 * Sugerencias contextuales del hero (V4A.2).
 *
 * Listas curadas por franja horaria; todo el texto visible vive en los
 * catálogos i18n (7 idiomas). Sin duplicados dentro de una misma rotación
 * y con la sugerencia específica de la franja siempre en primer lugar.
 */

const ROTATIONS: Record<TimeOfDay, readonly TranslationKey[]> = {
  morning: ['suggest.morning.1', 'suggest.morning.2', 'suggest.morning.3', 'suggest.general.5'],
  lunch: ['suggest.lunch.1', 'suggest.lunch.2', 'suggest.lunch.3', 'suggest.general.3'],
  afternoon: [
    'suggest.afternoon.1',
    'suggest.afternoon.2',
    'suggest.afternoon.3',
    'suggest.general.5',
  ],
  evening: ['suggest.evening.1', 'suggest.evening.2', 'suggest.evening.3', 'suggest.evening.4'],
  lateNight: [
    'suggest.lateNight.1',
    'suggest.lateNight.2',
    'suggest.lateNight.3',
    'suggest.general.2',
  ],
};

/** Claves i18n de la rotación de sugerencias para la franja dada. */
export function getContextualSuggestions(timeOfDay: TimeOfDay): TranslationKey[] {
  return [...ROTATIONS[timeOfDay]];
}
