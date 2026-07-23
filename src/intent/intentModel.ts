/**
 * Modelo canónico de INTENCIÓN (V5.5) — determinista, sin cadenas de UI.
 *
 * Convierte el objetivo inmediato del usuario en estructura. Separado de la
 * confianza de recomendación (V5.0), del contexto (V5.2) y de las preferencias
 * (V5.4). No persiste texto crudo.
 */

export type IntentId =
  | 'BREAKFAST'
  | 'COFFEE'
  | 'LUNCH'
  | 'DINNER'
  | 'NIGHTLIFE'
  | 'FAMILY_ACTIVITY'
  | 'QUICK_STOP'
  | 'SHOPPING'
  | 'PHARMACY'
  | 'MEDICAL'
  | 'FUEL'
  | 'LODGING'
  | 'ENTERTAINMENT'
  | 'ACCESSIBLE'
  | 'OPEN_NOW'
  | 'OPEN_LATE'
  | 'NEARBY';

export const INTENT_IDS: readonly IntentId[] = [
  'BREAKFAST', 'COFFEE', 'LUNCH', 'DINNER', 'NIGHTLIFE', 'FAMILY_ACTIVITY', 'QUICK_STOP',
  'SHOPPING', 'PHARMACY', 'MEDICAL', 'FUEL', 'LODGING', 'ENTERTAINMENT', 'ACCESSIBLE',
  'OPEN_NOW', 'OPEN_LATE', 'NEARBY',
];

export type IntentResolutionConfidence = 'EXACT' | 'STRONG' | 'PARTIAL' | 'AMBIGUOUS' | 'UNKNOWN';

export type IntentAmbiguityCode = 'INTENT_CONFLICTING_PRIMARIES';

export type IntentReasonCode =
  | 'INTENT_EXACT_MATCH'
  | 'INTENT_CATEGORY_MATCH'
  | 'INTENT_BREAKFAST_MATCH'
  | 'INTENT_COFFEE_MATCH'
  | 'INTENT_LUNCH_MATCH'
  | 'INTENT_DINNER_MATCH'
  | 'INTENT_FAMILY_MATCH'
  | 'INTENT_QUICK_STOP_MATCH'
  | 'INTENT_PHARMACY_MATCH'
  | 'INTENT_MEDICAL_MATCH'
  | 'INTENT_FUEL_MATCH'
  | 'INTENT_LODGING_MATCH'
  | 'INTENT_ENTERTAINMENT_MATCH'
  | 'INTENT_ACCESSIBILITY_MATCH'
  | 'INTENT_OPEN_NOW_MATCH'
  | 'INTENT_OPEN_LATE_MATCH'
  | 'INTENT_NEARBY_MATCH';

export type IntentExclusionCode = 'INTENT_CATEGORY_INCOMPATIBLE' | 'INTENT_REQUIRED_EVIDENCE_MISSING';

/** Un término reconocido y a qué intención mapea. */
export interface IntentMatchedTerm {
  term: string;
  intent: IntentId;
}

export interface ResolvedIntent {
  primaryIntent: IntentId;
  secondaryIntents: IntentId[];
  confidence: IntentResolutionConfidence;
  matchedTerms: IntentMatchedTerm[];
  unresolvedTerms: string[];
  ambiguity?: IntentAmbiguityCode;
  /** Candidatos primarios en conflicto (para la elección determinista de UI). */
  ambiguousPrimaries?: IntentId[];
}

/** Límites de seguridad de entrada (anti-DoS, ReDoS-safe). */
export const MAX_INTENT_INPUT_LENGTH = 120;
export const MAX_INTENT_TOKENS = 24;
