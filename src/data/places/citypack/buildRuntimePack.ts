import { createHash } from 'node:crypto';

import {
  MANIFEST_PATH,
  PLACE_ID_INDEX_PATH,
  RUNTIME_PACK_FORMAT,
  RUNTIME_PACK_SCHEMA_VERSION,
  SEARCH_INDEX_PATH,
  type CompactSearchIndex,
  type GeoBounds,
  type PlaceIdIndex,
  type RuntimeChunkInfo,
  type RuntimePackManifest,
  type SearchIndexEntry,
} from './RuntimePackFormat';
import type { CityPackPlace, CityPackV1 } from '../../import/denue/CityPackBuilder';
import { normalizeText } from '../../../utils/text';

/**
 * Generador del paquete de runtime (V4D) — SOLO herramientas/Node.
 *
 * Transforma el pack fuente (`culiacan.pack.json`) en trozos por categoría
 * subdivididos por retícula geográfica, más índices compactos y un
 * manifiesto con bytes y SHA-256 de cada archivo.
 *
 * Determinista: mismas entradas → mismos bytes en cada archivo. El runtime
 * de la app NUNCA importa este módulo (usa node:crypto).
 */

export interface RuntimePackBuildOptions {
  /** Máximo de registros por trozo (subdivisión determinista). */
  maxChunkRecords?: number;
  /** Tamaño de celda de la retícula geográfica en grados (~0.02 ≈ 2.2 km). */
  gridCellDegrees?: number;
}

export interface RuntimePackFile {
  path: string;
  content: string;
}

export interface RuntimePackBuildResult {
  manifest: RuntimePackManifest;
  /** Todos los archivos a escribir (manifest.json incluido, al final). */
  files: RuntimePackFile[];
}

const DEFAULT_MAX_CHUNK_RECORDS = 250;
const DEFAULT_GRID_CELL_DEGREES = 0.02;

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
 * Texto de búsqueda compacto del lugar. Espejo de
 * domain/search.buildPlaceSearchIndex SIN los términos de la categoría
 * (se re-derivan al consultar a partir de la categoría del trozo).
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
  const cell = options.gridCellDegrees ?? DEFAULT_GRID_CELL_DEGREES;

  // Agrupar por categoría (orden alfabético determinista).
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
  const searchEntries: SearchIndexEntry[] = [];

  for (const category of categories) {
    // Orden por celda geográfica (fila mayor) con orden original estable
    // dentro de cada celda: los trozos quedan geográficamente compactos.
    const places = [...byCategory.get(category)!].sort((a, b) => {
      const rowA = Math.floor(a.latitude / cell);
      const rowB = Math.floor(b.latitude / cell);
      if (rowA !== rowB) {
        return rowA - rowB;
      }
      const colA = Math.floor(a.longitude / cell);
      const colB = Math.floor(b.longitude / cell);
      if (colA !== colB) {
        return colA - colB;
      }
      return 0; // sort estable: conserva el orden por id del pack fuente
    });

    for (let start = 0; start < places.length; start += maxChunkRecords) {
      const chunkPlaces = places.slice(start, start + maxChunkRecords);
      const chunkNumber = Math.floor(start / maxChunkRecords);
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
        searchEntries.push([place.id, chunkIndex, compactSearchTextOf(place)]);
      }
    }
  }

  const idIndexContent = JSON.stringify(idIndex);
  const searchIndexContent = JSON.stringify({ entries: searchEntries } satisfies CompactSearchIndex);
  files.push({ path: PLACE_ID_INDEX_PATH, content: idIndexContent });
  files.push({ path: SEARCH_INDEX_PATH, content: searchIndexContent });

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
      search: {
        name: SEARCH_INDEX_PATH,
        bytes: Buffer.byteLength(searchIndexContent, 'utf8'),
        sha256: sha256Hex(searchIndexContent),
      },
    },
    chunks: chunkInfos,
  };

  // El manifiesto va al final: en una escritura secuencial interrumpida el
  // paquete queda sin manifiesto y el runtime cae limpiamente al fallback.
  files.push({ path: MANIFEST_PATH, content: JSON.stringify(manifest, null, 2) });

  return { manifest, files };
}
