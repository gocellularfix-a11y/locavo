/**
 * Fundación de Inteligencia Determinista (V5.0) — API pública.
 *
 * Motor local, offline, determinista y explicable. Sin LLM, sin red, sin
 * mutación de datos canónicos. Ver docs/architecture/
 * DETERMINISTIC-INTELLIGENCE-FOUNDATION.md.
 */
export {
  categoriesForIntent,
  intentMatchesCategory,
  intentLabelKey,
  isRecommendationIntent,
  RECOMMENDATION_INTENTS,
  type RecommendationIntent,
} from './intent';
export {
  baseConfidenceOf,
  weakestConfidence,
  confidenceRank,
  adjustForAgreement,
  type EvidenceConfidence,
} from './confidence';
export {
  normalizeContext,
  InvalidContextError,
  type RecommendationContext,
  type NormalizedContext,
  type RecommendationConstraints,
  type RecommendationPreferences,
} from './context';
export {
  gatherEvidence,
  type CandidateEvidence,
  type EvidenceItem,
  type EvidenceDimension,
  type EvidenceStatus,
} from './evidence';
export { evaluateEligibility, type EligibilityResult, type EligibilityReasonCode } from './eligibility';
export { scoreCandidate, type ScoreResult, type ScoreComponent, type ScoreDimension } from './scoring';
export {
  buildExplanation,
  type Explanation,
  type ExplanationItem,
  type ExplanationCode,
  type ExplanationPolarity,
} from './explanation';
export { surpriseKey } from './surprise';
export {
  DEFAULT_INTELLIGENCE_CONFIG,
  type IntelligenceConfig,
  type ScoreWeights,
} from './config';
export {
  type RecommendationResult,
  type RecommendationDiagnostics,
  type RecommendationOutput,
} from './result';
export { evaluateRecommendations } from './orchestrator';
