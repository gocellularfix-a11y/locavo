import React from 'react';
import { View } from 'react-native';

import { AppText } from './AppText';
import { useAppTheme } from '../theme/ThemeContext';

/**
 * Logotipo tipográfico temporal: "locavo" en minúsculas con la última "o"
 * en coral y un punto de ubicación integrado. No es el logotipo definitivo.
 */
export function LocavoWordmark({ size = 28 }: { size?: number }) {
  const { colors } = useAppTheme();
  const dot = Math.max(5, Math.round(size * 0.2));

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel="Locavo"
      style={{ flexDirection: 'row', alignItems: 'center' }}
    >
      <AppText
        variant="title"
        style={{ fontSize: size, lineHeight: Math.round(size * 1.2), letterSpacing: -0.5 }}
      >
        locav
      </AppText>
      <AppText
        variant="title"
        tone="brand"
        style={{ fontSize: size, lineHeight: Math.round(size * 1.2), letterSpacing: -0.5 }}
      >
        o
      </AppText>
      <View
        style={{
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: colors.accent,
          marginLeft: 2,
          marginTop: -Math.round(size * 0.45),
        }}
      />
    </View>
  );
}
