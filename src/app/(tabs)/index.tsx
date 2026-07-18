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
import type { ScoredPlace } from '../../domain/recommendation';
import { useDirections } from '../../hooks/useDirections';
import { usePlacesQuery } from '../../hooks/usePlacesQuery';
import { analytics } from '../../services/container';
import { describeLocationFailure } from '../../services/location';
import { useLocationState } from '../../state/LocationContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { spacing } from '../../theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const { colors, mode, setMode } = useAppTheme();
  const location = useLocationState();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');

  const { status, recommended } = usePlacesQuery();

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

  const directions = useDirections();
  const navigateTo = (scored: ScoredPlace) => {
    directions.navigateTo(scored.place);
  };

  const cycleTheme = () => {
    setMode(mode === 'system' ? 'dark' : mode === 'dark' ? 'light' : 'system');
  };
  const themeIcon = mode === 'dark' ? 'moon' : mode === 'light' ? 'sunny' : 'contrast';

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
              accessibilityLabel={`Ubicación: Culiacán, ${location.label}. Cambiar ubicación`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
            >
              <Ionicons name="location" size={14} color={colors.brand} />
              <AppText variant="caption" tone="secondary">
                Culiacán · {location.label} · Cambiar
              </AppText>
            </Pressable>
          </View>
          <Pressable
            onPress={cycleTheme}
            accessibilityRole="button"
            accessibilityLabel={`Cambiar tema. Actual: ${
              mode === 'system' ? 'sistema' : mode === 'dark' ? 'oscuro' : 'claro'
            }`}
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
            ¿Qué necesitas ahora?
          </AppText>
          <AppText variant="bodyStrong" tone="brand">
            No busques. Decide.
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
                  ? 'Obteniendo ubicación…'
                  : 'Usar mi ubicación actual'
              }
              variant="secondary"
              icon="locate"
              disabled={location.requestState === 'requesting'}
              onPress={() => {
                location.useCurrentLocation();
              }}
              accessibilityHint="Pide permiso de ubicación y usa tu posición actual una sola vez"
            />
            {location.requestState === 'failed' && location.failureReason ? (
              <AppText
                variant="caption"
                tone="secondary"
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                {describeLocationFailure(location.failureReason, location.manualLocation.label)}
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
            Recomendado cerca de ti
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
          label="Explorar lugares"
          variant="secondary"
          icon="compass"
          onPress={() => router.push('/explore')}
          accessibilityHint="Abre la lista completa de lugares"
        />

        <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>
          Fase de demostración: los lugares mostrados son datos simulados.
        </AppText>
      </View>
    </ScreenContainer>
  );
}
