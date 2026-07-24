import type { PlaceRepository } from '../../data/places/PlaceRepository';
import type { CategoryId, Coordinates } from '../../domain/place';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import { interpretQuery } from '../../domain/queryInterpreter';
import type { SearchIntent } from '../../domain/searchIntent';
import {
  decodeNearbyCursor,
  encodeNearbyCursor,
  isExpandedRadius,
  plainCursorOf,
  searchWithExpandingRadius,
} from './nearbyRadius';
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

/**
 * Aviso truthful mostrado por la UI (sin afirmar datos que no existen).
 * `NO_NEARBY_RESULTS`: no había nada en el entorno inmediato y se amplió el
 * radio; lo mostrado está lejos y la UI debe decirlo.
 */
export type SearchNotice = 'HOURS_UNAVAILABLE' | 'NO_NEARBY_RESULTS';

export interface PlaceSearchResponse {
  results: ScoredPlace[];
  /** Presente cuando hay más resultados; pásalo en la siguiente petición. */
  nextCursor?: string;
  /** Interpretación de la consulta de texto (V4D), si la hubo. */
  intent?: SearchIntent;
  /** Aviso truthful (p. ej. horarios no confirmados ante "abierto ahora"). */
  notice?: SearchNotice;
}

const FETCH_LIMIT = 50;
/**
 * Cotas de seguridad para reunir candidatos de TEXTO antes del ranking global.
 * Reunir "todos los candidatos válidos" NO es cargar la ciudad entera: el
 * índice invertido acota los candidatos a los que realmente coinciden. Estas
 * cotas solo evitan un bucle patológico con datasets futuros muy grandes; el
 * City Pack actual (500 lugares, categoría máxima 120) nunca las alcanza.
 */
