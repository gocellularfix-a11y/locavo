/**
 * Política de DIFERENCIACIÓN significativa (V5.6) — pura y determinista.
 *
 * Dos opciones son significativamente distintas cuando difieren lo suficiente
 * en al menos una dimensión aprobada y basada en datos. La diferencia de nombre
 * comercial NUNCA cuenta como diferenciación. Los umbrales son explícitos y
 * están documentados aquí para que la selección y las pruebas los compartan.
 */
import type { EvidenceConfidence } from '../intelligence';
import { confidenceRank } from '../intelligence';
import type { CategoryId } from '../domain/place';
import type { DecisionCandidateSnapshot } from './decisionModel';

/**
 * Distancia mínima (km) para considerar una opción "materialmente más cerca" o
 * "más lejos". Coherente con el redondeo de distancia de la UI (decenas de
 * metros bajo 1 km): 0.5 km es una diferencia percibible, no ruido.
 */
export const DISTANCE_DELTA_KM = 0.5;

/**
 * Proporción mínima de `finalScore` respecto al primario para que una
 * ALTERNATIVE cuente como "fuerte" (evita rellenar con opciones débiles).
 */
export const ALTERNATIVE_MIN_SCORE_RATIO = 0.6;

/** Intención activa mínima consultable por la política (solo alcance de categoría). */
export interface ActiveIntentScope {
  readonly categoryScope: ReadonlySet<CategoryId>;
}

/** El candidato es materialmente más cercano que el primario (ambos con distancia conocida). */
export function isMateriallyCloser(
  candidate: DecisionCandidateSnapshot,
  primary: DecisionCandidateSnapshot,
): boolean {
  if (candidate.distanceKm === null || primary.distanceKm === null) {
    return false;
  }
  return primary.distanceKm - candidate.distanceKm >= DISTANCE_DELTA_KM;
}

/** El candidato es materialmente más lejano que el primario (para compromisos). */
export function isMateriallyFarther(
  candidate: DecisionCandidateSnapshot,
  primary: DecisionCandidateSnapshot,
): boolean {
  if (candidate.distanceKm === null || primary.distanceKm === null) {
    return false;
  }
  return candidate.distanceKm - primary.distanceKm >= DISTANCE_DELTA_KM;
}

/** Confianza estrictamente mayor (al menos un nivel canónico de evidencia). */
export function hasStrongerConfidence(
  candidate: DecisionCandidateSnapshot,
  primary: DecisionCandidateSnapshot,
): boolean {
  return confidenceRank(candidate.recommendationConfidence) > confidenceRank(primary.recommendationConfidence);
}

export function hasWeakerConfidence(
  candidate: DecisionCandidateSnapshot,
  primary: DecisionCandidateSnapshot,
): boolean {
  return confidenceRank(candidate.recommendationConfidence) < confidenceRank(primary.recommendationConfidence);
}

/** Coincidencia de intención estrictamente más fuerte (y no nula). */
export function hasStrongerIntent(
  candidate: DecisionCandidateSnapshot,
  primary: DecisionCandidateSnapshot,
): boolean {
  return candidate.intentStrength > primary.intentStrength && candidate.intentStrength > 0;
}

/** Coincidencia de preferencia estrictamente más fuerte (y no nula). */
export function hasStrongerPreference(
  candidate: DecisionCandidateSnapshot,
  primary: DecisionCandidateSnapshot,
): boolean {
  return candidate.preferenceStrength > primary.preferenceStrength && candidate.preferenceStrength > 0;
}

/** Evidencia limitada absoluta: confianza desconocida (no "baja calidad" inferida). */
export function hasLimitedEvidence(candidate: DecisionCandidateSnapshot): boolean {
  const c: EvidenceConfidence = candidate.recommendationConfidence;
  return c === 'unknown';
}

/**
 * Categoría compatible con la intención activa: si la intención acota
 * categorías, el candidato debe estar dentro; sin intención, toda categoría es
 * compatible. Nunca se muestra una categoría no relacionada solo por variedad.
 */
export function isCategoryCompatible(
  candidate: DecisionCandidateSnapshot,
  activeIntent: ActiveIntentScope | null | undefined,
): boolean {
  if (!activeIntent || activeIntent.categoryScope.size === 0) {
    return true;
  }
  return activeIntent.categoryScope.has(candidate.category);
}
