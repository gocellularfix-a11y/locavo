/**
 * Resolver de intención (V5.5) — PURO, separado del parser. Elige UNA intención
 * primaria, retiene secundarias compatibles, marca ambigüedad y prefiere la
 * selección explícita de UI sobre el texto. Devuelve `null` para UNKNOWN.
 */
import { intentDefinition, isModifierIntent, scopesOverlap } from './intentCatalog';
import type { IntentId, IntentMatchedTerm, ResolvedIntent } from './intentModel';
import type { IntentParseResult } from './intentParser';

function byPriorityThenId(a: IntentId, b: IntentId): number {
  const pa = intentDefinition(a).priority;
  const pb = intentDefinition(b).priority;
  return pb !== pa ? pb - pa : a < b ? -1 : a > b ? 1 : 0;
}

function orderedSecondaries(primary: IntentId, ids: readonly IntentId[]): IntentId[] {
  return [...new Set(ids)].filter((i) => i !== primary).sort(byPriorityThenId);
}

export function resolveIntent(
  parseResult: IntentParseResult,
  explicitSelection?: IntentId,
): ResolvedIntent | null {
  const parsedIntents = parseResult.matches.map((m) => m.intent);
  const matchedTerms: IntentMatchedTerm[] = parseResult.matches.map((m) => ({ intent: m.intent, term: m.term }));

  // Selección explícita de UI: anula el texto.
  if (explicitSelection) {
    return {
      primaryIntent: explicitSelection,
      secondaryIntents: orderedSecondaries(explicitSelection, parsedIntents.filter(isModifierIntent)),
      confidence: 'EXACT',
      matchedTerms: [{ intent: explicitSelection, term: 'selection' }, ...matchedTerms.filter((m) => m.intent !== explicitSelection)],
      unresolvedTerms: [],
    };
  }

  if (parsedIntents.length === 0) {
    return null; // UNKNOWN
  }

  const categoryBearing = parsedIntents.filter((i) => !isModifierIntent(i));
  const modifiers = parsedIntents.filter(isModifierIntent);
  const unresolved = parseResult.unresolvedTokens;

  // Solo modificadoras (p. ej. "abierto", "cerca").
  if (categoryBearing.length === 0) {
    const primary = [...modifiers].sort(byPriorityThenId)[0];
    return {
      primaryIntent: primary,
      secondaryIntents: orderedSecondaries(primary, modifiers),
      confidence: unresolved.length > 0 ? 'PARTIAL' : parsedIntents.length >= 2 ? 'STRONG' : 'EXACT',
      matchedTerms,
      unresolvedTerms: unresolved,
    };
  }

  const primary = [...categoryBearing].sort(byPriorityThenId)[0];
  const conflicting = categoryBearing.filter((i) => i !== primary && !scopesOverlap(primary, i));

  if (conflicting.length > 0) {
    return {
      primaryIntent: primary,
      secondaryIntents: orderedSecondaries(primary, [...categoryBearing.filter((i) => scopesOverlap(primary, i)), ...modifiers]),
      confidence: 'AMBIGUOUS',
      matchedTerms,
      unresolvedTerms: unresolved,
      ambiguity: 'INTENT_CONFLICTING_PRIMARIES',
      ambiguousPrimaries: [primary, ...conflicting].sort(byPriorityThenId),
    };
  }

  const confidence = unresolved.length > 0 ? 'PARTIAL' : parsedIntents.length >= 2 ? 'STRONG' : 'EXACT';
  return {
    primaryIntent: primary,
    secondaryIntents: orderedSecondaries(primary, [...categoryBearing, ...modifiers]),
    confidence,
    matchedTerms,
    unresolvedTerms: unresolved,
  };
}
