import { CityPackAssetError, type CityPackAssetLoader } from './CityPackAssetLoader';
import { cityPackPlaceToLocavoPlace } from './CityPackPlaceMapper';
import {
  assertRuntimeChunk,
  assertRuntimeManifest,
  assertSearchShard,
  MANIFEST_PATH,
  minDistanceToBoundsKm,
  PLACE_ID_INDEX_PATH,
  searchShardKeyOf,
  type PlaceIdIndex,
  type RuntimePackManifest,
  type SearchShard,
} from './RuntimePackFormat';
import { applyOsmEnrichment } from '../../osm/applyOsmEnrichment';
import type { OsmEnrichmentIndex } from '../../osm/OsmEnrichment';
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
 * Repositorio de runtime del city pack v2 (V4D.1).
 *
 * Perezoso y neutral al proveedor: carga primero el manifiesto (pequeño) y
 * después SOLO los índices/trozos que la operación necesita. Los trozos son
 * hojas quadtree compactas (≤50 lugares): las consultas top-N por cercanía
 * cargan pocos trozos con corte temprano exacto, y la búsqueda usa un
 * índice invertido fragmentado (uno o dos fragmentos por consulta).
 *
 * Resiliencia: cualquier problema del pack (ausente, corrupto, esquema no
 * soportado, fragmento dañado) degrada esa llamada al repositorio local de
 * respaldo. Inicio y Explorar nunca se caen por un problema de datos.
 *
 * Nota de acotación: para consultas paginadas el `total` reportado puede
 * ser el número de coincidencias CARGADAS (cota inferior) en vez del total
 * global — el precio explícito de no hidratar categorías completas. Los
 * consumidores actuales solo usan `places`/`nextCursor`.
 */

const DEFAULT_MAX_CACHED_CHUNKS = 12;
const DEFAULT_MAX_CACHED_SHARDS = 6;
/** Margen sobre la distancia mínima aproximada al rectángulo del trozo. */
const BOUNDS_SLACK_KM = 0.75;

export interface CityPackRepositoryOptions {
  maxCachedChunks?: number;
  maxCachedShards?: number;
  /**
   * Proveedor OPCIONAL del índice de enriquecimiento OSM (V4F-0). Solo se
   * inyecta con `enableOpenStreetMapProvider` encendido. Ausente (por defecto)
   * → cero cambios de comportamiento. Un fallo del proveedor degrada a "sin
   * enriquecimiento" sin romper la carga del pack.
   */
  enrichmentProvider?: () => Promise<OsmEnrichmentIndex | null>;
}

export class CityPackRepository implements PlaceRepository {
  private manifest: RuntimePackManifest | null = null;
  private idIndex: PlaceIdIndex | null = null;
  private manifestPromise: Promise<RuntimePackManifest> | null = null;
  private unavailable = false;
  private warned = false;
  private readonly chunkCache = new Map<number, LocavoPlace[]>();
  private readonly shardCache = new Map<string, SearchShard>();
  private readonly maxCachedChunks: number;
  private readonly maxCachedShards: number;
  private readonly enrichmentProvider?: () => Promise<OsmEnrichmentIndex | null>;
  private enrichmentIndex: OsmEnrichmentIndex | null = null;
  private enrichmentLoaded = false;
  private enrichmentPromise: Promise<OsmEnrichmentIndex | null> | null = null;

  constructor(
    private readonly loader: CityPackAssetLoader,
    private readonly fallback: PlaceRepository,
    options: CityPackRepositoryOptions = {},
  ) {
    this.maxCachedChunks = options.maxCachedChunks ?? DEFAULT_MAX_CACHED_CHUNKS;
    this.maxCachedShards = options.maxCachedShards ?? DEFAULT_MAX_CACHED_SHARDS;
    this.enrichmentProvider = options.enrichmentProvider;
  }

