import { createHash } from 'node:crypto';

import {
  MANIFEST_PATH,
  PLACE_ID_INDEX_PATH,
  RUNTIME_PACK_FORMAT,
  RUNTIME_PACK_SCHEMA_VERSION,
  searchShardKeyOf,
  searchShardPathOf,
  type GeoBounds,
  type PlaceIdIndex,
  type RuntimeChunkInfo,
  type RuntimeFileInfo,
  type RuntimePackManifest,
  type SearchPosting,
  type SearchShard,
} from './RuntimePackFormat';
import type { CityPackPlace, CityPackV1 } from '../../import/denue/CityPackBuilder';
import { normalizeText, tokenize } from '../../../utils/text';

/**
 * Generador del paquete de runtime v2 (V4D.1) — SOLO herramientas/Node.
 *
 * Cambios frente a v1:
 * - Trozos por QUADTREE dentro de cada categoría (rectángulos compactos y
 *   pequeños, ≤50 lugares por defecto): las consultas top-N por cercanía
 *   cargan pocos trozos en lugar de hidratar la categoría completa.
 * - Índice de búsqueda INVERTIDO y fragmentado por prefijo: una búsqueda
 *   normal carga uno o dos fragmentos pequeños, no un índice de 1.87 MB.
 *
 * Determinista: mismas entradas → mismos bytes. El runtime nunca importa
 * este módulo (usa node:crypto).
 */

export interface RuntimePackBuildOptions {
  /** Máximo de registros por trozo (hoja del quadtree). */
  maxChunkRecords?: number;
  /**
   * Fracción de lugares a partir de la cual un token es "común" y sale del
   * índice invertido (se resuelve como comodín en runtime).
   */
  commonTokenFraction?: number;
}

export interface RuntimePackFile {
  path: string;
  content: string;
}

export interface RuntimePackBuildResult {
  manifest: RuntimePackManifest;
  files: RuntimePackFile[];
}

const DEFAULT_MAX_CHUNK_RECORDS = 50;
/** Corte de profundidad ante coordenadas degeneradas (todas idénticas). */
const MAX_QUADTREE_DEPTH = 14;
/**
 * Un token presente en ≥15 % de los lugares (p. ej. "culiacan") no aporta
 * selectividad: sus postings pesarían cientos de KB. Se publica en
 * manifest.commonTokens y el runtime lo trata como comodín verificado.
 */
const DEFAULT_COMMON_TOKEN_FRACTION = 0.15;

