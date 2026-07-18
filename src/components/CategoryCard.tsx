import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from './AppText';
import type { CategoryMeta } from '../domain/categories';
import { getCategoryVisual } from '../theme/categoryColors';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

export interface CategoryCardProps {
  category: CategoryMeta;
  selected?: boolean;
  onPress: (category: CategoryMeta) => void;
}

/**
 * Tarjeta de categoría (V2): tarjeta neutra con icon holder del color
 * distintivo de la categoría. El color vive en el holder, no en toda la
 * tarjeta, para mantener el diseño sobrio.
 */
export function CategoryCard({ category, selected = false, onPress }: CategoryCardProps) {
  const { colors, scheme } = useAppTheme();
  const visual = getCategoryVisual(category.id, scheme);

  return (
    <Pressable
      onPress={() => onPress(category)}
      accessibilityRole="button"
      accessibilityLabel={`Categoría ${category.label}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 104,
        borderRadius: radii.card,
        backgroundColor: pressed ? colors.neutralSoft : colors.surface,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? visual.solid : colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.md,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? visual.solid : visual.holder,
        }}
      >
        <Ionicons
          name={category.icon as keyof typeof Ionicons.glyphMap}
          size={24}
          color={selected ? visual.onSolid : visual.icon}
        />
      </View>
      <AppText variant="label" numberOfLines={1}>
        {category.label}
      </AppText>
    </Pressable>
  );
}
