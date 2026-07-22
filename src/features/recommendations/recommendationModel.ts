/**
 * Capa de PRESENTACIÓN de recomendaciones (V5.1) — pura y determinista.
 *
 * Consume la API pública del motor de inteligencia V5.0 (una sola llamada por
 * petición) y la traduce a modelos de tarjeta listos para la UI. NO reimplementa
 * ranking, score ni confianza: solo mapea la salida estructurada a estrellas,
 * insignias y CLAVES i18n (nunca prosa). El motor V5.0 no se modifica.
 */
import { haversineKm, isValidCoordinates } from '../../domain/distance';
import type { CategoryId } from '../../domain/place';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import type { TranslationKey } from '../../i18n/locales/es';
import {
  evaluateRecommendations,
  type EvidenceConfidence,
  type ExplanationCode,
  type IntelligenceConfig,
  type RecommendationContext,
  type RecommendationDiagnostics,
  type RecommendationResult,
} from '../../intelligence';

export type RecommendationBadge =
  | 'bestMatch'
  | 'openNow'
  | 'nearby'
  | 'family'
  | 'accessible'
  | 'verified'
  | 'enriched';

export type RecommendationOpenState = 'open' | 'closed' | 'unknown';
export type StarRating = 1 | 2 | 3 | 4 | 5;

export interface RecommendationCardModel {
  placeId: string;
  /** Nombre comercial (DATO: nunca se traduce). */
  name: string;
  category: CategoryId;
  rank: number;
  stars: StarRating;
  scoreTotal: number;
  confidence: EvidenceConfidence;
  badges: readonly RecommendationBadge[];
  reasonKeys: readonly TranslationKey[];
  warningKeys: readonly TranslationKey[];
  distanceKm: number | null;
  openState: RecommendationOpenState;
}

export interface RecommendationModelsResult {
  models: readonly RecommendationCardModel[];
  diagnostics: RecommendationDiagnostics;
}

/** Umbrales deterministas de estrellas sobre el score total [0, 1]. */
export function scoreToStars(total: number): StarRating {
  if (!Number.isFinite(total)) {
    return 1;
  }
  if (total >= 0.85) return 5;
  if (total >= 0.7) return 4;
  if (total >= 0.55) return 3;
  if (total >= 0.4) return 2;
  return 1;
}

const CODE_TO_KEY: Readonly<Record<ExplanationCode, TranslationKey>> = {
  INTENT_MATCH: 'rec.reason.intentMatch',
  OPEN_NOW: 'rec.reason.openNow',
  NEARBY: 'rec.reason.nearby',
  PARKING_CONFIRMED: 'rec.reason.parking',
  ACCESSIBILITY_CONFIRMED: 'rec.reason.accessible',
  FAMILY_FRIENDLY: 'rec.reason.family',
  HIGH_EVIDENCE_CONFIDENCE: 'rec.reason.highConfidence',
  OFFICIAL_SOURCE: 'rec.reason.official',
  ENRICHED_SOURCE: 'rec.reason.enriched',
  HOURS_UNKNOWN: 'rec.warn.hoursUnknown',
  CLOSED_NOW: 'rec.warn.closed',
  ACCESSIBILITY_UNKNOWN: 'rec.warn.accessibilityUnknown',
  PARKING_UNKNOWN: 'rec.warn.parkingUnknown',
  FAR: 'rec.warn.far',
  LOW_EVIDENCE_CONFIDENCE: 'rec.warn.lowConfidence',
  SOURCE_CONFLICT: 'rec.warn.conflict',
};

const BADGE_TO_KEY: Readonly<Record<RecommendationBadge, TranslationKey>> = {
  bestMatch: 'rec.badge.bestMatch',
  openNow: 'rec.badge.openNow',
  nearby: 'rec.badge.nearby',
  family: 'rec.badge.family',
  accessible: 'rec.badge.accessible',
  verified: 'rec.badge.verified',
  enriched: 'rec.badge.enriched',
};

const CONFIDENCE_TO_KEY: Readonly<Record<EvidenceConfidence, TranslationKey>> = {
  high: 'rec.confidence.high',
  medium: 'rec.confidence.medium',
  low: 'rec.confidence.low',
  unknown: 'rec.confidence.unknown',
};

export function explanationLabelKey(code: ExplanationCode): TranslationKey {
  return CODE_TO_KEY[code];
}
export function badgeLabelKey(badge: RecommendationBadge): TranslationKey {
  return BADGE_TO_KEY[badge];
}
export function confidenceLabelKey(level: EvidenceConfidence): TranslationKey {
  return CONFIDENCE_TO_KEY[level];
}

/** Insignias deterministas derivadas ÚNICAMENTE de la evidencia del resultado. */
export function badgesForResult(result: RecommendationResult): RecommendationBadge[] {
  const codes = new Set(result.reasons.map((r) => r.code));
  const badges: RecommendationBadge[] = [];
  if (result.rank === 1) badges.push('bestMatch');
  if (codes.has('OPEN_NOW')) badges.push('openNow');
  if (codes.has('NEARBY')) badges.push('nearby');
  if (codes.has('FAMILY_FRIENDLY')) badges.push('family');
  if (codes.has('ACCESSIBILITY_CONFIRMED')) badges.push('accessible');
  if (codes.has('OFFICIAL_SOURCE')) badges.push('verified');
  if (codes.has('ENRICHED_SOURCE')) badges.push('enriched');
  return badges;
}

function openStateOf(result: RecommendationResult): RecommendationOpenState {
  const codes = [...result.reasons, ...result.warnings].map((i) => i.code);
  if (codes.includes('OPEN_NOW')) return 'open';
  if (codes.includes('CLOSED_NOW')) return 'closed';
  return 'unknown';
}

/**
 * Ejecuta el motor UNA sola vez y construye los modelos de tarjeta. Puro:
 * mismas entradas → mismos modelos. No muta `places` ni el contexto.
 */
export function buildRecommendationModels(
  context: RecommendationContext,
  places: readonly LocavoPlace[],
  config?: IntelligenceConfig,
): RecommendationModelsResult {
  const output = config
    ? evaluateRecommendations(context, places, config)
    : evaluateRecommendations(context, places);
  const byId = new Map(places.map((p) => [p.id, p]));
  const origin = context.origin && isValidCoordinates(context.origin) ? context.origin : null;

  const models: RecommendationCardModel[] = [];
  for (const result of output.results) {
    const place = byId.get(result.placeId);
    if (!place) {
      continue;
    }
    const distanceKm =
      origin && isValidCoordinates(place.coordinates)
        ? haversineKm(origin, place.coordinates)
        : null;
    models.push({
      placeId: result.placeId,
      name: place.name,
      category: result.category,
      rank: result.rank,
      stars: scoreToStars(result.score.total),
      scoreTotal: result.score.total,
      confidence: result.confidence.overall,
      badges: badgesForResult(result),
      reasonKeys: result.reasons.map((r) => explanationLabelKey(r.code)),
      warningKeys: result.warnings.map((w) => explanationLabelKey(w.code)),
      distanceKm,
      openState: openStateOf(result),
    });
  }
  return { models, diagnostics: output.diagnostics };
}
