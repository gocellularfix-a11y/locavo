import { isValidCoordinates } from '../../domain/distance';
import type { Coordinates } from '../../domain/place';
import { CULIACAN_CENTER } from '../../data/places.mock';
import type { MapMarker } from './types';

/**
 * Saneamiento de datos que entran a la superficie del mapa:
 * nunca se envían coordenadas inválidas al WebView ni a Leaflet.
 */

export function sanitizeMarkers(markers: MapMarker[]): MapMarker[] {
  return markers.filter(
    (m) =>
      typeof m.id === 'string' &&
      m.id.length > 0 &&
      typeof m.label === 'string' &&
      isValidCoordinates(m),
  );
}

/** Centro seguro: ante coordenadas inválidas usa el centro de Culiacán. */
export function safeCenter(center: Coordinates): Coordinates {
  return isValidCoordinates(center) ? center : CULIACAN_CENTER;
}

export function safeUserLocation(coords: Coordinates | null): Coordinates | null {
  return coords && isValidCoordinates(coords) ? coords : null;
}
