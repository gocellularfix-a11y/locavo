import React from 'react';
import { View } from 'react-native';

import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { CategoryBadge } from './CategoryBadge';
import { StatusBadge } from './StatusBadge';
import { formatDistance, formatTravelTime } from '../domain/distance';
import { explainReasons, type ScoredPlace } from '../domain/recommendation';
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
  const { place, distanceKm, travelMinutes, status, reasons } = scored;

  return (
    <View
      accessible
      accessibilityLabel={`Mejor opción ahora: ${place.name}`}
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
        MEJOR OPCIÓN AHORA
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
          {formatDistance(distanceKm)} · {formatTravelTime(travelMinutes)}
        </AppText>
      </View>

      <AppText variant="body" tone="secondary">
        {explainReasons(reasons)}
      </AppText>

      <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
        <AppButton
          label="Cómo llegar"
          icon="navigate"
          onPress={() => onNavigate(scored)}
          accessibilityHint="Abre Google Maps con la ruta al lugar"
          style={{ flexGrow: 1 }}
        />
        <AppButton
          label="Detalles"
          variant="secondary"
          onPress={() => onDetails(scored)}
          accessibilityHint="Abre los detalles del lugar"
        />
      </View>
    </View>
  );
}
