import { Linking } from 'react-native';

import { isValidCoordinates } from '../domain/distance';
import type { Coordinates } from '../domain/place';

/**
 * Navegación externa.
 *
 * Fase 1 usa exclusivamente Google Maps mediante su enlace universal, que
 * funciona aunque la app de Google Maps no esté instalada (abre el
 * navegador). No se usan esquemas privados como `comgooglemaps://`.
 *
 * La interfaz permite agregar en el futuro `WazeNavigationProvider` o
 * `AppleMapsNavigationProvider` sin tocar a los consumidores
 * (no implementados en esta fase).
 */

export type NavigationProviderId = 'google_maps';

export class InvalidCoordinatesError extends Error {
  constructor() {
    super('Coordenadas de destino inválidas');
    this.name = 'InvalidCoordinatesError';
  }
}

export interface NavigationProvider {
  readonly id: NavigationProviderId;
  /** Construye la URL de direcciones. Lanza `InvalidCoordinatesError` si el destino es inválido. */
  buildDirectionsUrl(destination: Coordinates): string;
  /** Abre la URL universal. Devuelve `false` si el sistema no pudo abrirla. */
  openDirections(destination: Coordinates): Promise<boolean>;
}

export class GoogleMapsNavigationProvider implements NavigationProvider {
  readonly id = 'google_maps' as const;

  buildDirectionsUrl(destination: Coordinates): string {
    if (!isValidCoordinates(destination)) {
      throw new InvalidCoordinatesError();
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude}%2C${destination.longitude}`;
  }

  async openDirections(destination: Coordinates): Promise<boolean> {
    const url = this.buildDirectionsUrl(destination);
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  }
}

export const googleMapsProvider = new GoogleMapsNavigationProvider();