function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function boundsOf(places: readonly CityPackPlace[]): GeoBounds {
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  for (const place of places) {
    minLat = Math.min(minLat, place.latitude);
    maxLat = Math.max(maxLat, place.latitude);
    minLng = Math.min(minLng, place.longitude);
    maxLng = Math.max(maxLng, place.longitude);
  }
  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Partición quadtree determinista: divide por el punto medio del rectángulo
 * hasta que cada hoja tenga ≤ maxRecords (o profundidad máxima). El orden
 * de hojas es el recorrido en profundidad SW, SE, NW, NE.
 */
function quadtreeLeaves(
  places: CityPackPlace[],
  maxRecords: number,
  depth = 0,
): CityPackPlace[][] {
  if (places.length <= maxRecords || depth >= MAX_QUADTREE_DEPTH) {
    return places.length > 0 ? [places] : [];
  }
  const bounds = boundsOf(places);
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const midLng = (bounds.minLng + bounds.maxLng) / 2;
  const quadrants: CityPackPlace[][] = [[], [], [], []];
  for (const place of places) {
    const north = place.latitude > midLat;
    const east = place.longitude > midLng;
    quadrants[(north ? 2 : 0) + (east ? 1 : 0)].push(place);
  }
  // Cuadrante degenerado (todos los puntos en el mismo lugar): hoja forzada.
  if (quadrants.some((q) => q.length === places.length)) {
    return [places];
  }
  const leaves: CityPackPlace[][] = [];
  for (const quadrant of quadrants) {
    leaves.push(...quadtreeLeaves(quadrant, maxRecords, depth + 1));
  }
  return leaves;
}

/**
 * Texto de búsqueda del lugar para el índice invertido. Espejo de
 * domain/search.buildPlaceSearchIndex SIN los términos de la categoría
 * (la cobertura por categoría se resuelve en runtime).
 */
export function compactSearchTextOf(place: CityPackPlace): string {
  return normalizeText(
    [
      place.normalizedName,
      place.address?.formatted ?? '',
      place.address?.neighborhood ?? '',
      ...(place.searchTerms ?? []),
    ].join(' '),
  );
}

export function buildRuntimePack(
  pack: CityPackV1,
  options: RuntimePackBuildOptions = {},
): RuntimePackBuildResult {
  if (pack.format !== 'locavo-city-pack' || pack.formatVersion !== 1) {
    throw new Error('Pack fuente inválido: se espera locavo-city-pack v1');
  }
  const maxChunkRecords = options.maxChunkRecords ?? DEFAULT_MAX_CHUNK_RECORDS;

  const byCategory = new Map<string, CityPackPlace[]>();
  for (const place of pack.places) {
    const list = byCategory.get(place.category) ?? [];
    list.push(place);
    byCategory.set(place.category, list);
  }
  const categories = [...byCategory.keys()].sort();

  const files: RuntimePackFile[] = [];
  const chunkInfos: RuntimeChunkInfo[] = [];
  const idIndex: PlaceIdIndex = { ids: {} };
  /** token → postings (orden de inserción determinista). */
  const invertedIndex = new Map<string, SearchPosting[]>();

  for (const category of categories) {
    const leaves = quadtreeLeaves(byCategory.get(category)!, maxChunkRecords);
    leaves.forEach((chunkPlaces, chunkNumber) => {
      const name = `categories/${category}/chunk-${String(chunkNumber).padStart(3, '0')}.json`;
      const content = JSON.stringify({ places: chunkPlaces });
      const chunkIndex = chunkInfos.length;

      chunkInfos.push({
        name,
        category: category as RuntimeChunkInfo['category'],
        count: chunkPlaces.length,
        bounds: boundsOf(chunkPlaces),
        bytes: Buffer.byteLength(content, 'utf8'),
        sha256: sha256Hex(content),
      });
      files.push({ path: name, content });

      for (const place of chunkPlaces) {
        if (idIndex.ids[place.id] === undefined) {
          idIndex.ids[place.id] = chunkIndex;
        }
        const seenTokens = new Set<string>();
        for (const token of tokenize(compactSearchTextOf(place))) {
          if (seenTokens.has(token)) {
            continue;
          }
          seenTokens.add(token);
          const postings = invertedIndex.get(token) ?? [];
          postings.push([place.id, chunkIndex]);
          invertedIndex.set(token, postings);
        }
      }
    });
  }

  // Tokens comunes fuera del índice (comodines verificados en runtime).
  const commonThreshold = Math.max(
    2,
    Math.ceil(
      (options.commonTokenFraction ?? DEFAULT_COMMON_TOKEN_FRACTION) * pack.places.length,
    ),
  );
  const commonTokens: string[] = [];
  for (const [token, postings] of invertedIndex) {
    if (postings.length >= commonThreshold) {
      commonTokens.push(token);
    }
  }
  commonTokens.sort();
  for (const token of commonTokens) {
    invertedIndex.delete(token);
  }

  // Fragmentos por prefijo, con tokens ordenados dentro de cada fragmento.
  const shardTokens = new Map<string, string[]>();
  for (const token of [...invertedIndex.keys()].sort()) {
    const key = searchShardKeyOf(token);
    const list = shardTokens.get(key) ?? [];
    list.push(token);
    shardTokens.set(key, list);
  }
  const searchShards: Record<string, RuntimeFileInfo> = {};
  for (const key of [...shardTokens.keys()].sort()) {
    const shard: SearchShard = { tokens: {} };
    for (const token of shardTokens.get(key)!) {
      shard.tokens[token] = invertedIndex.get(token)!;
    }
    const path = searchShardPathOf(key);
    const content = JSON.stringify(shard);
    files.push({ path, content });
    searchShards[key] = {
      name: path,
      bytes: Buffer.byteLength(content, 'utf8'),
      sha256: sha256Hex(content),
    };
  }

  const idIndexContent = JSON.stringify(idIndex);
  files.push({ path: PLACE_ID_INDEX_PATH, content: idIndexContent });

  const byCategoryCounts: Record<string, number> = {};
  for (const category of categories) {
    byCategoryCounts[category] = byCategory.get(category)!.length;
  }

  const manifest: RuntimePackManifest = {
    format: RUNTIME_PACK_FORMAT,
    schemaVersion: RUNTIME_PACK_SCHEMA_VERSION,
    city: pack.city,
    packVersion: pack.sourceVersion,
    dataset: pack.dataset,
    license: pack.license,
    bounds: boundsOf(pack.places),
    totalPlaces: pack.places.length,
    byCategory: byCategoryCounts,
    indexes: {
      placeId: {
        name: PLACE_ID_INDEX_PATH,
        bytes: Buffer.byteLength(idIndexContent, 'utf8'),
        sha256: sha256Hex(idIndexContent),
      },
      searchShards,
    },
    commonTokens,
    chunks: chunkInfos,
  };

  // El manifiesto va al final: una escritura interrumpida deja un paquete
  // sin manifiesto y el runtime cae limpiamente al respaldo local.
  files.push({ path: MANIFEST_PATH, content: JSON.stringify(manifest, null, 2) });

  return { manifest, files };
}
