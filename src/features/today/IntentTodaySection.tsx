import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import type { TranslationKey } from '../../i18n/locales/es';
import { useI18n } from '../../i18n/I18nContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';
import { ContextBadges } from './ContextBadges';
import type { IntentTodayCardModel } from './intentToday';
import { RecommendationCard, RecommendationEmptyState, type RecommendationStatus } from '../recommendations';

function Badge({ labelKey, icon, tone }: { labelKey: TranslationKey; icon: keyof typeof Ionicons.glyphMap; tone: 'intent' | 'preference' }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const color = tone === 'intent' ? colors.brand : colors.brand;
  const bg = tone === 'intent' ? colors.brandSoft : colors.brandSoft;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: bg, borderRadius: radii.chip, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
      <Ionicons name={icon} size={11} color={color} />
      <AppText variant="caption" color={color}>
        {t(labelKey)}
      </AppText>
    </View>
  );
}

function IntentTodayCard({ model, onSelect }: { model: IntentTodayCardModel; onSelect: (id: string) => void }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
        {model.intentBadgeKey ? <Badge labelKey={model.intentBadgeKey} icon="search" tone="intent" /> : null}
        {model.preferenceBadgeKey ? (
          <Badge labelKey={model.preferenceBadgeKey} icon={model.preferenceBadgeKey === 'pref.badge.favorite' ? 'heart' : 'sparkles'} tone="preference" />
        ) : null}
        <ContextBadges badges={model.today.contextBadges} />
      </View>
      <RecommendationCard model={model.today.model} onSelect={onSelect} />
    </View>
  );
}

export interface IntentTodaySectionProps {
  status: RecommendationStatus;
  models: readonly IntentTodayCardModel[];
  onSelect: (placeId: string) => void;
  hideWhenEmpty?: boolean;
}

/** "Sugerencias de hoy" con intención + contexto + preferencias. */
export function IntentTodaySection({ status, models, onSelect, hideWhenEmpty = false }: IntentTodaySectionProps) {
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
          <IntentTodayCard key={model.today.model.placeId} model={model} onSelect={onSelect} />
        ))}
      </View>
    </View>
  );
}
