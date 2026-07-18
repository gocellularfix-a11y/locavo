import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from './AppText';
import { useAppTheme } from '../theme/ThemeContext';
import { radii, spacing } from '../theme/tokens';

export interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

/** Botón estándar con área táctil amplia (mínimo 48 px de alto). */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  accessibilityHint,
  style,
}: AppButtonProps) {
  const { colors } = useAppTheme();

  const background = (pressed: boolean): string => {
    switch (variant) {
      case 'primary':
        return pressed ? colors.brandPressed : colors.brand;
      case 'secondary':
        return pressed ? colors.neutralSoft : colors.surface;
      case 'ghost':
        return pressed ? colors.neutralSoft : 'transparent';
    }
  };
  const textTone = variant === 'primary' ? colors.onBrand : colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          minHeight: 48,
          borderRadius: radii.button,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          backgroundColor: background(pressed),
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={textTone} /> : null}
      <AppText variant="bodyStrong" color={textTone}>
        {label}
      </AppText>
    </Pressable>
  );
}
