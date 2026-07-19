import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable } from 'react-native';

import { AppText } from '../../components/AppText';
import { useI18n } from '../../i18n/I18nContext';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';

export interface SurpriseButtonProps {
  onPress: () => void;
  disabled?: boolean;
  /** Respiración sutil solo con pantalla activa y sin movimiento reducido. */
  breathe?: boolean;
}

const BREATH_SCALE = 1.015;
const BREATH_DURATION_MS = 1_600;

/**
 * CTA principal de Locavo: acento fuerte de marca, brillo sutil y una
 * respiración discreta (transform nativo, 60 FPS). Sin nuevas dependencias.
 */
export function SurpriseButton({ onPress, disabled = false, breathe = false }: SurpriseButtonProps) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const [scale] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!breathe || disabled) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: BREATH_SCALE,
          duration: BREATH_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: BREATH_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      scale.setValue(1);
    };
  }, [breathe, disabled, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t('home.surprise')}
        accessibilityHint={t('home.surpriseHint')}
        accessibilityState={{ disabled, busy: disabled }}
        style={({ pressed }) => ({
          minHeight: 56,
          borderRadius: radii.button,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          backgroundColor: pressed ? colors.brandPressed : colors.brand,
          opacity: disabled ? 0.6 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          transform: [{ scale: pressed ? 0.97 : 1 }],
          // Brillo sutil de marca (elevation en Android, sombra en iOS/web).
          shadowColor: colors.brand,
          shadowOpacity: 0.35,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        })}
      >
        <Ionicons name="dice" size={22} color={colors.onBrand} />
        <AppText variant="cardTitle" color={colors.onBrand}>
          {t('home.surprise')}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
