import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { useI18n } from '../../i18n/I18nContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';
import { badgeLabelKey, type RecommendationBadge } from './recommendationModel';

/** Máximo de insignias mostradas (las más relevantes van primero por construcción). */
const MAX_BADGES = 3;

export function RecommendationBadges({ badges }: { badges: readonly RecommendationBadge[] }) {
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
            backgroundColor: colors.brandSoft,
            borderRadius: radii.chip,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
          }}
        >
          <AppText variant="caption" color={colors.brand}>
            {t(badgeLabelKey(badge))}
          </AppText>
        </View>
      ))}
    </View>
  );
}
