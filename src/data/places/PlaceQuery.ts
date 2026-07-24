import { isValidCoordinates } from '../../domain/distance';
import type { LocavoCategory } from '../../domain/places/LocavoPlace';

/**
 * Contratos de consulta de la capa de datos (V3).
 *
 * Toda consulta se valida antes de tocar cualquier repositorio o proveedor;
 * una consulta inválida lanza `InvalidPlaceQueryError` con un motivo claro.
 */

export const MIN_RADIUS_METERS = 100;
/**
 * Cota ESTRUCTURAL, no política de producto: cubre cualquier par de puntos de
 * la Tierra y solo rechaza valores absurdos (negativos, NaN, infinitos). La
 * política del radio de exploración vive en la escalera determinista de
 * `services/places/nearbyRadius.ts`, que amplía el alcance cuando no hay nada
 * cerca en vez de esconder resultados.
 */
export const MAX_RADIUS_METERS = 20_100_000;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

export class InvalidPlaceQueryError extends Error {
  constructor(reason: string) {
    super(`Consulta de lugares inválida: ${reason}`);
    this.name = 'InvalidPlaceQueryError';
  }
}

export interface NearbyPlaceQuery {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  categories?: LocavoCategory[];
  openNow?: boolean;
  limit?: number;
  cursor?: string;
}

export interface TextPlaceQuery {
  text: string;
  /** Origen opcional para ordenar por distancia. */
  latitude?: number;
  longitude?: number;
  categories?: LocavoCategory[];
  limit?: number;
  cursor?: string;
}

export interface PlaceListOptions {
  latitude?: number;
  longitude?: number;
  limit?: number;
  cursor?: string;
}

function assertLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_LIMIT;
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new InvalidPlaceQueryError(`limit debe ser un entero entre 1 y ${MAX_LIMIT}`);
  }
  return limit;
}

/** Valida y normaliza una consulta por cercanía. Devuelve la consulta efectiva. */
export function validateNearbyQuery(query: NearbyPlaceQuery): Required<
  Pick<NearbyPlaceQuery, 'latitude' | 'longitude' | 'radiusMeters' | 'limit'>
> &
  NearbyPlaceQuery {
  if (
    typeof query.latitude !== 'number' ||
    typeof query.longitude !== 'number' ||
    !isValidCoordinates({ latitude: query.latitude, longitude: query.longitude })
  ) {
    throw new InvalidPlaceQueryError('coordenadas fuera de rango o no numéricas');
  }
  if (
    typeof query.radiusMeters !== 'number' ||
    !Number.isFinite(query.radiusMeters) ||
    query.radiusMeters < MIN_RADIUS_METERS ||
    query.radiusMeters > MAX_RADIUS_METERS
  ) {
    throw new InvalidPlaceQueryError(
      `radiusMeters debe estar entre ${MIN_RADIUS_METERS} y ${MAX_RADIUS_METERS}`,
    );
  }
  return { ...query, limit: assertLimit(query.limit) };
}

/** Valida una consulta de texto. */
export function validateTextQuery(query: TextPlaceQuery): TextPlaceQuery & { limit: number } {
  if (typeof query.text !== 'string' || query.text.trim().length === 0) {
    throw new InvalidPlaceQueryError('text no puede estar vacío');
  }
  if (
    (query.latitude !== undefined || query.longitude !== undefined) &&
    (typeof query.latitude !== 'number' ||
      typeof query.longitude !== 'number' ||
      !isValidCoordinates({ latitude: query.latitude, longitude: query.longitude }))
  ) {
    throw new InvalidPlaceQueryError('origen de texto con coordenadas inválidas');
  }
  return { ...query, limit: assertLimit(query.limit) };
}

export function validateListOptions(options: PlaceListOptions = {}): PlaceListOptions & {
  limit: number;
} {
  if (
    (options.latitude !== undefined || options.longitude !== undefined) &&
    (typeof options.latitude !== 'number' ||
      typeof options.longitude !== 'number' ||
      !isValidCoordinates({ latitude: options.latitude, longitude: options.longitude }))
  ) {
    throw new InvalidPlaceQueryError('origen de listado con coordenadas inválidas');
  }
  return { ...options, limit: assertLimit(options.limit) };
}