  /**
   * Índice de enriquecimiento OSM (memoizado). Sin proveedor → null. Un fallo
   * de carga/parseo degrada a null (sin enriquecimiento), nunca lanza.
   */
  private async ensureEnrichment(): Promise<OsmEnrichmentIndex | null> {
    if (!this.enrichmentProvider) {
      return null;
    }
    if (this.enrichmentLoaded) {
      return this.enrichmentIndex;
    }
    if (!this.enrichmentPromise) {
      this.enrichmentPromise = this.enrichmentProvider().catch(() => null);
    }
    this.enrichmentIndex = await this.enrichmentPromise;
    this.enrichmentLoaded = true;
    return this.enrichmentIndex;
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
      const offset = q.cursor ? Number.parseInt(q.cursor, 10) || 0 : 0;
      const needed = offset + q.limit;

      const relevant = manifest.chunks
        .map((chunk, index) => ({ chunk, index }))
        .filter(({ chunk }) => !q.categories || q.categories.includes(chunk.category))
        .filter(
          ({ chunk }) =>
            minDistanceToBoundsKm(origin.latitude, origin.longitude, chunk.bounds) <=
            radiusKm + BOUNDS_SLACK_KM,
        );

      const accept = (place: LocavoPlace): boolean => {
        if (haversineKm(origin, place.coordinates) * 1000 > q.radiusMeters) {
          return false;
        }
        return !q.openNow || evaluateOpenStatus(place.hours ?? null, now).state === 'open';
      };
      // Carga incremental por cercanía del trozo con corte temprano exacto:
      // nunca se hidratan trozos que ya no pueden aportar a la página pedida.
      const { places, exhausted } = await this.loadTopKByProximity(
        manifest,
        relevant,
        origin,
        needed,
        accept,
      );
      places.sort(
        (a, b) =>
          haversineKm(origin, a.coordinates) - haversineKm(origin, b.coordinates) ||
          (a.id < b.id ? -1 : 1),
      );
      const page = places.slice(offset, offset + q.limit);
      const nextOffset = offset + page.length;
      const hasMore = !exhausted || nextOffset < places.length;
      return {
        places: page,
        total: places.length,
        nextCursor: hasMore && page.length > 0 ? String(nextOffset) : undefined,
      };
    } catch (error) {
      this.warnOnce(error);
      return this.fallback.searchNearby(query);
    }
  }

  async searchText(query: TextPlaceQuery): Promise<PlaceSearchResult> {
    const q = validateTextQuery(query);
    try {
      const manifest = await this.ensureManifest();
      const tokens = tokenize(q.text);
      const phraseCategories = aliasCategoriesOf(q.text);
      const offset = q.cursor ? Number.parseInt(q.cursor, 10) || 0 : 0;
      const needed = offset + q.limit;
      const allCategories = Object.keys(manifest.byCategory) as LocavoCategory[];
      const categoryTermsCache = new Map<LocavoCategory, string>();
      const categoryTermsOf = (category: LocavoCategory): string => {
        let terms = categoryTermsCache.get(category);
        if (terms === undefined) {
          terms = normalizeText(getCategoryMeta(category).searchTerms.join(' '));
          categoryTermsCache.set(category, terms);
        }
        return terms;
      };

      // Cobertura por categoría de cada token: alias multilenguaje,
      // término de la categoría, o token COMÚN del pack (comodín: p. ej.
      // "culiacan" aparece en casi todos los lugares y no lleva postings).
      const isWildcard = (token: string): boolean =>
        manifest.commonTokens.some((common) => common.startsWith(token));
      const coveredByToken = tokens.map((token) =>
        isWildcard(token)
          ? new Set(allCategories)
          : new Set(
              allCategories.filter(
                (category) =>
                  aliasCategoriesOf(token).includes(category) ||
                  categoryTermsOf(category).includes(token),
              ),
            ),
      );
      const fullyCoveredCategories = allCategories.filter(
        (category) =>
          (q.categories === undefined || q.categories.includes(category)) &&
          (phraseCategories.includes(category) ||
            (tokens.length > 0 && coveredByToken.every((covered) => covered.has(category)))),
      );

      // Candidatos por token vía fragmentos del índice invertido (prefijo
      // de palabra). Solo se cargan los fragmentos de las letras usadas.
      const postingsByToken: Map<string, number>[] = [];
      for (const token of tokens) {
        const found = new Map<string, number>();
        const shard = await this.loadShard(manifest, searchShardKeyOf(token));
        if (shard) {
          for (const [indexToken, postings] of Object.entries(shard.tokens)) {
            if (indexToken.startsWith(token)) {
              for (const [id, chunkIndex] of postings) {
                found.set(id, chunkIndex);
              }
            }
          }
        }
        postingsByToken.push(found);
      }

      // Un id califica si CADA token lo alcanza por índice o por cobertura
      // de su categoría (semántica de placeMatchesQuery).
      const idCandidates = new Map<string, number>();
      for (let i = 0; i < postingsByToken.length; i++) {
        for (const [id, chunkIndex] of postingsByToken[i]) {
          if (idCandidates.has(id)) {
            continue;
          }
          const category = manifest.chunks[chunkIndex]?.category;
          if (category === undefined) {
            continue;
          }
          if (q.categories && !q.categories.includes(category)) {
            continue;
          }
          const qualifies = tokens.every(
            (_token, t) => postingsByToken[t].has(id) || coveredByToken[t].has(category),
          );
          if (qualifies) {
            idCandidates.set(id, chunkIndex);
          }
        }
      }

      const seen = new Map<string, LocavoPlace>();
      const candidateChunks = [...new Set(idCandidates.values())].sort((a, b) => a - b);
      for (const chunkIndex of candidateChunks) {
        for (const place of await this.loadChunk(manifest, chunkIndex)) {
          // Verificación final exacta contra la búsqueda de dominio.
          if (
            idCandidates.has(place.id) &&
            !seen.has(place.id) &&
            placeMatchesQuery(place, q.text)
          ) {
            seen.set(place.id, place);
          }
        }
      }

      // Categorías totalmente cubiertas (p. ej. "tacos" cubre comida):
      // carga acotada top-N por cercanía, jamás la categoría completa.
      let exhausted = true;
      if (fullyCoveredCategories.length > 0) {
        const refs = manifest.chunks
          .map((chunk, index) => ({ chunk, index }))
          .filter(({ chunk }) => fullyCoveredCategories.includes(chunk.category));
        if (q.latitude !== undefined && q.longitude !== undefined) {
          const origin = { latitude: q.latitude, longitude: q.longitude };
          const topK = await this.loadTopKByProximity(
            manifest,
            refs,
            origin,
            needed,
            (place) => placeMatchesQuery(place, q.text),
            seen,
          );
          exhausted = topK.exhausted;
        } else {
          for (const { index } of refs) {
            for (const place of await this.loadChunk(manifest, index)) {
              if (!seen.has(place.id) && placeMatchesQuery(place, q.text)) {
                seen.set(place.id, place);
              }
            }
          }
        }
      }

      const matches = [...seen.values()];
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
      const page = matches.slice(offset, offset + q.limit);
      const nextOffset = offset + page.length;
      const hasMore = !exhausted || nextOffset < matches.length;
      return {
        places: page,
        total: matches.length,
        nextCursor: hasMore && page.length > 0 ? String(nextOffset) : undefined,
      };
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

      // Trozos por cercanía de su rectángulo con corte temprano exacto:
      // la primera página de una categoría no hidrata la categoría entera.
      const { places } = await this.loadTopKByProximity(
        manifest,
        categoryChunks,
        origin,
        needed,
        () => true,
      );
      places.sort(
        (a, b) =>
          haversineKm(origin, a.coordinates) - haversineKm(origin, b.coordinates) ||
          (a.id < b.id ? -1 : 1),
      );
      const page = places.slice(offset, offset + opts.limit);
      const total = manifest.byCategory[category] ?? places.length;
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

  /**
   * Carga un fragmento del índice de búsqueda (caché LRU acotada). Un
   * fragmento inexistente en el manifiesto (letra sin tokens) devuelve
   * null; un fragmento anunciado pero ilegible/corrupto lanza (→ respaldo).
   */
  private async loadShard(
    manifest: RuntimePackManifest,
    key: string,
  ): Promise<SearchShard | null> {
    const info = manifest.indexes.searchShards[key];
    if (!info) {
      return null;
    }
    const cached = this.shardCache.get(key);
    if (cached) {
      this.shardCache.delete(key);
      this.shardCache.set(key, cached);
      return cached;
    }
    const raw = await this.loader.load(info.name);
    const shard = assertSearchShard(JSON.parse(raw), info.name);
    this.shardCache.set(key, shard);
    while (this.shardCache.size > this.maxCachedShards) {
      const oldest = this.shardCache.keys().next().value as string;
      this.shardCache.delete(oldest);
    }
    return shard;
  }

  /**
   * Carga trozos en orden de cercanía de su rectángulo al origen, con
   * corte temprano exacto: se detiene cuando el siguiente trozo ya no
   * puede aportar nada al top-`needed` (considerando el margen del
   * rectángulo). `exhausted` indica si se agotaron los trozos relevantes.
   */
  private async loadTopKByProximity(
    manifest: RuntimePackManifest,
    chunkRefs: readonly { chunk: RuntimePackManifest['chunks'][number]; index: number }[],
    origin: { latitude: number; longitude: number },
    needed: number,
    accept: (place: LocavoPlace) => boolean,
    seed?: Map<string, LocavoPlace>,
  ): Promise<{ places: LocavoPlace[]; exhausted: boolean }> {
    const ordered = [...chunkRefs].sort(
      (a, b) =>
        minDistanceToBoundsKm(origin.latitude, origin.longitude, a.chunk.bounds) -
        minDistanceToBoundsKm(origin.latitude, origin.longitude, b.chunk.bounds),
    );
    const seen = seed ?? new Map<string, LocavoPlace>();
    const distances: number[] = [];
    for (const place of seen.values()) {
      distances.push(haversineKm(origin, place.coordinates));
    }
    let exhausted = true;
    for (const { chunk, index } of ordered) {
      if (seen.size >= needed) {
        distances.sort((a, b) => a - b);
        const kth = distances[needed - 1];
        const minPossible =
          minDistanceToBoundsKm(origin.latitude, origin.longitude, chunk.bounds) -
          BOUNDS_SLACK_KM;
        if (minPossible > kth) {
          exhausted = false;
          break;
        }
      }
      for (const place of await this.loadChunk(manifest, index)) {
        if (!seen.has(place.id) && accept(place)) {
          seen.set(place.id, place);
          distances.push(haversineKm(origin, place.coordinates));
        }
      }
    }
    return { places: [...seen.values()], exhausted };
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
    const hydrated = chunk.places.map(cityPackPlaceToLocavoPlace);

    // Merge OSM (V4F-0): tras hidratar, detrás del flag y de forma append-only.
    // Sin proveedor (flag OFF) → `places === hydrated`, sin cambios.
    const enrichment = await this.ensureEnrichment();
    const places = enrichment
      ? hydrated.map((place) => {
          const entry = enrichment.get(place.id);
          return entry ? applyOsmEnrichment(place, entry) : place;
        })
      : hydrated;

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
