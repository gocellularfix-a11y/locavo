import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppText } from '../../components/AppText';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';

/**
 * Fallback visible cuando el mapa no puede cargar (sin red, error de
 * Leaflet, timeout). La lista de lugares sigue funcionando fuera del mapa.
 */
export function MapFallback({ height, onRetry }: { height: number; onRetry: () => void }) {
  const { colors } = useAppTheme();
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
        No pudimos cargar el mapa.
      </AppText>
      <AppText tone="secondary" style={{ textAlign: 'center' }}>
        Puedes seguir usando la lista de lugares.
      </AppText>
      <AppButton label="Reintentar mapa" variant="secondary" icon="refresh" onPress={onRetry} />
    </View>
  );
}
