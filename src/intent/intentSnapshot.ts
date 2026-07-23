/**
 * Snapshot de intención resuelto (V5.5) — puro. Estructura consultable por las
 * capas de alcance y ajuste. No consume lugares.
 */
import type { CategoryId } from '../domain/place';
import { intentDefinition } from './intentCatalog';
import type { IntentId, IntentResolutionConfidence, ResolvedIntent } from './intentModel';

export interface IntentSnapshot {
  primaryIntent: IntentId;
  confidence: IntentResolutionConfidence;
  categoryScope: ReadonlySet<CategoryId>;
  wantsOpenNow: boolean;
  wantsOpenLate: boolean;
  wantsNearby: boolean;
  wantsAccessible: boolean;
  wantsFamily: boolean;
}

export function buildIntentSnapshot(resolved: ResolvedIntent): IntentSnapshot {
  const all: IntentId[] = [resolved.primaryIntent, ...resolved.secondaryIntents];
  const categoryScope = new Set<CategoryId>();
  for (const id of all) {
    for (const c of intentDefinition(id).categoryScope) {
      categoryScope.add(c);
    }
  }
  const has = (id: IntentId) => all.includes(id);
  return {
    primaryIntent: resolved.primaryIntent,
    confidence: resolved.confidence,
    categoryScope,
    wantsOpenNow: has('OPEN_NOW'),
    wantsOpenLate: has('OPEN_LATE'),
    wantsNearby: has('NEARBY'),
    wantsAccessible: has('ACCESSIBLE'),
    wantsFamily: has('FAMILY_ACTIVITY'),
  };
}
