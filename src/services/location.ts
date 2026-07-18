import * as Location from 'expo-location';

import { isValidCoordinates } from '../domain/distance';
import type { Coordinates } from '../domain/place';
import { CULIACAN_CENTER } from '../data/places.mock';

/**
 * Lectura puntual de ubicación.
 *
 * Solo se lee la posición cuando el usuario lo pide; no hay rastreo
 * continuo, ubicación en segundo plano ni almacenamiento remoto.
 * Toda falla degrada a la ubicación manual (Culiacán) sin bloquear la app.
 */

export type LocationFailureReason =
  | 'denied'
  | 'services-off'
  | 'timeout'
  | 'invalid'
  | 'error';

export interface CurrentLocationResult {
  status: 'granted' | 'failed';
  reason?: LocationFailureReason;
  coords: Coordinates | null;
}

export interface ManualLocation {
  id: string;
  label: string;
  coords: Coordinates;
}

/** Zonas de demostración para ubicación manual dentro de Culiacán. */
export const MANUAL_LOCATIONS: ManualLocation[] = [
  { id: 'centro', label: 'Centro de Culiacán', coords: CULIACAN_CENTER },
  { id: 'tres-rios', label: 'Tres Ríos', coords: { latitude: 24.8215, longitude: -107.3861 } },
  { id: 'universitaria', label: 'Zona Universitaria', coords: { latitude: 24.8259, longitude: -107.3979 } },
  { id: 'las-vegas', label: 'Las Vegas / Sur', coords: { latitude: 24.7895, longitude: -107.3958 } },
];

export const DEFAULT_MANUAL_LOCATION = MANUAL_LOCATIONS[0];

/**
 * Devuelve la zona manual correspondiente a un id persistido; ante un valor
 * desconocido, corrupto u obsoleto regresa el default seguro (Centro).
 */
export function resolveManualLocation(storedId: unknown): ManualLocation {
  if (typeof storedId !== 'string') {
    return DEFAULT_MANUAL_LOCATION;
  }
  return MANUAL_LOCATIONS.find((l) => l.id === storedId) ?? DEFAULT_MANUAL_LOCATION;
}

export const LOCATION_TIMEOUT_MS = 10_000;

/** Subconjunto de expo-location usado, inyectable para pruebas. */
export interface LocationApi {
  requestForegroundPermissionsAsync(): Promise<{ status: string }>;
  hasServicesEnabledAsync(): Promise<boolean>;
  getCurrentPositionAsync(options: {
    accuracy: Location.Accuracy;
  }): Promise<{ coords: { latitude: number; longitude: number } }>;
}

const TIMEOUT = Symbol('location-timeout');

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMEOUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<typeof TIMEOUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMEOUT), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pide permiso (si hace falta) y lee la posición UNA sola vez.
 * Nunca lanza: siempre devuelve un resultado clasificado.
 */
export async function readCurrentLocation(
  api: LocationApi = Location,
  timeoutMs: number = LOCATION_TIMEOUT_MS,
): Promise<CurrentLocationResult> {
  try {
    const { status } = await api.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { status: 'failed', reason: 'denied', coords: null };
    }

    const servicesEnabled = await api.hasServicesEnabledAsync().catch(() => true);
    if (!servicesEnabled) {
      return { status: 'failed', reason: 'services-off', coords: null };
    }

    const position = await withTimeout(
      api.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeoutMs,
    );
    if (position === TIMEOUT) {
      return { status: 'failed', reason: 'timeout', coords: null };
    }

    const coords = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    if (!isValidCoordinates(coords)) {
      return { status: 'failed', reason: 'invalid', coords: null };
    }

    return { status: 'granted', coords };
  } catch {
    return { status: 'failed', reason: 'error', coords: null };
  }
}

// Nota V3: el mensaje humano de cada falla vive en i18n/format.ts
// (locationFailureText) según el locale.
