import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { categoryLabelKey, type CategoryMeta } from '../../domain/categories';
import { useI18n } from '../../i18n/I18nContext';
import { getCategoryVisual } from '../../theme/categoryColors';
import { useAppTheme } from '../../theme/ThemeContext';
import { cardShadow, radii, spacing } from '../../theme/tokens';

export interface FeaturedCategoryCardProps {
  category: CategoryMeta;
  /** 'large' (primera fila) o 'medium' (segunda fila). */
  emphasis: 'large' | 'medium';
  onPress: (category: CategoryMeta) => void;
}

/**
 * Tarjeta destacada de categoría (V4A.2): usa el color establecido de la
 * categoría como fondo tintado y mayor peso visual que la retícula compacta.
 * Alturas mínimas relativas (sin dimensiones por pantalla) para mantener la
 * respuesta en teléfonos chicos, grandes, PWA y escalado de fuente.
 */
export function FeaturedCategoryCard({ category, emphasis, onPress }: FeaturedCategoryCardProps) {
  const { colors, scheme } = useAppTheme();
  const { t } = useI18n();
  const visual = getCategoryVisual(category.id, scheme);
  const label = t(categoryLabelKey(category.id));
  const large = emphasis === 'large';

  return (
    <Pressable
      onPress={() => onPress(category)}
      accessibilityRole="button"
      accessibilityLabel={t('category.a11y', { label })}
      style={({ pressed }) => [
        {
          flex: 1,
          minHeight: large ? 136 : 112,
          borderRadius: radii.cardLarge,
          backgroundColor: visual.holder,
          borderWidth: 1,
          borderColor: pressed ? visual.solid : colors.border,
          padding: spacing.lg,
          justifyContent: 'space-between',
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        cardShadow,
      ]}
    >
      <View
        style={{
          width: large ? 52 : 46,
          height: large ? 52 : 46,
          borderRadius: large ? 16 : 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: visual.solid,
        }}
      >
        <Ionicons
          name={category.icon as keyof typeof Ionicons.glyphMap}
          size={large ? 26 : 22}
          color={visual.onSolid}
        />
      </View>
      <AppText variant={large ? 'cardTitle' : 'bodyStrong'} numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}
