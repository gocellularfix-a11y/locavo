import type { PlaceRepository } from '../../data/places/PlaceRepository';
import { haversineKm, isValidCoordinates } from '../../domain/distance';
import { evaluateOpenStatus } from '../../domain/openingHours';
import type { Coordinates } from '../../domain/place';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import { getPreferredCategories, getTimeOfDayContext } from './timeOfDay';

/**
 * Selección "Sorpréndeme" (V4A.2).
 *
 * Reglas deterministas sobre el repositorio activo (LocalPlaceRepository):
 * 1. Solo lugares elegibles según el modelo canónico (activos, no cerrados).
 * 2. La franja horaria local prefiere categorías relevantes; si ninguna
 *    tiene resultados se usa todo el conjunto elegible.
 * 3. Se prefieren lugares abiertos SOLO cuando existen datos reales de
 *    horario que lo confirmen.
 * 4. La distancia pondera la elección solo con origen y coordenadas válidas.
 * 5. Nunca se repite el mismo lugar dos veces seguidas en la sesión (si hay
 *    alternativas) y una fuente aleatoria inyectable mantiene la frescura
 *    sin sacrificar la reproducibilidad en pruebas.
 *
 * Sin nube, sin proveedores externos y sin calificaciones inventadas.
 */

export interface SurpriseContext {
  now: Date;
  /** Origen opcional: GPS o zona manual. Nulo = sin ponderación de distancia. */
  origin?: Coordinates | null;
  /** Último lugar entregado en la sesión (se evita repetirlo de inmediato). */
  previousPlaceId?: string | null;
  /** Fuente aleatoria [0,1). Inyectable para pruebas deterministas. */
  random?: () => number;
}

/** Elegibilidad según el modelo canónico: activo y no cerrado. */
export function isEligiblePlace(place: LocavoPlace): boolean {
  return (
    place.status.active &&
    place.status.permanentlyClosed !== true &&
    place.status.temporarilyClosed !== true
  );
}

interface WeightedPlace {
  place: LocavoPlace;
  weight: number;
}

function pickWeighted(entries: WeightedPlace[], random: () => number): LocavoPlace | null {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (entries.length === 0 || total <= 0) {
    return entries[0]?.place ?? null;
  }
  let remaining = random() * total;
  for (const entry of entries) {
    remaining -= entry.weight;
    if (remaining < 0) {
      return entry.place;
    }
  }
  return entries[entries.length - 1].place;
}

/**
 * Selector puro e independiente de React/repositorios: mismas entradas y
 * misma fuente aleatoria → mismo resultado.
 */
export function selectSurprisePlace(
  places: LocavoPlace[],
  context: SurpriseContext,
): LocavoPlace | null {
  const random = context.random ?? Math.random;
  const eligible = places.filter(isEligiblePlace);
  if (eligible.length === 0) {
    return null;
  }

  // Preferencia por franja horaria; sin resultados → todo lo elegible.
  const preferred = getPreferredCategories(getTimeOfDayContext(context.now));
  let pool = eligible.filter((place) => preferred.includes(place.category));
  if (pool.length === 0) {
    pool = eligible;
  }

  // Preferir abiertos únicamente cuando hay horarios reales que lo prueben.
  const open = pool.filter(
    (place) =>
      place.hours != null && evaluateOpenStatus(place.hours, context.now).state === 'open',
  );
  if (open.length > 0) {
    pool = open;
  }

  // Evitar repetir el resultado anterior cuando existen alternativas.
  if (context.previousPlaceId && pool.length > 1) {
    const withoutPrevious = pool.filter((place) => place.id !== context.previousPlaceId);
    if (withoutPrevious.length > 0) {
      pool = withoutPrevious;
    }
  }

  // Ponderación por cercanía solo con origen y coordenadas válidas.
  const origin =
    context.origin && isValidCoordinates(context.origin) ? context.origin : null;
  if (origin) {
    const weighted = pool.map((place) => {
      const hasCoords = isValidCoordinates(place.coordinates);
      const km = hasCoords ? haversineKm(origin, place.coordinates) : null;
      // Más cerca → más peso; sin coordenadas válidas → peso neutro bajo.
      const weight = km === null ? 0.25 : 1 / (1 + km);
      return { place, weight };
    });
    return pickWeighted(weighted, random);
  }

  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index];
}

export interface SurpriseRequest {
  /** Origen efectivo (GPS o zona manual seleccionada; siempre existe). */
  origin: Coordinates;
  now?: Date;
  random?: () => number;
}

const SURPRISE_FETCH_LIMIT = 50;
const SURPRISE_FALLBACK_RADIUS_M = 20_000;

/**
 * Servicio de sesión: carga candidatos del repositorio activo y recuerda el
 * último resultado para no repetirlo de inmediato. No usa red propia: solo
 * el `PlaceRepository` inyectado (local hoy).
 */
export class SurprisePlaceService {
  private lastPlaceId: string | null = null;

  constructor(private readonly repository: PlaceRepository) {}

  async surprise(request: SurpriseRequest): Promise<LocavoPlace | null> {
    const now = request.now ?? new Date();
    const origin = isValidCoordinates(request.origin) ? request.origin : null;
    const candidates = new Map<string, LocavoPlace>();

    const preferred = getPreferredCategories(getTimeOfDayContext(now));
    for (const category of preferred) {
      const result = await this.repository.listByCategory(category, {
        latitude: origin?.latitude,
        longitude: origin?.longitude,
        limit: SURPRISE_FETCH_LIMIT,
      });
      for (const place of result.places) {
        candidates.set(place.id, place);
      }
    }

    // Sin resultados en las categorías de la franja → todo el entorno.
    if (candidates.size === 0 && origin) {
      const nearby = await this.repository.searchNearby({
        latitude: origin.latitude,
        longitude: origin.longitude,
        radiusMeters: SURPRISE_FALLBACK_RADIUS_M,
        limit: SURPRISE_FETCH_LIMIT,
      });
      for (const place of nearby.places) {
        candidates.set(place.id, place);
      }
    }

    const place = selectSurprisePlace([...candidates.values()], {
      now,
      origin,
      previousPlaceId: this.lastPlaceId,
      random: request.random,
    });
    if (place) {
      this.lastPlaceId = place.id;
    }
    return place;
  }
}
