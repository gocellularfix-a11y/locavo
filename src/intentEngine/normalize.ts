/**
 * Normalización del Intent Engine (V1) — determinista y ReDoS-safe.
 *
 * Reutiliza `normalizeText` (minúsculas, sin acentos, espacios colapsados) y
 * además elimina apóstrofes ("i'm" → "im") y trata cualquier no-alfanumérico
 * como límite de palabra. Coincidencia por TOKEN/FRASE exacta, jamás substring
 * accidental ni difuso.
 */
import { normalizeText } from '../utils/text';

const APOSTROPHES = /['’`´]/g;
const NON_ALNUM = /[^a-z0-9]+/g;

export function normalizeIntentText(input: string): string {
  return normalizeText(input).replace(APOSTROPHES, '').replace(NON_ALNUM, ' ').trim();
}

export function intentTokens(input: string): string[] {
  const normalized = normalizeIntentText(input);
  return normalized.length === 0 ? [] : normalized.split(' ');
}

/** Palabras de relleno ignoradas al medir cobertura (no aportan intención). */
export const FILLER_WORDS: ReadonlySet<string> = new Set([
  // en
  'i', 'im', 'a', 'an', 'the', 'some', 'any', 'need', 'want', 'looking', 'for',
  'to', 'find', 'me', 'my', 'is', 'are', 'please', 'get', 'go', 'can', 'where',
  'somewhere', 'place', 'wanna', 'like',
  // es
  'un', 'una', 'el', 'la', 'los', 'las', 'algo', 'de', 'para', 'quiero',
  'necesito', 'busco', 'donde', 'puedo', 'me', 'por', 'favor', 'un poco',
  'ando', 'buscando', 'lugar',
  // pt
  'um', 'uma', 'o', 'os', 'as', 'quero', 'preciso', 'procuro', 'onde', 'posso',
  'estou', 'com', 'perto',
]);
