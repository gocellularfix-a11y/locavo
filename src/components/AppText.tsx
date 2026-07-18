import React from 'react';
import { Text, type TextProps } from 'react-native';

import { useAppTheme } from '../theme/ThemeContext';
import { fontFamilies, typography, type TypeVariant } from '../theme/tokens';

type Variant = keyof typeof typography;
type Tone = 'primary' | 'secondary' | 'muted' | 'brand' | 'onBrand' | 'success' | 'warning' | 'danger';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  color?: string;
}

export function AppText({
  variant = 'body',
  tone = 'primary',
  color,
  style,
  ...rest
}: AppTextProps) {
  const { colors } = useAppTheme();
  const type: TypeVariant = typography[variant];
  const toneColor: Record<Tone, string> = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    brand: colors.brand,
    onBrand: colors.onBrand,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  };

  return (
    <Text
      {...rest}
      style={[
        {
          fontSize: type.fontSize,
          lineHeight: type.lineHeight,
          fontWeight: type.fontWeight,
          fontFamily: fontFamilies[type.fontWeight],
          color: color ?? toneColor[tone],
        },
        style,
      ]}
    />
  );
}
