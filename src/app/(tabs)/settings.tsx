import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { ScreenContainer } from '../../components/ScreenContainer';
import { PreferencesSettings } from '../../preferences/PreferencesSettings';
import { useI18n } from '../../i18n/I18nContext';
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '../../i18n/types';
import { MANUAL_LOCATIONS } from '../../services/location';
import { useLocationState } from '../../state/LocationContext';
import { useAppTheme, type ThemeMode } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';

interface OptionRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function OptionRow({ label, selected, onPress }: OptionRowProps) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: radii.button,
        paddingHorizontal: spacing.lg,
        justifyContent: 'center',
        backgroundColor: selected
          ? colors.brandSoft
          : pressed
            ? colors.neutralSoft
            : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.border,
      })}
    >
      <AppText variant="bodyStrong" color={selected ? colors.brand : colors.textPrimary}>
        {label}
      </AppText>
    </Pressable>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: radii.button,
        paddingHorizontal: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: pressed ? colors.neutralSoft : colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      })}
    >
      <AppText variant="bodyStrong">{label}</AppText>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="section" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { mode, setMode } = useAppTheme();
  const { t, locale, setLocale } = useI18n();
  const location = useLocationState();

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: t('settings.theme.system') },
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
  ];

  return (
    <ScreenContainer>
      <View style={{ gap: spacing.xxxl }}>
        <AppText variant="title" accessibilityRole="header">
          {t('settings.title')}
        </AppText>

        <Section title={t('settings.language')}>
          <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
            {SUPPORTED_LOCALES.map((supported) => (
              <OptionRow
                key={supported}
                label={LOCALE_NAMES[supported]}
                selected={locale === supported}
                onPress={() => setLocale(supported)}
              />
            ))}
          </View>
        </Section>

        <Section title={t('settings.theme')}>
          <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
            {themeOptions.map((option) => (
              <OptionRow
                key={option.value}
                label={option.label}
                selected={mode === option.value}
                onPress={() => setMode(option.value)}
              />
            ))}
          </View>
        </Section>

        <Section title={t('settings.manualLocation')}>
          <AppText variant="body" tone="secondary">
            {t('settings.manualLocationBody')}
          </AppText>
          <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
            {MANUAL_LOCATIONS.map((manual) => (
              <OptionRow
                key={manual.id}
                label={manual.label}
                selected={location.source === 'manual' && location.manualLocation.id === manual.id}
                onPress={() => location.setManualLocation(manual)}
              />
            ))}
          </View>
        </Section>

        <PreferencesSettings />

        <Section title={t('settings.privacy')}>
          <AppText variant="body" tone="secondary">
            {t('settings.privacyBody')}
          </AppText>
        </Section>

        <Section title={t('settings.info')}>
          <View style={{ gap: spacing.sm }}>
            <LinkRow label={t('settings.privacyLink')} onPress={() => router.push('/privacy')} />
            <LinkRow label={t('settings.termsLink')} onPress={() => router.push('/terms')} />
            <LinkRow label={t('settings.supportLink')} onPress={() => router.push('/support')} />
          </View>
        </Section>

        <Section title={t('settings.demoData')}>
          <AppText variant="body" tone="secondary">
            {t('settings.demoDataBody')}
          </AppText>
        </Section>
      </View>
    </ScreenContainer>
  );
}
