import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '../../components/AppText';
import type { DecisionOption, DecisionSet } from '../../decision';
import { categoryLabelKey } from '../../domain/categories';
import { formatDistanceLocalized } from '../../i18n/format';
import { useI18n } from '../../i18n/I18nContext';
import type { TranslationKey } from '../../i18n/locales/es';
import { useAppTheme } from '../../theme/ThemeContext';
import { radii, spacing } from '../../theme/tokens';
import { ContextBadges } from './ContextBadges';
import { decisionReasonLabelKey, decisionRoleLabelKey, decisionTradeoffLabelKey } from './decisionLabels';
import type { IntentTodayCardModel } from './intentToday';
import {
  RecommendationCard,
  RecommendationEmptyState,
  confidenceLabelKey,
  type RecommendationStatus,
} from '../recommendations';

const OPEN_STATE_KEY: Readonly<Record<'open' | 'closed' | 'unknown', TranslationKey>> = {
  open: 'rec.reason.openNow',
  closed: 'rec.warn.closed',
  unknown: 'rec.warn.hoursUnknown',
};

function Chip({ labelKey, icon, tone }: { labelKey: TranslationKey; icon: keyof typeof Ionicons.glyphMap; tone: 'brand' | 'muted' }) {
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const color = tone === 'brand' ? colors.brand : colors.textSecondary;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: tone === 'brand' ? colors.brandSoft : colors.neutralSoft,
        borderRadius: radii.chip,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
      }}
    >
      <Ionicons name={icon} size={11} color={color} />
      <AppText variant="caption" color={color}>
        {t(labelKey)}
      </AppText>
    </View>
  );
}

/** Compone la etiqueta accesible: "Mejor opción. Nombre. Abierto ahora. 1,2 km." */
function optionA11yLabel(role: string, model: IntentTodayCardModel, locale: Parameters<typeof formatDistanceLocalized>[1], statusText: string): string {
  const parts = [role, model.today.model.name, statusText];
  if (model.today.model.distanceKm !== null) {
    parts.push(formatDistanceLocalized(model.today.model.distanceKm, locale));
  }
  return parts.join('. ');
}

function OptionHeader({
  option,
  model,
  emphasis,
}: {
  option: DecisionOption;
  model: IntentTodayCardModel;
  emphasis: boolean;
}) {
  const { t, locale } = useI18n();
  const { colors } = useAppTheme();
  const roleLabel = t(decisionRoleLabelKey(option.role));
  const reasonLabel = option.reasonCodes[0] ? t(decisionReasonLabelKey(option.reasonCodes[0])) : '';
  const statusText = t(OPEN_STATE_KEY[model.today.model.openState]);
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={optionA11yLabel(roleLabel, model, locale, statusText)}
      style={{ gap: 2 }}
    >
      <AppText variant={emphasis ? 'cardTitle' : 'label'} color={colors.brand}>
        {roleLabel}
      </AppText>
      {reasonLabel ? (
        <AppText variant="caption" tone="secondary">
          {reasonLabel}
        </AppText>
      ) : null}
    </View>
  );
}

function Tradeoffs({ option }: { option: DecisionOption }) {
  if (option.tradeoffCodes.length === 0) {
    return null;
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      {option.tradeoffCodes.map((code) => (
        <Chip key={code} labelKey={decisionTradeoffLabelKey(code)} icon="swap-horizontal" tone="muted" />
      ))}
    </View>
  );
}

function DecisionCard({
  option,
  model,
  emphasis,
  onSelect,
}: {
  option: DecisionOption;
  model: IntentTodayCardModel;
  emphasis: boolean;
  onSelect: (placeId: string) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        gap: spacing.sm,
        padding: emphasis ? spacing.md : 0,
        borderRadius: radii.cardLarge,
        borderWidth: emphasis ? 1 : 0,
        borderColor: emphasis ? colors.brand : 'transparent',
        backgroundColor: emphasis ? colors.brandSoft : 'transparent',
      }}
    >
      <OptionHeader option={option} model={model} emphasis={emphasis} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
        {model.intentBadgeKey ? <Chip labelKey={model.intentBadgeKey} icon="search" tone="brand" /> : null}
        {model.preferenceBadgeKey ? (
          <Chip labelKey={model.preferenceBadgeKey} icon={model.preferenceBadgeKey === 'pref.badge.favorite' ? 'heart' : 'sparkles'} tone="brand" />
        ) : null}
        <ContextBadges badges={model.today.contextBadges} />
      </View>
      <Tradeoffs option={option} />
      <RecommendationCard model={model.today.model} onSelect={onSelect} />
    </View>
  );
}

function CompareCell({ label, value, header }: { label?: string; value: string; header?: boolean }) {
  return (
    <View style={{ width: 120, paddingVertical: spacing.xs, paddingRight: spacing.sm }}>
      {label ? (
        <AppText variant="caption" tone="muted">
          {label}
        </AppText>
      ) : null}
      <AppText variant={header ? 'label' : 'caption'} tone={header ? 'primary' : 'secondary'} numberOfLines={2}>
        {value}
      </AppText>
    </View>
  );
}

