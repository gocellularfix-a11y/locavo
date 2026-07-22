import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import type { TranslationKey } from '../../i18n/locales/es';
import { useI18n } from '../../i18n/I18nContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing } from '../../theme/tokens';

export interface RecommendationReasonsProps {
  reasonKeys: readonly TranslationKey[];
  warningKeys: readonly TranslationKey[];
  /** Muestra el encabezado "Por qué se recomienda". */
  showTitle?: boolean;
}

/**
 * "Por qué se recomienda": positivos (✓) y advertencias (dato desconocido),
 * visualmente distinguibles. Solo mapea claves i18n; no genera texto.
 */
export function RecommendationReasons({
  reasonKeys,
  warningKeys,
  showTitle = true,
}: RecommendationReasonsProps) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  if (reasonKeys.length === 0 && warningKeys.length === 0) {
    return null;
  }
  return (
    <View style={{ gap: spacing.xs }}>
      {showTitle ? (
        <AppText variant="label" tone="secondary">
          {t('rec.whyTitle')}
        </AppText>
      ) : null}
      {reasonKeys.map((key) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <AppText variant="caption" tone="secondary">
            {t(key)}
          </AppText>
        </View>
      ))}
      {warningKeys.map((key) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Ionicons name="information-circle-outline" size={14} color={colors.warning} />
          <AppText variant="caption" color={colors.warning}>
            {t(key)}
          </AppText>
        </View>
      ))}
    </View>
  );
}
