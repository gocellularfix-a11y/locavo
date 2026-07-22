/**
 * Mapa determinista de tags OSM → categoría canónica Locavo, y compatibilidad
 * de categoría (gate de candidatos). Documentado y versionable; NO expande el
 * alcance canónico más allá de V4F-0 (las 8 categorías del pilot).
 */
import type { LocavoCategory } from '../../domain/places/LocavoPlace';

/** amenity → categoría. */
const AMENITY: Record<string, LocavoCategory> = {
  restaurant: 'food',
  fast_food: 'food',
  food_court: 'food',
  cafe: 'coffee',
  ice_cream: 'coffee',
  bar: 'beer',
  pub: 'beer',
  biergarten: 'beer',
  nightclub: 'nightlife',
  fuel: 'gas',
  pharmacy: 'pharmacy',
};

/** shop → categoría. */
const SHOP: Record<string, LocavoCategory> = {
  convenience: 'store',
  supermarket: 'store',
  grocery: 'store',
  general: 'store',
  bakery: 'store',
  alcohol: 'beer',
  beverages: 'beer',
};

/** tourism → categoría. */
const TOURISM: Record<string, LocavoCategory> = {
  hotel: 'lodging',
  motel: 'lodging',
  hostel: 'lodging',
  guest_house: 'lodging',
  apartment: 'lodging',
};

/**
 * Categorías compatibles por categoría canónica DENUE. Un candidato OSM es
 * compatible si su categoría derivada pertenece al conjunto de la categoría
 * DENUE. Los conjuntos cubren solapamientos reales (bares ↔ vida nocturna).
 */
const COMPATIBILITY: Record<LocavoCategory, ReadonlySet<LocavoCategory>> = {
  food: new Set(['food']),
  coffee: new Set(['coffee']),
  beer: new Set(['beer', 'nightlife']),
  nightlife: new Set(['nightlife', 'beer']),
  pharmacy: new Set(['pharmacy']),
  gas: new Set(['gas']),
  store: new Set(['store']),
  lodging: new Set(['lodging']),
};

/** Categoría Locavo derivada de los tags OSM, o `null` si no mapea al pilot. */
export function osmCategoryOf(tags: Record<string, string>): LocavoCategory | null {
  const amenity = tags.amenity;
  if (amenity && amenity in AMENITY) {
    return AMENITY[amenity];
  }
  const shop = tags.shop;
  if (shop && shop in SHOP) {
    return SHOP[shop];
  }
  const tourism = tags.tourism;
  if (tourism && tourism in TOURISM) {
    return TOURISM[tourism];
  }
  return null;
}

/** ¿Es compatible una categoría OSM con la categoría canónica DENUE? */
export function categoryCompatible(
  denueCategory: LocavoCategory,
  osmCategory: LocavoCategory,
): boolean {
  return COMPATIBILITY[denueCategory].has(osmCategory);
}
