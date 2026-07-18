import type { Coordinates } from './place';

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function isValidCoordinates(coords: Coordinates): boolean {
  return (
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude) &&
    Math.abs(coords.latitude) <= 90 &&
    Math.abs(coords.longitude) <= 180
  );
}

/** Distancia Haversine en kilómetros entre dos coordenadas. */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  if (!isValidCoordinates(a) || !isValidCoordinates(b)) {
    throw new Error('Coordenadas inválidas para el cálculo de distancia');
  }
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Estimación determinista y aproximada de traslado urbano.
 *
 * NO usa tráfico en tiempo real: asume una velocidad urbana promedio de
 * 22 km/h más un minuto de arranque. Es solo una referencia para decidir.
 */
export function estimateTravelMinutes(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error('Distancia inválida para estimar tiempo');
  }
  return Math.max(1, Math.round(1 + (distanceKm / 22) * 60));
}

/** 'A 350 m' para menos de 1 km, 'A 1.4 km' en adelante. */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `A ${Math.max(10, Math.round(distanceKm * 100) * 10)} m`;
  }
  return `A ${distanceKm.toFixed(1)} km`;
}

export function formatTravelTime(minutes: number): string {
  return `Aprox. ${minutes} min`;
}
