import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { CategoryBadge } from '../../components/CategoryBadge';
import { categoryLabelKey } from '../../domain/categories';
import { formatDistanceWithOriginLocalized } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nContext';
import { useDistanceOrigin } from '../../state/LocationContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';
import { RecommendationBadges } from './RecommendationBadges';
import { RecommendationConfidence } from './RecommendationConfidence';
import type { RecommendationCardModel, RecommendationOpenState } from './recommendationModel';
import { RecommendationReasons } from './RecommendationReasons';
import { RecommendationScore } from './RecommendationScore';

export interface RecommendationCardProps {
  model: RecommendationCardModel;
  onSelect: (placeId: string) => void;
}

function OpenPill({ state }: { state: RecommendationOpenState }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const map = {
    open: { key: 'rec.reason.openNow' as const, color: colors.success },
    closed: { key: 'rec.warn.closed' as const, color: colors.danger },
    unknown: { key: 'rec.warn.hoursUnknown' as const, color: colors.textMuted },
  }[state];
  return (
    <AppText variant="caption" color={map.color}>
      {t(map.key)}
    </AppText>
  );
}

/** Tarjeta de recomendación: score, confianza, razón principal, distancia, estado. */
export function RecommendationCard({ model, onSelect }: RecommendationCardProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useI18n();
  const origin = useDistanceOrigin();
  const categoryLabel = t(categoryLabelKey(model.category));

  return (
    <Pressable
      onPress={() => onSelect(model.placeId)}
      accessibilityRole="button"
      accessibilityLabel={t('place.cardA11y', { name: model.name, category: categoryLabel })}
      accessibilityHint={t('place.cardHint')}
      style={({ pressed }) => ({
        borderRadius: radii.card,
        backgroundColor: pressed ? colors.neutralSoft : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.sm,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <AppText variant="cardTitle" numberOfLines={1} style={{ flex: 1 }}>
          {model.name}
        </AppText>
        <RecommendationScore stars={model.stars} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
        <CategoryBadge category={model.category} />
        <RecommendationBadges badges={model.badges} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
        <OpenPill state={model.openState} />
        {model.distanceKm !== null ? (
          <AppText variant="caption" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {formatDistanceWithOriginLocalized(model.distanceKm, origin, locale)}
          </AppText>
        ) : null}
        <RecommendationConfidence level={model.confidence} />
      </View>

      <RecommendationReasons reasonKeys={model.reasonKeys} warningKeys={model.warningKeys} />
    </Pressable>
  );
}
