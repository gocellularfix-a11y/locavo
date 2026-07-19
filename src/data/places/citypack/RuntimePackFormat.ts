import type { CityPackPlace } from '../../import/denue/CityPackBuilder';
import type { LocavoCategory } from '../../../domain/places/LocavoPlace';

/**
 * Formato del city pack de RUNTIME (V4D).
 *
 * Paquete generado, troceado y perezoso: el runtime carga primero el
 * manifiesto (pequeño), luego solo los índices/trozos que la operación
 * necesita. Nunca se carga el pack fuente completo (10+ MB) al arrancar.
 *
 * Neutral al proveedor: los trozos contienen `CityPackPlace` (DTO canónico
 * con procedencia en sources[]), no registros DENUE crudos.
 */

export const RUNTIME_PACK_FORMAT = 'locavo-city-pack-runtime';
export const RUNTIME_PACK_SCHEMA_VERSION = 1;

export const MANIFEST_PATH = 'manifest.json';
export const PLACE_ID_INDEX_PATH = 'index/place-id-index.json';
export const SEARCH_INDEX_PATH = 'index/compact-search-index.json';

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface RuntimeFileInfo {
  name: string;
  bytes: number;
  sha256: string;
}

export interface RuntimeChunkInfo extends RuntimeFileInfo {
  category: LocavoCategory;
  count: number;
  bounds: GeoBounds;
}

export interface RuntimePackManifest {
  format: typeof RUNTIME_PACK_FORMAT;
  schemaVersion: number;
  city: string;
  /** Versión del pack (versión oficial del dataset fuente). */
  packVersion: string;
  dataset: string;
  license: string;
  bounds: GeoBounds;
  totalPlaces: number;
  byCategory: Record<string, number>;
  indexes: {
    placeId: RuntimeFileInfo;
    search: RuntimeFileInfo;
  };
  chunks: RuntimeChunkInfo[];
}

/** Índice compacto id → posición del trozo en manifest.chunks. */
export interface PlaceIdIndex {
  ids: Record<string, number>;
}

/**
 * Entrada del índice de búsqueda compacto: [id, chunkIdx, texto].
 * `texto` = índice normalizado del lugar SIN los términos de la categoría
 * (estos se re-derivan de la categoría del trozo al momento de consultar,
 * manteniendo la paridad con domain/search.ts sin duplicar bytes).
 */
export type SearchIndexEntry = [id: string, chunkIndex: number, text: string];

export interface CompactSearchIndex {
  entries: SearchIndexEntry[];
}

/** Contenido de un trozo de categoría. */
export interface RuntimeChunk {
  places: CityPackPlace[];
}

export class CityPackFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CityPackFormatError';
  }
}

function isFileInfo(value: unknown): value is RuntimeFileInfo {
  const v = value as RuntimeFileInfo;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.name === 'string' &&
    typeof v.bytes === 'number' &&
    typeof v.sha256 === 'string'
  );
}

/**
 * Valida forma y versión de esquema del manifiesto. Un esquema desconocido
 * se RECHAZA (nunca se interpreta a ciegas un formato futuro).
 */
export function assertRuntimeManifest(value: unknown): RuntimePackManifest {
  const m = value as RuntimePackManifest;
  if (typeof m !== 'object' || m === null || m.format !== RUNTIME_PACK_FORMAT) {
    throw new CityPackFormatError('Manifiesto de city pack inválido: formato desconocido');
  }
  if (m.schemaVersion !== RUNTIME_PACK_SCHEMA_VERSION) {
    throw new CityPackFormatError(
      `Versión de esquema no soportada: ${String(m.schemaVersion)} (esperada ${RUNTIME_PACK_SCHEMA_VERSION})`,
    );
  }
  if (
    typeof m.city !== 'string' ||
    typeof m.totalPlaces !== 'number' ||
    !Array.isArray(m.chunks) ||
    !m.indexes ||
    !isFileInfo(m.indexes.placeId) ||
    !isFileInfo(m.indexes.search) ||
    !m.chunks.every((c) => isFileInfo(c) && typeof c.category === 'string' && typeof c.count === 'number')
  ) {
    throw new CityPackFormatError('Manifiesto de city pack inválido: estructura incompleta');
  }
  return m;
}

/** Valida la forma de un trozo ya parseado. */
export function assertRuntimeChunk(value: unknown, name: string): RuntimeChunk {
  const c = value as RuntimeChunk;
  if (typeof c !== 'object' || c === null || !Array.isArray(c.places)) {
    throw new CityPackFormatError(`Trozo corrupto: ${name}`);
  }
  for (const place of c.places) {
    if (
      typeof place !== 'object' ||
      place === null ||
      typeof place.id !== 'string' ||
      typeof place.name !== 'string' ||
      typeof place.latitude !== 'number' ||
      typeof place.longitude !== 'number' ||
      !Array.isArray(place.sources)
    ) {
      throw new CityPackFormatError(`Trozo corrupto (lugar inválido): ${name}`);
    }
  }
  return c;
}

/** Distancia mínima aproximada (km) de un punto al rectángulo de un trozo. */
export function minDistanceToBoundsKm(
  latitude: number,
  longitude: number,
  bounds: GeoBounds,
): number {
  const clampedLat = Math.min(Math.max(latitude, bounds.minLat), bounds.maxLat);
  const clampedLng = Math.min(Math.max(longitude, bounds.minLng), bounds.maxLng);
  const dLatKm = (clampedLat - latitude) * 111.32;
  const dLngKm =
    (clampedLng - longitude) * 111.32 * Math.cos((latitude * Math.PI) / 180);
  return Math.sqrt(dLatKm * dLatKm + dLngKm * dLngKm);
}
