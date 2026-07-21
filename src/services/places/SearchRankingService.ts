import { buildPlaceSearchIndex } from '../../domain/search';
import { estimateTravelMinutes, haversineKm } from '../../domain/distance';
import { evaluateOpenStatus } from '../../domain/openingHours';
import type { Coordinates } from '../../domain/place';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import type { SearchIntent } from '../../domain/searchIntent';
import { completenessOf, type RecommendationReason, type ScoredPlace } from './PlaceRankingService';
import { SEARCH_RANKING_CONFIG } from './SearchRankingConfig';
import type {
  MatchConfidence,
  MatchedTerm,
  RankingSignal,
  ScoreComponent,
} from './searchExplanation';

/**
 * Ranking de BÚSQUEDA (V4D): determinista, explicable y sin datos inventados.
 *
 * A diferencia del ranking de conveniencia (apertura/distancia/confianza), la
 * relevancia del NOMBRE del negocio manda: una coincidencia exacta de nombre
 * siempre supera a una coincidencia solo de categoría, y la distancia jamás
 * hace que un resultado irrelevante quede primero (su peso es pequeño frente a
 * los niveles de nombre). Mismas entradas → mismo orden.
 *
 * Prioridad (pesos decrecientes):
 *  1. nombre normalizado == consulta (exacto)
 *  2. el nombre EMPIEZA con la consulta
 *  3. término fuerte del nombre (palabra completa del nombre)
 *  4. categoría inferida coincide
 *  5. término / actividad oficial coincide (índice del lugar)
 *  6. bono por múltiples términos coincidentes
 *  7. distancia (solo con origen válido; peso pequeño)
 *  8. completitud (desempate menor)
 *  9. desempate final estable: nombre y luego id
 */

// Pesos y umbrales extraídos a la configuración canónica (V4E.1). Se
// destructuran a los MISMOS nombres de const para que el cuerpo del ranking
// quede byte-idéntico: mismos valores → mismo score → mismo orden.
const {
  exactName: W_EXACT_NAME,
  namePrefix: W_NAME_PREFIX,
  nameToken: W_NAME_TOKEN,
  category: W_CATEGORY,
  term: W_TERM,
  multiTerm: W_MULTI_TERM,
  completeness: W_COMPLETENESS,
  distanceBase: W_DISTANCE_BASE,
  distanceNearby: W_DISTANCE_NEARBY,
} = SEARCH_RANKING_CONFIG.weights;
const { distanceHorizonKm: DISTANCE_HORIZON_KM, nearbyKm: NEARBY_KM } = SEARCH_RANKING_CONFIG;

function wordSet(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter((w) => w.length > 0));
}

interface Relevance {
  score: number;
  reasons: RecommendationReason[];
  /** Componentes de relevancia (sin distancia); suman EXACTAMENTE `score`. */
  breakdown: ScoreComponent[];
  matchedTerms: MatchedTerm[];
  matchConfidence: MatchConfidence;
}

/**
 * Confianza de COINCIDENCIA (no calidad/veracidad del negocio). Derivada solo
 * de hechos de matching: nombre, categoría y cobertura de términos. Nunca usa
 * `verification.confidence`, distancia ni completitud.
 */
function searchMatchConfidenceOf(facts: {
  exactName: boolean;
  namePrefix: boolean;
  nameTokenHits: number;
  categoryHit: boolean;
  termCount: number;
  matchedTermCount: number;
}): MatchConfidence {
  const termCoverage =
    facts.termCount > 0 ? facts.matchedTermCount / facts.termCount : facts.categoryHit ? 1 : 0;
  if (facts.exactName || facts.namePrefix) {
    return 'HIGH';
  }
  if (facts.nameTokenHits > 0 && (facts.categoryHit || termCoverage === 1)) {
    return 'HIGH';
  }
  if (facts.nameTokenHits > 0) {
    return 'MEDIUM';
  }
  if (facts.categoryHit && termCoverage >= 0.5) {
    return 'MEDIUM';
  }
  if (termCoverage === 1) {
    return 'MEDIUM';
  }
  return 'LOW';
}

/**
 * Matching + Scoring + Explanation desde LOS MISMOS hechos (una sola pasada).
 * El score se define como la suma de sus componentes, garantizando el
 * invariante `sum(breakdown.points) === score` sin lógica paralela divergente.
 */
