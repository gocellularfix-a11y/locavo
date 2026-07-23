/**
 * Ajuste de preferencias determinista (V5.4) — puro y ACOTADO.
 *
 * Modelo MULTIPLICATIVO (coherente con el multiplicador de contexto de V5.2):
 * se combina un factor por señal y se acota el resultado a [MIN_MULT, MAX_MULT].
 * `additiveBoost` es siempre 0 (no se mezclan modelos). NO modifica el score
 * base ni la confianza de V5.0: es un factor separado que aplica la capa Today.
 * Los lugares ocultos se EXCLUYEN. Las señales de interacción son más débiles
 * que las explícitas y están acotadas (nunca crecimiento ilimitado).
 */
import type { CategoryId } from '../domain/place';
import type { PreferenceSnapshot } from './preferenceSnapshot';

export type PreferenceReasonCode =
  | 'PREF_FAVORITE_PLACE'
  | 'PREF_FAVORITE_CATEGORY'
  | 'PREF_DISTANCE_MATCH'
  | 'PREF_ACCESSIBILITY_MATCH'
  | 'PREF_FAMILY_MATCH'
  | 'PREF_PARKING_MATCH'
  | 'PREF_OPEN_NOW_MATCH'
  | 'PREF_PREVIOUS_DIRECTIONS';

export type PreferenceExclusionCode = 'PREF_PLACE_HIDDEN';

// Factores explícitos (fuertes) y de soporte / interacción (débiles).
export const FAVORITE_PLACE_MULT = 1.5;
export const FAVORITE_CATEGORY_MULT = 1.2;
export const REDUCED_CATEGORY_MULT = 0.7;
export const SUPPORTING_MULT = 1.05;
export const DIRECTIONS_MULT = 1.05;
export const DETAIL_OPEN_MULT = 1.03;
export const MIN_MULT = 0.5;
export const MAX_MULT = 1.6;

export interface PreferenceCandidateEvidence {
  placeId: string;
  category: CategoryId;
  openState: 'open' | 'closed' | 'unknown';
  distanceKm: number | null;
  accessible?: boolean;
  family?: boolean;
  parking?: boolean;
}

export interface PreferenceAdjustment {
  multiplier: number;
  /** Siempre 0 en V5.4 (modelo multiplicativo puro). */
  additiveBoost: number;
  reasonCodes: PreferenceReasonCode[];
  exclusion?: PreferenceExclusionCode;
  explicitSignals: number;
  interactionSignals: number;
  capped: boolean;
}

export function evaluatePreferenceAdjustment(
  evidence: PreferenceCandidateEvidence,
  snapshot: PreferenceSnapshot,
): PreferenceAdjustment {
  if (snapshot.hiddenPlaceIds.has(evidence.placeId)) {
    return {
      multiplier: 1,
      additiveBoost: 0,
      reasonCodes: [],
      exclusion: 'PREF_PLACE_HIDDEN',
      explicitSignals: 1,
      interactionSignals: 0,
      capped: false,
    };
  }

  let m = 1;
  const reasonCodes: PreferenceReasonCode[] = [];
  let explicitSignals = 0;
  let interactionSignals = 0;

  // Explícitas (fuertes).
  if (snapshot.favoritePlaceIds.has(evidence.placeId)) {
    m *= FAVORITE_PLACE_MULT;
    reasonCodes.push('PREF_FAVORITE_PLACE');
    explicitSignals += 1;
  }
  if (snapshot.favoriteCategories.has(evidence.category)) {
    m *= FAVORITE_CATEGORY_MULT;
    reasonCodes.push('PREF_FAVORITE_CATEGORY');
    explicitSignals += 1;
  }
  if (snapshot.reducedCategories.has(evidence.category)) {
    m *= REDUCED_CATEGORY_MULT; // negativa: sin código de razón positivo
    explicitSignals += 1;
  }

  // Preferencias de soporte (evidencia confirmada que coincide con la preferencia).
  if (snapshot.prefersAccessible && evidence.accessible === true) {
    m *= SUPPORTING_MULT;
    reasonCodes.push('PREF_ACCESSIBILITY_MATCH');
    explicitSignals += 1;
  }
  if (snapshot.prefersFamilyFriendly && evidence.family === true) {
    m *= SUPPORTING_MULT;
    reasonCodes.push('PREF_FAMILY_MATCH');
    explicitSignals += 1;
  }
  if (snapshot.prefersParking && evidence.parking === true) {
    m *= SUPPORTING_MULT;
    reasonCodes.push('PREF_PARKING_MATCH');
    explicitSignals += 1;
  }
  if (snapshot.prefersOpenNow && evidence.openState === 'open') {
    m *= SUPPORTING_MULT;
    reasonCodes.push('PREF_OPEN_NOW_MATCH');
    explicitSignals += 1;
  }
  if (
    snapshot.preferredMaxDistanceKm !== null &&
    evidence.distanceKm !== null &&
    evidence.distanceKm <= snapshot.preferredMaxDistanceKm
  ) {
    m *= SUPPORTING_MULT;
    reasonCodes.push('PREF_DISTANCE_MATCH');
    explicitSignals += 1;
  }

  // Interacción (débil, acotada: la presencia cuenta una vez, no el contador).
  if (snapshot.directionsPlaceIds.has(evidence.placeId)) {
    m *= DIRECTIONS_MULT;
    reasonCodes.push('PREF_PREVIOUS_DIRECTIONS');
    interactionSignals += 1;
  }
  if (snapshot.detailedPlaceIds.has(evidence.placeId)) {
    m *= DETAIL_OPEN_MULT; // sin código de razón (señal muy débil)
    interactionSignals += 1;
  }

  const raw = m;
  const multiplier = Math.min(MAX_MULT, Math.max(MIN_MULT, m));
  return {
    multiplier,
    additiveBoost: 0,
    reasonCodes,
    explicitSignals,
    interactionSignals,
    capped: multiplier !== raw,
  };
}
