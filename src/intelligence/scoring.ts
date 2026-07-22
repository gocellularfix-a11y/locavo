/**
 * SCORING determinista (V5.0).
 *
 * Reglas explícitas y auditables; sin ML, sin aleatoriedad. Cada aporte es
 * explicable. Los pesos (config) suman 1 → `total ∈ [0, 1]`. El score es
 * INDEPENDIENTE de la confianza: la confianza puede entrar como UN insumo
 * pequeño (`confidenceAdjustment`) pero el resumen de confianza del resultado
 * es un canal aparte. Lo desconocido puntúa neutro; lo negativo, bajo.
 */
import { DEFAULT_INTELLIGENCE_CONFIG, type IntelligenceConfig } from './config';
import { confidenceRank } from './confidence';
import type { NormalizedContext } from './context';
import type { CandidateEvidence } from './evidence';

export type ScoreDimension =
  | 'intentMatch'
  | 'distance'
  | 'openStatus'
  | 'preferences'
  | 'evidenceCompleteness'
  | 'confidenceAdjustment';

export interface ScoreComponent {
  dimension: ScoreDimension;
  /** Valor normalizado [0, 1] de la dimensión. */
  value: number;
  weight: number;
  /** value * weight (aporte al total). */
  weighted: number;
}

export interface ScoreResult {
  total: number;
  components: readonly ScoreComponent[];
}

function tristate(value: boolean | 'unknown', neutral: number): number {
  if (value === 'unknown') {
    return neutral;
  }
  return value ? 1 : 0;
}

function openValue(state: CandidateEvidence['openState'], neutral: number): number {
  if (state === 'open') {
    return 1;
  }
  if (state === 'closed') {
    return 0;
  }
  return neutral;
}

function preferencesValue(
  evidence: CandidateEvidence,
  context: NormalizedContext,
  neutral: number,
): number {
  const parts: number[] = [];
  const prefs = context.preferences;
  if (prefs.openNow) {
    parts.push(openValue(evidence.openState, neutral));
  }
  if (prefs.accessible) {
    parts.push(tristate(evidence.accessible, neutral));
  }
  if (prefs.parking) {
    parts.push(tristate(evidence.parking, neutral));
  }
  if (prefs.family) {
    parts.push(tristate(evidence.family, neutral));
  }
  if (parts.length === 0) {
    return neutral;
  }
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function scoreCandidate(
  evidence: CandidateEvidence,
  context: NormalizedContext,
  config: IntelligenceConfig = DEFAULT_INTELLIGENCE_CONFIG,
): ScoreResult {
  const w = config.weights;
  const neutral = config.neutralUnknown;

  const intentValue = evidence.intentMatch ? 1 : 0;

  const distanceValue =
    evidence.distanceMeters === null
      ? neutral
      : 1 / (1 + evidence.distanceMeters / 1000 / config.distanceScaleKm);

  const openStatusValue = openValue(evidence.openState, neutral);
  const preferencesVal = preferencesValue(evidence, context, neutral);

  const rankingItems = evidence.items.filter((i) => i.affectsRanking);
  const completeness =
    rankingItems.length === 0
      ? neutral
      : rankingItems.filter((i) => i.status === 'known').length / rankingItems.length;

  const confidenceValue = confidenceRank(evidence.overallConfidence) / 3;

  const raw: readonly [ScoreDimension, number, number][] = [
    ['intentMatch', intentValue, w.intentMatch],
    ['distance', distanceValue, w.distance],
    ['openStatus', openStatusValue, w.openStatus],
    ['preferences', preferencesVal, w.preferences],
    ['evidenceCompleteness', completeness, w.evidenceCompleteness],
    ['confidenceAdjustment', confidenceValue, w.confidenceAdjustment],
  ];

  const components: ScoreComponent[] = raw.map(([dimension, value, weight]) => ({
    dimension,
    value,
    weight,
    weighted: value * weight,
  }));
  const total = components.reduce((sum, c) => sum + c.weighted, 0);

  return { total, components };
}
