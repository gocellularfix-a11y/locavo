import type { CategoryId } from './place';

/**
 * Catálogo cerrado de categorías del MVP.
 *
 * Los IDs internos NUNCA cambian; la presentación (nombre visible) se
 * resuelve por i18n con la clave `category.{id}`. `icon` es un nombre de
 * Ionicons (única familia de iconos del proyecto).
 */
export interface CategoryMeta {
  id: CategoryId;
  icon: string;
  /**
   * Términos semilla (español) que la búsqueda indexa por lugar. Los demás
   * idiomas se cubren con el Search Alias Engine (i18n/searchAliases.ts).
   */
  searchTerms: string[];
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'food',
    icon: 'restaurant',
    searchTerms: ['comida', 'tacos', 'taquería', 'restaurante', 'mariscos', 'birria', 'antojitos', 'cenaduría', 'sushi'],
  },
  {
    id: 'beer',
    icon: 'beer',
    searchTerms: ['cerveza', 'expendio', 'chelas', 'six', 'caguama', 'depósito', 'cervecería'],
  },
  {
    id: 'coffee',
    icon: 'cafe',
    searchTerms: ['café', 'cafetería', 'coffee', 'espresso', 'capuchino'],
  },
  {
    id: 'lodging',
    icon: 'bed',
    searchTerms: ['hotel', 'motel', 'hospedaje', 'habitación'],
  },
  {
    id: 'pharmacy',
    icon: 'medical',
    searchTerms: ['farmacia', 'medicina', 'medicamentos', 'botica'],
  },
  {
    id: 'gas',
    icon: 'car',
    searchTerms: ['gasolina', 'gasolinera', 'combustible', 'diésel'],
  },
  {
    id: 'store',
    icon: 'storefront',
    searchTerms: ['tienda', 'abarrotes', 'súper', 'supermercado', 'conveniencia'],
  },
  {
    id: 'nightlife',
    icon: 'moon',
    searchTerms: ['antro', 'bar', 'cantina', 'vida nocturna', 'noche', 'música'],
  },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategoryMeta(id: CategoryId): CategoryMeta {
  const meta = BY_ID.get(id);
  if (!meta) {
    throw new Error(`Categoría desconocida: ${id}`);
  }
  return meta;
}

export function isCategoryId(value: string): value is CategoryId {
  return BY_ID.has(value as CategoryId);
}

/** Clave i18n del nombre visible de una categoría. */
export function categoryLabelKey(id: CategoryId): `category.${CategoryId}` {
  return `category.${id}`;
}
