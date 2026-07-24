/**
 * ESCALERA de radio para la exploración del entorno (V5.9.1).
 *
 * Cuando no hay NADA dentro del radio base, esconder los lugares sería tan
 * deshonesto como falsear la distancia: la búsqueda amplía el radio por pasos
 * deterministas hasta encontrar algo y avisa que lo encontrado NO está cerca.
 * Las distancias mostradas siempre son reales; ampliar el radio jamás convierte
 * un lugar lejano en "cercano" (el umbral NEARBY del motor V5.0 no cambia).
 *
 * La escalera es la POLÍTICA de producto del radio; la validación de la capa de
 * datos solo rechaza valores estructuralmente absurdos.
 */

/** Radio que cubre cualquier par de puntos de la Tierra (~20,015 km reales). */
export const GLOBAL_RADIUS_M = 20_100_000;

/**
 * Pasos deterministas: barrio → región → país → continente → global. Se sube un
 * escalón SOLO cuando el anterior no devolvió ningún resultado.
 */
export const NEARBY_RADIUS_LADDER_M: readonly number[] = [
  20_000,
  100_000,
  500_000,
  2_500_000,
  GLOBAL_RADIUS_M,
];

/** Radio base: el entorno inmediato del usuario. */
export const DEFAULT_NEARBY_RADIUS_M = NEARBY_RADIUS_LADDER_M[0];

/** ¿El radio usado ya no es el del entorno inmediato? */
export function isExpandedRadius(radiusMeters: number): boolean {
  return radiusMeters > DEFAULT_NEARBY_RADIUS_M;
}

export interface ExpandingRadiusOutcome<T> {
  readonly value: T;
  /** Radio con el que se obtuvo el resultado devuelto. */
  readonly radiusMeters: number;
  /** true si hubo que pasar del radio base. */
  readonly expanded: boolean;
}

/**
 * Sondea la escalera y devuelve el PRIMER escalón con resultados. Si ninguno
 * los tiene, devuelve el último (vacío honesto, sin inventar candidatos).
 * Determinista: la misma sonda produce el mismo escalón.
 */
export async function searchWithExpandingRadius<T>(
  probe: (radiusMeters: number) => Promise<T>,
  hasResults: (value: T) => boolean,
  ladder: readonly number[] = NEARBY_RADIUS_LADDER_M,
): Promise<ExpandingRadiusOutcome<T>> {
  let last: T | undefined;
  let lastRadius = ladder[0];

  for (let step = 0; step < ladder.length; step++) {
    lastRadius = ladder[step];
    last = await probe(lastRadius);
    if (hasResults(last)) {
      return { value: last, radiusMeters: lastRadius, expanded: step > 0 };
    }
  }

  return {
    value: last as T,
    radiusMeters: lastRadius,
    expanded: isExpandedRadius(lastRadius),
  };
}

/**
 * Cursor COMPUESTO del entorno: conserva el radio elegido en la primera página
 * para que las siguientes recorran EXACTAMENTE el mismo conjunto. Sin esto, una
 * página 2 volvería al radio base y la paginación mezclaría dos búsquedas.
 */
export function encodeNearbyCursor(radiusMeters: number, cursor: string): string {
  return `${radiusMeters}:${cursor}`;
}

export interface DecodedNearbyCursor {
  /** Radio fijado por la página anterior, o null si aún no se ha elegido. */
  readonly radiusMeters: number | null;
  /** Cursor opaco que entiende el repositorio. */
  readonly cursor?: string;
}

export function decodeNearbyCursor(cursor: string | undefined): DecodedNearbyCursor {
  if (cursor === undefined) {
    return { radiusMeters: null };
  }
  const match = /^(\d+):(.*)$/.exec(cursor);
  if (!match) {
    // Cursor plano (otra rama de búsqueda): se respeta con el radio base.
    return { radiusMeters: null, cursor };
  }
  return { radiusMeters: Number.parseInt(match[1], 10), cursor: match[2] };
}

/** Cursor tal como lo entiende el repositorio, venga compuesto o plano. */
export function plainCursorOf(cursor: string | undefined): string | undefined {
  return decodeNearbyCursor(cursor).cursor;
}
