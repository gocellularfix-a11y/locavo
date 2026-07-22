/**
 * Recuperación canónica de candidatos (V5.3) — API pública. Determinista,
 * independiente del ranking; nunca calcula score/confianza/contexto.
 */
export {
  retrieveRecommendationCandidates,
  DEFAULT_CANDIDATE_SAFETY_LIMIT,
  type CandidateRetrievalInput,
  type CandidateRetrievalResult,
  type CandidateRetrievalDiagnostics,
} from './retrieveCandidates';
