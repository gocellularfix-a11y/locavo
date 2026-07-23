import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../components/AppText';
import { categoryLabelKey, CATEGORIES } from '../domain/categories';
import type { CategoryId } from '../domain/place';
import { formatDistanceLocalized } from '../i18n/format';
import { useI18n } from '../i18n/I18nContext';
import type { TranslationKey } from '../i18n/locales/es';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';
import { usePreferences } from './PreferenceContext';

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        borderRadius: radii.chip,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        backgroundColor: selected ? colors.brandSoft : pressed ? colors.neutralSoft : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.border,
      })}
    >
      <AppText variant="caption" color={selected ? colors.brand : colors.textPrimary}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ToggleRow({ labelKey, value, onToggle }: { labelKey: TranslationKey; value: boolean; onToggle: () => void }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={t(labelKey)}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: radii.button,
        paddingHorizontal: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: value ? colors.brandSoft : pressed ? colors.neutralSoft : colors.surface,
        borderWidth: 1,
        borderColor: value ? colors.brand : colors.border,
      })}
    >
      <AppText variant="bodyStrong" color={value ? colors.brand : colors.textPrimary}>
        {t(labelKey)}
      </AppText>
      <Ionicons
        name={value ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={value ? colors.brand : colors.textMuted}
      />
    </Pressable>
  );
}

const DISTANCE_OPTIONS: (number | null)[] = [null, 1, 3, 5, 10];

/** Sección de preferencias privadas para Ajustes (V5.4). */
export function PreferencesSettings() {
  const { colors } = useAppTheme();
  const { t, locale } = useI18n();
  const { profile, dispatch, reset } = usePreferences();
  const [confirmReset, setConfirmReset] = useState(false);

  const favSet = new Set<CategoryId>(profile.favoriteCategories);
  const reducedSet = new Set<CategoryId>(profile.reducedCategories);

  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="section" accessibilityRole="header">
        {t('pref.settings.title')}
      </AppText>
      <AppText variant="caption" tone="secondary">
        {t('pref.settings.privacy')}
      </AppText>

      <View style={{ gap: spacing.sm }}>
        <ToggleRow
          labelKey="pref.settings.openNow"
          value={profile.prefersOpenNow === true}
          onToggle={() => dispatch({ type: 'SET_OPEN_NOW_PREFERENCE', enabled: profile.prefersOpenNow !== true })}
        />
        <ToggleRow
          labelKey="pref.settings.accessible"
          value={profile.prefersAccessible === true}
          onToggle={() => dispatch({ type: 'SET_ACCESSIBILITY_PREFERENCE', enabled: profile.prefersAccessible !== true })}
        />
        <ToggleRow
          labelKey="pref.settings.family"
          value={profile.prefersFamilyFriendly === true}
          onToggle={() => dispatch({ type: 'SET_FAMILY_PREFERENCE', enabled: profile.prefersFamilyFriendly !== true })}
        />
        <ToggleRow
          labelKey="pref.settings.parking"
          value={profile.prefersParking === true}
          onToggle={() => dispatch({ type: 'SET_PARKING_PREFERENCE', enabled: profile.prefersParking !== true })}
        />
      </View>

      <AppText variant="label" tone="secondary">
        {t('pref.settings.favoriteCategories')}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            label={t(categoryLabelKey(c.id))}
            selected={favSet.has(c.id)}
            onPress={() => dispatch({ type: 'SET_FAVORITE_CATEGORY', categoryId: c.id, enabled: !favSet.has(c.id) })}
          />
        ))}
      </View>

      <AppText variant="label" tone="secondary">
        {t('pref.settings.reducedCategories')}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            label={t(categoryLabelKey(c.id))}
            selected={reducedSet.has(c.id)}
            onPress={() => dispatch({ type: 'SET_REDUCED_CATEGORY', categoryId: c.id, enabled: !reducedSet.has(c.id) })}
          />
        ))}
      </View>

      <AppText variant="label" tone="secondary">
        {t('pref.settings.maxDistance')}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {DISTANCE_OPTIONS.map((km) => (
          <Chip
            key={km ?? 'any'}
            label={km === null ? t('pref.settings.distanceAny') : formatDistanceLocalized(km, locale)}
            selected={(profile.preferredMaximumDistanceKm ?? null) === km}
            onPress={() => dispatch({ type: 'SET_DISTANCE_PREFERENCE', kilometers: km })}
          />
        ))}
      </View>

      <Pressable
        onPress={() => {
          if (confirmReset) {
            reset();
            setConfirmReset(false);
          } else {
            setConfirmReset(true);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={confirmReset ? t('pref.settings.resetConfirm') : t('pref.settings.reset')}
        style={({ pressed }) => ({
          minHeight: 48,
          borderRadius: radii.button,
          paddingHorizontal: spacing.lg,
          justifyContent: 'center',
          backgroundColor: pressed ? colors.dangerSoft : colors.surface,
          borderWidth: 1,
          borderColor: colors.danger,
        })}
      >
        <AppText variant="bodyStrong" color={colors.danger}>
          {confirmReset ? t('pref.settings.resetConfirm') : t('pref.settings.reset')}
        </AppText>
      </Pressable>
    </View>
  );
}
