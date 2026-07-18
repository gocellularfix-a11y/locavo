import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';
import type { ConfidenceLevel } from '../domain/places/LocavoPlace';
import { confidenceText } from '../i18n/format';
import { useI18n } from '../i18n/I18nContext';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

/**
 * Señal de confianza en lenguaje claro (sin porcentajes ni estrellas),
 * localizada según el idioma activo.
 */
export function ConfidenceIndicator({ level }: { level: ConfidenceLevel }) {
  const { colors } = useAppTheme();
  const { t, locale } = useI18n();
  const color =
    level === 'high' ? colors.success : level === 'medium' ? colors.textSecondary : colors.warning;
  const icon: keyof typeof Ionicons.glyphMap =
    level === 'high' ? 'shield-checkmark' : level === 'medium' ? 'time' : 'alert-circle';
  const label = confidenceText(level, locale);

  return (
    <View
      accessible
      accessibilityLabel={t('confidence.a11y', { label })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
    >
      <Ionicons name={icon} size={14} color={color} />
      <AppText variant="caption" color={color}>
        {label}
      </AppText>
    </View>
  );
}
