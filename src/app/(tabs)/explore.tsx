import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { AppButton } from '../../components/AppButton';
import { AppText } from '../../components/AppText';
import { EmptyState, ErrorState, LoadingState } from '../../components/FeedbackStates';
import { NavigationErrorNotice } from '../../components/NavigationErrorNotice';
import { PlaceCard } from '../../components/PlaceCard';
import { RecommendedPlaceCard } from '../../components/RecommendedPlaceCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SearchField } from '../../components/SearchField';
import { CATEGORIES, categoryLabelKey, isCategoryId } from '../../domain/categories';
import type { CategoryId } from '../../domain/place';
import { MapSurface } from '../../features/map/MapSurface';
import { useI18n } from '../../i18n/I18nContext';
import { useDirections } from '../../hooks/useDirections';
import { usePlacesQuery } from '../../hooks/usePlacesQuery';
import { analytics } from '../../services/container';
import type { ScoredPlace } from '../../services/places/PlaceRankingService';
import { useLocationState } from '../../state/LocationContext';
import { getCategoryVisual } from '../../theme/categoryColors';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';

/** Máximo de marcadores simultáneos en el mapa (tope V4D.1). */
const MAX_MAP_MARKERS = 200;

/**
 * Ajustes de virtualización (V4D.2), medidos sobre tarjetas de ~150–170 px
 * en una pantalla de ~2340 px:
 * - initialNumToRender 8: llena el primer viewport bajo cabecera+mapa sin
 *   montar páginas enteras;
 * - maxToRenderPerBatch 8 y windowSize 7 (~3.5 pantallas por lado):
 *   desplazamiento fluido sin retener las 150+ tarjetas de varias páginas;
 * - sin getItemLayout: la altura de tarjeta NO es determinista (nombres de
 *   negocios reales envuelven a 2 líneas);
 * - removeClippedSubviews queda en el default de plataforma (activado en
 *   Android por FlatList; forzarlo en web causa parpadeos conocidos).
 */
const LIST_INITIAL_RENDER = 8;
const LIST_BATCH_SIZE = 8;
const LIST_WINDOW_SIZE = 7;

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Color de fondo cuando está activo (default: coral de marca). */
  activeColor?: string;
  /** Color del texto sobre `activeColor` (default: blanco de marca). */
  activeTextColor?: string;
}

