import { CityPackAssetError, type CityPackAssetLoader } from './CityPackAssetLoader';
import { cityPackPlaceToLocavoPlace } from './CityPackPlaceMapper';
import {
  assertRuntimeChunk,
  assertRuntimeManifest,
  MANIFEST_PATH,
  minDistanceToBoundsKm,
  PLACE_ID_INDEX_PATH,
  SEARCH_INDEX_PATH,
  type CompactSearchIndex,
  type PlaceIdIndex,
  type RuntimePackManifest,
} from './RuntimePackFormat';
import { getCategoryMeta } from '../../../domain/categories';
import { haversineKm } from '../../../domain/distance';
import { evaluateOpenStatus } from '../../../domain/openingHours';
import type { LocavoCategory, LocavoPlace } from '../../../domain/places/LocavoPlace';
import { placeMatchesQuery } from '../../../domain/search';
import { aliasCategoriesOf } from '../../../i18n/searchAliases';
import { normalizeText, tokenize } from '../../../utils/text';
import type { PlaceRepository } from '../PlaceRepository';
import {
  validateListOptions,
  validateNearbyQuery,
  validateTextQuery,
  type NearbyPlaceQuery,
  type PlaceListOptions,
  type TextPlaceQuery,
} from '../PlaceQuery';
import type { PlaceSearchResult } from '../PlaceSearchResult';

/**
 * Repositorio de runtime del city pack (V4D).
 *
 * Perezoso y neutral al proveedor: carga primero el manifiesto (pequeño) y
 * después SOLO los índices/trozos que la operación necesita. Nunca parsea
 * el pack completo. Caché acotada LRU de trozos hidratados.
 *
 * Resiliencia: cualquier problema del pack (ausente, corrupto, esquema no
 * soportado) degrada automáticamente esa llamada al repositorio local de
 * respaldo. Inicio y Explorar nunca se caen por un problema de datos.
 */

const DEFAULT_MAX_CACHED_CHUNKS = 12;
/** Margen sobre la distancia mínima aproximada al rectángulo del trozo. */
const BOUNDS_SLACK_KM = 0.75;

export interface CityPackRepositoryOptions {
  maxCachedChunks?: number;
}

export class CityPackRepository implements PlaceRepository {
  private manifest: RuntimePackManifest | null = null;
  private idIndex: PlaceIdIndex | null = null;
  private searchIndex: CompactSearchIndex | null = null;
  private manifestPromise: Promise<RuntimePackManifest> | null = null;
  private unavailable = false;
  private warned = false;
  private readonly chunkCache = new Map<number, LocavoPlace[]>();
  private readonly maxCachedChunks: number;

  constructor(
    private readonly loader: CityPackAssetLoader,
    private readonly fallback: PlaceRepository,
    options: CityPackRepositoryOptions = {},
  ) {
    this.maxCachedChunks = options.maxCachedChunks ?? DEFAULT_MAX_CACHED_CHUNKS;
  }

  // ── Contrato PlaceRepository ─────────────────────────────────────────

  async getById(id: string): Promise<LocavoPlace | null> {
    try {
      const manifest = await this.ensureManifest();
      const index = await this.ensureIdIndex(manifest);
      const chunkIndex = index.ids[id];
      if (chunkIndex === undefined) {
        return null;
      }
      const places = await this.loadChunk(manifest, chunkIndex);
      return places.find((place) => place.id === id) ?? null;
    } catch (error) {
      this.warnOnce(error);
      return this.fallback.getById(id);
    }
  }

  async searchNearby(query: NearbyPlaceQuery): Promise<PlaceSearchResult> {
    const q = validateNearbyQuery(query);
    try {
      const manifest = await this.ensureManifest();
      const origin = { latitude: q.latitude, longitude: q.longitude };
      const radiusKm = q.radiusMeters / 1000;
      const now = new Date();

      const relevant = manifest.chunks
        .map((chunk, index) => ({ chunk, index }))
        .filter(({ chunk }) => !q.categories || q.categories.includes(chunk.category))
        .filter(
          ({ chunk }) =>
            minDistanceToBoundsKm(origin.latitude, origin.longitude, chunk.bounds) <=
            radiusKm + BOUNDS_SLACK_KM,
        );

      const merged = await this.loadChunks(manifest, relevant.map((r) => r.index));
      let matches = merged.filter(
        (place) => haversineKm(origin, place.coordinates) * 1000 <= q.radiusMeters,
      );
      if (q.openNow) {
        matches = matches.filter(
          (place) => evaluateOpenStatus(place.hours ?? null, now).state === 'open',
        );
      }
      matches.sort(
        (a, b) =>
          haversineKm(origin, a.coordinates) - haversineKm(origin, b.coordinates) ||
          (a.id < b.id ? -1 : 1),
      );
      return paginate(matches, q.limit, q.cursor);
    } catch (error) {
      this.warnOnce(error);
      return this.fallback.searchNearby(query);
    }
  }

