import { buildPlaceSearchIndex } from '../../domain/search';
import { estimateTravelMinutes, haversineKm } from '../../domain/distance';
import { evaluateOpenStatus } from '../../domain/openingHours';
import type { Coordinates } from '../../domain/place';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import type { SearchIntent } from '../../domain/searchIntent';
import { completenessOf, type RecommendationReason, type ScoredPlace } from './PlaceRankingService';

/**
 * Ranking de BÚSQUEDA (V4D): determinista, explicable y sin datos inventados.
 *
 * A diferencia del ranking de conveniencia (apertura/distancia/confianza), la
 * relevancia del NOMBRE del negocio manda: una coincidencia exacta de nombre
 * siempre supera a una coincidencia solo de categoría, y la distancia jamás
 * hace que un resultado irrelevante quede primero (su peso es pequeño frente a
 * los niveles de nombre). Mismas entradas → mismo orden.
 *
 * Prioridad (pesos decrecientes):
 *  1. nombre normalizado == consulta (exacto)
 *  2. el nombre EMPIEZA con la consulta
 *  3. término fuerte del nombre (palabra completa del nombre)
 *  4. categoría inferida coincide
 *  5. término / actividad oficial coincide (índice del lugar)
 *  6. bono por múltiples términos coincidentes
 *  7. distancia (solo con origen válido; peso pequeño)
 *  8. completitud (desempate menor)
 *  9. desempate final estable: nombre y luego id
 */

const W_EXACT_NAME = 1000;
const W_NAME_PREFIX = 500;
const W_NAME_TOKEN = 200;
const W_CATEGORY = 80;
const W_TERM = 30;
const W_MULTI_TERM = 10;
const W_COMPLETENESS = 5;
const DISTANCE_HORIZON_KM = 8;
const W_DISTANCE_BASE = 15;
const W_DISTANCE_NEARBY = 40;
const NEARBY_KM = 2;

function wordSet(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter((w) => w.length > 0));
}

interface Relevance {
  score: number;
  reasons: RecommendationReason[];
}

function relevanceOf(place: LocavoPlace, intent: SearchIntent): Relevance {
  const name = place.normalizedName;
  const nameWords = wordSet(name);
  const index = buildPlaceSearchIndex(place);
  const reasons: RecommendationReason[] = [];
  let score = 0;

  const exactName = intent.searchText.length > 0 && name === intent.searchText;
  const namePrefix = intent.searchText.length > 0 && name.startsWith(intent.searchText);

  // Términos que aparecen como palabra completa del nombre / en el índice.
  const nameTokenHits = intent.terms.filter((term) => nameWords.has(term));
  const indexHits = intent.terms.filter((term) => index.includes(term));
  const categoryHit = intent.categories.includes(place.category);

  if (exactName) {
    score += W_EXACT_NAME;
    reasons.push('EXACT_NAME_MATCH');
  } else if (namePrefix) {
    score += W_NAME_PREFIX;
    reasons.push('NAME_MATCH');
  } else if (nameTokenHits.length > 0) {
    score += W_NAME_TOKEN;
    reasons.push(categoryHit || indexHits.length > nameTokenHits.length ? 'NAME_AND_ACTIVITY' : 'NAME_MATCH');
  } else if (categoryHit) {
    score += W_CATEGORY;
    reasons.push('CATEGORY_MATCH');
  } else if (indexHits.length > 0) {
    score += W_TERM;
    reasons.push('TERM_MATCH');
  }

  if (categoryHit && !reasons.includes('EXACT_NAME_MATCH')) {
    score += W_CATEGORY / 2;
  }
  score += indexHits.length * W_TERM;
  if (indexHits.length > 1) {
    score += (indexHits.length - 1) * W_MULTI_TERM;
  }
  score += completenessOf(place) * W_COMPLETENESS;

  return { score, reasons };
}

/**
 * Ordena resultados YA filtrados por relevancia de búsqueda. `origin` es el
 * ancla de distancia (ubicación real o zona seleccionada). La distancia solo
 * suma peso; nunca supera la relevancia del nombre.
 */
export function rankSearchResults(
  places: readonly LocavoPlace[],
  intent: SearchIntent,
  origin: Coordinates,
  now: Date,
): ScoredPlace[] {
  const scored = places.map((place) => {
    const distanceKm = haversineKm(origin, place.coordinates);
    const status = evaluateOpenStatus(place.hours ?? null, now);
    const { score: relScore, reasons } = relevanceOf(place, intent);

    const distanceWeight = intent.nearby ? W_DISTANCE_NEARBY : W_DISTANCE_BASE;
    const distanceScore = Math.max(0, 1 - distanceKm / DISTANCE_HORIZON_KM) * distanceWeight;

    const finalReasons = [...reasons];
    // Cercanía: solo verdad — está cerca del ancla (ubicación o zona).
    if (intent.nearby && distanceKm <= NEARBY_KM) {
      finalReasons.push('NEARBY');
    }
    // "Abierto ahora" SOLO con horario real confirmado (nunca inventado).
    if (status.state === 'open') {
      finalReasons.unshift('OPEN_NOW');
    }

    return {
      place,
      distanceKm,
      travelMinutes: estimateTravelMinutes(distanceKm),
      status,
      score: relScore + distanceScore,
      reasons: finalReasons,
    } satisfies ScoredPlace;
  });

  return scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Con intención de cercanía la distancia desempata; si no, orden estable.
    if (intent.nearby && a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    if (a.place.normalizedName !== b.place.normalizedName) {
      return a.place.normalizedName < b.place.normalizedName ? -1 : 1;
    }
    return a.place.id < b.place.id ? -1 : 1;
  });
}
