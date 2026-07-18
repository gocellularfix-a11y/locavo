import { estimateTravelMinutes, haversineKm } from '../../domain/distance';
import { evaluateOpenStatus, type OpenStatus } from '../../domain/openingHours';
import type { Coordinates } from '../../domain/place';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';

/**
 * Ranking local, determinista y explicable sobre el modelo canónico.
 * Sin IA, sin aleatoriedad y sin calificaciones inventadas: mismas
 * entradas → mismo orden. Separado de la UI y de los datos.
 *
 * Preparado para datos reales: los factores (apertura, distancia,
 * confianza de verificación, recencia, completitud) provienen del modelo
 * canónico, no de la semilla. Factores futuros (accesibilidad, precio,
 * familia) podrán sumarse aquí sin tocar pantallas.
 */

export type RecommendationReason =
  | 'OPEN_NOW'
  | 'NEARBY'
  | 'RECENTLY_VERIFIED'
  | 'HIGH_CONFIDENCE'
  | 'COMPLETE_INFORMATION';

export interface ScoredPlace {
  place: LocavoPlace;
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

/** Fracción 0–1 de campos informados (horario, teléfono, sitio, precio). */
export function completenessOf(place: LocavoPlace): number {
  const fields = [place.hours, place.contact?.phone, place.contact?.website, place.price?.level];
  const present = fields.filter((f) => f !== null && f !== undefined).length;
  return present / fields.length;
}

function daysSinceVerified(place: LocavoPlace, now: Date): number {
  const iso = place.verification.lastVerifiedAt;
  const verified = iso ? Date.parse(iso) : Number.NaN;
  if (Number.isNaN(verified)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, (now.getTime() - verified) / MS_PER_DAY);
}

export function scorePlace(place: LocavoPlace, origin: Coordinates, now: Date): ScoredPlace {
  const distanceKm = haversineKm(origin, place.coordinates);
  const status = evaluateOpenStatus(place.hours ?? null, now);
  const completeness = completenessOf(place);
  const recencyDays = daysSinceVerified(place, now);
  const confidence = place.verification.confidence;

  const openScore = status.state === 'open' ? 0.4 : status.state === 'unknown' ? 0.12 : 0;
  const distanceScore = Math.max(0, 1 - distanceKm / DISTANCE_HORIZON_KM) * 0.25;
  const confidenceScore = confidence >= 0.75 ? 0.15 : confidence >= 0.45 ? 0.08 : 0;
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
  if (confidence >= 0.75) {
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
 * puntuación desc → distancia asc → nombre normalizado asc → id asc.
 */
export function rankPlaces(
  places: LocavoPlace[],
  origin: Coordinates,
  now: Date,
): ScoredPlace[] {
  return places
    .map((place) => scorePlace(place, origin, now))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      if (a.place.normalizedName !== b.place.normalizedName) {
        return a.place.normalizedName < b.place.normalizedName ? -1 : 1;
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
 * "Recomendado porque está abierto, está cerca y su información fue
 * verificada recientemente."
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