  async searchText(query: TextPlaceQuery): Promise<PlaceSearchResult> {
    const q = validateTextQuery(query);
    try {
      const manifest = await this.ensureManifest();
      const index = await this.ensureSearchIndex(manifest);
      const tokens = tokenize(q.text);
      const phraseCategories = aliasCategoriesOf(q.text);
      const categoryTermsCache = new Map<LocavoCategory, string>();
      const categoryTermsOf = (category: LocavoCategory): string => {
        let terms = categoryTermsCache.get(category);
        if (terms === undefined) {
          terms = normalizeText(getCategoryMeta(category).searchTerms.join(' '));
          categoryTermsCache.set(category, terms);
        }
        return terms;
      };

      const candidateIds = new Set<string>();
      const candidateChunks = new Set<number>();
      for (const [id, chunkIndex, text] of index.entries) {
        const category = manifest.chunks[chunkIndex]?.category;
        if (category === undefined) {
          continue;
        }
        if (q.categories && !q.categories.includes(category)) {
          continue;
        }
        const matches =
          tokens.length === 0 ||
          phraseCategories.includes(category) ||
          tokens.every(
            (token) =>
              text.includes(token) ||
              categoryTermsOf(category).includes(token) ||
              aliasCategoriesOf(token).includes(category),
          );
        if (matches) {
          candidateIds.add(id);
          candidateChunks.add(chunkIndex);
        }
      }

      const merged = await this.loadChunks(manifest, [...candidateChunks].sort((a, b) => a - b));
      // Verificación final con la búsqueda de dominio: paridad exacta.
      let matches = merged.filter(
        (place) => candidateIds.has(place.id) && placeMatchesQuery(place, q.text),
      );
      if (q.categories && q.categories.length > 0) {
        matches = matches.filter((place) => q.categories!.includes(place.category));
      }
      if (q.latitude !== undefined && q.longitude !== undefined) {
        const origin = { latitude: q.latitude, longitude: q.longitude };
        matches.sort(
          (a, b) =>
            haversineKm(origin, a.coordinates) - haversineKm(origin, b.coordinates) ||
            (a.id < b.id ? -1 : 1),
        );
      } else {
        matches.sort((a, b) => (a.id < b.id ? -1 : 1));
      }
      return paginate(matches, q.limit, q.cursor);
    } catch (error) {
      this.warnOnce(error);
      return this.fallback.searchText(query);
    }
  }

  async listByCategory(
    category: LocavoCategory,
    options?: PlaceListOptions,
  ): Promise<PlaceSearchResult> {
    const opts = validateListOptions(options);
    try {
      const manifest = await this.ensureManifest();
      const categoryChunks = manifest.chunks
        .map((chunk, index) => ({ chunk, index }))
        .filter(({ chunk }) => chunk.category === category);

      if (opts.latitude === undefined || opts.longitude === undefined) {
        const merged = await this.loadChunks(manifest, categoryChunks.map((c) => c.index));
        merged.sort((a, b) => (a.id < b.id ? -1 : 1));
        return paginate(merged, opts.limit, opts.cursor);
      }

      const origin = { latitude: opts.latitude, longitude: opts.longitude };
      const offset = opts.cursor ? Number.parseInt(opts.cursor, 10) || 0 : 0;
      const needed = offset + opts.limit;

      // Trozos por cercanía de su rectángulo; se deja de cargar cuando el
      // siguiente trozo ya no puede aportar nada al top-N solicitado.
      const ordered = [...categoryChunks].sort(
        (a, b) =>
          minDistanceToBoundsKm(origin.latitude, origin.longitude, a.chunk.bounds) -
          minDistanceToBoundsKm(origin.latitude, origin.longitude, b.chunk.bounds),
      );

      const seen = new Map<string, LocavoPlace>();
      const distances: number[] = [];
      for (const { chunk, index } of ordered) {
        if (seen.size >= needed) {
          distances.sort((a, b) => a - b);
          const kth = distances[needed - 1];
          const minPossible =
            minDistanceToBoundsKm(origin.latitude, origin.longitude, chunk.bounds) -
            BOUNDS_SLACK_KM;
          if (minPossible > kth) {
            break;
          }
        }
        for (const place of await this.loadChunk(manifest, index)) {
          if (!seen.has(place.id)) {
            seen.set(place.id, place);
            distances.push(haversineKm(origin, place.coordinates));
          }
        }
      }

      const merged = [...seen.values()].sort(
        (a, b) =>
          haversineKm(origin, a.coordinates) - haversineKm(origin, b.coordinates) ||
          (a.id < b.id ? -1 : 1),
      );
      const page = merged.slice(offset, offset + opts.limit);
      const total = manifest.byCategory[category] ?? merged.length;
      const nextOffset = offset + page.length;
      return {
        places: page,
        total,
        nextCursor: nextOffset < total ? String(nextOffset) : undefined,
      };
    } catch (error) {
      this.warnOnce(error);
      return this.fallback.listByCategory(category, options);
    }
  }

