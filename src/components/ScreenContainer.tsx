import React from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../theme/ThemeContext';
import { spacing } from '../theme/tokens';

export interface ScreenContainerProps {
  children: React.ReactNode;
  /** Sin scroll (la pantalla gestiona sus propias listas). */
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Contenedor base de pantalla: fondo del tema, safe areas y ancho máximo
 * controlado en pantallas grandes (escritorio/web).
 */
export function ScreenContainer({ children, scroll = true, contentStyle }: ScreenContainerProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const inner = (
    <View
      style={[
        {
          width: '100%',
          maxWidth: 1080,
          alignSelf: 'center',
          paddingHorizontal: spacing.xl,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: spacing.xxxl,
          flexGrow: 1,
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  if (!scroll) {
    return <View style={{ flex: 1, backgroundColor: colors.background }}>{inner}</View>;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      {inner}
    </ScrollView>
  );
}
