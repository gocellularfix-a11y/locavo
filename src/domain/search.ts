import { getCategoryMeta } from './categories';
import type { LocavoPlace } from './places/LocavoPlace';
import { aliasCategoriesOf } from '../i18n/searchAliases';
import { normalizeText, tokenize } from '../utils/text';

/**
 * Búsqueda local, rápida y sin conexión sobre el modelo canónico.
 *
 * Un token coincide si:
 * - es subcadena del índice del lugar (nombre normalizado, dirección,
 *   términos internos), o
 * - es un alias multilenguaje de la categoría del lugar
 *   ("beer", "啤酒" y "cerveza" encuentran lugares de `beer`).
 *
 * Insensible a acentos, mayúsculas y espacios extra. Los nombres
 * comerciales nunca se traducen: se indexan tal cual.
 */
export function buildPlaceSearchIndex(place: LocavoPlace): string {
  const category = getCategoryMeta(place.category);
  return normalizeText(
    [
      place.normalizedName,
      place.address?.formatted ?? '',
      place.address?.neighborhood ?? '',
      ...category.searchTerms,
      ...(place.searchTerms ?? []),
    ].join(' '),
  );
}

export function placeMatchesQuery(place: LocavoPlace, query: string): boolean {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return true;
  }
  // Frase completa como alias ("gas station", "vida nocturna", "vie nocturne").
  if (aliasCategoriesOf(query).includes(place.category)) {
    return true;
  }
  const index = buildPlaceSearchIndex(place);
  return tokens.every(
    (token) => index.includes(token) || aliasCategoriesOf(token).includes(place.category),
  );
}

export function searchPlaces(places: LocavoPlace[], query: string): LocavoPlace[] {
  return places.filter((place) => placeMatchesQuery(place, query));
}
