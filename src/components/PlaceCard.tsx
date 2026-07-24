import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from './AppText';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { StatusBadge } from './StatusBadge';
import { categoryLabelKey, getCategoryMeta } from '../domain/categories';
import { confidenceLevelOf } from '../domain/places/LocavoPlace';
import { formatDistanceWithOriginLocalized, formatTravelTimeLocalized } from '../i18n/format';
import { useI18n } from '../i18n/I18nContext';
import type { ScoredPlace } from '../services/places/PlaceRankingService';
import { useDistanceOrigin } from '../state/LocationContext';
import { getCategoryVisual } from '../theme/categoryColors';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

export interface PlaceCardProps {
  scored: ScoredPlace;
  selected?: boolean;
  onPress: (scored: ScoredPlace) => void;
}

/** Tarjeta estándar de resultado: lo esencial para decidir, sin ruido. */
export function PlaceCard({ scored, selected = false, onPress }: PlaceCardProps) {
  const { colors, scheme } = useAppTheme();
  const { t, locale } = useI18n();
  const origin = useDistanceOrigin();
  const { place, distanceKm, travelMinutes, status } = scored;
  const category = getCategoryMeta(place.category);
  const visual = getCategoryVisual(place.category, scheme);
  const categoryLabel = t(categoryLabelKey(place.category));

  return (
    <Pressable
      onPress={() => onPress(scored)}
      accessibilityRole="button"
      accessibilityLabel={t('place.cardA11y', { name: place.name, category: categoryLabel })}
      accessibilityHint={t('place.cardHint')}
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
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: visual.holder,
          }}
        >
          <Ionicons
            name={category.icon as keyof typeof Ionicons.glyphMap}
            size={17}
            color={visual.icon}
          />
        </View>
        <AppText variant="cardTitle" numberOfLines={1} style={{ flex: 1 }}>
          {place.name}
        </AppText>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>

      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}
      >
        <AppText variant="caption" tone="secondary">
          {categoryLabel}
        </AppText>
        <StatusBadge status={status} />
      </View>

      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}
      >
        <AppText variant="body" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
          {formatDistanceWithOriginLocalized(distanceKm, origin, locale)} ·{' '}
          {formatTravelTimeLocalized(travelMinutes, locale)}
        </AppText>
        <ConfidenceIndicator level={confidenceLevelOf(place.verification.confidence)} />
      </View>
    </Pressable>
  );
}
