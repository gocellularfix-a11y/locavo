import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { AppText } from '../../components/AppText';
import { evaluateContext, type ContextProfile } from '../../context';
import { useI18n } from '../../i18n/I18nContext';
import {
  buildIntentSnapshot,
  parseIntentText,
  resolveIntent,
  type IntentId,
  type IntentSnapshot,
} from '../../intent';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';
import { intentChipLabelKey } from './intentToday';

/** Subconjunto de chips por franja (reglas explícitas, no IA). */
const CHIP_POOL: Readonly<Record<ContextProfile, IntentId[]>> = {
  breakfast: ['BREAKFAST', 'COFFEE', 'NEARBY', 'OPEN_NOW'],
  coffee: ['COFFEE', 'BREAKFAST', 'NEARBY', 'OPEN_NOW'],
  lunch: ['LUNCH', 'FAMILY_ACTIVITY', 'NEARBY', 'OPEN_NOW'],
  dinner: ['DINNER', 'NIGHTLIFE', 'FAMILY_ACTIVITY', 'OPEN_NOW'],
  nightlife: ['NIGHTLIFE', 'ENTERTAINMENT', 'OPEN_LATE', 'NEARBY'],
  lateNight: ['OPEN_LATE', 'PHARMACY', 'FUEL', 'NEARBY'],
  shopping: ['SHOPPING', 'COFFEE', 'NEARBY', 'OPEN_NOW'],
  familyAfternoon: ['FAMILY_ACTIVITY', 'COFFEE', 'NEARBY', 'OPEN_NOW'],
  quickStop: ['QUICK_STOP', 'PHARMACY', 'FUEL', 'NEARBY'],
};

export interface IntentBarProps {
  onIntentChange: (snapshot: IntentSnapshot | null) => void;
}

function Chip({ labelKey, selected, onPress }: { labelKey: ReturnType<typeof intentChipLabelKey>; selected: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={t(labelKey)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        borderRadius: radii.chip,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        backgroundColor: selected ? colors.brandSoft : pressed ? colors.neutralSoft : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.brand : colors.border,
      })}
    >
      {selected ? <Ionicons name="checkmark" size={12} color={colors.brand} /> : null}
      <AppText variant="caption" color={selected ? colors.brand : colors.textPrimary}>
        {t(labelKey)}
      </AppText>
    </Pressable>
  );
}

export function IntentBar({ onIntentChange }: IntentBarProps) {
  const { colors } = useAppTheme();
  const { t, locale } = useI18n();
  const [now] = useState(() => new Date());
  const profile = useMemo(() => evaluateContext(now).profile, [now]);
  const chips = CHIP_POOL[profile];

  const [text, setText] = useState('');
  const [activeId, setActiveId] = useState<IntentId | null>(null);
  const [message, setMessage] = useState<'unknown' | null>(null);
  const [ambiguous, setAmbiguous] = useState<IntentId[] | null>(null);

  const applyExplicit = (id: IntentId) => {
    const resolved = resolveIntent(parseIntentText('', locale), id);
    if (resolved) {
      onIntentChange(buildIntentSnapshot(resolved));
      setActiveId(id);
      setMessage(null);
      setAmbiguous(null);
    }
  };

  const submitText = () => {
    const resolved = resolveIntent(parseIntentText(text, locale));
    if (!resolved) {
      setMessage('unknown');
      setAmbiguous(null);
      setActiveId(null);
      onIntentChange(null);
      return;
    }
    if (resolved.ambiguity && resolved.ambiguousPrimaries && resolved.ambiguousPrimaries.length > 1) {
      setAmbiguous(resolved.ambiguousPrimaries);
      setMessage(null);
      return;
    }
    onIntentChange(buildIntentSnapshot(resolved));
    setActiveId(resolved.primaryIntent);
    setMessage(null);
    setAmbiguous(null);
  };

  const clear = () => {
    setText('');
    setActiveId(null);
    setMessage(null);
    setAmbiguous(null);
    onIntentChange(null);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label" tone="secondary">
        {t('intent.input.label')}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            borderRadius: radii.input,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
          }}
        >
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={text}
            onChangeText={setText}
            onSubmitEditing={submitText}
            returnKeyType="search"
            placeholder={t('intent.input.placeholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('intent.input.label')}
            style={{ flex: 1, paddingVertical: spacing.sm, color: colors.textPrimary }}
          />
          {text.length > 0 || activeId ? (
            <Pressable onPress={clear} accessibilityRole="button" accessibilityLabel={t('intent.clear')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {message === 'unknown' ? (
        <AppText variant="caption" tone="secondary" accessibilityLiveRegion="polite">
          {t('intent.unknown')}
        </AppText>
      ) : null}

      {ambiguous ? (
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" tone="secondary">
            {t('intent.ambiguous.title')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {ambiguous.map((id) => (
              <Chip key={id} labelKey={intentChipLabelKey(id)} selected={activeId === id} onPress={() => applyExplicit(id)} />
            ))}
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {chips.map((id) => (
            <Chip key={id} labelKey={intentChipLabelKey(id)} selected={activeId === id} onPress={() => applyExplicit(id)} />
          ))}
        </View>
      )}
    </View>
  );
}
