import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { useI18n } from '../../i18n/I18nContext';
import { spacing } from '../../theme/tokens';
import { RecommendationEmptyState, type RecommendationStatus } from '../recommendations';
import { PersonalizedTodayCard } from './PersonalizedTodayCard';
import type { PersonalizedTodayCardModel } from './personalizedToday';

export interface PersonalizedTodaySectionProps {
  status: RecommendationStatus;
  models: readonly PersonalizedTodayCardModel[];
  onSelect: (placeId: string) => void;
  hideWhenEmpty?: boolean;
}

/** "Sugerencias de hoy" personalizadas por contexto + preferencias privadas. */
export function PersonalizedTodaySection({
  status,
  models,
  onSelect,
  hideWhenEmpty = false,
}: PersonalizedTodaySectionProps) {
  const { t } = useI18n();

  if (status === 'loading') {
    return null;
  }
  if (models.length === 0) {
    return hideWhenEmpty ? null : <RecommendationEmptyState />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="section" accessibilityRole="header">
        {t('today.section.title')}
      </AppText>
      <View style={{ gap: spacing.md }}>
        {models.map((model) => (
          <PersonalizedTodayCard key={model.today.model.placeId} model={model} onSelect={onSelect} />
        ))}
      </View>
    </View>
  );
}
