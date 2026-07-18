import { getCategoryMeta } from './categories';
import type { Place } from './place';
import { normalizeText, tokenize } from '../utils/text';

/**
 * Búsqueda local, rápida y sin conexión.
 *
 * Cada token de la consulta debe coincidir (subcadena) con el índice del
 * lugar: nombre, dirección, etiqueta de categoría, términos de categoría
 * o palabras clave. Insensible a acentos, mayúsculas y espacios extra.
 */
export function buildSearchIndex(place: Place): string {
  const category = getCategoryMeta(place.category);
  return normalizeText(
    [place.name, place.address, category.label, ...category.searchTerms, ...place.keywords].join(' '),
  );
}

export function searchPlaces(places: Place[], query: string): Place[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return [...places];
  }
  return places.filter((place) => {
    const index = buildSearchIndex(place);
    return tokens.every((token) => index.includes(token));
  });
}
