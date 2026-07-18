import { evaluateOpenStatus, type OpenStatus } from './openingHours';
import { estimateTravelMinutes, haversineKm } from './distance';
import type { Coordinates, Place } from './place';

/**
 * Motor de recomendación local, determinista y explicable.
 * No usa IA ni aleatoriedad: mismas entradas → mismo resultado.
 */

export type RecommendationReason =
  | 'OPEN_NOW'
  | 'NEARBY'
  | 'RECENTLY_VERIFIED'
  | 'HIGH_CONFIDENCE'
  | 'COMPLETE_INFORMATION';

export interface ScoredPlace {
  place: Place;
  distanceKm: number;
  travelMinutes: number;
  status: OpenStatus;
  /** Puntuación interna normalizada 0–1. No se muestra al usuario. */
  score: number;
  reasons: RecommendationReason[];
}

const NEARBY_KM = 2;
const RECENT_DAYS = 21;
const DISTANCE_HORIZON_KM = 8;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Fracción 0–1 de campos opcionales informados (horario, teléfono, sitio, precio). */
export function completenessOf(place: Place): number {
  const fields = [place.openingHours, place.phone, place.website, place.priceLevel];
  const present = fields.filter((f) => f !== null && f !== undefined).length;
  return present / fields.length;
}

function daysSinceVerified(place: Place, now: Date): number {
  const verified = Date.parse(place.lastVerifiedAt);
  if (Number.isNaN(verified)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, (now.getTime() - verified) / MS_PER_DAY);
}

export function scorePlace(place: Place, origin: Coordinates, now: Date): ScoredPlace {
  const distanceKm = haversineKm(origin, place);
  const status = evaluateOpenStatus(place.openingHours, now);
  const completeness = completenessOf(place);
  const recencyDays = daysSinceVerified(place, now);

  const openScore = status.state === 'open' ? 0.4 : status.state === 'unknown' ? 0.12 : 0;
  const distanceScore = Math.max(0, 1 - distanceKm / DISTANCE_HORIZON_KM) * 0.25;
  const confidenceScore =
    place.confidence === 'high' ? 0.15 : place.confidence === 'medium' ? 0.08 : 0;
  const recencyScore = recencyDays <= RECENT_DAYS ? 0.1 : recencyDays <= 60 ? 0.05 : 0;
  const completenessScore = completeness * 0.1;

  const reasons: RecommendationReason[] = [];
  if (status.state === 'open') {
    reasons.push('OPEN_NOW');
  }
  if (distanceKm <= NEARBY_KM) {
    reasons.push('NEARBY');
  }
  if (recencyDays <= RECENT_DAYS) {
    reasons.push('RECENTLY_VERIFIED');
  }
  if (place.confidence === 'high') {
    reasons.push('HIGH_CONFIDENCE');
  }
  if (completeness >= 0.75) {
    reasons.push('COMPLETE_INFORMATION');
  }

  return {
    place,
    distanceKm,
    travelMinutes: estimateTravelMinutes(distanceKm),
    status,
    score: openScore + distanceScore + confidenceScore + recencyScore + completenessScore,
    reasons,
  };
}

/**
 * Ordena lugares por conveniencia con desempates deterministas:
 * puntuación desc → distancia asc → nombre asc → id asc.
 */
export function rankPlaces(places: Place[], origin: Coordinates, now: Date): ScoredPlace[] {
  return places
    .map((place) => scorePlace(place, origin, now))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      if (a.place.name !== b.place.name) {
        return a.place.name < b.place.name ? -1 : 1;
      }
      return a.place.id < b.place.id ? -1 : 1;
    });
}

const REASON_PHRASES: Record<RecommendationReason, string> = {
  OPEN_NOW: 'está abierto',
  NEARBY: 'está cerca',
  RECENTLY_VERIFIED: 'su información fue verificada recientemente',
  HIGH_CONFIDENCE: 'su información es de alta confianza',
  COMPLETE_INFORMATION: 'su información está completa',
};

/**
 * Convierte razones estructuradas en una explicación legible:
 * "Recomendado porque está abierto, está cerca y su información fue verificada recientemente."
 */
export function explainReasons(reasons: RecommendationReason[]): string {
  if (reasons.length === 0) {
    return 'Es la opción más conveniente entre los resultados disponibles.';
  }
  const phrases = reasons.slice(0, 3).map((r) => REASON_PHRASES[r]);
  const joined =
    phrases.length === 1
      ? phrases[0]
      : `${phrases.slice(0, -1).join(', ')} y ${phrases[phrases.length - 1]}`;
  return `Recomendado porque ${joined}.`;
}
