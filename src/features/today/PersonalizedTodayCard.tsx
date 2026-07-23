import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import type { TranslationKey } from '../../i18n/locales/es';
import { useI18n } from '../../i18n/I18nContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';
import { ContextBadges } from './ContextBadges';
import type { PersonalizedTodayCardModel } from './personalizedToday';
import { RecommendationCard } from '../recommendations';

export interface PersonalizedTodayCardProps {
  model: PersonalizedTodayCardModel;
  onSelect: (placeId: string) => void;
}

function PreferenceBadge({ labelKey }: { labelKey: TranslationKey }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const favorite = labelKey === 'pref.badge.favorite';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: colors.brandSoft,
        borderRadius: radii.chip,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
      }}
    >
      <Ionicons name={favorite ? 'heart' : 'sparkles'} size={11} color={colors.brand} />
      <AppText variant="caption" color={colors.brand}>
        {t(labelKey)}
      </AppText>
    </View>
  );
}

/**
 * Tarjeta de "hoy" personalizada: máximo UNA insignia de preferencia + las de
 * contexto, sobre la tarjeta de recomendación V5.1 (reutilizada sin modificar).
 * Las razones de preferencia van en "Por qué se recomienda" del modelo base.
 */
export function PersonalizedTodayCard({ model, onSelect }: PersonalizedTodayCardProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
        {model.preferenceBadgeKey ? <PreferenceBadge labelKey={model.preferenceBadgeKey} /> : null}
        <ContextBadges badges={model.today.contextBadges} />
      </View>
      <RecommendationCard model={model.today.model} onSelect={onSelect} />
    </View>
  );
}
