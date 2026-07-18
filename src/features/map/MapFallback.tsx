import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppText } from '../../components/AppText';
import { useI18n } from '../../i18n/I18nContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';

/**
 * Fallback visible cuando el mapa no puede cargar (sin red, error de
 * Leaflet, timeout). La lista de lugares sigue funcionando fuera del mapa.
 */
export function MapFallback({ height, onRetry }: { height: number; onRetry: () => void }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        height,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.neutralSoft,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        padding: spacing.xl,
      }}
    >
      <Ionicons name="map-outline" size={36} color={colors.textMuted} />
      <AppText variant="cardTitle" style={{ textAlign: 'center' }}>
        {t('map.failedTitle')}
      </AppText>
      <AppText tone="secondary" style={{ textAlign: 'center' }}>
        {t('map.failedBody')}
      </AppText>
      <AppButton label={t('map.retry')} variant="secondary" icon="refresh" onPress={onRetry} />
    </View>
  );
}
