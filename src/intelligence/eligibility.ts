/**
 * ELEGIBILIDAD determinista (V5.0), previa al ranking.
 *
 * Responde: ¿debe este lugar seguir siendo candidato para esta petición?
 * Distingue restricciones DURAS de preferencias blandas. Lo DESCONOCIDO no es
 * `false` salvo que la petición exija evidencia CONFIRMADA. Reutiliza la
 * elegibilidad canónica (`isEligiblePlace`) y no la duplica.
 */
import { isValidCoordinates } from '../domain/distance';
import type { LocavoPlace } from '../domain/places/LocavoPlace';
import { isEligiblePlace } from '../features/home/surprise';
import type { NormalizedContext } from './context';
import type { CandidateEvidence } from './evidence';

export type EligibilityReasonCode =
  | 'MALFORMED_RECORD'
  | 'INACTIVE_OR_CLOSED'
  | 'CATEGORY_MISMATCH'
  | 'OUTSIDE_RADIUS'
  | 'CLOSED_NOW_REQUIRED'
  | 'ACCESSIBILITY_REQUIRED_UNCONFIRMED';

export interface EligibilityResult {
  eligible: boolean;
  reasons: readonly EligibilityReasonCode[];
}

export function evaluateEligibility(
  place: LocavoPlace,
  context: NormalizedContext,
  evidence: CandidateEvidence,
): EligibilityResult {
  const reasons: EligibilityReasonCode[] = [];

  if (!place.id || !place.category || !isValidCoordinates(place.coordinates)) {
    reasons.push('MALFORMED_RECORD');
  }
  if (!isEligiblePlace(place)) {
    reasons.push('INACTIVE_OR_CLOSED');
  }
  if (!evidence.intentMatch) {
    reasons.push('CATEGORY_MISMATCH');
  }

  // Radio duro: solo excluye cuando la distancia es MEDIBLE y excede el radio.
  if (
    context.radiusMeters !== undefined &&
    evidence.distanceMeters !== null &&
    evidence.distanceMeters > context.radiusMeters
  ) {
    reasons.push('OUTSIDE_RADIUS');
  }

  // Abierto exigido: solo excluye si está CERRADO conocido (desconocido no).
  if (context.constraints.openNow && evidence.openState === 'closed') {
    reasons.push('CLOSED_NOW_REQUIRED');
  }

  // Accesibilidad exigida: requiere CONFIRMADA (desconocida o negativa excluye).
  if (context.constraints.accessible && evidence.accessible !== true) {
    reasons.push('ACCESSIBILITY_REQUIRED_UNCONFIRMED');
  }

  return { eligible: reasons.length === 0, reasons };
}