function CompareMatrix({ options, byId }: { options: DecisionOption[]; byId: Map<string, IntentTodayCardModel> }) {
  const { t, locale } = useI18n();
  const rows: { key: TranslationKey; cell: (m: IntentTodayCardModel) => string }[] = [
    { key: 'decision.compare.category', cell: (m) => t(categoryLabelKey(m.today.model.category)) },
    { key: 'decision.compare.distance', cell: (m) => (m.today.model.distanceKm !== null ? formatDistanceLocalized(m.today.model.distanceKm, locale) : t('decision.value.no')) },
    { key: 'decision.compare.status', cell: (m) => t(OPEN_STATE_KEY[m.today.model.openState]) },
    { key: 'decision.compare.confidence', cell: (m) => t(confidenceLabelKey(m.today.model.confidence)) },
    { key: 'decision.compare.intent', cell: (m) => t(m.intentBadgeKey ? 'decision.value.yes' : 'decision.value.no') },
    { key: 'decision.compare.preference', cell: (m) => t(m.preferenceBadgeKey ? 'decision.value.yes' : 'decision.value.no') },
  ];
  const cols = options.map((o) => ({ option: o, model: byId.get(o.placeId) })).filter((c): c is { option: DecisionOption; model: IntentTodayCardModel } => Boolean(c.model));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={t('decision.compare.title')}>
      <View>
        {/* Encabezado: papel de cada opción */}
        <View style={{ flexDirection: 'row' }}>
          <CompareCell value={t('decision.compare.role')} header />
          {cols.map((c) => (
            <CompareCell key={c.option.placeId} value={t(decisionRoleLabelKey(c.option.role))} header />
          ))}
        </View>
        {rows.map((row) => (
          <View key={row.key} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'transparent' }}>
            <CompareCell value={t(row.key)} />
            {cols.map((c) => (
              <CompareCell key={c.option.placeId} value={row.cell(c.model)} />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export interface DecisionSectionProps {
  status: RecommendationStatus;
  decision: DecisionSet | null;
  models: readonly IntentTodayCardModel[];
  onSelect: (placeId: string) => void;
  hideWhenEmpty?: boolean;
}

/** Superficie de DECISIÓN (V5.6): un primario dominante + hasta dos alternativas. */
export function DecisionSection({ status, decision, models, onSelect, hideWhenEmpty = false }: DecisionSectionProps) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [comparing, setComparing] = useState(false);

  const byId = useMemo(() => new Map(models.map((m) => [m.today.model.placeId, m])), [models]);

  if (status === 'loading') {
    return null;
  }
  if (!decision || !decision.primary) {
    return hideWhenEmpty ? null : <RecommendationEmptyState />;
  }

  const primaryModel = byId.get(decision.primary.placeId);
  if (!primaryModel) {
    return hideWhenEmpty ? null : <RecommendationEmptyState />;
  }

  const alternatives = decision.alternatives
    .map((option) => ({ option, model: byId.get(option.placeId) }))
    .filter((entry): entry is { option: DecisionOption; model: IntentTodayCardModel } => Boolean(entry.model));

  const compareOptions = [decision.primary, ...decision.alternatives];
  const canCompare = compareOptions.length >= 2;

  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="section" accessibilityRole="header">
        {t('decision.section.title')}
      </AppText>

      <DecisionCard option={decision.primary} model={primaryModel} emphasis onSelect={onSelect} />

      {alternatives.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="label" tone="secondary" accessibilityRole="header">
            {t('decision.alternatives.title')}
          </AppText>
          {alternatives.map(({ option, model }) => (
            <DecisionCard key={option.placeId} option={option} model={model} emphasis={false} onSelect={onSelect} />
          ))}
        </View>
      ) : null}

      {canCompare ? (
        <View style={{ gap: spacing.sm }}>
          <Pressable
            onPress={() => setComparing((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: comparing }}
            accessibilityLabel={t(comparing ? 'decision.compare.close' : 'decision.compare.open')}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              alignSelf: 'flex-start',
              minHeight: 44,
              paddingHorizontal: spacing.md,
              borderRadius: radii.chip,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.neutralSoft : colors.surface,
            })}
          >
            <Ionicons name={comparing ? 'chevron-up' : 'git-compare'} size={16} color={colors.brand} />
            <AppText variant="label" color={colors.brand}>
              {t(comparing ? 'decision.compare.close' : 'decision.compare.open')}
            </AppText>
          </Pressable>
          {comparing ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radii.card,
                padding: spacing.md,
                backgroundColor: colors.surface,
              }}
            >
              <AppText variant="label" style={{ marginBottom: spacing.xs }}>
                {t('decision.compare.title')}
              </AppText>
              <CompareMatrix options={compareOptions} byId={byId} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
