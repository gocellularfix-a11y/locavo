import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppButton } from './AppButton';
import { AppText } from './AppText';
import { useI18n } from '../i18n/I18nContext';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

function CenteredBox({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xxxl,
        paddingHorizontal: spacing.xl,
        gap: spacing.md,
      }}
    >
      {children}
    </View>
  );
}

export function LoadingState({ message }: { message?: string }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  return (
    <CenteredBox>
      <ActivityIndicator size="large" color={colors.brand} accessibilityLabel={t('common.loading')} />
      <AppText tone="secondary">{message ?? t('state.loadingPlaces')}</AppText>
    </CenteredBox>
  );
}

export interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  return (
    <CenteredBox>
      <Ionicons name="compass-outline" size={40} color={colors.textMuted} />
      <AppText variant="cardTitle">{title ?? t('explore.emptyTitle')}</AppText>
      <AppText tone="secondary" style={{ textAlign: 'center' }}>
        {message ?? t('explore.emptyGeneric')}
      </AppText>
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} variant="secondary" onPress={onAction} />
      ) : null}
    </CenteredBox>
  );
}

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  return (
    <CenteredBox>
      <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
      <AppText variant="cardTitle">{t('state.errorTitle')}</AppText>
      <AppText tone="secondary" style={{ textAlign: 'center' }}>
        {message ?? t('state.errorBody')}
      </AppText>
      {onRetry ? <AppButton label={t('common.retry')} onPress={onRetry} /> : null}
    </CenteredBox>
  );
}
