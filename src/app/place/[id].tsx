import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { buildPlaceActions } from '../../actions';
import { placeActionDisplay } from './placeActionLabels';
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
import { usePreferences } from '../../preferences/PreferenceContext';
import { useDirections } from '../../hooks/useDirections';
import { analytics, placeSearchService } from '../../services/container';
import { executePlaceAction } from '../../services/placeActionExecutor';
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
  const { profile, dispatch } = usePreferences();
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
      // Interacción de alta intención (V5.4): abrir detalles del lugar.
      dispatch({ type: 'OPEN_PLACE_DETAILS', placeId: state.place.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status === 'ready' ? state.place.id : null]);

  const scored = useMemo(
    () => (state.status === 'ready' ? scorePlace(state.place, location.coords, new Date()) : null),
    [state, location.coords],
  );

  // Acciones seguras (V5.7): validadas en el dominio; jamás campos crudos.
  const actions = useMemo(
    () => (state.status === 'ready' ? buildPlaceActions(state.place) : null),
    [state],
  );
  const [actionFailed, setActionFailed] = useState(false);
  const runAction = async (action: NonNullable<typeof actions>['call']) => {
    setActionFailed(false);
    const outcome = await executePlaceAction(action);
    if (!outcome.opened) {
      setActionFailed(true);
    }
  };

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
    const signal = profile.placeSignals[place.id];
    const isFavorite = signal?.favorite === true;
    const isHidden = signal?.hidden === true;
    body = (
      <View style={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title" accessibilityRole="header">
            {place.name}
          </AppText>
          <CategoryBadge category={place.category} />
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Pressable
              onPress={() =>
                dispatch({ type: isFavorite ? 'UNFAVORITE_PLACE' : 'FAVORITE_PLACE', placeId: place.id })
              }
              accessibilityRole="button"
              accessibilityLabel={t(isFavorite ? 'pref.action.unfavorite' : 'pref.action.favorite')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                borderWidth: 1,
                borderColor: isFavorite ? colors.brand : colors.border,
                borderRadius: 999,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
              }}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={16}
                color={isFavorite ? colors.brand : colors.textSecondary}
              />
              <AppText variant="caption" color={isFavorite ? colors.brand : colors.textSecondary}>
                {t(isFavorite ? 'pref.action.unfavorite' : 'pref.action.favorite')}
              </AppText>
            </Pressable>
            <Pressable
              onPress={() => dispatch({ type: isHidden ? 'UNHIDE_PLACE' : 'HIDE_PLACE', placeId: place.id })}
              accessibilityRole="button"
              accessibilityLabel={t(isHidden ? 'pref.action.unhide' : 'pref.action.hide')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 999,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
              }}
            >
              <Ionicons
                name={isHidden ? 'eye-outline' : 'eye-off-outline'}
                size={16}
                color={colors.textSecondary}
              />
              <AppText variant="caption" tone="secondary">
                {t(isHidden ? 'pref.action.unhide' : 'pref.action.hide')}
              </AppText>
            </Pressable>
          </View>
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

        {actions?.directions.availability === 'AVAILABLE' ? (
          <AppButton
            label={t('place.directions')}
            icon="navigate"
            onPress={() => {
              dispatch({ type: 'REQUEST_DIRECTIONS', placeId: place.id });
              directions.navigateTo(place);
            }}
            accessibilityHint={t('place.directionsHint')}
          />
        ) : null}

        {directions.failedPlace ? (
          <NavigationErrorNotice
            placeName={directions.failedPlace.name}
            onRetry={directions.retry}
            onDismiss={directions.dismiss}
          />
        ) : null}

        {actionFailed ? (
          <AppText
            variant="caption"
            color={colors.danger}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            {t('place.actionFailed')}
          </AppText>
        ) : null}

        <View style={{ gap: spacing.lg }}>
          {place.address?.formatted ? (
            <DetailRow icon="location" label={t('place.address')} value={place.address.formatted} />
          ) : null}
          {(() => {
            // Teléfono (V5.7.1): válido → accionable con el número legible; inválido
            // → razón localizada NO accionable (nunca el texto crudo); ausente → oculto.
            if (!actions || !place.contact?.phone) {
              return null;
            }
            const d = placeActionDisplay(actions.call);
            if (d.kind === 'hidden') {
              return null;
            }
            if (d.kind === 'invalid') {
              return <DetailRow icon="call" label={t('place.phone')} value={t(d.reasonKey)} />;
            }
            return (
              <Pressable
                onPress={() => runAction(actions.call)}
                accessibilityRole="button"
                accessibilityLabel={t('place.callA11y', { name: place.name })}
                accessibilityHint={t('place.callHint')}
              >
                <DetailRow icon="call" label={t('place.call')} value={place.contact.phone} />
              </Pressable>
            );
          })()}
          {(() => {
            // Sitio web (V5.7.1): válido → muestra el destino NORMALIZADO (sin desajuste
            // con lo ejecutado) y abre solo el destino validado; inválido → razón
            // localizada NO accionable (nunca la cadena cruda); ausente → oculto.
            if (!actions || !website) {
              return null;
            }
            const d = placeActionDisplay(actions.website);
            if (d.kind === 'hidden') {
              return null;
            }
            if (d.kind === 'invalid') {
              return <DetailRow icon="globe" label={t('place.website')} value={t(d.reasonKey)} />;
            }
            return (
              <Pressable
                onPress={() => runAction(actions.website)}
                accessibilityRole="link"
                accessibilityLabel={t('place.websiteA11y', { name: place.name })}
                accessibilityHint={t('place.websiteHint')}
              >
                <DetailRow icon="globe" label={t('place.website')} value={actions.website.target ?? website} />
              </Pressable>
            );
          })()}
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
