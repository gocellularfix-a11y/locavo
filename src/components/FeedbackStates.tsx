import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppButton } from './AppButton';
import { AppText } from './AppText';
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

export function LoadingState({ message = 'Buscando lugares cerca de ti…' }: { message?: string }) {
  const { colors } = useAppTheme();
  return (
    <CenteredBox>
      <ActivityIndicator size="large" color={colors.brand} accessibilityLabel="Cargando" />
      <AppText tone="secondary">{message}</AppText>
    </CenteredBox>
  );
}

export interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = 'Sin resultados por aquí',
  message = 'Prueba con otra categoría o cambia tu búsqueda.',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors } = useAppTheme();
  return (
    <CenteredBox>
      <Ionicons name="compass-outline" size={40} color={colors.textMuted} />
      <AppText variant="cardTitle">{title}</AppText>
      <AppText tone="secondary" style={{ textAlign: 'center' }}>
        {message}
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

export function ErrorState({
  message = 'Algo salió mal al cargar los lugares.',
  onRetry,
}: ErrorStateProps) {
  const { colors } = useAppTheme();
  return (
    <CenteredBox>
      <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
      <AppText variant="cardTitle">Ocurrió un problema</AppText>
      <AppText tone="secondary" style={{ textAlign: 'center' }}>
        {message}
      </AppText>
      {onRetry ? <AppButton label="Reintentar" onPress={onRetry} /> : null}
    </CenteredBox>
  );
}
