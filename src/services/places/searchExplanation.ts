/**
 * Explicación de búsqueda (V4E.1) — salida ADITIVA y explicable del ranking.
 *
 * Pipeline canónico del Search Ranking (cada capa independiente y testeable):
 *
 *   Intent → Matching → Scoring → Explanation → Sorting → Pagination
 *
 * `SearchExplanation` describe POR QUÉ un resultado obtuvo su score, derivado
 * de LOS MISMOS hechos de matching que producen el score (sin lógica paralela).
 * No añade señales sin datos: no hay popularity, price ni attributes.
 *
 * Separación de conceptos (invariante):
 *   Ranking Score ≠ Match Confidence ≠ Verification Confidence ≠ Data Availability
 */

/** Señales de scoring con datos reales (excluye popularity/price/attributes). */
export type RankingSignal =
  | 'NAME_EXACT'
  | 'NAME_PREFIX'
  | 'NAME_TOKEN'
  | 'CATEGORY'
  | 'CATEGORY_BONUS'
  | 'TERM'
  | 'TERM_COVERAGE'
  | 'MULTI_TERM'
  | 'COMPLETENESS'
  | 'DISTANCE'
  // Hechos veraces adicionales (no aportan puntos propios; la distancia ya suma):
  | 'NEARBY'
  | 'OPEN_NOW';

/** Solidez de la COINCIDENCIA de búsqueda (no calidad/veracidad del negocio). */
export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/** Un componente del score: qué señal aportó cuántos puntos. */
export interface ScoreComponent {
  signal: RankingSignal;
  points: number;
}

/** Un término de la consulta y dónde coincidió. */
export interface MatchedTerm {
  term: string;
  inName: boolean;
  inIndex: boolean;
}

/**
 * Explicación completa de un resultado. INVARIANTE:
 *   sum(scoreBreakdown.points) === ScoredPlace.score
 *
 * ALCANCE: explica ÚNICAMENTE el ranking de búsqueda. NO debe evolucionar a un
 * objeto genérico de explicación de recomendación (calidad, popularidad,
 * personalización, etc.): esas capas, si llegan, tendrán su propio contrato.
 */
export interface SearchExplanation {
  /** Componentes que suman EXACTAMENTE el score del resultado. */
  scoreBreakdown: ScoreComponent[];
  /** Señales que coincidieron (por qué apareció). */
  matchedSignals: RankingSignal[];
  /** Términos de la consulta y dónde coincidieron. */
  matchedTerms: MatchedTerm[];
  /** Solidez de la coincidencia de búsqueda (HIGH/MEDIUM/LOW). */
  matchConfidence: MatchConfidence;
}
