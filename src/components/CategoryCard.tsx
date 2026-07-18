import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable } from 'react-native';

import { AppText } from './AppText';
import type { CategoryMeta } from '../domain/categories';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

export interface CategoryCardProps {
  category: CategoryMeta;
  selected?: boolean;
  onPress: (category: CategoryMeta) => void;
}

/** Tarjeta de categoría: icono + nombre, con estado seleccionado en coral. */
export function CategoryCard({ category, selected = false, onPress }: CategoryCardProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={() => onPress(category)}
      accessibilityRole="button"
      accessibilityLabel={`Categoría ${category.label}`}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 92,
        borderRadius: radii.card,
        backgroundColor: selected
          ? pressed
            ? colors.brandPressed
            : colors.brand
          : pressed
            ? colors.neutralSoft
            : colors.surface,
        borderWidth: selected ? 0 : 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Ionicons
        name={category.icon as keyof typeof Ionicons.glyphMap}
        size={26}
        color={selected ? colors.onBrand : colors.brand}
      />
      <AppText
        variant="label"
        color={selected ? colors.onBrand : colors.textPrimary}
        numberOfLines={1}
      >
        {category.label}
      </AppText>
    </Pressable>
  );
}
