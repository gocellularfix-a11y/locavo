import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useAppTheme } from '../theme/ThemeContext';
import { fontFamilies, radii, spacing, typography } from '../theme/tokens';

export interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchField({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'Buscar tacos, café, farmacia...',
  autoFocus = false,
}: SearchFieldProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radii.input,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.lg,
        minHeight: 52,
        gap: spacing.sm,
      }}
    >
      <Ionicons name="search" size={20} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        autoFocus={autoFocus}
        accessibilityLabel="Buscar lugares"
        accessibilityHint="Escribe qué necesitas, por ejemplo tacos o farmacia"
        style={{
          flex: 1,
          color: colors.textPrimary,
          fontSize: typography.body.fontSize,
          fontFamily: fontFamilies['400'],
          paddingVertical: spacing.md,
        }}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Limpiar búsqueda"
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
