/**
 * Recuperación canónica de candidatos de recomendación (V5.3).
 *
 * Responde SOLO: ¿qué lugares debe evaluar el motor de inteligencia? Nunca
 * calcula score, confianza, explicaciones ni boosts de contexto; no usa el orden
 * de Surprise; no depende de React ni de la UI. Devuelve `LocavoPlace`
 * canónicos + diagnósticos.
 *
 * Política de recuperación:
 * 1. Alcance de categorías explícito (o las 8 canónicas).
 * 2. Paginación completa por categoría (no se detiene en el primer shard).
 * 3. Validación canónica (id/categoría; coordenadas si hay evaluación geográfica).
 * 4. Deduplicación determinista por id canónico (nunca por posición de array).
 * 5. Filtro geográfico explícito por radio (haversine canónico).
 * 6. Orden determinista: por distancia asc (con origen) y desempate por id;
 *    sin origen, por id asc.
 * 7. Límite de seguridad explícito aplicado AL FINAL sobre la población ya
 *    ordenada geográficamente (nunca truncamiento arbitrario/hash).
 *
 * Complejidad: O(n) validación/dedup/filtrado + O(k log k) solo por el orden
 * geográfico determinista. `c` llamadas al repositorio (una por categoría,
 * paginadas), con los chunks cacheados por el repositorio.
 */
import { CATEGORIES, isCategoryId } from '../domain/categories';
import { haversineKm, isValidCoordinates } from '../domain/distance';
import type { Coordinates } from '../domain/place';
import type { LocavoCategory, LocavoPlace } from '../domain/places/LocavoPlace';
import type { PlaceRepository } from '../data/places/PlaceRepository';
import { MAX_LIMIT } from '../data/places/PlaceQuery';

/** Población de seguridad por defecto (≤ tope del motor de recomendación). */
export const DEFAULT_CANDIDATE_SAFETY_LIMIT = 100;
/** Páginas máximas por categoría (cota dura anti-bucle). */
const MAX_PAGES_PER_CATEGORY = 200;

export interface CandidateRetrievalInput {
  repository: PlaceRepository;
  origin: Coordinates | null;
  /** Alcance de categorías; ausente = todas las canónicas. */
  categories?: readonly LocavoCategory[];
  /** Radio duro en metros; se aplica solo con origen válido y valor finito > 0. */
  radiusMeters?: number;
  /** Población máxima de seguridad. */
  safetyLimit?: number;
}

export interface CandidateRetrievalDiagnostics {
  received: number;
  emitted: number;
  duplicatesRemoved: number;
  conflictingDuplicates: number;
  malformedExcluded: number;
  outsideRadiusExcluded: number;
  categoryExcluded: number;
  safetyLimitApplied: boolean;
  safetyLimitDropped: number;
}

export interface CandidateRetrievalResult {
  candidates: LocavoPlace[];
  diagnostics: CandidateRetrievalDiagnostics;
}

const ALL_CATEGORIES: readonly LocavoCategory[] = CATEGORIES.map((c) => c.id);

function isValidRadius(radius: number | undefined): radius is number {
  return typeof radius === 'number' && Number.isFinite(radius) && radius > 0;
}

/** Elección determinista ante ids duplicados con contenido distinto (min por JSON). */
function pickDeterministic(a: LocavoPlace, b: LocavoPlace): { kept: LocavoPlace; conflict: boolean } {
  const ja = JSON.stringify(a);
  const jb = JSON.stringify(b);
  if (ja === jb) {
    return { kept: a, conflict: false };
  }
  return { kept: ja < jb ? a : b, conflict: true };
}

