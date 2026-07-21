import type { PlaceRepository } from '../../data/places/PlaceRepository';
import type { CategoryId, Coordinates } from '../../domain/place';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import { interpretQuery } from '../../domain/queryInterpreter';
import type { SearchIntent } from '../../domain/searchIntent';
import { rankPlaces, type ScoredPlace } from './PlaceRankingService';
import { rankSearchResults } from './SearchRankingService';
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
  /** Cursor opaco de la página anterior (paginación V4D.1). */
  cursor?: string;
}

/** Aviso truthful mostrado por la UI (sin afirmar datos que no existen). */
export type SearchNotice = 'HOURS_UNAVAILABLE';

export interface PlaceSearchResponse {
  results: ScoredPlace[];
  /** Presente cuando hay más resultados; pásalo en la siguiente petición. */
  nextCursor?: string;
  /** Interpretación de la consulta de texto (V4D), si la hubo. */
  intent?: SearchIntent;
  /** Aviso truthful (p. ej. horarios no confirmados ante "abierto ahora"). */
  notice?: SearchNotice;
}

const DEFAULT_NEARBY_RADIUS_M = 20_000;
const FETCH_LIMIT = 50;

export class PlaceSearchService {
  constructor(
    private readonly repository: PlaceRepository,
    private readonly analytics: AnalyticsService,
  ) {}

  async search(request: PlaceSearchRequest): Promise<PlaceSearchResponse> {
    const { origin, category = null, text = '', openNow = false, sort = 'best', cursor } = request;
    const trimmed = text.trim();
    const now = new Date();

    // Interpretación de la consulta (V4D): intención, categorías, cercanía…
    const intent: SearchIntent | undefined =
      trimmed.length > 0 ? interpretQuery(trimmed) : undefined;
    // Categorías efectivas: filtro explícito (chip) o intención inferida. Acota
    // la carga del repositorio y mejora la relevancia sin cargar todo el pack.
    const effectiveCategories: CategoryId[] | undefined = category
      ? [category]
      : intent && intent.categories.length > 0
        ? intent.categories
        : undefined;

    this.analytics.track({
      eventName: 'place_search_started',
      category: category ?? undefined,
      metadata: { queryLength: trimmed.length, openNow },
    });

    let places: LocavoPlace[];
    let nextCursor: string | undefined;
    try {
      if (intent && intent.searchText.length > 0) {
        // Búsqueda por texto con los términos interpretados (relleno removido).
        const result = await this.repository.searchText({
          text: intent.searchText,
          latitude: origin.latitude,
          longitude: origin.longitude,
          categories: effectiveCategories,
          limit: FETCH_LIMIT,
          cursor,
        });
        places = result.places;
        nextCursor = result.nextCursor;
      } else if (effectiveCategories && effectiveCategories.length === 1) {
        // Intención pura de categoría ("tengo hambre" → food) o chip de categoría.
        const result = await this.repository.listByCategory(effectiveCategories[0], {
          latitude: origin.latitude,
          longitude: origin.longitude,
          limit: FETCH_LIMIT,
          cursor,
        });
        places = result.places;
        nextCursor = result.nextCursor;
      } else {
        // Sin texto ni categoría (o "cerca" a secas): explorar el entorno.
        const result = await this.repository.searchNearby({
          latitude: origin.latitude,
          longitude: origin.longitude,
          radiusMeters: DEFAULT_NEARBY_RADIUS_M,
          limit: FETCH_LIMIT,
          cursor,
        });
        places = result.places;
        nextCursor = result.nextCursor;
      }
    } catch (error) {
      this.analytics.track({
        eventName: 'repository_error',
        metadata: { operation: 'search' },
      });
      throw error;
    }

    // Ranking: relevancia de búsqueda cuando hay intención de texto; ranking de
    // conveniencia (apertura/distancia/…) al navegar por categoría o entorno.
    let ranked = intent
      ? rankSearchResults(places, intent, origin, now)
      : rankPlaces(places, origin, now);

    // "Abierto ahora" veraz: solo filtra si hay horarios reales; con datos sin
    // horario (City Pack) preserva los resultados y avisa que no se confirman.
    let notice: SearchNotice | undefined;
    const wantsOpenNow = openNow || (intent?.openNow ?? false);
    if (wantsOpenNow) {
      const anyHours = ranked.some((scored) => scored.status.state !== 'unknown');
      if (anyHours) {
        ranked = ranked.filter((scored) => scored.status.state === 'open');
      } else {
        notice = 'HOURS_UNAVAILABLE';
      }
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

    return {
      results: ranked,
      ...(nextCursor !== undefined ? { nextCursor } : {}),
      ...(intent ? { intent } : {}),
      ...(notice ? { notice } : {}),
    };
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