function FilterChip({ label, active, onPress, activeColor, activeTextColor }: FilterChipProps) {
  const { colors } = useAppTheme();
  const activeBg = activeColor ?? colors.brand;
  const activeText = activeTextColor ?? colors.onBrand;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        borderRadius: radii.chip,
        paddingHorizontal: spacing.lg,
        minHeight: 40,
        justifyContent: 'center',
        backgroundColor: active ? activeBg : pressed ? colors.neutralSoft : colors.surface,
        opacity: active && pressed ? 0.85 : 1,
        borderWidth: active ? 0 : 1,
        borderColor: colors.border,
      })}
    >
      <AppText variant="label" color={active ? activeText : colors.textPrimary}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const { colors, scheme } = useAppTheme();
  const { t } = useI18n();
  const location = useLocationState();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ category?: string; q?: string }>();

  const paramCategory =
    typeof params.category === 'string' && isCategoryId(params.category) ? params.category : null;
  const paramQuery = typeof params.q === 'string' ? params.q : '';

  const [category, setCategory] = useState<CategoryId | null>(paramCategory);
  const [query, setQuery] = useState(paramQuery);
  const [openOnly, setOpenOnly] = useState(false);
  const [sortByDistance, setSortByDistance] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Sincroniza parámetros entrantes (desde Inicio) con el estado local usando
  // el patrón de ajuste de estado durante el render (la pestaña no se remonta).
  const [lastParamCategory, setLastParamCategory] = useState(paramCategory);
  const [lastParamQuery, setLastParamQuery] = useState(paramQuery);
  if (paramCategory !== lastParamCategory) {
    setLastParamCategory(paramCategory);
    if (paramCategory) {
      setCategory(paramCategory);
    }
  }
  if (paramQuery !== lastParamQuery) {
    setLastParamQuery(paramQuery);
    if (paramQuery) {
      setQuery(paramQuery);
    }
  }

  const { status, results, recommended, reload, hasMore, loadingMore, loadMore, notice } =
    usePlacesQuery({
      category,
      query,
      openOnly,
      sort: sortByDistance ? 'distance' : 'best',
    });

  useEffect(() => {
    if (recommended) {
      analytics.track({
        eventName: 'recommendation_shown',
        placeId: recommended.place.id,
        category: recommended.place.category,
        metadata: { screen: 'explore' },
      });
    }
  }, [recommended?.place.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tope explícito de marcadores (V4D.1): DTOs ligeros regenerados desde la
  // consulta activa; jamás acumulan páginas ni categorías anteriores.
  const markers = useMemo(
    () =>
      results.slice(0, MAX_MAP_MARKERS).map((r) => ({
        id: r.place.id,
        latitude: r.place.coordinates.latitude,
        longitude: r.place.coordinates.longitude,
        label: r.place.name,
      })),
    [results],
  );

  const locationLabel =
    location.source === 'gps' ? t('location.current') : location.manualLocation.label;
  const categoryLabel = category ? t(categoryLabelKey(category)) : t('explore.allPlaces');
  const isWide = width >= 900;

  const directions = useDirections();
  const navigateTo = useCallback(
    (scored: ScoredPlace) => {
      directions.navigateTo(scored.place);
    },
    [directions],
  );
  const openDetails = useCallback(
    (scored: ScoredPlace) => router.push(`/place/${scored.place.id}`),
    [router],
  );

  // Datos de la lista virtualizada (la recomendación va en la cabecera).
  const listData = useMemo(
    () => (recommended ? results.slice(1) : results),
    [results, recommended],
  );

  const keyExtractor = useCallback((item: ScoredPlace) => item.place.id, []);
  const renderItem = useCallback(
    ({ item }: { item: ScoredPlace }) => (
      <View style={{ paddingBottom: spacing.md }}>
        <PlaceCard
          scored={item}
          selected={item.place.id === selectedId}
          onPress={(s) => {
            setSelectedId(s.place.id);
            openDetails(s);
          }}
        />
      </View>
    ),
    [selectedId, openDetails],
  );

  const navigationNotice = directions.failedPlace ? (
    <NavigationErrorNotice
      placeName={directions.failedPlace.name}
      onRetry={directions.retry}
      onDismiss={directions.dismiss}
    />
  ) : null;

  const searchAndFilters = (
    <View style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.push('/'))}
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
        <View style={{ flex: 1 }}>
          <AppText variant="section" accessibilityRole="header" numberOfLines={1}>
            {categoryLabel}
          </AppText>
          <AppText variant="caption" tone="secondary">
            {t('explore.locationLine', { label: locationLabel })}
          </AppText>
        </View>
      </View>

      <SearchField
        value={query}
        onChangeText={setQuery}
        onSubmit={() => {
          if (query.trim()) {
            analytics.track({
              eventName: 'search_submitted',
              metadata: { queryLength: query.trim().length, screen: 'explore' },
            });
          }
        }}
        placeholder={
          category
            ? t('explore.searchInCategory', { category: categoryLabel.toLowerCase() })
            : undefined
        }
      />

      {/* Aviso truthful: horarios no confirmados ante intención de "abierto". */}
      {notice === 'HOURS_UNAVAILABLE' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="time-outline" size={16} color={colors.warning} />
          <AppText variant="caption" tone="secondary" style={{ flex: 1 }}>
            {t('search.hoursUnconfirmed')}
          </AppText>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        <FilterChip
          label={t('explore.openNow')}
          active={openOnly}
          onPress={() => setOpenOnly((v) => !v)}
        />
        <FilterChip
          label={t('explore.near')}
          active={sortByDistance}
          onPress={() => setSortByDistance((v) => !v)}
        />
        {CATEGORIES.map((c) => {
          const visual = getCategoryVisual(c.id, scheme);
          return (
            <FilterChip
              key={c.id}
              label={t(categoryLabelKey(c.id))}
              active={category === c.id}
              activeColor={visual.solid}
              activeTextColor={visual.onSolid}
              onPress={() => {
                const next = category === c.id ? null : c.id;
                setCategory(next);
                if (next) {
                  analytics.track({ eventName: 'category_selected', category: next });
                }
              }}
            />
          );
        })}
      </ScrollView>
    </View>
  );

  const mapBlock = (
    <MapSurface
      center={location.coords}
      markers={markers}
      selectedId={selectedId}
      userLocation={location.source === 'gps' ? location.coords : null}
      onSelectMarker={setSelectedId}
      height={isWide ? 520 : 260}
    />
  );

  const hasResults = status === 'ready' && results.length > 0;

  const listHeader = (
    <View style={{ gap: spacing.xl, paddingBottom: hasResults ? spacing.md : 0 }}>
      {searchAndFilters}
      {hasResults && recommended ? (
        <RecommendedPlaceCard scored={recommended} onNavigate={navigateTo} onDetails={openDetails} />
      ) : null}
      {navigationNotice}
      {hasResults && !isWide ? mapBlock : null}
      {hasResults ? (
        <AppText variant="section" accessibilityRole="header">
          {t('explore.nearbyPlaces')}
        </AppText>
      ) : null}
    </View>
  );

  const listEmpty =
    status === 'loading' ? (
      <LoadingState />
    ) : status === 'error' ? (
      <ErrorState onRetry={reload} />
    ) : (
      <EmptyState
        title={t('explore.emptyTitle')}
        message={openOnly ? t('explore.emptyFiltered') : t('explore.emptyGeneric')}
        actionLabel={openOnly ? t('explore.removeFilter') : t('explore.seeAll')}
        onAction={() => {
          setOpenOnly(false);
          setCategory(null);
          setQuery('');
        }}
      />
    );

  const listFooter =
    hasResults && hasMore ? (
      <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.xxl }}>
        <AppButton
          label={loadingMore ? t('common.loading') : t('explore.loadMore')}
          variant="secondary"
          icon="chevron-down"
          disabled={loadingMore}
          onPress={loadMore}
          accessibilityHint={t('explore.loadMoreHint')}
        />
      </View>
    ) : (
      <View style={{ height: spacing.xxl }} />
    );

  // Lista virtualizada como ÚNICO scroll vertical de la pantalla: solo se
  // montan las tarjetas visibles más una ventana acotada, sin importar
  // cuántas páginas se hayan cargado.
  const list = (
    <FlatList
      style={{ flex: 1 }}
      data={hasResults ? listData : []}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      ListFooterComponent={hasResults ? listFooter : null}
      initialNumToRender={LIST_INITIAL_RENDER}
      maxToRenderPerBatch={LIST_BATCH_SIZE}
      windowSize={LIST_WINDOW_SIZE}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    />
  );

  return (
    <ScreenContainer scroll={false} contentStyle={{ paddingBottom: 0 }}>
      {isWide ? (
        <View style={{ flexDirection: 'row', gap: spacing.xl, flex: 1 }}>
          <View style={{ flex: 5 }}>{list}</View>
          <View style={{ flex: 4, paddingTop: spacing.xxxl }}>{hasResults ? mapBlock : null}</View>
        </View>
      ) : (
        list
      )}
    </ScreenContainer>
  );
}
