/**
 * Mapa INTENCIÓN → categoría Locavo (Intent Engine V1). Locavo tiene 8
 * categorías; solo las intenciones que mapean a una rutean al Decision Engine.
 * Las intenciones reconocidas SIN categoría (cajero, hospital, aeropuerto…) y
 * las desconocidas caen a la búsqueda universal (fallback), nunca se bloquean.
 */
import type { CategoryId } from '../domain/place';
import type { SearchIntentId } from './types';

export const INTENT_CATEGORY: Readonly<Partial<Record<SearchIntentId, CategoryId>>> = {
  FOOD: 'food',
  COFFEE: 'coffee',
  BEER: 'beer',
  LODGING: 'lodging',
  FUEL: 'gas',
  PHARMACY: 'pharmacy',
  SHOPPING: 'store',
  NIGHTLIFE: 'nightlife',
  SUPERMARKET: 'store',
  CONVENIENCE_STORE: 'store',
  // Sin categoría Locavo (reconocidas pero sin datos propios → búsqueda universal):
  // TOURIST_ATTRACTION, ATM, HOSPITAL, PARKING, PUBLIC_RESTROOM, EV_CHARGING,
  // AIRPORT, BUS_STATION, TAXI, POLICE, FIRE_DEPARTMENT, BANK.
};

/** Orden canónico de desempate cuando dos intenciones empatan en puntaje. */
export const SEARCH_INTENT_ORDER: readonly SearchIntentId[] = [
  'FOOD', 'COFFEE', 'BEER', 'LODGING', 'FUEL', 'PHARMACY', 'SHOPPING', 'NIGHTLIFE',
  'SUPERMARKET', 'CONVENIENCE_STORE', 'TOURIST_ATTRACTION', 'ATM', 'HOSPITAL',
  'PARKING', 'PUBLIC_RESTROOM', 'EV_CHARGING', 'AIRPORT', 'BUS_STATION', 'TAXI',
  'POLICE', 'FIRE_DEPARTMENT', 'BANK',
];

export function categoryForIntent(intent: SearchIntentId): CategoryId | null {
  return INTENT_CATEGORY[intent] ?? null;
}