function relevanceOf(place: LocavoPlace, intent: SearchIntent): Relevance {
  const name = place.normalizedName;
  const nameWords = wordSet(name);
  const index = buildPlaceSearchIndex(place);

  const exactName = intent.searchText.length > 0 && name === intent.searchText;
  const namePrefix = intent.searchText.length > 0 && name.startsWith(intent.searchText);

  // Términos que aparecen como palabra completa del nombre / en el índice.
  const nameTokenHits = intent.terms.filter((term) => nameWords.has(term));
  const indexHits = intent.terms.filter((term) => index.includes(term));
  const categoryHit = intent.categories.includes(place.category);

  const breakdown: ScoreComponent[] = [];
  const reasons: RecommendationReason[] = [];

  // Tier base (exactamente uno) — mismo if/else que antes.
  if (exactName) {
    breakdown.push({ signal: 'NAME_EXACT', points: W_EXACT_NAME });
    reasons.push('EXACT_NAME_MATCH');
  } else if (namePrefix) {
    breakdown.push({ signal: 'NAME_PREFIX', points: W_NAME_PREFIX });
    reasons.push('NAME_MATCH');
  } else if (nameTokenHits.length > 0) {
    breakdown.push({ signal: 'NAME_TOKEN', points: W_NAME_TOKEN });
    reasons.push(
      categoryHit || indexHits.length > nameTokenHits.length ? 'NAME_AND_ACTIVITY' : 'NAME_MATCH',
    );
  } else if (categoryHit) {
    breakdown.push({ signal: 'CATEGORY', points: W_CATEGORY });
    reasons.push('CATEGORY_MATCH');
  } else if (indexHits.length > 0) {
    breakdown.push({ signal: 'TERM', points: W_TERM });
    reasons.push('TERM_MATCH');
  }

  if (categoryHit && !exactName) {
    breakdown.push({ signal: 'CATEGORY_BONUS', points: W_CATEGORY / 2 });
  }
  if (indexHits.length > 0) {
    breakdown.push({ signal: 'TERM_COVERAGE', points: indexHits.length * W_TERM });
  }
  if (indexHits.length > 1) {
    breakdown.push({ signal: 'MULTI_TERM', points: (indexHits.length - 1) * W_MULTI_TERM });
  }
  const completenessPoints = completenessOf(place) * W_COMPLETENESS;
  if (completenessPoints > 0) {
    breakdown.push({ signal: 'COMPLETENESS', points: completenessPoints });
  }

  const score = breakdown.reduce((sum, component) => sum + component.points, 0);

  const matchedTerms: MatchedTerm[] = intent.terms
    .map((term) => ({ term, inName: nameWords.has(term), inIndex: index.includes(term) }))
    .filter((match) => match.inName || match.inIndex);

  const matchConfidence = searchMatchConfidenceOf({
    exactName,
    namePrefix,
    nameTokenHits: nameTokenHits.length,
    categoryHit,
    termCount: intent.terms.length,
    matchedTermCount: matchedTerms.length,
  });

  return { score, reasons, breakdown, matchedTerms, matchConfidence };
}

/**
 * Ordena resultados YA filtrados por relevancia de búsqueda. `origin` es el
 * ancla de distancia (ubicación real o zona seleccionada). La distancia solo
 * suma peso; nunca supera la relevancia del nombre.
 */
export function rankSearchResults(
  places: readonly LocavoPlace[],
  intent: SearchIntent,
  origin: Coordinates,
  now: Date,
): ScoredPlace[] {
  const scored = places.map((place) => {
    const distanceKm = haversineKm(origin, place.coordinates);
    const status = evaluateOpenStatus(place.hours ?? null, now);
    const { score: relScore, reasons, breakdown, matchedTerms, matchConfidence } = relevanceOf(
      place,
      intent,
    );

    const distanceWeight = intent.nearby ? W_DISTANCE_NEARBY : W_DISTANCE_BASE;
    const distanceScore = Math.max(0, 1 - distanceKm / DISTANCE_HORIZON_KM) * distanceWeight;

    const finalReasons = [...reasons];
    const nearbyTrue = intent.nearby && distanceKm <= NEARBY_KM;
    // Cercanía: solo verdad — está cerca del ancla (ubicación o zona).
    if (nearbyTrue) {
      finalReasons.push('NEARBY');
    }
    // "Abierto ahora" SOLO con horario real confirmado (nunca inventado).
    if (status.state === 'open') {
      finalReasons.unshift('OPEN_NOW');
    }

    // Explicación (V4E.1): mismos hechos que el scoring; la distancia se añade
    // como componente para que sum(scoreBreakdown.points) === score.
    const scoreBreakdown: ScoreComponent[] =
      distanceScore > 0 ? [...breakdown, { signal: 'DISTANCE', points: distanceScore }] : breakdown;
    const matchedSignals: RankingSignal[] = [...new Set(scoreBreakdown.map((c) => c.signal))];
    if (nearbyTrue) {
      matchedSignals.push('NEARBY');
    }
    if (status.state === 'open') {
      matchedSignals.push('OPEN_NOW');
    }

    return {
      place,
      distanceKm,
      travelMinutes: estimateTravelMinutes(distanceKm),
      status,
      score: relScore + distanceScore,
      reasons: finalReasons,
      explanation: { scoreBreakdown, matchedSignals, matchedTerms, matchConfidence },
    } satisfies ScoredPlace;
  });

  return scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Con intención de cercanía la distancia desempata; si no, orden estable.
    if (intent.nearby && a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    if (a.place.normalizedName !== b.place.normalizedName) {
      return a.place.normalizedName < b.place.normalizedName ? -1 : 1;
    }
    return a.place.id < b.place.id ? -1 : 1;
  });
}
