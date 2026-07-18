import type { CategoryId } from '../domain/place';

/**
 * Sistema de color por categoría (V2).
 *
 * Cada categoría tiene identidad cromática propia, pensada como sistema:
 * - `base`: color distintivo (iconos y acentos en modo oscuro, chips activos).
 * - `deep`: variante más profunda para iconos/texto sobre fondos claros.
 * - `onBase`: color de icono/texto cuando el fondo es el color sólido `base`.
 * - `tintDark` / `tintLight`: fondo del contenedor del icono por esquema.
 *
 * Los colores son acentos funcionales: la tarjeta permanece oscura/neutra y
 * solo el icon holder y pequeños acentos llevan el color.
 */
export interface CategoryPalette {
  base: string;
  deep: string;
  onBase: string;
  tintDark: string;
  tintLight: string;
}

export const CATEGORY_COLORS: Record<CategoryId, CategoryPalette> = {
  food: {
    base: '#FF6A45',
    deep: '#D8492A',
    onBase: '#FFFFFF',
    tintDark: '#3D241D',
    tintLight: '#FFE5DC',
  },
  beer: {
    base: '#F5B942',
    deep: '#9A6B10',
    onBase: '#231700',
    tintDark: '#3B301A',
    tintLight: '#FBEED2',
  },
  coffee: {
    base: '#7BCB4D',
    deep: '#448220',
    onBase: '#122905',
    tintDark: '#26391C',
    tintLight: '#E6F4DB',
  },
  lodging: {
    base: '#8E5BFF',
    deep: '#6B3BD8',
    onBase: '#FFFFFF',
    tintDark: '#2C2345',
    tintLight: '#EDE4FF',
  },
  pharmacy: {
    base: '#4A90FF',
    deep: '#2160C4',
    onBase: '#FFFFFF',
    tintDark: '#1D2A44',
    tintLight: '#DFEBFF',
  },
  gas: {
    base: '#31C7BD',
    deep: '#147A72',
    onBase: '#03211E',
    tintDark: '#16342F',
    tintLight: '#D8F4F1',
  },
  store: {
    base: '#E255A1',
    deep: '#B02D72',
    onBase: '#FFFFFF',
    tintDark: '#3A2230',
    tintLight: '#FBDFEE',
  },
  nightlife: {
    base: '#5B74E6',
    deep: '#3A4AA6',
    onBase: '#FFFFFF',
    tintDark: '#232A4A',
    tintLight: '#E2E7FA',
  },
};

/** Acento secundario opcional de Vida nocturna (uso muy puntual). */
export const NIGHTLIFE_ACCENT = '#FFD76A';

export interface CategoryVisual {
  /** Color del icono/acento sobre fondos neutros o tintados. */
  icon: string;
  /** Fondo del contenedor del icono. */
  holder: string;
  /** Color sólido de la categoría (chips activos, holder seleccionado). */
  solid: string;
  /** Icono/texto sobre el color sólido. */
  onSolid: string;
}

/** Resuelve los colores de una categoría para el esquema activo. */
export function getCategoryVisual(
  category: CategoryId,
  scheme: 'light' | 'dark',
): CategoryVisual {
  const palette = CATEGORY_COLORS[category];
  return {
    icon: scheme === 'dark' ? palette.base : palette.deep,
    holder: scheme === 'dark' ? palette.tintDark : palette.tintLight,
    solid: palette.base,
    onSolid: palette.onBase,
  };
}
