import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { useI18n } from '../../i18n/I18nContext';
import { useAppTheme } from '../../theme/ThemeContext';
import type { StarRating } from './recommendationModel';

/** Puntuación de recomendación como escala visual de estrellas (nunca decimales). */
export function RecommendationScore({ stars }: { stars: StarRating }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  return (
    <View
      accessible
      accessibilityLabel={t('rec.stars.a11y', { stars })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= stars ? 'star' : 'star-outline'}
          size={14}
          color={i <= stars ? colors.accent : colors.textMuted}
        />
      ))}
    </View>
  );
}
