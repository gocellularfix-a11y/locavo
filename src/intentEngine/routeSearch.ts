/**
 * Ruteo determinista (Intent Engine V1). Decide, a partir del texto, si la
 * consulta va al Decision Engine (intención conocida con categoría Locavo y
 * confianza suficiente) o a la búsqueda universal (desconocida, sin categoría o
 * baja confianza). NUNCA bloquea: el fallback siempre es búsqueda universal.
 */
import { detectIntent } from './detectIntent';
import { DECISION_CONFIDENCE_THRESHOLD, type IntentLanguage, type SearchRoute } from './types';

export function routeSearch(text: string, localeHint?: IntentLanguage): SearchRoute {
  const detection = detectIntent(text, localeHint);
  if (
    detection.intent !== null &&
    detection.categories.length > 0 &&
    detection.confidence >= DECISION_CONFIDENCE_THRESHOLD
  ) {
    return { kind: 'decision', intent: detection.intent, category: detection.categories[0], detection };
  }
  return { kind: 'search', text, detection };
}
