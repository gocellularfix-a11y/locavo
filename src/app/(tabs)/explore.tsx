import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { EmptyState, ErrorState, LoadingState } from '../../components/FeedbackStates';
import { PlaceCard } from '../../components/PlaceCard';
import { RecommendedPlaceCard } from '../../components/RecommendedPlaceCard';
import { ScreenContainer } from '../../components/ScreenContainer';
import { SearchField } from '../../components/SearchField';
import { CATEGORIES, getCategoryMeta, isCategoryId } from '../../domain/categories';
import type { CategoryId } from '../../domain/place';
import type { ScoredPlace } from '../../domain/recommendation';
import { MapSurface } from '../../features/map/MapSurface';
import { usePlacesQuery } from '../../hooks/usePlacesQuery';
import { analytics, navigationProvider } from '../../services/container';
import { useLocationState } from '../../state/LocationContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function FilterChip({ label, active, onPress }: FilterChipProps) {
  const { colors } = useAppTheme();
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
        backgroundColor: active
          ? pressed
            ? colors.brandPressed
            : colors.brand
          : pressed
            ? colors.neutralSoft
            : colors.surface,
        borderWidth: active ? 0 : 1,
        borderColor: colors.border,
      })}
    >
      <AppText variant="label" color={active ? colors.onBrand : colors.textPrimary}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
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

  const { status, results, recommended, reload } = usePlacesQuery({
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

  const markers = useMemo(
    () =>
      results.map((r) => ({
        id: r.place.id,
        latitude: r.place.latitude,
        longitude: r.place.longitude,
        label: r.place.name,
      })),
    [results],
  );

  const categoryLabel = category ? getCategoryMeta(category).label : 'Todos los lugares';
  const isWide = width >= 900;

  const navigateTo = (scored: ScoredPlace) => {
    analytics.track({
      eventName: 'navigation_requested',
      navigationProvider: navigationProvider.id,
      placeId: scored.place.id,
    });
    navigationProvider.openDirections(scored.place);
  };
  const openDetails = (scored: ScoredPlace) => router.push(`/place/${scored.place.id}`);

  const header = (
    <View style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.push('/'))}
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
        <View style={{ flex: 1 }}>
          <AppText variant="section" accessibilityRole="header" numberOfLines={1}>
            {categoryLabel}
          </AppText>
          <AppText variant="caption" tone="secondary">
            Culiacán · {location.label}
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
        placeholder={category ? `Buscar en ${categoryLabel.toLowerCase()}…` : undefined}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm }}
      >
        <FilterChip
          label="Abierto ahora"
          active={openOnly}
          onPress={() => setOpenOnly((v) => !v)}
        />
        <FilterChip
          label="Cerca"
          active={sortByDistance}
          onPress={() => setSortByDistance((v) => !v)}
        />
        {CATEGORIES.map((c) => (
          <FilterChip
            key={c.id}
            label={c.label}
            active={category === c.id}
            onPress={() => {
              const next = category === c.id ? null : c.id;
              setCategory(next);
              if (next) {
                analytics.track({ eventName: 'category_selected', category: next });
              }
            }}
          />
        ))}
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

  const listBlock = (
    <View style={{ gap: spacing.md }}>
      <AppText variant="section" accessibilityRole="header">
        Lugares cercanos
      </AppText>
      {results.slice(recommended ? 1 : 0).map((scored) => (
        <PlaceCard
          key={scored.place.id}
          scored={scored}
          selected={scored.place.id === selectedId}
          onPress={(s) => {
            setSelectedId(s.place.id);
            openDetails(s);
          }}
        />
      ))}
    </View>
  );

  let body: React.ReactNode;
  if (status === 'loading') {
    body = <LoadingState />;
  } else if (status === 'error') {
    body = <ErrorState onRetry={reload} />;
  } else if (results.length === 0) {
    body = (
      <EmptyState
        title="Sin resultados"
        message={
          openOnly
            ? 'Nada abierto con esos filtros ahora mismo. Quita "Abierto ahora" o cambia de categoría.'
            : 'Prueba con otra categoría o cambia tu búsqueda.'
        }
        actionLabel={openOnly ? 'Quitar filtro' : 'Ver todo'}
        onAction={() => {
          setOpenOnly(false);
          setCategory(null);
          setQuery('');
        }}
      />
    );
  } else if (isWide) {
    body = (
      <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
        <View style={{ flex: 5, gap: spacing.xl }}>
          {recommended ? (
            <RecommendedPlaceCard
              scored={recommended}
              onNavigate={navigateTo}
              onDetails={openDetails}
            />
          ) : null}
          {listBlock}
        </View>
        <View style={{ flex: 4 }}>{mapBlock}</View>
      </View>
    );
  } else {
    body = (
      <View style={{ gap: spacing.xl }}>
        {recommended ? (
          <RecommendedPlaceCard
            scored={recommended}
            onNavigate={navigateTo}
            onDetails={openDetails}
          />
        ) : null}
        {mapBlock}
        {listBlock}
      </View>
    );
  }

  return (
    <ScreenContainer>
      <View style={{ gap: spacing.xl }}>
        {header}
        {body}
      </View>
    </ScreenContainer>
  );
}
