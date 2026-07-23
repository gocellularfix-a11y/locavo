/**
 * Snapshot de comparación (V5.6) — puro y determinista.
 *
 * Normaliza cada modelo YA rankeado (V5.5) a una estructura comparable. No
 * recalcula ninguna fórmula previa: distancia, confianza, estado de apertura y
 * categoría vienen del modelo; la fuerza de intención/preferencia se deriva
 * SOLO de las señales ya presentes (insignias y claves de razón ya fusionadas
 * por V5.4/V5.5). La evidencia estructurada (accesible/familiar) se lee del
 * registro canónico del lugar, preservando el estado desconocido.
 */
import type { CategoryId } from '../domain/place';
import type { LocavoPlace } from '../domain/places/LocavoPlace';
import type { EvidenceConfidence } from '../intelligence';
import type { DecisionCandidateSnapshot, DecisionOpenState } from './decisionModel';

/**
 * Supertipo estructural del modelo rankeado de entrada. `IntentTodayCardModel`
 * (V5.5) lo satisface sin que la capa de dominio dependa de `features/` ni de
 * React. Solo se leen los campos ya evaluados.
 */
export interface RankedDecisionModel {
  readonly finalScore: number;
  readonly rank: number;
  readonly intentBadgeKey?: string;
  readonly preferenceBadgeKey?: string;
  readonly today: {
    readonly model: {
      readonly placeId: string;
      readonly category: CategoryId;
      readonly distanceKm: number | null;
      readonly openState: DecisionOpenState;
      readonly confidence: EvidenceConfidence;
      readonly reasonKeys: readonly string[];
    };
  };
}

const INTENT_REASON_PREFIX = 'intent.reason.';
const PREF_REASON_PREFIX = 'pref.reason.';
const PREF_BADGE_FAVORITE = 'pref.badge.favorite';
const PREF_BADGE_MATCH = 'pref.badge.match';

/** Cuenta claves DISTINTAS con un prefijo (evita inflar por claves repetidas). */
function distinctWithPrefix(keys: readonly string[], prefix: string): number {
  const seen = new Set<string>();
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      seen.add(key);
    }
  }
  return seen.size;
}

/**
 * Fuerza de intención: número de razones de intención distintas ya aplicadas
 * (0 cuando la intención no coincidió). Ordinal determinista, no recalculado.
 */
export function intentStrengthOf(model: RankedDecisionModel): number {
  return distinctWithPrefix(model.today.model.reasonKeys, INTENT_REASON_PREFIX);
}

/**
 * Fuerza de preferencia: la insignia primaria domina (favorito ≫ coincidencia)
 * y las razones de preferencia distintas rompen empates. Derivada de señales ya
 * presentes; jamás recalcula la fórmula V5.4.
 */
export function preferenceStrengthOf(model: RankedDecisionModel): number {
  const badgeWeight =
    model.preferenceBadgeKey === PREF_BADGE_FAVORITE
      ? 200
      : model.preferenceBadgeKey === PREF_BADGE_MATCH
        ? 100
        : 0;
  return badgeWeight + distinctWithPrefix(model.today.model.reasonKeys, PREF_REASON_PREFIX);
}

/**
 * Construye un snapshot inmutable por candidato, en el MISMO orden rankeado de
 * entrada. No muta los modelos ni los lugares. La evidencia faltante queda como
 * desconocida (nunca `false`).
 */
export function buildDecisionSnapshots(
  models: readonly RankedDecisionModel[],
  placesById: ReadonlyMap<string, LocavoPlace>,
): DecisionCandidateSnapshot[] {
  return models.map((model) => {
    const m = model.today.model;
    const place = placesById.get(m.placeId);
    const confidence: EvidenceConfidence = m.confidence;
    const snapshot: DecisionCandidateSnapshot = {
      placeId: m.placeId,
      sourceRank: model.rank,
      finalScore: model.finalScore,
      distanceKm: m.distanceKm,
      recommendationConfidence: confidence,
      intentStrength: intentStrengthOf(model),
      preferenceStrength: preferenceStrengthOf(model),
      openState: m.openState,
      category: m.category,
      accessible: place?.features?.wheelchairAccessible,
      familyFriendly: place?.features?.familyFriendly,
    };
    return snapshot;
  });
}
