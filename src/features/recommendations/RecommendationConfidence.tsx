import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { useI18n } from '../../i18n/I18nContext';
import type { EvidenceConfidence } from '../../intelligence';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing } from '../../theme/tokens';
import { confidenceLabelKey } from './recommendationModel';

/**
 * Confianza de los DATOS, separada de la fuerza de la recomendación. Sin
 * porcentajes; soporta el nivel `unknown` de V5.0.
 */
export function RecommendationConfidence({ level }: { level: EvidenceConfidence }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const color =
    level === 'high'
      ? colors.success
      : level === 'medium'
        ? colors.textSecondary
        : level === 'low'
          ? colors.warning
          : colors.textMuted;
  const icon: keyof typeof Ionicons.glyphMap =
    level === 'high'
      ? 'shield-checkmark'
      : level === 'medium'
        ? 'time'
        : level === 'low'
          ? 'alert-circle'
          : 'help-circle';
  const label = t(confidenceLabelKey(level));
  return (
    <View
      accessible
      accessibilityLabel={t('rec.confidence.a11y', { label })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
    >
      <Ionicons name={icon} size={14} color={color} />
      <AppText variant="caption" color={color}>
        {label}
      </AppText>
    </View>
  );
}
