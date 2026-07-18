import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';
import type { OpenStatus } from '../domain/openingHours';
import { openStatusText } from '../i18n/format';
import { useI18n } from '../i18n/I18nContext';
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
  const { t, locale } = useI18n();

  const config = {
    open: {
      background: colors.successSoft,
      color: colors.success,
      icon: 'checkmark-circle' as const,
      compactLabel: t('status.open'),
    },
    closed: {
      background: colors.neutralSoft,
      color: colors.textSecondary,
      icon: 'close-circle' as const,
      compactLabel: t('status.closed'),
    },
    unknown: {
      background: colors.warningSoft,
      color: colors.warning,
      icon: 'help-circle' as const,
      compactLabel: t('status.unknown'),
    },
  }[status.state];

  const fullText = openStatusText(status, locale);
  const label = compact ? config.compactLabel : fullText;

  return (
    <View
      accessible
      accessibilityLabel={fullText}
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
