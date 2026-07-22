import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { AppText } from '../../components/AppText';
import { useI18n } from '../../i18n/I18nContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';

/** Estado vacío amable: nunca una lista vacía. */
export function RecommendationEmptyState() {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  return (
    <View
      accessible
      accessibilityLabel={t('rec.empty.title')}
      style={{
        borderRadius: radii.card,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.xl,
        gap: spacing.xs,
        alignItems: 'center',
      }}
    >
      <Ionicons name="compass-outline" size={28} color={colors.textMuted} />
      <AppText variant="cardTitle">{t('rec.empty.title')}</AppText>
      <AppText variant="body" tone="secondary" style={{ textAlign: 'center' }}>
        {t('rec.empty.body')}
      </AppText>
    </View>
  );
}