const MAX_RANKING_CANDIDATES = 1000;
const MAX_FETCH_PAGES = 40;

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

    // ── Búsqueda por TEXTO: RANKING GLOBAL ANTES DE PAGINACIÓN (V4D.1) ──
    // Reúne TODOS los candidatos válidos por el índice invertido (perezoso y
    // acotado a los que coinciden, jamás la ciudad entera), los rankea con el
    // Search Intelligence existente y pagina el resultado YA ordenado. Así una
    // coincidencia de nombre no queda excluida de la primera página por estar
    // más lejos que 50 coincidencias genéricas.
    if (intent && intent.searchText.length > 0) {
      let candidates: LocavoPlace[];
      try {
        candidates = await this.collectAllTextCandidates(
          intent.searchText,
          origin,
          effectiveCategories,
        );
      } catch (error) {
        this.analytics.track({ eventName: 'repository_error', metadata: { operation: 'search' } });
        throw error;
      }

      let ranked = rankSearchResults(candidates, intent, origin, now);
      const openNowResult = this.applyOpenNow(ranked, openNow || intent.openNow);
      ranked = openNowResult.ranked;
      if (sort === 'distance') {
        ranked = [...ranked].sort((a, b) => a.distanceKm - b.distanceKm);
      }

      // Paginación DESPUÉS del ranking: cursor = offset dentro del orden global.
      const pageSize = request.limit ?? FETCH_LIMIT;
      const textCursor = plainCursorOf(cursor);
      const offset = textCursor ? Number.parseInt(textCursor, 10) || 0 : 0;
      const page = ranked.slice(offset, offset + pageSize);
      const nextOffset = offset + page.length;
      const nextCursor = nextOffset < ranked.length ? String(nextOffset) : undefined;

      this.analytics.track({
        eventName: page.length === 0 ? 'place_search_empty' : 'place_search_completed',
        category: category ?? undefined,
        metadata: { resultCount: page.length },
      });

      return {
        results: page,
        ...(nextCursor !== undefined ? { nextCursor } : {}),
        intent,
        ...(openNowResult.notice ? { notice: openNowResult.notice } : {}),
      };
    }

    // ── Navegación por CATEGORÍA o ENTORNO (sin texto): paginación por el
    // repositorio y ranking de conveniencia. Sin coincidencia de nombre, la
    // distancia es la señal correcta, por lo que este flujo no cambia. ──
    let places: LocavoPlace[];
    let nextCursor: string | undefined;
    let radiusExpanded = false;
    try {
      if (effectiveCategories && effectiveCategories.length === 1) {
        // Intención pura de categoría ("tengo hambre" → food) o chip de categoría.
        // El listado por categoría ordena por distancia SIN filtrar por radio:
        // no esconde lugares lejanos, así que no necesita ampliación.
        const result = await this.repository.listByCategory(effectiveCategories[0], {
          latitude: origin.latitude,
          longitude: origin.longitude,
          limit: FETCH_LIMIT,
          cursor: plainCursorOf(cursor),
        });
        places = result.places;
        nextCursor = result.nextCursor;
      } else {
        // Sin texto ni categoría (o "cerca" a secas): explorar el entorno. Si el
        // radio base no devuelve nada, se AMPLÍA por escalones deterministas en
        // vez de fingir que no existe nada: las distancias siguen siendo reales
        // y el aviso dirá que lo mostrado no está cerca.
        const requested = decodeNearbyCursor(cursor);
        const probe = (radiusMeters: number) =>
          this.repository.searchNearby({
            latitude: origin.latitude,
            longitude: origin.longitude,
            radiusMeters,
            limit: FETCH_LIMIT,
            cursor: requested.cursor,
          });

        // Página siguiente: se reusa el radio ya fijado para recorrer el MISMO
        // conjunto; solo la primera página elige escalón.
        const outcome =
          requested.radiusMeters !== null
            ? {
                value: await probe(requested.radiusMeters),
                radiusMeters: requested.radiusMeters,
                expanded: isExpandedRadius(requested.radiusMeters),
              }
            : await searchWithExpandingRadius(probe, (result) => result.places.length > 0);

        places = outcome.value.places;
        radiusExpanded = outcome.expanded;
        nextCursor =
          outcome.value.nextCursor !== undefined
            ? encodeNearbyCursor(outcome.radiusMeters, outcome.value.nextCursor)
            : undefined;
      }
    } catch (error) {
      this.analytics.track({
        eventName: 'repository_error',
        metadata: { operation: 'search' },
      });
      throw error;
    }

    let ranked = intent
      ? rankSearchResults(places, intent, origin, now)
      : rankPlaces(places, origin, now);
    const openNowResult = this.applyOpenNow(ranked, openNow || (intent?.openNow ?? false));
    ranked = openNowResult.ranked;

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

    // Un solo aviso: el de horarios (filtro explícito del usuario) tiene
    // prioridad. Sin resultados no hace falta advertir que están lejos: el
    // estado vacío ya lo dice.
    const notice: SearchNotice | undefined =
      openNowResult.notice ??
      (radiusExpanded && ranked.length > 0 ? 'NO_NEARBY_RESULTS' : undefined);

    return {
      results: ranked,
      ...(nextCursor !== undefined ? { nextCursor } : {}),
      ...(intent ? { intent } : {}),
      ...(notice ? { notice } : {}),
    };
  }

  /**
   * Reúne TODOS los candidatos de texto válidos recorriendo la paginación del
   * repositorio (mismo contrato e índices existentes) y deduplicando por id
   * canónico. Necesario para rankear globalmente antes de paginar. Acotado por
   * cotas de seguridad: nunca es un escaneo completo del país.
   */
  private async collectAllTextCandidates(
    text: string,
    origin: Coordinates,
    categories: CategoryId[] | undefined,
  ): Promise<LocavoPlace[]> {
    const byId = new Map<string, LocavoPlace>();
    let cursor: string | undefined;
    let pages = 0;
    do {
      const result = await this.repository.searchText({
        text,
        latitude: origin.latitude,
        longitude: origin.longitude,
        categories,
        limit: FETCH_LIMIT,
        cursor,
      });
      for (const place of result.places) {
        if (!byId.has(place.id)) {
          byId.set(place.id, place);
        }
      }
      cursor = result.nextCursor;
      pages += 1;
    } while (cursor !== undefined && byId.size < MAX_RANKING_CANDIDATES && pages < MAX_FETCH_PAGES);
    return [...byId.values()];
  }

  /**
   * Filtro/aviso VERAZ de "abierto ahora" sobre un conjunto ya rankeado: solo
   * filtra si existen horarios reales; con datos sin horario (City Pack)
   * preserva los resultados y avisa que no se confirman.
   */
  private applyOpenNow(
    ranked: ScoredPlace[],
    wants: boolean,
  ): { ranked: ScoredPlace[]; notice?: SearchNotice } {
    if (!wants) {
      return { ranked };
    }
    const anyHours = ranked.some((scored) => scored.status.state !== 'unknown');
    if (anyHours) {
      return { ranked: ranked.filter((scored) => scored.status.state === 'open') };
    }
    return { ranked, notice: 'HOURS_UNAVAILABLE' };
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
