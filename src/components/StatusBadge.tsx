import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';
import type { OpenStatus } from '../domain/openingHours';
import { describeOpenStatus } from '../domain/openingHours';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

export interface StatusBadgeProps {
  status: OpenStatus;
  /** Texto compacto ('Abierto') en lugar de 'Abierto hasta las…'. */
  compact?: boolean;
}

/**
 * Estado de apertura accesible: siempre combina texto + icono + color
 * (nunca depende solo del color).
 */
export function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  const { colors } = useAppTheme();

  const config = {
    open: {
      background: colors.successSoft,
      color: colors.success,
      icon: 'checkmark-circle' as const,
      compactLabel: 'Abierto',
    },
    closed: {
      background: colors.neutralSoft,
      color: colors.textSecondary,
      icon: 'close-circle' as const,
      compactLabel: 'Cerrado',
    },
    unknown: {
      background: colors.warningSoft,
      color: colors.warning,
      icon: 'help-circle' as const,
      compactLabel: 'Horario no confirmado',
    },
  }[status.state];

  const label = compact ? config.compactLabel : describeOpenStatus(status);

  return (
    <View
      accessible
      accessibilityLabel={describeOpenStatus(status)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: config.background,
        borderRadius: radii.chip,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        alignSelf: 'flex-start',
      }}
    >
      <Ionicons name={config.icon} size={14} color={config.color} />
      <AppText variant="label" color={config.color}>
        {label}
      </AppText>
    </View>
  );
}
