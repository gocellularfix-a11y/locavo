/**
 * EXPLICACIÓN estructurada (V5.0).
 *
 * Datos legibles por máquina; NUNCA prosa de UI (la localización se hace luego
 * con `code` + `value`). Cada ítem refleja evidencia que realmente participó;
 * no se afirma nada sin respaldo. El orden es determinista. Las advertencias de
 * dato DESCONOCIDO no deben sonar como negativas confirmadas.
 */
import type { NormalizedContext } from './context';
import type { CandidateEvidence } from './evidence';

export type ExplanationPolarity = 'positive' | 'warning' | 'neutral';

export type ExplanationCode =
  | 'INTENT_MATCH'
  | 'OPEN_NOW'
  | 'NEARBY'
  | 'PARKING_CONFIRMED'
  | 'ACCESSIBILITY_CONFIRMED'
  | 'FAMILY_FRIENDLY'
  | 'HIGH_EVIDENCE_CONFIDENCE'
  | 'OFFICIAL_SOURCE'
  | 'ENRICHED_SOURCE'
  | 'HOURS_UNKNOWN'
  | 'CLOSED_NOW'
  | 'ACCESSIBILITY_UNKNOWN'
  | 'PARKING_UNKNOWN'
  | 'FAR'
  | 'LOW_EVIDENCE_CONFIDENCE'
  | 'SOURCE_CONFLICT';

export interface ExplanationItem {
  code: ExplanationCode;
  polarity: ExplanationPolarity;
  value?: Readonly<Record<string, number | string | boolean>>;
}

/** Distancias (m) para clasificar cercanía en explicaciones. */
const NEARBY_METERS = 1000;
const FAR_METERS = 5000;

/** Orden determinista canónico de códigos. */
const CODE_ORDER: readonly ExplanationCode[] = [
  'INTENT_MATCH',
  'OPEN_NOW',
  'NEARBY',
  'PARKING_CONFIRMED',
  'ACCESSIBILITY_CONFIRMED',
  'FAMILY_FRIENDLY',
  'HIGH_EVIDENCE_CONFIDENCE',
  'OFFICIAL_SOURCE',
  'ENRICHED_SOURCE',
  'HOURS_UNKNOWN',
  'CLOSED_NOW',
  'ACCESSIBILITY_UNKNOWN',
  'PARKING_UNKNOWN',
  'FAR',
  'LOW_EVIDENCE_CONFIDENCE',
  'SOURCE_CONFLICT',
];
const ORDER_INDEX = new Map(CODE_ORDER.map((code, i) => [code, i]));

export interface Explanation {
  positive: readonly ExplanationItem[];
  warnings: readonly ExplanationItem[];
}

export function buildExplanation(
  evidence: CandidateEvidence,
  context: NormalizedContext,
): Explanation {
  const items: ExplanationItem[] = [];

  if (evidence.intentMatch) {
    items.push({ code: 'INTENT_MATCH', polarity: 'positive', value: { category: evidence.category } });
  }

  if (evidence.openState === 'open') {
    items.push({ code: 'OPEN_NOW', polarity: 'positive' });
  } else if (evidence.openState === 'closed') {
    items.push({ code: 'CLOSED_NOW', polarity: 'warning' });
  } else {
    items.push({ code: 'HOURS_UNKNOWN', polarity: 'warning' });
  }

  if (evidence.distanceMeters !== null) {
    if (evidence.distanceMeters <= NEARBY_METERS) {
      items.push({ code: 'NEARBY', polarity: 'positive', value: { distanceMeters: Math.round(evidence.distanceMeters) } });
    } else if (evidence.distanceMeters > FAR_METERS) {
      items.push({ code: 'FAR', polarity: 'warning', value: { distanceMeters: Math.round(evidence.distanceMeters) } });
    }
  }

  if (evidence.accessible === true) {
    items.push({ code: 'ACCESSIBILITY_CONFIRMED', polarity: 'positive' });
  } else if (evidence.accessible === 'unknown') {
    items.push({ code: 'ACCESSIBILITY_UNKNOWN', polarity: 'warning' });
  }

  if (evidence.parking === true) {
    items.push({ code: 'PARKING_CONFIRMED', polarity: 'positive' });
  } else if (evidence.parking === 'unknown' && context.preferences.parking) {
    items.push({ code: 'PARKING_UNKNOWN', polarity: 'warning' });
  }

  if (evidence.family === true) {
    items.push({ code: 'FAMILY_FRIENDLY', polarity: 'positive' });
  }

  if (evidence.overallConfidence === 'high') {
    items.push({ code: 'HIGH_EVIDENCE_CONFIDENCE', polarity: 'positive' });
  } else if (evidence.overallConfidence === 'low' || evidence.overallConfidence === 'unknown') {
    items.push({ code: 'LOW_EVIDENCE_CONFIDENCE', polarity: 'warning' });
  }

  if (evidence.sources.includes('denue')) {
    items.push({ code: 'OFFICIAL_SOURCE', polarity: 'positive', value: { source: 'denue' } });
  }
  if (evidence.sources.includes('openstreetmap')) {
    items.push({ code: 'ENRICHED_SOURCE', polarity: 'neutral', value: { source: 'openstreetmap' } });
  }

  if (evidence.items.some((i) => i.status === 'conflict')) {
    items.push({ code: 'SOURCE_CONFLICT', polarity: 'warning' });
  }

  items.sort((a, b) => (ORDER_INDEX.get(a.code) ?? 0) - (ORDER_INDEX.get(b.code) ?? 0));

  return {
    positive: items.filter((i) => i.polarity === 'positive' || i.polarity === 'neutral'),
    warnings: items.filter((i) => i.polarity === 'warning'),
  };
}
