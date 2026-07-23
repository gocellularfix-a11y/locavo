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

/**
 * Reconstruye coordenadas desde el destino canónico `"lat,lng"`. ESTRICTO: solo
 * acepta EXACTAMENTE el formato serializado que produce `validateDirections`
 * (`${number},${number}`), sin confiar en los llamadores. Rechaza: número de
 * componentes distinto de 2, componentes vacíos o en blanco, hexadecimal,
 * espacios, signos/formatos no canónicos, `NaN`, `Infinity` y fuera de rango.
 *
 * La garantía se obtiene con un round-trip canónico: un componente es válido
 * solo si `String(Number(componente)) === componente`. Así "24.8069" se acepta,
 * pero "", " 24", "0x10", "24.80", "+24", "NaN", "Infinity" se rechazan. Las
 * notaciones exponenciales solo se aceptan cuando SON la forma canónica que
 * `String(number)` emitiría (p. ej. magnitudes muy pequeñas), nunca como truco.
 */
export function parseDirectionsTarget(target: string): Coordinates | null {
  const parts = target.split(',');
  if (parts.length !== 2) {
    return null;
  }
  const [latStr, lngStr] = parts;
  const latitude = Number(latStr);
  const longitude = Number(lngStr);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  // Round-trip canónico: rechaza vacío, espacios, hex y formatos no canónicos.
  if (String(latitude) !== latStr || String(longitude) !== lngStr) {
    return null;
  }
  const coords = { latitude, longitude };
  return isValidCoordinates(coords) ? coords : null;
}
