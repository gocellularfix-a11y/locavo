import type { CloudRpcTransport } from './client';
import { CloudRepositoryError } from './errors';
import { mapCloudRowToPlace } from './SupabasePlaceMapper';
import type { LocavoCategory, LocavoPlace } from '../../domain/places/LocavoPlace';
import type { PlaceRepository } from '../places/PlaceRepository';
import {
  validateListOptions,
  validateNearbyQuery,
  validateTextQuery,
  type NearbyPlaceQuery,
  type PlaceListOptions,
  type TextPlaceQuery,
} from '../places/PlaceQuery';
import type { PlaceSearchResult } from '../places/PlaceSearchResult';
import { isCategoryId } from '../../domain/categories';
import { normalizeText } from '../../utils/text';

/**
 * Repositorio cloud sobre Supabase (V4A) — implementa exactamente el
 * contrato `PlaceRepository` existente; las pantallas no cambian.
 *
 * - Solo usa las RPCs públicas de lectura (RLS: lugares publicados/activos).
 * - Valida entradas con los mismos validadores que el repositorio local.
 * - Mapea cada fila al modelo canónico; filas malformadas se descartan de
 *   forma segura (mapper devuelve null). Una respuesta no-arreglo es
 *   INVALID_CLOUD_RESPONSE.
 * - PERMANECE APAGADO por defecto: solo la factory lo instancia cuando el
 *   feature flag `useCloudPlaceRepository` esté activo con config válida.
 */

interface RpcRow {
  place?: unknown;
  total?: unknown;
}

export class SupabasePlaceRepository implements PlaceRepository {
  constructor(private readonly transport: CloudRpcTransport) {}

  private async call(
    fn: 'place_by_id' | 'places_nearby' | 'places_search_text' | 'places_by_category',
    params: Record<string, unknown>,
  ): Promise<{ places: LocavoPlace[]; total: number }> {
    let data: unknown;
    let error: { message: string } | null;
    try {
      ({ data, error } = await this.transport.rpc(fn, params));
    } catch (cause) {
      throw new CloudRepositoryError(
        'CLOUD_REPOSITORY_UNAVAILABLE',
        cause instanceof Error ? cause.message : 'network failure',
      );
    }
    if (error) {
      throw new CloudRepositoryError('CLOUD_QUERY_FAILED', error.message);
    }
    if (data === null || data === undefined) {
      return { places: [], total: 0 };
    }
    if (!Array.isArray(data)) {
      throw new CloudRepositoryError('INVALID_CLOUD_RESPONSE', 'la RPC no devolvió un arreglo');
    }
    const rows = data as RpcRow[];
    const places = rows
      .map((row) => mapCloudRowToPlace(row?.place))
      .filter((place): place is LocavoPlace => place !== null);
    const totalRaw = rows[0]?.total;
    const total = typeof totalRaw === 'number' && totalRaw >= 0 ? totalRaw : places.length;
    return { places, total };
  }

  private toResult(
    places: LocavoPlace[],
    total: number,
    offset: number,
  ): PlaceSearchResult {
    const nextOffset = offset + places.length;
    return {
      places,
      total,
      nextCursor: nextOffset < total && places.length > 0 ? String(nextOffset) : undefined,
    };
  }

  private static offsetFrom(cursor?: string): number {
    const parsed = cursor ? Number.parseInt(cursor, 10) : 0;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  }

  async getById(id: string): Promise<LocavoPlace | null> {
    if (typeof id !== 'string' || id.length === 0 || id.length > 100) {
      return null;
    }
    const { places } = await this.call('place_by_id', { p_id: id });
    return places[0] ?? null;
  }

  async searchNearby(query: NearbyPlaceQuery): Promise<PlaceSearchResult> {
    const q = validateNearbyQuery(query);
    const offset = SupabasePlaceRepository.offsetFrom(q.cursor);
    const { places, total } = await this.call('places_nearby', {
      p_lat: q.latitude,
      p_lng: q.longitude,
      p_radius_m: q.radiusMeters,
      p_categories: q.categories && q.categories.length > 0 ? q.categories : null,
      p_limit: q.limit,
      p_offset: offset,
    });
    // openNow se evalúa en la app (evaluador determinista compartido).
    return this.toResult(places, total, offset);
  }

  async searchText(query: TextPlaceQuery): Promise<PlaceSearchResult> {
    const q = validateTextQuery(query);
    const offset = SupabasePlaceRepository.offsetFrom(q.cursor);
    const { places, total } = await this.call('places_search_text', {
      p_query: normalizeText(q.text),
      p_lat: q.latitude ?? null,
      p_lng: q.longitude ?? null,
      p_categories: q.categories && q.categories.length > 0 ? q.categories : null,
      p_limit: q.limit,
      p_offset: offset,
    });
    return this.toResult(places, total, offset);
  }

  async listByCategory(
    category: LocavoCategory,
    options?: PlaceListOptions,
  ): Promise<PlaceSearchResult> {
    if (!isCategoryId(category)) {
      throw new CloudRepositoryError('CLOUD_QUERY_FAILED', 'categoría desconocida');
    }
    const opts = validateListOptions(options);
    const offset = SupabasePlaceRepository.offsetFrom(opts.cursor);
    const { places, total } = await this.call('places_by_category', {
      p_category: category,
      p_lat: opts.latitude ?? null,
      p_lng: opts.longitude ?? null,
      p_limit: opts.limit,
      p_offset: offset,
    });
    return this.toResult(places, total, offset);
  }
}
