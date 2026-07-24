import * as Location from 'expo-location';

import { isValidCoordinates } from '../domain/distance';
import type { Coordinates } from '../domain/place';

/**
 * Lectura puntual de ubicación (E/S del dispositivo).
 *
 * Este módulo SOLO habla con el GPS: la resolución de la ubicación efectiva
 * (GPS → manual → centro de ciudad) vive en `effectiveLocation.ts`, fuente
 * canónica única.
 *
 * No hay rastreo continuo, ubicación en segundo plano ni almacenamiento
 * remoto. Toda falla se clasifica y degrada por la cadena canónica, sin
 * bloquear la app y sin fingir jamás que se usó el GPS.
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
