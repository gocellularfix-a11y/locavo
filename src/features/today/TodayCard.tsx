import React from 'react';
import { View } from 'react-native';

import { spacing } from '../../theme/tokens';
import { RecommendationCard } from '../recommendations';
import { ContextBadges } from './ContextBadges';
import type { TodayCardModel } from './todayModel';

export interface TodayCardProps {
  model: TodayCardModel;
  onSelect: (placeId: string) => void;
}

/**
 * Tarjeta de "hoy": insignias de contexto + la tarjeta de recomendación V5.1
 * (reutilizada sin modificar). Las razones de contexto ya vienen fusionadas en
 * el modelo base.
 */
export function TodayCard({ model, onSelect }: TodayCardProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <ContextBadges badges={model.contextBadges} />
      <RecommendationCard model={model.model} onSelect={onSelect} />
    </View>
  );
}
