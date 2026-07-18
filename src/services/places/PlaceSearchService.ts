import type { PlaceRepository } from '../../data/places/PlaceRepository';
import type { CategoryId, Coordinates } from '../../domain/place';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import { rankPlaces, type ScoredPlace } from './PlaceRankingService';
import type { AnalyticsService } from '../analytics';

/**
 * Fachada de búsqueda para pantallas y hooks (V3).
 *
 * La UI solo conoce este servicio; el repositorio concreto (local hoy,
 * cloud mañana) se inyecta. Registra telemetría local de consultas sin
 * datos personales ni coordenadas del usuario.
 */

export interface PlaceSearchRequest {
  origin: Coordinates;
  category?: CategoryId | null;
  text?: string;
  openNow?: boolean;
  sort?: 'best' | 'distance';
  limit?: number;
}

export interface PlaceSearchResponse {
  results: ScoredPlace[];
}

const DEFAULT_NEARBY_RADIUS_M = 20_000;
const FETCH_LIMIT = 50;

export class PlaceSearchService {
  constructor(
    private readonly repository: PlaceRepository,
    private readonly analytics: AnalyticsService,
  ) {}

  async search(request: PlaceSearchRequest): Promise<PlaceSearchResponse> {
    const { origin, category = null, text = '', openNow = false, sort = 'best' } = request;
    const trimmed = text.trim();

    this.analytics.track({
      eventName: 'place_search_started',
      category: category ?? undefined,
      metadata: { queryLength: trimmed.length, openNow },
    });

    let places: LocavoPlace[];
    try {
      if (trimmed.length > 0) {
        const result = await this.repository.searchText({
          text: trimmed,
          latitude: origin.latitude,
          longitude: origin.longitude,
          categories: category ? [category] : undefined,
          limit: FETCH_LIMIT,
        });
        places = result.places;
      } else if (category) {
        const result = await this.repository.listByCategory(category, {
          latitude: origin.latitude,
          longitude: origin.longitude,
          limit: FETCH_LIMIT,
        });
        places = result.places;
      } else {
        const result = await this.repository.searchNearby({
          latitude: origin.latitude,
          longitude: origin.longitude,
          radiusMeters: DEFAULT_NEARBY_RADIUS_M,
          limit: FETCH_LIMIT,
        });
        places = result.places;
      }
    } catch (error) {
      this.analytics.track({
        eventName: 'repository_error',
        metadata: { operation: 'search' },
      });
      throw error;
    }

    let ranked = rankPlaces(places, origin, new Date());
    if (openNow) {
      ranked = ranked.filter((scored) => scored.status.state === 'open');
    }
    if (sort === 'distance') {
      ranked = [...ranked].sort((a, b) => a.distanceKm - b.distanceKm);
    }
    if (request.limit !== undefined) {
      ranked = ranked.slice(0, request.limit);
    }

    this.analytics.track({
      eventName: ranked.length === 0 ? 'place_search_empty' : 'place_search_completed',
      category: category ?? undefined,
      metadata: { resultCount: ranked.length },
    });

    return { results: ranked };
  }

  async getById(id: string): Promise<LocavoPlace | null> {
    try {
      return await this.repository.getById(id);
    } catch (error) {
      this.analytics.track({
        eventName: 'repository_error',
        metadata: { operation: 'getById' },
      });
      throw error;
    }
  }
}
