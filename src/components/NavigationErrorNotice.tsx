import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { useI18n } from '../i18n/I18nContext';
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
  const { t } = useI18n();
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
          {t('navError.title', { name: placeName })}
        </AppText>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('navError.closeA11y')}
          hitSlop={8}
        >
          <Ionicons name="close" size={20} color={colors.danger} />
        </Pressable>
      </View>
      <AppText variant="body" tone="secondary">
        {t('navError.body')}
      </AppText>
      <AppButton label={t('common.retry')} variant="secondary" icon="refresh" onPress={onRetry} />
    </View>
  );
}