async function fetchCategory(
  repository: PlaceRepository,
  category: LocavoCategory,
  origin: Coordinates | null,
): Promise<LocavoPlace[]> {
  const out: LocavoPlace[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < MAX_PAGES_PER_CATEGORY; page++) {
      const result = await repository.listByCategory(category, {
        latitude: origin?.latitude,
        longitude: origin?.longitude,
        limit: MAX_LIMIT,
        cursor,
      });
      out.push(...result.places);
      if (!result.nextCursor || result.places.length === 0) {
        break;
      }
      cursor = result.nextCursor;
    }
  } catch {
    // Degradación segura: una categoría que falla no rompe la recuperación.
    return out;
  }
  return out;
}

export async function retrieveRecommendationCandidates(
  input: CandidateRetrievalInput,
): Promise<CandidateRetrievalResult> {
  const scope = input.categories ?? ALL_CATEGORIES;
  const scopeSet = new Set<LocavoCategory>(scope);
  const geoActive = input.origin !== null && isValidCoordinates(input.origin);
  const origin = geoActive ? (input.origin as Coordinates) : null;
  const radiusActive = geoActive && isValidRadius(input.radiusMeters);
  const safetyLimit = Number.isInteger(input.safetyLimit)
    ? Math.max(0, input.safetyLimit as number)
    : DEFAULT_CANDIDATE_SAFETY_LIMIT;

  // 1–2. Recuperación completa por categoría.
  const fetched: LocavoPlace[] = [];
  for (const category of scope) {
    fetched.push(...(await fetchCategory(input.repository, category, origin)));
  }
  const received = fetched.length;

  const diagnostics: CandidateRetrievalDiagnostics = {
    received,
    emitted: 0,
    duplicatesRemoved: 0,
    conflictingDuplicates: 0,
    malformedExcluded: 0,
    outsideRadiusExcluded: 0,
    categoryExcluded: 0,
    safetyLimitApplied: false,
    safetyLimitDropped: 0,
  };

  // 3–4. Validación canónica + deduplicación determinista por id.
  const byId = new Map<string, LocavoPlace>();
  for (const place of fetched) {
    if (!place || typeof place.id !== 'string' || place.id.length === 0 || !isCategoryId(place.category)) {
      diagnostics.malformedExcluded += 1;
      continue;
    }
    if (geoActive && !isValidCoordinates(place.coordinates)) {
      diagnostics.malformedExcluded += 1;
      continue;
    }
    if (!scopeSet.has(place.category)) {
      diagnostics.categoryExcluded += 1;
      continue;
    }
    const existing = byId.get(place.id);
    if (existing) {
      const { kept, conflict } = pickDeterministic(existing, place);
      if (conflict) {
        diagnostics.conflictingDuplicates += 1;
      }
      diagnostics.duplicatesRemoved += 1;
      byId.set(place.id, kept);
    } else {
      byId.set(place.id, place);
    }
  }

  // 5. Filtro geográfico + distancia (calculada una vez).
  interface Scored {
    place: LocavoPlace;
    distanceMeters: number | null;
  }
  const kept: Scored[] = [];
  for (const place of byId.values()) {
    const distanceMeters = geoActive ? haversineKm(origin as Coordinates, place.coordinates) * 1000 : null;
    if (radiusActive && distanceMeters !== null && distanceMeters > (input.radiusMeters as number)) {
      diagnostics.outsideRadiusExcluded += 1;
      continue;
    }
    kept.push({ place, distanceMeters });
  }

  // 6. Orden determinista (distancia asc con origen; siempre desempate por id).
  kept.sort((a, b) => {
    if (a.distanceMeters !== null && b.distanceMeters !== null && a.distanceMeters !== b.distanceMeters) {
      return a.distanceMeters - b.distanceMeters;
    }
    return a.place.id < b.place.id ? -1 : a.place.id > b.place.id ? 1 : 0;
  });

  // 7. Límite de seguridad al final.
  if (kept.length > safetyLimit) {
    diagnostics.safetyLimitDropped = kept.length - safetyLimit;
    diagnostics.safetyLimitApplied = true;
  }
  const candidates = kept.slice(0, safetyLimit).map((s) => s.place);
  diagnostics.emitted = candidates.length;

  return { candidates, diagnostics };
}
