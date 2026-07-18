import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';
import { categoryLabelKey, getCategoryMeta } from '../domain/categories';
import type { CategoryId } from '../domain/place';
import { useI18n } from '../i18n/I18nContext';
import { getCategoryVisual } from '../theme/categoryColors';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

/**
 * Etiqueta compacta de categoría con su color distintivo:
 * icono + nombre (localizado) sobre fondo tintado.
 */
export function CategoryBadge({ category }: { category: CategoryId }) {
  const { scheme } = useAppTheme();
  const { t } = useI18n();
  const meta = getCategoryMeta(category);
  const visual = getCategoryVisual(category, scheme);
  const label = t(categoryLabelKey(category));

  return (
    <View
      accessible
      accessibilityLabel={t('category.badgeA11y', { label })}
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
        {label}
      </AppText>
    </View>
  );
}