  // ── Carga perezosa interna ───────────────────────────────────────────

  private async ensureManifest(): Promise<RuntimePackManifest> {
    if (this.manifest) {
      return this.manifest;
    }
    if (this.unavailable) {
      throw new CityPackAssetError('City pack no disponible (fallo previo)');
    }
    if (!this.manifestPromise) {
      this.manifestPromise = this.loader
        .load(MANIFEST_PATH)
        .then((raw) => assertRuntimeManifest(JSON.parse(raw)));
    }
    try {
      this.manifest = await this.manifestPromise;
      return this.manifest;
    } catch (error) {
      this.unavailable = true;
      this.manifestPromise = null;
      throw error;
    }
  }

  private async ensureIdIndex(manifest: RuntimePackManifest): Promise<PlaceIdIndex> {
    if (!this.idIndex) {
      const raw = await this.loader.load(manifest.indexes.placeId.name ?? PLACE_ID_INDEX_PATH);
      const parsed = JSON.parse(raw) as PlaceIdIndex;
      if (typeof parsed !== 'object' || parsed === null || typeof parsed.ids !== 'object') {
        throw new CityPackAssetError('Índice de ids corrupto');
      }
      this.idIndex = parsed;
    }
    return this.idIndex;
  }

  private async ensureSearchIndex(manifest: RuntimePackManifest): Promise<CompactSearchIndex> {
    if (!this.searchIndex) {
      const raw = await this.loader.load(manifest.indexes.search.name ?? SEARCH_INDEX_PATH);
      const parsed = JSON.parse(raw) as CompactSearchIndex;
      if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.entries)) {
        throw new CityPackAssetError('Índice de búsqueda corrupto');
      }
      this.searchIndex = parsed;
    }
    return this.searchIndex;
  }

  private async loadChunk(
    manifest: RuntimePackManifest,
    chunkIndex: number,
  ): Promise<LocavoPlace[]> {
    const cached = this.chunkCache.get(chunkIndex);
    if (cached) {
      // LRU: retocar la posición de uso reciente.
      this.chunkCache.delete(chunkIndex);
      this.chunkCache.set(chunkIndex, cached);
      return cached;
    }
    const info = manifest.chunks[chunkIndex];
    if (!info) {
      throw new CityPackAssetError(`Trozo inexistente: ${chunkIndex}`);
    }
    const raw = await this.loader.load(info.name);
    const chunk = assertRuntimeChunk(JSON.parse(raw), info.name);
    const places = chunk.places.map(cityPackPlaceToLocavoPlace);

    this.chunkCache.set(chunkIndex, places);
    while (this.chunkCache.size > this.maxCachedChunks) {
      const oldest = this.chunkCache.keys().next().value as number;
      this.chunkCache.delete(oldest);
    }
    return places;
  }

  /** Carga varios trozos y deduplica por id canónico (conserva el primero). */
  private async loadChunks(
    manifest: RuntimePackManifest,
    chunkIndexes: readonly number[],
  ): Promise<LocavoPlace[]> {
    const seen = new Map<string, LocavoPlace>();
    for (const index of chunkIndexes) {
      for (const place of await this.loadChunk(manifest, index)) {
        if (!seen.has(place.id)) {
          seen.set(place.id, place);
        }
      }
    }
    return [...seen.values()];
  }

  private warnOnce(error: unknown): void {
    if (!this.warned) {
      this.warned = true;
      console.warn(
        'CityPack no disponible o dañado; usando el repositorio local de respaldo.',
        error instanceof Error ? error.message : error,
      );
    }
  }
}

/** Paginación idéntica a LocalPlaceRepository (cursor = offset serializado). */
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
