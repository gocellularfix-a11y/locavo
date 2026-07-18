import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';
import { getCategoryMeta } from '../domain/categories';
import type { CategoryId } from '../domain/place';
import { getCategoryVisual } from '../theme/categoryColors';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

/**
 * Etiqueta compacta de categoría con su color distintivo:
 * icono + nombre sobre fondo tintado. Acento funcional, no ruido.
 */
export function CategoryBadge({ category }: { category: CategoryId }) {
  const { scheme } = useAppTheme();
  const meta = getCategoryMeta(category);
  const visual = getCategoryVisual(category, scheme);

  return (
    <View
      accessible
      accessibilityLabel={`Categoría: ${meta.label}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: visual.holder,
        borderRadius: radii.chip,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        alignSelf: 'flex-start',
      }}
    >
      <Ionicons
        name={meta.icon as keyof typeof Ionicons.glyphMap}
        size={14}
        color={visual.icon}
      />
      <AppText variant="label" color={visual.icon}>
        {meta.label}
      </AppText>
    </View>
  );
}
