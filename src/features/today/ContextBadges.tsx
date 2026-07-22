import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import type { ContextBadge } from '../../context';
import { useI18n } from '../../i18n/I18nContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';
import { contextBadgeLabelKey } from './todayLabels';

const MAX_BADGES = 3;

/** Insignias de CONTEXTO (por qué "ahora"): estilo sutil con punto de acento. */
export function ContextBadges({ badges }: { badges: readonly ContextBadge[] }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  if (badges.length === 0) {
    return null;
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      {badges.slice(0, MAX_BADGES).map((badge) => (
        <View
          key={badge}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.chip,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
          <AppText variant="caption" tone="secondary">
            {t(contextBadgeLabelKey(badge))}
          </AppText>
        </View>
      ))}
    </View>
  );
}
