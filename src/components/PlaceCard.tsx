import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from './AppText';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { StatusBadge } from './StatusBadge';
import { getCategoryMeta } from '../domain/categories';
import { formatDistance, formatTravelTime } from '../domain/distance';
import type { ScoredPlace } from '../domain/recommendation';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

export interface PlaceCardProps {
  scored: ScoredPlace;
  selected?: boolean;
  onPress: (scored: ScoredPlace) => void;
}

/** Tarjeta estándar de resultado: lo esencial para decidir, sin ruido. */
export function PlaceCard({ scored, selected = false, onPress }: PlaceCardProps) {
  const { colors } = useAppTheme();
  const { place, distanceKm, travelMinutes, status } = scored;
  const category = getCategoryMeta(place.category);

  return (
    <Pressable
      onPress={() => onPress(scored)}
      accessibilityRole="button"
      accessibilityLabel={`${place.name}, ${category.label}`}
      accessibilityHint="Abre los detalles del lugar"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        borderRadius: radii.card,
        backgroundColor: pressed ? colors.neutralSoft : colors.surface,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.brand : colors.border,
        padding: spacing.lg,
        gap: spacing.sm,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons
          name={category.icon as keyof typeof Ionicons.glyphMap}
          size={18}
          color={colors.brand}
        />
        <AppText variant="cardTitle" numberOfLines={1} style={{ flex: 1 }}>
          {place.name}
        </AppText>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}
      >
        <AppText variant="caption" tone="secondary">
          {category.label}
        </AppText>
        <StatusBadge status={status} />
      </View>

      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}
      >
        <AppText variant="body" tone="secondary">
          {formatDistance(distanceKm)} · {formatTravelTime(travelMinutes)}
        </AppText>
        <ConfidenceIndicator level={place.confidence} />
      </View>
    </Pressable>
  );
}
