import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppText } from '../../components/AppText';
import { CategoryBadge } from '../../components/CategoryBadge';
import { ConfidenceIndicator } from '../../components/ConfidenceIndicator';
import { EmptyState, ErrorState, LoadingState } from '../../components/FeedbackStates';
import { NavigationErrorNotice } from '../../components/NavigationErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDistance, formatTravelTime } from '../../domain/distance';
import type { Place } from '../../domain/place';
import { explainReasons, scorePlace } from '../../domain/recommendation';
import { useDirections } from '../../hooks/useDirections';
import { analytics, placeRepository } from '../../services/container';
import { useLocationState } from '../../state/LocationContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing } from '../../theme/tokens';
import { formatPriceLevel, formatVerifiedDate } from '../../utils/format';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; place: Place };

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
    >
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
        <AppText variant="body">{value}</AppText>
      </View>
    </View>
  );
}

export default function PlaceDetailScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const location = useLocationState();
  const directions = useDirections();
  const { id } = useLocalSearchParams<{ id: string }>();
  const validId = typeof id === 'string' && id.length > 0 ? id : null;
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  // Reinicia la carga cuando cambia el id (ajuste de estado durante render).
  const [lastId, setLastId] = useState(validId);
  if (validId !== lastId) {
    setLastId(validId);
    setState({ status: 'loading' });
  }

  useEffect(() => {
    if (!validId) {
      return;
    }
    let cancelled = false;
    placeRepository
      .getPlaceById(validId)
      .then((place) => {
        if (!cancelled) {
          setState(place ? { status: 'ready', place } : { status: 'not-found' });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: 'error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [validId]);

  useEffect(() => {
    if (state.status === 'ready') {
      analytics.track({
        eventName: 'place_opened',
        placeId: state.place.id,
        category: state.place.category,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status === 'ready' ? state.place.id : null]);

  const scored = useMemo(
    () => (state.status === 'ready' ? scorePlace(state.place, location.coords, new Date()) : null),
    [state, location.coords],
  );

  const back = () => (router.canGoBack() ? router.back() : router.push('/'));

  let body: React.ReactNode = null;
  if (!validId || state.status === 'not-found') {
    body = (
      <EmptyState
        title="Lugar no encontrado"
        message="Este lugar ya no está disponible en los datos de demostración."
        actionLabel="Volver al inicio"
        onAction={() => router.push('/')}
      />
    );
  } else if (state.status === 'loading') {
    body = <LoadingState message="Cargando lugar…" />;
  } else if (state.status === 'error') {
    body = <ErrorState onRetry={() => router.replace(`/place/${validId}`)} />;
  } else if (scored) {
    const { place } = state;
    body = (
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title" accessibilityRole="header">
            {place.name}
          </AppText>
          <CategoryBadge category={place.category} />
        </View>

        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }}
        >
          <StatusBadge status={scored.status} />
          <AppText variant="bodyStrong" tone="secondary">
            {formatDistance(scored.distanceKm)} · {formatTravelTime(scored.travelMinutes)}
          </AppText>
        </View>

        <AppText variant="body" tone="secondary">
          {explainReasons(scored.reasons)}
        </AppText>

        <AppButton
          label="Cómo llegar"
          icon="navigate"
          onPress={() => {
            directions.navigateTo(place);
          }}
          accessibilityHint="Abre Google Maps con la ruta al lugar"
        />

        {directions.failedPlace ? (
          <NavigationErrorNotice
            placeName={directions.failedPlace.name}
            onRetry={directions.retry}
            onDismiss={directions.dismiss}
          />
        ) : null}

        <View style={{ gap: spacing.lg }}>
          <DetailRow icon="location" label="Dirección" value={place.address} />
          {place.phone ? <DetailRow icon="call" label="Teléfono" value={place.phone} /> : null}
          {place.website ? (
            <Pressable
              onPress={() => {
                Linking.openURL(place.website as string).catch(() => undefined);
              }}
              accessibilityRole="link"
              accessibilityLabel={`Abrir sitio web de ${place.name}`}
            >
              <DetailRow icon="globe" label="Sitio web" value={place.website} />
            </Pressable>
          ) : null}
          <DetailRow icon="cash" label="Nivel de precio" value={formatPriceLevel(place.priceLevel)} />
          <DetailRow
            icon="cloud-outline"
            label="Fuente"
            value={place.isDemo ? 'Datos de demostración (demo-seed)' : place.source}
          />
          <DetailRow icon="checkmark-done" label="Última verificación" value={formatVerifiedDate(place.lastVerifiedAt)} />
        </View>

        <ConfidenceIndicator level={place.confidence} />

        <AppText variant="caption" tone="muted">
          Locavo registra tu intención de navegar, no confirma visitas ni compras. La ruta se abre
          en Google Maps.
        </AppText>
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: spacing.xl }}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={8}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? colors.neutralSoft : colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          })}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        {body}
      </View>
    </ScreenContainer>
  );
}
