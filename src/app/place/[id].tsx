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
import { confidenceLevelOf, type LocavoPlace } from '../../domain/places/LocavoPlace';
import {
  explainReasonsLocalized,
  formatDistanceLocalized,
  formatTravelTimeLocalized,
  priceLevelText,
  sourceLabelLocalized,
  verificationTextLocalized,
} from '../../i18n/format';
import { useI18n } from '../../i18n/I18nContext';
import { useDirections } from '../../hooks/useDirections';
import { analytics, placeSearchService } from '../../services/container';
import { scorePlace } from '../../services/places/PlaceRankingService';
import { useLocationState } from '../../state/LocationContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing } from '../../theme/tokens';

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; place: LocavoPlace };

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
  const { t, locale } = useI18n();
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
    placeSearchService
      .getById(validId)
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
        title={t('place.notFoundTitle')}
        message={t('place.notFoundBody')}
        actionLabel={t('common.goHome')}
        onAction={() => router.push('/')}
      />
    );
  } else if (state.status === 'loading') {
    body = <LoadingState message={t('place.loading')} />;
  } else if (state.status === 'error') {
    body = <ErrorState onRetry={() => router.replace(`/place/${validId}`)} />;
  } else if (scored) {
    const { place } = state;
    const website = place.contact?.website;
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
            {formatDistanceLocalized(scored.distanceKm, locale)} ·{' '}
            {formatTravelTimeLocalized(scored.travelMinutes, locale)}
          </AppText>
        </View>

        <AppText variant="body" tone="secondary">
          {explainReasonsLocalized(scored.reasons, locale)}
        </AppText>

        <AppButton
          label={t('place.directions')}
          icon="navigate"
          onPress={() => {
            directions.navigateTo(place);
          }}
          accessibilityHint={t('place.directionsHint')}
        />

        {directions.failedPlace ? (
          <NavigationErrorNotice
            placeName={directions.failedPlace.name}
            onRetry={directions.retry}
            onDismiss={directions.dismiss}
          />
        ) : null}

        <View style={{ gap: spacing.lg }}>
          {place.address?.formatted ? (
            <DetailRow icon="location" label={t('place.address')} value={place.address.formatted} />
          ) : null}
          {place.contact?.phone ? (
            <DetailRow icon="call" label={t('place.phone')} value={place.contact.phone} />
          ) : null}
          {website ? (
            <Pressable
              onPress={() => {
                Linking.openURL(website).catch(() => undefined);
              }}
              accessibilityRole="link"
              accessibilityLabel={t('place.websiteA11y', { name: place.name })}
            >
              <DetailRow icon="globe" label={t('place.website')} value={website} />
            </Pressable>
          ) : null}
          <DetailRow
            icon="cash"
            label={t('place.priceLevel')}
            value={priceLevelText(place.price?.level, locale)}
          />
          <DetailRow
            icon="cloud-outline"
            label={t('place.source')}
            value={sourceLabelLocalized(place, locale)}
          />
          <DetailRow
            icon="checkmark-done"
            label={t('place.lastVerification')}
            value={verificationTextLocalized(place.verification, locale)}
          />
        </View>

        <ConfidenceIndicator level={confidenceLevelOf(place.verification.confidence)} />

        <AppText variant="caption" tone="muted">
          {t('place.navNote')}
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
          accessibilityLabel={t('common.back')}
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
