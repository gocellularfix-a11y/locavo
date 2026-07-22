import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { useI18n } from '../../i18n/I18nContext';
import { spacing } from '../../theme/tokens';
import { RecommendationCard } from './RecommendationCard';
import { RecommendationEmptyState } from './RecommendationEmptyState';
import type { RecommendationCardModel } from './recommendationModel';
import type { RecommendationStatus } from './useRecommendations';

export interface RecommendationSectionProps {
  status: RecommendationStatus;
  models: readonly RecommendationCardModel[];
  onSelect: (placeId: string) => void;
  /**
   * Si es true, no renderiza nada cuando no hay modelos (para superficies como
   * Inicio donde no debe ocupar espacio). Por defecto muestra el estado vacío.
   */
  hideWhenEmpty?: boolean;
}

/**
 * Sección de recomendaciones. Carga local = instantánea: sin spinners. Nunca
 * muestra una lista vacía (estado vacío amable o nada, según `hideWhenEmpty`).
 */
export function RecommendationSection({
  status,
  models,
  onSelect,
  hideWhenEmpty = false,
}: RecommendationSectionProps) {
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
        {t('rec.section.title')}
      </AppText>
      <View style={{ gap: spacing.sm }}>
        {models.map((model) => (
          <RecommendationCard key={model.placeId} model={model} onSelect={onSelect} />
        ))}
      </View>
    </View>
  );
}
