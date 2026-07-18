import type { LocavoPlace } from '../../domain/places/LocavoPlace';

/** Resultado paginable de la capa de datos. */
export interface PlaceSearchResult {
  places: LocavoPlace[];
  /** Total de coincidencias (antes de aplicar limit/cursor). */
  total: number;
  /** Cursor opaco para la siguiente página; ausente si no hay más. */
  nextCursor?: string;
}

export const EMPTY_RESULT: PlaceSearchResult = Object.freeze({ places: [], total: 0 });
