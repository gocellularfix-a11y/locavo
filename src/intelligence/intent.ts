/**
 * Modelo de INTENCIÓN normalizado (V5.0).
 *
 * Vocabulario CERRADO y tipado; no acepta texto libre (eso es el dominio de
 * búsqueda `SearchIntent`). Cada intención mapea de forma determinista a las
 * categorías canónicas ya soportadas por Locavo (`CategoryId`). El nombre
 * visible se resuelve por i18n con la clave `intent.{id}`; la lógica de dominio
 * nunca contiene etiquetas de idioma.
 */
import { CATEGORIES } from '../domain/categories';
import type { CategoryId } from '../domain/place';

export type RecommendationIntent =
  | 'food'
  | 'coffee'
  | 'beer'
  | 'nightlife'
  | 'hotel'
  | 'pharmacy'
  | 'gas'
  | 'shopping'
  | 'surprise';

export const RECOMMENDATION_INTENTS: readonly RecommendationIntent[] = [
  'food',
  'coffee',
  'beer',
  'nightlife',
  'hotel',
  'pharmacy',
  'gas',
  'shopping',
  'surprise',
];

/** Todas las categorías canónicas (para `surprise`). */
const ALL_CATEGORIES: readonly CategoryId[] = CATEGORIES.map((c) => c.id);

/**
 * Mapeo determinista intención → categorías canónicas. Solo se mapea a
 * semántica ya soportada; no se inventan categorías (BREAKFAST/ATM/PARK/
 * EMERGENCY quedan fuera por no existir en la taxonomía actual). `surprise`
 * abarca todas las categorías.
 */
const INTENT_CATEGORIES: Readonly<Record<RecommendationIntent, readonly CategoryId[]>> = {
  food: ['food'],
  coffee: ['coffee'],
  beer: ['beer'],
  nightlife: ['nightlife'],
  hotel: ['lodging'],
  pharmacy: ['pharmacy'],
  gas: ['gas'],
  shopping: ['store'],
  surprise: ALL_CATEGORIES,
};

export function isRecommendationIntent(value: string): value is RecommendationIntent {
  return (RECOMMENDATION_INTENTS as readonly string[]).includes(value);
}

/** Categorías canónicas que satisfacen una intención (determinista, estable). */
export function categoriesForIntent(intent: RecommendationIntent): readonly CategoryId[] {
  return INTENT_CATEGORIES[intent];
}

/** ¿La categoría de un lugar satisface la intención? */
export function intentMatchesCategory(intent: RecommendationIntent, category: CategoryId): boolean {
  return INTENT_CATEGORIES[intent].includes(category);
}

/** Clave i18n del nombre visible de una intención. */
export function intentLabelKey(intent: RecommendationIntent): `intent.${RecommendationIntent}` {
  return `intent.${intent}`;
}
