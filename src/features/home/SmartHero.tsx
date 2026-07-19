import React, { useMemo } from 'react';
import { Animated, View } from 'react-native';

import { SurpriseButton } from './SurpriseButton';
import { getContextualSuggestions } from './suggestions';
import { getTimeOfDayContext } from './timeOfDay';
import { useRotatingSuggestion } from './useRotatingSuggestion';
import { AppText } from '../../components/AppText';
import { SearchField } from '../../components/SearchField';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useScreenActive } from '../../hooks/useScreenActive';
import { useI18n } from '../../i18n/I18nContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { cardShadow, radii, spacing } from '../../theme/tokens';

export interface SmartHeroProps {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSurprise: () => void;
  surprising: boolean;
  /** Mensaje localizado cuando la sorpresa no encontró lugares elegibles. */
  fallbackMessage?: string | null;
}

/**
 * Hero vivo del inicio (V4A.2): encabezado, sugerencia contextual rotativa,
 * CTA "Sorpréndeme", búsqueda y el mensaje de marca. Compacto para que las
 * categorías destacadas queden visibles sin scroll excesivo.
 */
export function SmartHero({
  search,
  onSearchChange,
  onSearchSubmit,
  onSurprise,
  surprising,
  fallbackMessage = null,
}: SmartHeroProps) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const active = useScreenActive();
  const reducedMotion = useReducedMotion();

  const timeOfDay = getTimeOfDayContext(new Date());
  const suggestionKeys = useMemo(() => getContextualSuggestions(timeOfDay), [timeOfDay]);
  const rotation = useRotatingSuggestion(suggestionKeys.length, active, reducedMotion);
  const currentSuggestion = t(suggestionKeys[rotation.index]);

  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceElevated,
          borderRadius: radii.cardLarge,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.xl,
          gap: spacing.lg,
        },
        cardShadow,
      ]}
    >
      <AppText variant="display" accessibilityRole="header">
        {t('home.heroTitle')}
      </AppText>

      {/* Sin región viva: el lector no anuncia cada rotación automática,
          pero la sugerencia visible sí es enfocable y legible. */}
      <View style={{ minHeight: 24, justifyContent: 'center' }}>
        <Animated.View
          style={{ opacity: rotation.opacity, transform: [{ translateY: rotation.translateY }] }}
        >
          <AppText variant="bodyStrong" tone="secondary" numberOfLines={2}>
            {currentSuggestion}
          </AppText>
        </Animated.View>
      </View>

      <SurpriseButton
        onPress={onSurprise}
        disabled={surprising}
        breathe={active && !reducedMotion}
      />

      {fallbackMessage ? (
        <AppText
          variant="caption"
          tone="secondary"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {fallbackMessage}
        </AppText>
      ) : null}

      <View style={{ gap: spacing.xs }}>
        <SearchField
          value={search}
          onChangeText={onSearchChange}
          onSubmit={onSearchSubmit}
          placeholder={t('home.searchPlaceholder')}
        />
        <AppText variant="caption" tone="muted">
          {t('home.searchExamples')}
        </AppText>
      </View>

      <AppText variant="caption" tone="brand" style={{ textAlign: 'center', letterSpacing: 0.6 }}>
        {t('home.tagline')}
      </AppText>
    </View>
  );
}
