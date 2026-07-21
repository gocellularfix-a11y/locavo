import type { CategoryId } from './place';
import { normalizeQuery, tokenVariants } from './queryNormalizer';
import type { SearchIntent } from './searchIntent';
import {
  hasOpen24hPhrase,
  isFillerToken,
  isIntentOnlyToken,
  isNearbyToken,
  isOpenNowToken,
  subtypeCategoryOf,
} from './searchLexicon';
import { aliasCategoriesOf } from '../i18n/searchAliases';
import { tokenize } from '../utils/text';

/**
 * Intérprete de consultas (V4D): convierte texto libre en `SearchIntent`.
 *
 * Determinista y conservador (no sobreinterpreta): clasifica cada token como
 * cercanía, "abierto ahora", relleno, palabra de intención o término de
 * búsqueda, e infiere categorías por alias multilenguaje + subtipo. Los
 * nombres de negocio se conservan como términos; la intención de categoría
 * jamás los reemplaza (el ranking hace que el nombre pese más).
 */
export function interpretQuery(raw: string): SearchIntent {
  const normalized = normalizeQuery(raw);
  const allTokens = tokenize(normalized);

  const categories = new Set<CategoryId>();
  const terms: string[] = [];
  const removed: string[] = [];
  let nearby = false;
  let openNow = hasOpen24hPhrase(normalized);

  // Frase completa como alias de categoría ("vida nocturna", "gas station").
  for (const category of aliasCategoriesOf(normalized)) {
    categories.add(category);
  }

  for (const token of allTokens) {
    if (isNearbyToken(token)) {
      nearby = true;
      removed.push(token);
      continue;
    }
    if (isOpenNowToken(token)) {
      openNow = true;
      removed.push(token);
      continue;
    }
    if (isFillerToken(token)) {
      removed.push(token);
      continue;
    }

    // Inferencia de categoría por alias directo o subtipo (con singular/plural).
    for (const variant of tokenVariants(token)) {
      for (const category of aliasCategoriesOf(variant)) {
        categories.add(category);
      }
      const subtype = subtypeCategoryOf(variant);
      if (subtype) {
        categories.add(subtype);
      }
    }

    // Palabra de intención pura ("hambre", "dormir"): infiere categoría pero
    // NO es término de búsqueda (ningún negocio se llama así).
    if (isIntentOnlyToken(token)) {
      removed.push(token);
      continue;
    }

    terms.push(token);
  }

  // Orden determinista (alfabético) para estabilidad entre corridas.
  const orderedCategories = [...categories].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return {
    raw,
    normalized,
    terms,
    searchText: terms.join(' '),
    categories: orderedCategories,
    nearby,
    openNow,
    removed,
    hasText: normalized.length > 0,
  };
}
