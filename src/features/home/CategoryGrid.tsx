import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { categoryLabelKey, type CategoryMeta } from '../../domain/categories';
import { useI18n } from '../../i18n/I18nContext';
import { getCategoryVisual } from '../../theme/categoryColors';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';

/**
 * Retícula compacta de categorías del inicio (Home above-the-fold).
 *
 * Un ÚNICO panel de decisión: las 8 categorías primarias en 4 columnas × 2
 * filas, visibles juntas sin scroll ni carrusel ni "ver más". Cada baldosa
 * es un icono dominante en su contenedor de color + etiqueta localizada
 * debajo, con estado presionado y escala sutil. Sin dimensiones fijas por
 * pantalla: columnas de ancho igual (flex) que se adaptan a teléfonos
 * chicos/grandes, PWA y escalado de fuente.
 */
export const CATEGORY_GRID_COLUMNS = 4;

/** Límite de líneas de la etiqueta (evita romper la retícula con textos largos). */
export const CATEGORY_LABEL_LINES = 2;

export interface CategoryGridProps {
  categories: readonly CategoryMeta[];
  onSelect: (category: CategoryMeta) => void;
}

function chunkIntoRows<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size) as T[]);
  }
  return rows;
}

function CategoryTile({
  category,
  onSelect,
}: {
  category: CategoryMeta;
  onSelect: (category: CategoryMeta) => void;
}) {
  const { colors, scheme } = useAppTheme();
  const { t } = useI18n();
  const visual = getCategoryVisual(category.id, scheme);
  const label = t(categoryLabelKey(category.id));

  return (
    <Pressable
      onPress={() => onSelect(category)}
      accessibilityRole="button"
      accessibilityLabel={t('category.a11y', { label })}
      style={({ pressed }) => ({
        flex: 1,
        // Altura uniforme y cómoda; muy por encima del objetivo táctil 44×44.
        minHeight: 84,
        borderRadius: radii.card,
        backgroundColor: pressed ? colors.neutralSoft : colors.surface,
        borderWidth: 1,
        borderColor: pressed ? visual.solid : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xs,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: visual.holder,
        }}
      >
        <Ionicons
          name={category.icon as keyof typeof Ionicons.glyphMap}
          size={22}
          color={visual.icon}
        />
      </View>
      <AppText
        variant="label"
        numberOfLines={CATEGORY_LABEL_LINES}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={{ textAlign: 'center' }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export function CategoryGrid({ categories, onSelect }: CategoryGridProps) {
  const rows = useMemo(() => chunkIntoRows(categories, CATEGORY_GRID_COLUMNS), [categories]);

  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap: spacing.sm }}>
          {row.map((category) => (
            <CategoryTile key={category.id} category={category} onSelect={onSelect} />
          ))}
          {/* Relleno para mantener columnas iguales si la última fila no llena. */}
          {row.length < CATEGORY_GRID_COLUMNS
            ? Array.from({ length: CATEGORY_GRID_COLUMNS - row.length }).map((_, i) => (
                <View key={`spacer-${i}`} style={{ flex: 1 }} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}
