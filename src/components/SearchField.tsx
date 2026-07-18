import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useI18n } from '../i18n/I18nContext';
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
  placeholder,
  autoFocus = false,
}: SearchFieldProps) {
  const { colors } = useAppTheme();
  const { t } = useI18n();

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
        placeholder={placeholder ?? t('home.searchPlaceholder')}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        autoFocus={autoFocus}
        accessibilityLabel={t('search.a11yLabel')}
        accessibilityHint={t('search.a11yHint')}
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
          accessibilityLabel={t('search.clear')}
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
