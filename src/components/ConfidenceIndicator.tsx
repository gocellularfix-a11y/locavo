import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';
import type { ConfidenceLevel } from '../domain/place';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

/**
 * Señal de confianza en lenguaje claro (sin porcentajes ni estrellas):
 * Alta confianza / Información reciente / Información limitada.
 */
export function confidenceLabel(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'Alta confianza';
    case 'medium':
      return 'Información reciente';
    case 'low':
      return 'Información limitada';
  }
}

export function ConfidenceIndicator({ level }: { level: ConfidenceLevel }) {
  const { colors } = useAppTheme();
  const color =
    level === 'high' ? colors.success : level === 'medium' ? colors.textSecondary : colors.warning;
  const icon: keyof typeof Ionicons.glyphMap =
    level === 'high' ? 'shield-checkmark' : level === 'medium' ? 'time' : 'alert-circle';

  return (
    <View
      accessible
      accessibilityLabel={`Confianza de la información: ${confidenceLabel(level)}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
    >
      <Ionicons name={icon} size={14} color={color} />
      <AppText variant="caption" color={color}>
        {confidenceLabel(level)}
      </AppText>
    </View>
  );
}
