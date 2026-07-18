import type { CategoryId } from '../domain/place';
import { normalizeText, tokenize } from '../utils/text';

/**
 * Search Alias Engine (V3).
 *
 * Mapea términos de búsqueda en cualquiera de los idiomas soportados al
 * concepto interno (categoría canónica). Los IDs internos nunca cambian:
 * "restaurant", "restaurante" y "餐厅" apuntan todos a `food`.
 *
 * Los alias se normalizan (minúsculas, sin acentos) con la misma función
 * que usa la búsqueda, por lo que "Café" y "cafe" son equivalentes.
 */
const RAW_ALIASES: Record<CategoryId, string[]> = {
  food: [
    // es
    'comida', 'restaurante', 'tacos', 'antojitos', 'mariscos', 'cena', 'almuerzo',
    // en
    'food', 'restaurant', 'eat', 'dinner', 'lunch',
    // pt
    'restaurante', 'comida',
    // fr
    'restaurant', 'nourriture', 'manger',
    // it
    'ristorante', 'cibo', 'mangiare',
    // de
    'essen', 'restaurant',
    // zh-CN
    '餐厅', '美食', '吃饭', '饭店',
  ],
  beer: [
    'cerveza', 'chelas', 'expendio', 'caguama',
    'beer', 'brewery',
    'cerveja',
    'biere', 'bière', 'brasserie',
    'birra',
    'bier', 'brauerei',
    '啤酒',
  ],
  coffee: [
    'cafe', 'café', 'cafeteria', 'cafetería',
    'coffee', 'espresso', 'latte',
    'caffe', 'caffè',
    'kaffee',
    '咖啡', '咖啡店',
  ],
  lodging: [
    'hotel', 'hospedaje', 'motel', 'posada',
    'lodging', 'hostel', 'stay',
    'hospedagem', 'pousada',
    'hebergement', 'hébergement', 'hôtel',
    'albergo', 'alloggio',
    'unterkunft', 'herberge',
    '酒店', '旅馆', '住宿',
  ],
  pharmacy: [
    'farmacia', 'botica', 'medicinas',
    'pharmacy', 'drugstore', 'chemist',
    'farmacia', 'farmácia',
    'pharmacie',
    'apotheke',
    '药店', '药房',
  ],
  gas: [
    'gasolina', 'gasolinera', 'combustible',
    'gas', 'gas station', 'fuel', 'petrol',
    'posto de gasolina', 'combustivel', 'combustível',
    'essence', 'station service', 'station-service',
    'benzina', 'distributore',
    'tankstelle', 'benzin',
    '加油站', '汽油',
  ],
  store: [
    'tienda', 'abarrotes', 'super', 'súper', 'supermercado',
    'store', 'shop', 'supermarket', 'groceries', 'market',
    'loja', 'mercado',
    'magasin', 'supermarche', 'supermarché', 'epicerie', 'épicerie',
    'negozio', 'supermercato',
    'geschaft', 'geschäft', 'laden', 'supermarkt',
    '商店', '超市', '便利店',
  ],
  nightlife: [
    'antro', 'bar', 'cantina', 'vida nocturna', 'noche',
    'nightlife', 'nightclub', 'club', 'pub',
    'vida noturna', 'balada',
    'vie nocturne', 'boite', 'boîte',
    'vita notturna', 'discoteca',
    'nachtleben', 'kneipe', 'disco',
    '夜生活', '酒吧', '夜店',
  ],
};

/** Índice normalizado alias → categorías (un alias puede servir a varias). */
const ALIAS_INDEX: Map<string, Set<CategoryId>> = (() => {
  const index = new Map<string, Set<CategoryId>>();
  for (const [category, aliases] of Object.entries(RAW_ALIASES) as [CategoryId, string[]][]) {
    for (const alias of aliases) {
      const key = normalizeText(alias);
      if (!index.has(key)) {
        index.set(key, new Set());
      }
      index.get(key)!.add(category);
    }
  }
  return index;
})();

/** Categorías a las que apunta un término exacto (normalizado). */
export function aliasCategoriesOf(term: string): CategoryId[] {
  const found = ALIAS_INDEX.get(normalizeText(term));
  return found ? [...found] : [];
}

/**
 * Resuelve una consulta completa a categorías: primero la frase entera
 * ("gas station", "vida nocturna"), después token por token.
 */
export function expandQueryToCategories(query: string): CategoryId[] {
  const categories = new Set<CategoryId>(aliasCategoriesOf(query));
  for (const token of tokenize(query)) {
    for (const category of aliasCategoriesOf(token)) {
      categories.add(category);
    }
  }
  return [...categories];
}
