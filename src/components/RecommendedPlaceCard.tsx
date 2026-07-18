import React from 'react';
import { View } from 'react-native';

import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { CategoryBadge } from './CategoryBadge';
import { StatusBadge } from './StatusBadge';
import {
  explainReasonsLocalized,
  formatDistanceLocalized,
  formatTravelTimeLocalized,
} from '../i18n/format';
import { useI18n } from '../i18n/I18nContext';
import type { ScoredPlace } from '../services/places/PlaceRankingService';
import { useAppTheme } from '../theme/ThemeContext';
import { cardShadow, radii, spacing } from '../theme/tokens';

export interface RecommendedPlaceCardProps {
  scored: ScoredPlace;
  onNavigate: (scored: ScoredPlace) => void;
  onDetails: (scored: ScoredPlace) => void;
}

/** Tarjeta destacada "Mejor opción ahora" con acento lateral coral. */
export function RecommendedPlaceCard({ scored, onNavigate, onDetails }: RecommendedPlaceCardProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useI18n();
  const { place, distanceKm, travelMinutes, status, reasons } = scored;

  return (
    <View
      accessible
      accessibilityLabel={t('recommend.bestOptionA11y', { name: place.name })}
      style={[
        {
          borderRadius: radii.cardLarge,
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: 5,
          borderLeftColor: colors.brand,
          padding: spacing.xl,
          gap: spacing.md,
        },
        cardShadow,
      ]}
    >
      <AppText variant="label" tone="brand">
        {t('recommend.bestOption')}
      </AppText>

      <View style={{ gap: spacing.sm }}>
        <AppText variant="section" numberOfLines={2}>
          {place.name}
        </AppText>
        <CategoryBadge category={place.category} />
      </View>

      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}
      >
        <StatusBadge status={status} />
        <AppText variant="bodyStrong" tone="secondary">
          {formatDistanceLocalized(distanceKm, locale)} ·{' '}
          {formatTravelTimeLocalized(travelMinutes, locale)}
        </AppText>
      </View>

      <AppText variant="body" tone="secondary">
        {explainReasonsLocalized(reasons, locale)}
      </AppText>

      <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
        <AppButton
          label={t('place.directions')}
          icon="navigate"
          onPress={() => onNavigate(scored)}
          accessibilityHint={t('place.directionsHint')}
          style={{ flexGrow: 1 }}
        />
        <AppButton
          label={t('recommend.details')}
          variant="secondary"
          onPress={() => onDetails(scored)}
          accessibilityHint={t('recommend.detailsHint')}
        />
      </View>
    </View>
  );
}
