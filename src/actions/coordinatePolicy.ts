/**
 * Política canónica de DIRECCIONES (V5.7) — pura y determinista.
 *
 * Reutiliza la validación de coordenadas del dominio (`isValidCoordinates`): sin
 * un nuevo proveedor de mapas, sin enriquecimiento OSM en tiempo de ejecución.
 * No convierte silenciosamente coordenadas inválidas a cero; el (0,0) es una
 * coordenada canónicamente válida y NO se trata como ausente.
 */
import { isValidCoordinates } from '../domain/distance';
import type { Coordinates } from '../domain/place';

export type DirectionsReasonCode = 'ACTION_AVAILABLE' | 'ACTION_INVALID_COORDINATES';

export interface DirectionsValidation {
  readonly valid: boolean;
  /** Destino canónico `"lat,lng"` solo cuando `valid` es true; si no, `null`. */
  readonly target: string | null;
  readonly reasonCode: DirectionsReasonCode;
}

const INVALID: DirectionsValidation = { valid: false, target: null, reasonCode: 'ACTION_INVALID_COORDINATES' };

/**
 * Valida coordenadas para navegación. Exige latitud/longitud finitas y en rango
 * (`|lat| ≤ 90`, `|lng| ≤ 180`). El destino es la representación canónica
 * `"lat,lng"`; la construcción de la URL del proveedor y la apertura viven en la
 * frontera de ejecución (se conserva el proveedor de navegación aprobado).
 */
export function validateDirections(coords: Coordinates | undefined | null): DirectionsValidation {
  if (coords === undefined || coords === null) {
    return INVALID;
  }
  if (!isValidCoordinates(coords)) {
    return INVALID;
  }
  return { valid: true, target: `${coords.latitude},${coords.longitude}`, reasonCode: 'ACTION_AVAILABLE' };
}

/** Reconstruye coordenadas desde un destino canónico `"lat,lng"`; `null` si es inválido. */
export function parseDirectionsTarget(target: string): Coordinates | null {
  const parts = target.split(',');
  if (parts.length !== 2) {
    return null;
  }
  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  const coords = { latitude, longitude };
  return isValidCoordinates(coords) ? coords : null;
}
