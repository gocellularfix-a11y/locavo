import type { CategoryId } from '../../domain/place';
import { expandQueryToCategories } from '../../i18n/searchAliases';

/**
 * Normalizador de categorías (V3).
 *
 * Convierte señales de fuentes externas a las 8 categorías canónicas de
 * Locavo. Reglas iniciales demostrables y probadas; se ampliarán cuando se
 * conecten datos reales. Nunca se ejecuta dentro de componentes UI.
 */

export type CategoryMatchedBy = 'scian_code' | 'osm_tag' | 'name_keyword';

export interface CategoryNormalizationInput {
  /** Código de actividad SCIAN (DENUE), p. ej. '722511'. */
  scianCode?: string;
  /** Tags de OpenStreetMap (amenity, shop, tourism, leisure…). */
  osmTags?: Record<string, string>;
  /** Nombre o descripción de actividad, como último recurso. */
  name?: string;
}

export interface CategoryNormalizationResult {
  category: CategoryId;
  confidence: number;
  matchedBy: CategoryMatchedBy;
}

/**
 * Prefijos SCIAN iniciales (más específico gana). Referencia: catálogo
 * SCIAN 2023 usado por DENUE. Se ampliará con la importación real.
 */
const SCIAN_PREFIXES: [prefix: string, category: CategoryId, confidence: number][] = [
  ['722412', 'nightlife', 0.95], // bares, cantinas
  ['722411', 'nightlife', 0.95], // centros nocturnos
  ['46121', 'beer', 0.92], // bebidas alcohólicas al por menor (incl. cerveza)
  ['7225', 'food', 0.94], // restaurantes
  ['7224', 'nightlife', 0.9], // servicios de bebidas alcohólicas
  ['7211', 'lodging', 0.95], // hoteles y moteles
  ['46411', 'pharmacy', 0.96], // farmacias
  ['468411', 'gas', 0.96], // gasolineras
  ['4611', 'store', 0.85], // abarrotes y alimentos al por menor
  ['4622', 'store', 0.85], // tiendas de autoservicio
  ['4631', 'store', 0.7], // otros comercios al por menor
];

/** Tags OSM iniciales (clave=valor → categoría). */
const OSM_TAG_RULES: [key: string, value: string, category: CategoryId, confidence: number][] = [
  ['amenity', 'restaurant', 'food', 0.95],
  ['amenity', 'fast_food', 'food', 0.92],
  ['amenity', 'food_court', 'food', 0.9],
  ['amenity', 'cafe', 'coffee', 0.95],
  ['amenity', 'bar', 'nightlife', 0.92],
  ['amenity', 'pub', 'nightlife', 0.92],
  ['amenity', 'nightclub', 'nightlife', 0.95],
  ['amenity', 'biergarten', 'beer', 0.9],
  ['amenity', 'pharmacy', 'pharmacy', 0.96],
  ['amenity', 'fuel', 'gas', 0.96],
  ['shop', 'alcohol', 'beer', 0.9],
  ['shop', 'beverages', 'beer', 0.8],
  ['shop', 'convenience', 'store', 0.92],
  ['shop', 'supermarket', 'store', 0.94],
  ['shop', 'general', 'store', 0.7],
  ['tourism', 'hotel', 'lodging', 0.95],
  ['tourism', 'motel', 'lodging', 0.93],
  ['tourism', 'guest_house', 'lodging', 0.9],
  ['tourism', 'hostel', 'lodging', 0.9],
];

const NAME_KEYWORD_CONFIDENCE = 0.55;

export function normalizeCategory(
  input: CategoryNormalizationInput,
): CategoryNormalizationResult | null {
  // 1. SCIAN: gana el prefijo coincidente más largo.
  if (input.scianCode) {
    const code = input.scianCode.trim();
    const match = SCIAN_PREFIXES.filter(([prefix]) => code.startsWith(prefix)).sort(
      (a, b) => b[0].length - a[0].length,
    )[0];
    if (match) {
      return { category: match[1], confidence: match[2], matchedBy: 'scian_code' };
    }
  }

  // 2. Tags de OSM (en orden de la tabla de reglas).
  if (input.osmTags) {
    for (const [key, value, category, confidence] of OSM_TAG_RULES) {
      if (input.osmTags[key] === value) {
        return { category, confidence, matchedBy: 'osm_tag' };
      }
    }
  }

  // 3. Palabras del nombre/actividad mediante el Search Alias Engine.
  if (input.name) {
    const categories = expandQueryToCategories(input.name);
    if (categories.length === 1) {
      return {
        category: categories[0],
        confidence: NAME_KEYWORD_CONFIDENCE,
        matchedBy: 'name_keyword',
      };
    }
  }

  return null;
}
