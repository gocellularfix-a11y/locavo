import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { useI18n } from '../../i18n/I18nContext';
import { spacing } from '../../theme/tokens';
import { RecommendationEmptyState, type RecommendationStatus } from '../recommendations';
import { TodayCard } from './TodayCard';
import type { TodayCardModel } from './todayModel';

export interface TodaySectionProps {
  status: RecommendationStatus;
  models: readonly TodayCardModel[];
  onSelect: (placeId: string) => void;
  /** No renderiza nada cuando está vacío (para Inicio). Por defecto: estado vacío. */
  hideWhenEmpty?: boolean;
}

/**
 * "Sugerencias de hoy": recomendaciones reordenadas por contexto. Carga local =
 * instantánea (sin spinners); nunca una lista vacía.
 */
export function TodaySection({ status, models, onSelect, hideWhenEmpty = false }: TodaySectionProps) {
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
          <TodayCard key={model.model.placeId} model={model} onSelect={onSelect} />
        ))}
      </View>
    </View>
  );
}
