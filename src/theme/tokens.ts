/**
 * Tokens de diseño de Locavo (dirección visual obligatoria de Fase 1).
 * Color principal: naranja coral. El amarillo es acento limitado.
 */

export interface ColorPalette {
  background: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  brand: string;
  brandPressed: string;
  onBrand: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  border: string;
  mapOverlay: string;
  /** Fondos suaves derivados para chips/tarjetas de estado. */
  brandSoft: string;
  successSoft: string;
  warningSoft: string;
  dangerSoft: string;
  neutralSoft: string;
}

export const lightColors: ColorPalette = {
  background: '#F7F7F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#171717',
  textSecondary: '#666666',
  textMuted: '#929292',
  brand: '#FF5A36',
  brandPressed: '#E94A28',
  onBrand: '#FFFFFF',
  accent: '#FFC83D',
  success: '#168A55',
  warning: '#D98C00',
  danger: '#D64545',
  border: '#E7E7E3',
  mapOverlay: 'rgba(23, 23, 23, 0.08)',
  brandSoft: '#FFEDE8',
  successSoft: '#E3F3EB',
  warningSoft: '#FCF0DA',
  dangerSoft: '#FBE7E7',
  neutralSoft: '#F0F0EC',
};

export const darkColors: ColorPalette = {
  background: '#111210',
  surface: '#1A1B18',
  surfaceElevated: '#22231F',
  textPrimary: '#F7F7F2',
  textSecondary: '#B8B8B0',
  textMuted: '#85857E',
  brand: '#FF6A45',
  brandPressed: '#E95533',
  onBrand: '#FFFFFF',
  accent: '#FFD15A',
  success: '#45C487',
  warning: '#F0AD35',
  danger: '#F06A6A',
  border: '#30312C',
  mapOverlay: 'rgba(255, 255, 255, 0.08)',
  brandSoft: '#3A231D',
  successSoft: '#1C3328',
  warningSoft: '#3A2F1A',
  dangerSoft: '#3A2222',
  neutralSoft: '#262723',
};

/** Escala de espaciado base. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Radios: tarjetas 18–24, botones 14–18, chips redondos. */
export const radii = {
  button: 16,
  card: 20,
  cardLarge: 24,
  chip: 999,
  input: 18,
} as const;

export interface TypeVariant {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
}

export const typography: Record<
  'display' | 'title' | 'section' | 'cardTitle' | 'body' | 'bodyStrong' | 'label' | 'caption',
  TypeVariant
> = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' },
  section: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
};

/** Familia por peso (Inter, cargada con expo-font). */
export const fontFamilies: Record<TypeVariant['fontWeight'], string> = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
};

/** Duraciones de animación (rápidas por diseño). */
export const motion = {
  fast: 150,
  normal: 220,
} as const;

/** Sombra suave para tarjetas (se usa con moderación). */
export const cardShadow = {
  shadowColor: '#171717',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
