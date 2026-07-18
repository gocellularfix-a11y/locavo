import type { CategoryId } from './place';

/**
 * Catálogo cerrado de categorías del MVP (Fase 1).
 * `icon` es un nombre de Ionicons (única familia de iconos del proyecto).
 */
export interface CategoryMeta {
  id: CategoryId;
  label: string;
  icon: string;
  /** Términos que la búsqueda local asocia a la categoría (sin acentos no es necesario: se normalizan). */
  searchTerms: string[];
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'food',
    label: 'Comida',
    icon: 'restaurant',
    searchTerms: ['comida', 'tacos', 'taquería', 'restaurante', 'mariscos', 'birria', 'antojitos', 'cenaduría', 'sushi'],
  },
  {
    id: 'beer',
    label: 'Cerveza',
    icon: 'beer',
    searchTerms: ['cerveza', 'expendio', 'chelas', 'six', 'caguama', 'depósito', 'cervecería'],
  },
  {
    id: 'coffee',
    label: 'Café',
    icon: 'cafe',
    searchTerms: ['café', 'cafetería', 'coffee', 'espresso', 'capuchino'],
  },
  {
    id: 'lodging',
    label: 'Hospedaje',
    icon: 'bed',
    searchTerms: ['hotel', 'motel', 'hospedaje', 'habitación'],
  },
  {
    id: 'pharmacy',
    label: 'Farmacias',
    icon: 'medical',
    searchTerms: ['farmacia', 'medicina', 'medicamentos', 'botica'],
  },
  {
    id: 'gas',
    label: 'Gasolineras',
    icon: 'car',
    searchTerms: ['gasolina', 'gasolinera', 'combustible', 'diésel'],
  },
  {
    id: 'store',
    label: 'Tiendas',
    icon: 'storefront',
    searchTerms: ['tienda', 'abarrotes', 'súper', 'supermercado', 'conveniencia'],
  },
  {
    id: 'nightlife',
    label: 'Vida nocturna',
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
