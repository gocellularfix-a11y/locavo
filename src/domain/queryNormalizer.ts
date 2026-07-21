import { normalizeText } from '../utils/text';

/**
 * Normalización de CONSULTAS de búsqueda (V4D).
 *
 * Sobre `normalizeText` (minúsculas, sin acentos, espacios colapsados) añade:
 * - limpieza de puntuación (signos, comas, "¿?", guiones sueltos → espacio);
 * - variantes singular/plural SEGURAS para consultar el léxico sin stemming
 *   agresivo (nunca produce coincidencias falsas: la variante solo se usa
 *   para BUSCAR en tablas; si no existe, no tiene efecto).
 */

/** Normaliza una consulta: sin acentos, minúsculas, sin puntuación. */
export function normalizeQuery(raw: string): string {
  // La puntuación se reemplaza por espacio ANTES de colapsar espacios.
  const withoutPunctuation = raw.replace(/[^\p{L}\p{N}\s]+/gu, ' ');
  return normalizeText(withoutPunctuation);
}

/**
 * Variantes singular/plural seguras de un token normalizado, para lookup en
 * el léxico. Solo quita 's'/'es' finales en palabras suficientemente largas
 * (farmacias→farmacia, gasolineras→gasolinera, cafes→cafe, tacos→taco). No
 * altera palabras cortas ni aplica reglas irregulares (sin falsos positivos:
 * las variantes que no existan en el léxico simplemente no coinciden).
 */
export function tokenVariants(token: string): string[] {
  const base = normalizeText(token);
  const variants = new Set<string>([base]);
  if (base.length > 4 && base.endsWith('es')) {
    variants.add(base.slice(0, -2));
  }
  if (base.length > 3 && base.endsWith('s')) {
    variants.add(base.slice(0, -1));
  }
  return [...variants];
}
