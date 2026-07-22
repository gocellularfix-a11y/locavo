/**
 * Clasificación de 3 niveles (AUTO-SAFE / AMBIGUOUS / NO-MATCH) sobre la salida
 * del motor canónico `matchPlaces`. NO reimplementa scoring, similitud ni
 * distancia: solo envuelve el resultado con la regla conservadora aprobada.
 *
 * Regla dura: teléfono + website + categoría (aun combinados) NUNCA bastan para
 * AUTO-SAFE. Se exige corroboración NO-contacto: nombre fuerte (>= umbral
 * canónico) o cercanía fuerte (<= banda fuerte canónica), evaluada sobre los
 * valores canónicos que el motor ya calculó (no por presencia de la etiqueta).
 */
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import { matchPlaces, type PlaceMatchResult } from '../../services/places/PlaceMergeService';
import type { OsmClassification } from './OsmEnrichment';
import type { OsmCandidate } from './osmCandidates';
import { categoryCompatible } from './osmCategoryMap';
import { OSM_MATCH_CONFIG, type OsmMatchConfig } from './osmMatchConfig';

export interface ScoredCandidate {
  osmId: string;
  result: PlaceMatchResult;
  categoryCompatible: boolean;
}

export type AmbiguityReason =
  | 'confidence-floor'
  | 'multiple-competitive'
  | 'contact-only'
  | 'contention';

export interface OsmClassificationResult {
  classification: OsmClassification;
  /** Mejor candidato (por confianza, desempate osmId), o null si no hay ninguno. */
  best: ScoredCandidate | null;
  /** Todos los candidatos evaluados, ordenados de forma determinista. */
  scored: ScoredCandidate[];
  ambiguityReason?: AmbiguityReason;
}

export function hasNonContactCorroboration(
  result: PlaceMatchResult,
  config: OsmMatchConfig = OSM_MATCH_CONFIG,
): boolean {
  return (
    result.nameSimilarity >= config.strongNameSimilarity ||
    result.distanceMeters <= config.strongProximityMeters
  );
}

/** Ordena por confianza descendente, desempate estable por osmId ascendente. */
function sortScored(a: ScoredCandidate, b: ScoredCandidate): number {
  if (b.result.confidence !== a.result.confidence) {
    return b.result.confidence - a.result.confidence;
  }
  return a.osmId < b.osmId ? -1 : a.osmId > b.osmId ? 1 : 0;
}

/**
 * Clasifica un lugar DENUE contra sus candidatos OSM (ya filtrados por radio).
 * `excludeOsmIds` permite reevaluar cuando un osmId fue tomado por otro lugar
 * (resolución de contención 1:1).
 */
export function classifyDenuePlace(
  denue: LocavoPlace,
  candidates: readonly OsmCandidate[],
  config: OsmMatchConfig = OSM_MATCH_CONFIG,
  excludeOsmIds?: ReadonlySet<string>,
): OsmClassificationResult {
  const scored: ScoredCandidate[] = [];
  for (const candidate of candidates) {
    if (excludeOsmIds?.has(candidate.poi.osmId)) {
      continue;
    }
    const compatible = categoryCompatible(denue.category, candidate.osmCategory);
    const result = matchPlaces(denue, candidate.place);
    scored.push({ osmId: candidate.poi.osmId, result, categoryCompatible: compatible });
  }
  scored.sort(sortScored);

  if (scored.length === 0) {
    return { classification: 'no-match', best: null, scored };
  }

  const best = scored[0];
  const competitors = scored.filter(
    (s) => s.osmId !== best.osmId &&
      s.result.confidence >= best.result.confidence - config.competitiveConfidenceDelta,
  );
  const hasCompetitive = competitors.length > 0;

  const corroborated = hasNonContactCorroboration(best.result, config);

  if (best.categoryCompatible && best.result.likelySamePlace && corroborated && !hasCompetitive) {
    return { classification: 'auto-safe', best, scored };
  }

  // AMBIGUOUS si hay señal suficiente pero falta certeza.
  let ambiguityReason: AmbiguityReason | undefined;
  if (best.categoryCompatible && best.result.likelySamePlace && !corroborated) {
    ambiguityReason = 'contact-only';
  } else if (hasCompetitive) {
    ambiguityReason = 'multiple-competitive';
  } else if (best.categoryCompatible && best.result.confidence >= config.ambiguousConfidenceFloor) {
    ambiguityReason = 'confidence-floor';
  }

  if (ambiguityReason) {
    return { classification: 'ambiguous', best, scored, ambiguityReason };
  }
  return { classification: 'no-match', best, scored };
}
