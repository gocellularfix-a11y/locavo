import * as Location from 'expo-location';

import type { Coordinates } from '../domain/place';
import { CULIACAN_CENTER } from '../data/places.mock';

/**
 * Lectura puntual de ubicación.
 *
 * Solo se lee la posición cuando el usuario lo pide; no hay rastreo
 * continuo, ubicación en segundo plano ni almacenamiento remoto.
 */

export type LocationPermission = 'granted' | 'denied' | 'unavailable';

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

export interface CurrentLocationResult {
  permission: LocationPermission;
  coords: Coordinates | null;
}

/** Pide permiso (si hace falta) y lee la posición una sola vez. */
export async function readCurrentLocation(): Promise<CurrentLocationResult> {
  try {
    const services = await Location.hasServicesEnabledAsync();
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { permission: 'denied', coords: null };
    }
    if (!services) {
      return { permission: 'unavailable', coords: null };
    }
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      permission: 'granted',
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
    };
  } catch {
    return { permission: 'unavailable', coords: null };
  }
}
