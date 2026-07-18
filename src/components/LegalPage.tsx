import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from './AppText';
import { ScreenContainer } from './ScreenContainer';
import { useI18n } from '../i18n/I18nContext';
import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

export interface LegalSection {
  heading?: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalPageProps {
  title: string;
  intro?: string;
  sections: LegalSection[];
  /** Nota destacada al final (p. ej. aviso de documento inicial). */
  note?: string;
}

/**
 * Página pública informativa (privacidad, términos, soporte).
 * Diseñada para funcionar por URL directa en web y dentro de la app.
 */
export function LegalPage({ title, intro, sections, note }: LegalPageProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { t } = useI18n();

  return (
    <ScreenContainer contentStyle={{ maxWidth: 760 }}>
      <View style={{ gap: spacing.xl }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.push('/'))}
          accessibilityRole="button"
          accessibilityLabel={t('common.backToApp')}
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            alignSelf: 'flex-start',
            minHeight: 44,
            paddingRight: spacing.md,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="arrow-back" size={20} color={colors.brand} />
          <AppText variant="bodyStrong" tone="brand">
            {t('common.backToApp')}
          </AppText>
        </Pressable>

        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>

        {intro ? (
          <AppText variant="body" tone="secondary">
            {intro}
          </AppText>
        ) : null}

        {sections.map((section, index) => (
          <View key={index} style={{ gap: spacing.md }}>
            {section.heading ? (
              <AppText variant="section" accessibilityRole="header">
                {section.heading}
              </AppText>
            ) : null}
            {section.paragraphs.map((paragraph, pIndex) => (
              <AppText key={pIndex} variant="body" tone="secondary">
                {paragraph}
              </AppText>
            ))}
            {section.bullets ? (
              <View style={{ gap: spacing.sm }}>
                {section.bullets.map((bullet, bIndex) => (
                  <View
                    key={bIndex}
                    style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}
                  >
                    <AppText variant="body" tone="brand">
                      •
                    </AppText>
                    <AppText variant="body" tone="secondary" style={{ flex: 1 }}>
                      {bullet}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}

        {note ? (
          <View
            style={{
              backgroundColor: colors.warningSoft,
              borderRadius: 16,
              padding: spacing.lg,
            }}
          >
            <AppText variant="bodyStrong" color={colors.warning}>
              {note}
            </AppText>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
