/**
 * Motor de DECISIÓN determinista (V5.6) — API pública. Local, offline,
 * explicable; sin LLM/ML/red/aleatoriedad. Consume el ranking (V5.0–V5.5) y no
 * lo reemplaza: selecciona opciones significativamente distintas para comparar.
 */
export {
  DECISION_ROLES,
  ALTERNATIVE_ROLE_PRIORITY,
  DECISION_REASON_CODES,
  DECISION_TRADEOFF_CODES,
  ROLE_REASON,
  type DecisionRole,
  type DecisionReasonCode,
  type DecisionTradeoffCode,
  type DecisionOpenState,
  type DecisionCandidateSnapshot,
  type DecisionOption,
  type DecisionSet,
  type DecisionSelectionDiagnostics,
} from './decisionModel';
export {
  buildDecisionSnapshots,
  intentStrengthOf,
  preferenceStrengthOf,
  type RankedDecisionModel,
} from './decisionSnapshot';
export {
  DISTANCE_DELTA_KM,
  ALTERNATIVE_MIN_SCORE_RATIO,
  isMateriallyCloser,
  isMateriallyFarther,
  hasStrongerConfidence,
  hasWeakerConfidence,
  hasStrongerIntent,
  hasStrongerPreference,
  hasLimitedEvidence,
  isCategoryCompatible,
  type ActiveIntentScope,
} from './decisionDifferentiation';
export { buildDecisionSet, type BuildDecisionSetInput } from './decisionSelection';
