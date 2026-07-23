/**
 * Motor de INTENCIÓN determinista (V5.5) — API pública. Local, offline,
 * explicable; sin LLM/ML/red. Parser y resolver son responsabilidades separadas.
 */
export {
  INTENT_IDS,
  MAX_INTENT_INPUT_LENGTH,
  MAX_INTENT_TOKENS,
  type IntentId,
  type IntentResolutionConfidence,
  type IntentReasonCode,
  type IntentExclusionCode,
  type IntentAmbiguityCode,
  type IntentMatchedTerm,
  type ResolvedIntent,
} from './intentModel';
export { intentDefinition, isModifierIntent, scopesOverlap, type IntentDefinition } from './intentCatalog';
export { INTENT_LEXICON } from './intentLexicon';
export { normalizeIntentInput, type NormalizedIntentInput } from './intentNormalization';
export {
  parseIntentText,
  type IntentParseResult,
  type IntentTermMatch,
  type IntentParseDiagnostics,
} from './intentParser';
export { resolveIntent } from './intentResolver';
export { buildIntentSnapshot, type IntentSnapshot } from './intentSnapshot';
export { intentCategoryScope } from './intentScope';
export {
  evaluateIntentAdjustment,
  MIN_MULT,
  MAX_MULT,
  type IntentAdjustment,
  type IntentCandidateEvidence,
} from './intentAdjustment';
