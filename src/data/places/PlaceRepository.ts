import type { LocavoCategory, LocavoPlace } from '../../domain/places/LocavoPlace';
import type { NearbyPlaceQuery, PlaceListOptions, TextPlaceQuery } from './PlaceQuery';
import type { PlaceSearchResult } from './PlaceSearchResult';

/**
 * Frontera de acceso a datos de lugares (V3).
 *
 * Implementaciones:
 * - `LocalPlaceRepository` (actual): datos semilla locales en modelo canónico.
 * - `CloudPlaceRepository` (futuro): Supabase/PostgreSQL+PostGIS detrás del
 *   mismo contrato, sin reescribir pantallas ni hooks.
 *
 * Las pantallas NUNCA importan una implementación concreta ni datos mock;
 * consumen `PlaceSearchService`, que a su vez usa esta interfaz.
 */
export interface PlaceRepository {
  getById(id: string): Promise<LocavoPlace | null>;

  searchNearby(query: NearbyPlaceQuery): Promise<PlaceSearchResult>;

  searchText(query: TextPlaceQuery): Promise<PlaceSearchResult>;

  listByCategory(
    category: LocavoCategory,
    options?: PlaceListOptions,
  ): Promise<PlaceSearchResult>;
}
