import { haversineKm } from '../../domain/distance';
import { evaluateOpenStatus } from '../../domain/openingHours';
import type { LocavoCategory, LocavoPlace } from '../../domain/places/LocavoPlace';
import { placeMatchesQuery } from '../../domain/search';
import { seedToLocavoPlace } from './PlaceMapper';
import type { PlaceRepository } from './PlaceRepository';
import {
  validateListOptions,
  validateNearbyQuery,
  validateTextQuery,
  type NearbyPlaceQuery,
  type PlaceListOptions,
  type TextPlaceQuery,
} from './PlaceQuery';
import type { PlaceSearchResult } from './PlaceSearchResult';
import { MOCK_PLACES } from '../places.mock';

/**
 * Repositorio local (dataMode: 'mock'): sirve la semilla transformada al
 * modelo canónico. Implementa el mismo contrato que tendrá el repositorio
 * cloud (Supabase/PostGIS), incluida paginación por cursor.
 *
 * La distancia se calcula con Haversine en el cliente; PostGIS asumirá ese
 * papel en el backend futuro.
 */
export class LocalPlaceRepository implements PlaceRepository {
  private readonly places: LocavoPlace[];

  constructor(places?: LocavoPlace[]) {
    this.places = places ?? MOCK_PLACES.map(seedToLocavoPlace);
  }

  async getById(id: string): Promise<LocavoPlace | null> {
    return this.places.find((place) => place.id === id) ?? null;
  }

  async searchNearby(query: NearbyPlaceQuery): Promise<PlaceSearchResult> {
    const q = validateNearbyQuery(query);
    const origin = { latitude: q.latitude, longitude: q.longitude };
    const now = new Date();

    let matches = this.places.filter(
      (place) => haversineKm(origin, place.coordinates) * 1000 <= q.radiusMeters,
    );
    if (q.categories && q.categories.length > 0) {
      matches = matches.filter((place) => q.categories!.includes(place.category));
    }
    if (q.openNow) {
      matches = matches.filter(
        (place) => evaluateOpenStatus(place.hours ?? null, now).state === 'open',
      );
    }
    matches = [...matches].sort(
      (a, b) =>
        haversineKm(origin, a.coordinates) - haversineKm(origin, b.coordinates) ||
        (a.id < b.id ? -1 : 1),
    );
    return paginate(matches, q.limit, q.cursor);
  }

  async searchText(query: TextPlaceQuery): Promise<PlaceSearchResult> {
    const q = validateTextQuery(query);

    let matches = this.places.filter((place) => placeMatchesQuery(place, q.text));
    if (q.categories && q.categories.length > 0) {
      matches = matches.filter((place) => q.categories!.includes(place.category));
    }
    if (q.latitude !== undefined && q.longitude !== undefined) {
      const origin = { latitude: q.latitude, longitude: q.longitude };
      matches = [...matches].sort(
        (a, b) =>
          haversineKm(origin, a.coordinates) - haversineKm(origin, b.coordinates) ||
          (a.id < b.id ? -1 : 1),
      );
    }
    return paginate(matches, q.limit, q.cursor);
  }

  async listByCategory(
    category: LocavoCategory,
    options?: PlaceListOptions,
  ): Promise<PlaceSearchResult> {
    const opts = validateListOptions(options);
    let matches = this.places.filter((place) => place.category === category);
    if (opts.latitude !== undefined && opts.longitude !== undefined) {
      const origin = { latitude: opts.latitude, longitude: opts.longitude };
      matches = [...matches].sort(
        (a, b) =>
          haversineKm(origin, a.coordinates) - haversineKm(origin, b.coordinates) ||
          (a.id < b.id ? -1 : 1),
      );
    } else {
      matches = [...matches].sort((a, b) => (a.id < b.id ? -1 : 1));
    }
    return paginate(matches, opts.limit, opts.cursor);
  }
}

/** Cursor opaco = offset serializado (suficiente para el repositorio local). */
function paginate(all: LocavoPlace[], limit: number, cursor?: string): PlaceSearchResult {
  const offset = cursor ? Number.parseInt(cursor, 10) || 0 : 0;
  const page = all.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  return {
    places: page,
    total: all.length,
    nextCursor: nextOffset < all.length ? String(nextOffset) : undefined,
  };
}
