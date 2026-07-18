import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

export interface NavigationErrorNoticeProps {
  placeName: string;
  onRetry: () => void;
  onDismiss: () => void;
}

/** Aviso accesible cuando Google Maps no pudo abrirse, con reintento. */
export function NavigationErrorNotice({
  placeName,
  onRetry,
  onDismiss,
}: NavigationErrorNoticeProps) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={{
        backgroundColor: colors.dangerSoft,
        borderRadius: radii.card,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <Ionicons name="alert-circle" size={20} color={colors.danger} />
        <AppText variant="bodyStrong" color={colors.danger} style={{ flex: 1 }}>
          No pudimos abrir Google Maps para {placeName}.
        </AppText>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Cerrar aviso"
          hitSlop={8}
        >
          <Ionicons name="close" size={20} color={colors.danger} />
        </Pressable>
      </View>
      <AppText variant="body" tone="secondary">
        Verifica que tengas un navegador o la app de Google Maps disponible e inténtalo de nuevo.
      </AppText>
      <AppButton label="Reintentar" variant="secondary" icon="refresh" onPress={onRetry} />
    </View>
  );
}
