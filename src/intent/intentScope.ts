/**
 * Política de ALCANCE de candidatos por intención (V5.5). Solo estrecha la
 * recuperación (V5.3) cuando el alcance es fiable; nunca duplica la lógica de
 * recuperación: devuelve categorías para pasar a `retrieveRecommendationCandidates`.
 */
import type { CategoryId } from '../domain/place';
import type { IntentSnapshot } from './intentSnapshot';

/**
 * Categorías explícitas para la recuperación, o `undefined` (recuperación
 * amplia canónica) cuando la intención es parcial/ambigua/desconocida.
 */
export function intentCategoryScope(snapshot: IntentSnapshot): CategoryId[] | undefined {
  const reliable = snapshot.confidence === 'EXACT' || snapshot.confidence === 'STRONG';
  if (reliable && snapshot.categoryScope.size > 0 && snapshot.categoryScope.size <= 4) {
    return [...snapshot.categoryScope].sort();
  }
  return undefined;
}
