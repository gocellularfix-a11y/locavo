import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppText } from '../../components/AppText';
import { LoadingState } from '../../components/FeedbackStates';
import { LocavoWordmark } from '../../components/LocavoWordmark';
import { NavigationErrorNotice } from '../../components/NavigationErrorNotice';
import { RecommendedPlaceCard } from '../../components/RecommendedPlaceCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { CATEGORIES, type CategoryMeta } from '../../domain/categories';
import { CategoryGrid } from '../../features/home/CategoryGrid';
import { SmartHero } from '../../features/home/SmartHero';
import { locationFailureText } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nContext';
import { useDirections } from '../../hooks/useDirections';
import { usePlacesQuery } from '../../hooks/usePlacesQuery';
import { analytics, surprisePlaceService } from '../../services/container';
import type { ScoredPlace } from '../../services/places/PlaceRankingService';
import { useLocationState } from '../../state/LocationContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const { colors, mode, setMode } = useAppTheme();
  const { t, locale } = useI18n();
  const location = useLocationState();
  const [search, setSearch] = useState('');
  const [surprising, setSurprising] = useState(false);
  const [surpriseFallback, setSurpriseFallback] = useState(false);

  const { status, recommended } = usePlacesQuery();
  const directions = useDirections();

  const locationLabel =
    location.source === 'gps' ? t('location.current') : location.manualLocation.label;
  const requestingLocation = location.requestState === 'requesting';

  useEffect(() => {
    if (recommended) {
      analytics.track({
        eventName: 'recommendation_shown',
        placeId: recommended.place.id,
        category: recommended.place.category,
        metadata: { screen: 'home' },
      });
    }
  }, [recommended?.place.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitSearch = () => {
    const query = search.trim();
    if (query.length === 0) {
      return;
    }
    analytics.track({ eventName: 'search_submitted', metadata: { queryLength: query.length } });
    router.push({ pathname: '/explore', params: { q: query } });
  };

  const openCategory = (category: CategoryMeta) => {
    analytics.track({ eventName: 'category_selected', category: category.id });
    router.push({ pathname: '/explore', params: { category: category.id } });
  };

  const surpriseMe = async () => {
    if (surprising) {
      return;
    }
    setSurprising(true);
    setSurpriseFallback(false);
    try {
      const place = await surprisePlaceService.surprise({ origin: location.coords });
      if (place) {
        analytics.track({
          eventName: 'recommendation_shown',
          placeId: place.id,
          category: place.category,
          metadata: { screen: 'home', trigger: 'surprise' },
        });
        router.push(`/place/${place.id}`);
      } else {
        setSurpriseFallback(true);
        router.push('/explore');
      }
    } catch {
      setSurpriseFallback(true);
      router.push('/explore');
    } finally {
      setSurprising(false);
    }
  };

  const navigateTo = (scored: ScoredPlace) => {
    directions.navigateTo(scored.place);
  };

  const cycleTheme = () => {
    setMode(mode === 'system' ? 'dark' : mode === 'dark' ? 'light' : 'system');
  };
  const themeIcon = mode === 'dark' ? 'moon' : mode === 'light' ? 'sunny' : 'contrast';
  const themeModeShort =
    mode === 'system'
      ? t('settings.theme.systemShort')
      : mode === 'dark'
        ? t('settings.theme.darkShort')
        : t('settings.theme.lightShort');

  return (
    <ScreenContainer>
      {/* Ritmo vertical compacto para que el panel de categorías quede sobre
          el pliegue en teléfonos modernos comunes. */}
      <View style={{ gap: spacing.lg }}>
        {/* Encabezado de marca */}
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <LocavoWordmark />
            </View>
            <Pressable
              onPress={cycleTheme}
              accessibilityRole="button"
              accessibilityLabel={t('home.themeToggleA11y', { mode: themeModeShort })}
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
              <Ionicons name={themeIcon} size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          {/* Fila compacta de ubicación: zona + acción de GPS en una línea */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel={t('home.locationA11y', { label: locationLabel })}
              hitSlop={8}
              style={{
                flexShrink: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                minHeight: 32,
              }}
            >
              <Ionicons name="location" size={14} color={colors.brand} />
              <AppText variant="caption" tone="secondary" numberOfLines={1}>
                {t('home.locationLine', { label: locationLabel })}
              </AppText>
            </Pressable>
            {location.source === 'manual' ? (
              <Pressable
                onPress={() => {
                  location.useCurrentLocation();
                }}
                disabled={requestingLocation}
                accessibilityRole="button"
                accessibilityLabel={
                  requestingLocation ? t('home.gettingLocation') : t('home.useMyLocation')
                }
                accessibilityHint={t('home.useMyLocationHint')}
                accessibilityState={{ disabled: requestingLocation, busy: requestingLocation }}
                hitSlop={8}
                style={({ pressed }) => ({
                  height: 32,
                  minWidth: 44,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radii.chip,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: pressed ? colors.neutralSoft : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: requestingLocation ? 0.6 : 1,
                })}
              >
                {requestingLocation ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : (
                  <Ionicons name="locate" size={16} color={colors.brand} />
                )}
              </Pressable>
            ) : null}
          </View>
          {location.requestState === 'failed' && location.failureReason ? (
            <AppText
              variant="caption"
              tone="secondary"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {locationFailureText(location.failureReason, location.manualLocation.label, locale)}
            </AppText>
          ) : null}
        </View>

        {/* Hero vivo: sugerencia contextual + Sorpréndeme + búsqueda */}
        <SmartHero
          search={search}
          onSearchChange={setSearch}
          onSearchSubmit={submitSearch}
          onSurprise={surpriseMe}
          surprising={surprising}
          fallbackMessage={surpriseFallback ? t('home.surpriseEmpty') : null}
        />

        {/* Panel de decisión: las 8 categorías primarias, 4×2, sobre el pliegue */}
        <CategoryGrid categories={CATEGORIES} onSelect={openCategory} />

        {/* Recomendación inicial */}
        <View style={{ gap: spacing.md }}>
          <AppText variant="section" accessibilityRole="header">
            {t('home.recommendedNearYou')}
          </AppText>
          {status === 'loading' ? <LoadingState /> : null}
          {status === 'ready' && recommended ? (
            <RecommendedPlaceCard
              scored={recommended}
              onNavigate={navigateTo}
              onDetails={(scored) => router.push(`/place/${scored.place.id}`)}
            />
          ) : null}
          {directions.failedPlace ? (
            <NavigationErrorNotice
              placeName={directions.failedPlace.name}
              onRetry={directions.retry}
              onDismiss={directions.dismiss}
            />
          ) : null}
        </View>

        <AppButton
          label={t('home.explorePlaces')}
          variant="secondary"
          icon="compass"
          onPress={() => router.push('/explore')}
          accessibilityHint={t('home.explorePlacesHint')}
        />

        <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
          {t('home.demoNotice')}
        </AppText>
      </View>
    </ScreenContainer>
  );
}
