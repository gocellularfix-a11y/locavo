import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppText } from '../../components/AppText';
import { CategoryCard } from '../../components/CategoryCard';
import { LoadingState } from '../../components/FeedbackStates';
import { LocavoWordmark } from '../../components/LocavoWordmark';
import { NavigationErrorNotice } from '../../components/NavigationErrorNotice';
import { RecommendedPlaceCard } from '../../components/RecommendedPlaceCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SearchField } from '../../components/SearchField';
import { CATEGORIES, type CategoryMeta } from '../../domain/categories';
import { locationFailureText } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nContext';
import { useDirections } from '../../hooks/useDirections';
import { usePlacesQuery } from '../../hooks/usePlacesQuery';
import { analytics } from '../../services/container';
import type { ScoredPlace } from '../../services/places/PlaceRankingService';
import { useLocationState } from '../../state/LocationContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing } from '../../theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const { colors, mode, setMode } = useAppTheme();
  const { t, locale } = useI18n();
  const location = useLocationState();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');

  const { status, recommended } = usePlacesQuery();
  const directions = useDirections();

  const locationLabel =
    location.source === 'gps' ? t('location.current') : location.manualLocation.label;

  const columns = width >= 720 ? 4 : 2;
  const rows = useMemo(() => {
    const grouped: CategoryMeta[][] = [];
    for (let i = 0; i < CATEGORIES.length; i += columns) {
      grouped.push(CATEGORIES.slice(i, i + columns));
    }
    return grouped;
  }, [columns]);

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
      <View style={{ gap: spacing.xxl }}>
        {/* Encabezado ligero */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <LocavoWordmark />
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel={t('home.locationA11y', { label: locationLabel })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
            >
              <Ionicons name="location" size={14} color={colors.brand} />
              <AppText variant="caption" tone="secondary">
                {t('home.locationLine', { label: locationLabel })}
              </AppText>
            </Pressable>
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

        {/* Hero */}
        <View style={{ gap: spacing.xs }}>
          <AppText variant="display" accessibilityRole="header">
            {t('home.heroTitle')}
          </AppText>
          <AppText variant="bodyStrong" tone="brand">
            {t('home.tagline')}
          </AppText>
        </View>

        {/* Búsqueda */}
        <SearchField value={search} onChangeText={setSearch} onSubmit={submitSearch} />

        {/* Ubicación actual */}
        {location.source === 'manual' ? (
          <View style={{ gap: spacing.sm }}>
            <AppButton
              label={
                location.requestState === 'requesting'
                  ? t('home.gettingLocation')
                  : t('home.useMyLocation')
              }
              variant="secondary"
              icon="locate"
              disabled={location.requestState === 'requesting'}
              onPress={() => {
                location.useCurrentLocation();
              }}
              accessibilityHint={t('home.useMyLocationHint')}
            />
            {location.requestState === 'failed' && location.failureReason ? (
              <AppText
                variant="caption"
                tone="secondary"
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {locationFailureText(
                  location.failureReason,
                  location.manualLocation.label,
                  locale,
                )}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {/* Categorías */}
        <View style={{ gap: spacing.md }}>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={{ flexDirection: 'row', gap: spacing.md }}>
              {row.map((category) => (
                <CategoryCard key={category.id} category={category} onPress={openCategory} />
              ))}
              {row.length < columns
                ? Array.from({ length: columns - row.length }).map((_, i) => (
                    <View key={`spacer-${i}`} style={{ flex: 1 }} />
                  ))
                : null}
            </View>
          ))}
        </View>

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
