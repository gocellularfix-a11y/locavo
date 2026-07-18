import type { Place } from './place';

/**
 * Frontera de acceso a datos de lugares.
 *
 * Fase 1 solo incluye `MockPlaceRepository` (datos locales de demostración).
 * En fases futuras esta misma interfaz será implementada por
 * `RemotePlaceRepository`, `CommunityPlaceRepository` y
 * `AggregatedPlaceRepository` sin cambiar a los consumidores.
 */
export interface PlaceRepository {
  listPlaces(): Promise<Place[]>;
  getPlaceById(id: string): Promise<Place | undefined>;
}
