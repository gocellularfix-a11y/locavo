/**
 * Ajuste de INTENCIÓN determinista (V5.5) — puro y ACOTADO. Modelo
 * MULTIPLICATIVO coherente con contexto (V5.2) y preferencias (V5.4). Preserva
 * el score base, la confianza, el score contextual y el multiplicador de
 * preferencias: es un factor SEPARADO que aplica la capa Today.
 */
import type { CategoryId } from '../domain/place';
import { intentDefinition } from './intentCatalog';
import type { IntentExclusionCode, IntentReasonCode } from './intentModel';
import type { IntentSnapshot } from './intentSnapshot';

export const CATEGORY_IN_SCOPE_MULT = 1.3;
export const OUT_OF_SCOPE_MULT = 0.7;
export const MODIFIER_MATCH_MULT = 1.1;
export const CLOSED_UNDER_OPEN_INTENT_MULT = 0.6;
export const NEARBY_MAX_KM = 1;
export const MIN_MULT = 0.5;
export const MAX_MULT = 1.6;

export interface IntentCandidateEvidence {
  placeId: string;
  category: CategoryId;
  openState: 'open' | 'closed' | 'unknown';
  distanceKm: number | null;
  accessible?: boolean;
  family?: boolean;
}

export interface IntentAdjustment {
  multiplier: number;
  reasonCodes: IntentReasonCode[];
  exclusion?: IntentExclusionCode;
  adjustments: number;
  capped: boolean;
}

export function evaluateIntentAdjustment(
  evidence: IntentCandidateEvidence,
  snapshot: IntentSnapshot,
): IntentAdjustment {
  let m = 1;
  const reasons: IntentReasonCode[] = [];
  let adjustments = 0;

  if (snapshot.categoryScope.size > 0) {
    if (snapshot.categoryScope.has(evidence.category)) {
      m *= CATEGORY_IN_SCOPE_MULT;
      reasons.push(intentDefinition(snapshot.primaryIntent).reasonCode);
      adjustments += 1;
    } else {
      m *= OUT_OF_SCOPE_MULT; // fuera de alcance: baja, sin excluir (seguro)
      adjustments += 1;
    }
  }

  if (snapshot.wantsOpenNow) {
    if (evidence.openState === 'open') {
      m *= MODIFIER_MATCH_MULT;
      reasons.push('INTENT_OPEN_NOW_MATCH');
      adjustments += 1;
    } else if (evidence.openState === 'closed') {
      m *= CLOSED_UNDER_OPEN_INTENT_MULT;
      adjustments += 1;
    }
  }
  if (snapshot.wantsOpenLate) {
    if (evidence.openState === 'open') {
      m *= MODIFIER_MATCH_MULT;
      reasons.push('INTENT_OPEN_LATE_MATCH');
      adjustments += 1;
    } else if (evidence.openState === 'closed') {
      m *= CLOSED_UNDER_OPEN_INTENT_MULT;
      adjustments += 1;
    }
  }
  if (snapshot.wantsNearby && evidence.distanceKm !== null && evidence.distanceKm <= NEARBY_MAX_KM) {
    m *= MODIFIER_MATCH_MULT;
    reasons.push('INTENT_NEARBY_MATCH');
    adjustments += 1;
  }
  if (snapshot.wantsAccessible && evidence.accessible === true) {
    m *= MODIFIER_MATCH_MULT;
    reasons.push('INTENT_ACCESSIBILITY_MATCH');
    adjustments += 1;
  }
  if (snapshot.wantsFamily && evidence.family === true) {
    m *= MODIFIER_MATCH_MULT;
    reasons.push('INTENT_FAMILY_MATCH');
    adjustments += 1;
  }

  const raw = m;
  const multiplier = Math.min(MAX_MULT, Math.max(MIN_MULT, m));
  return {
    multiplier,
    reasonCodes: [...new Set(reasons)],
    adjustments,
    capped: multiplier !== raw,
  };
}
