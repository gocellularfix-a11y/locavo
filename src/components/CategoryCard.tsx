import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from './AppText';
import { categoryLabelKey, type CategoryMeta } from '../domain/categories';
import { useI18n } from '../i18n/I18nContext';
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
 * distintivo de la categoría. El nombre visible se resuelve por i18n.
 */
export function CategoryCard({ category, selected = false, onPress }: CategoryCardProps) {
  const { colors, scheme } = useAppTheme();
  const { t } = useI18n();
  const visual = getCategoryVisual(category.id, scheme);
  const label = t(categoryLabelKey(category.id));

  return (
    <Pressable
      onPress={() => onPress(category)}
      accessibilityRole="button"
      accessibilityLabel={t('category.a11y', { label })}
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
        {label}
      </AppText>
    </Pressable>
  );
}
