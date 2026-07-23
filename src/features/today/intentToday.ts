/**
 * Capa de INTENCIÓN sobre Today (V5.5) — pura y determinista.
 *
 * Compone, sin modificarlos: V5.4 personalizado (contexto + preferencias) + el
 * ajuste de intención (V5.5). Orden final:
 *   finalScore = contextualScore × preferenceMultiplier × intentMultiplier.
 * Preserva score base, confianza, score contextual y multiplicador de
 * preferencias. Sin intención activa → orden idéntico al personalizado (limpiar
 * la intención restaura Today normal). Desempate por placeId.
 */
import type { ContextSnapshot } from '../../context';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import type { TranslationKey } from '../../i18n/locales/es';
import {
  evaluateIntentAdjustment,
  type IntentId,
  type IntentReasonCode,
  type IntentSnapshot,
} from '../../intent';
import type { PreferenceSnapshot } from '../../preferences';
import type { RecommendationCardModel } from '../recommendations';
import { buildPersonalizedTodayModels, type PersonalizedTodayCardModel } from './personalizedToday';

const INTENT_REASON_KEY: Readonly<Record<IntentReasonCode, TranslationKey>> = {
  INTENT_EXACT_MATCH: 'intent.reason.match',
  INTENT_CATEGORY_MATCH: 'intent.reason.match',
  INTENT_BREAKFAST_MATCH: 'intent.reason.match',
  INTENT_COFFEE_MATCH: 'intent.reason.match',
  INTENT_LUNCH_MATCH: 'intent.reason.match',
  INTENT_DINNER_MATCH: 'intent.reason.match',
  INTENT_FAMILY_MATCH: 'intent.reason.family',
  INTENT_QUICK_STOP_MATCH: 'intent.reason.match',
  INTENT_PHARMACY_MATCH: 'intent.reason.match',
  INTENT_MEDICAL_MATCH: 'intent.reason.match',
  INTENT_FUEL_MATCH: 'intent.reason.match',
  INTENT_LODGING_MATCH: 'intent.reason.match',
  INTENT_ENTERTAINMENT_MATCH: 'intent.reason.match',
  INTENT_ACCESSIBILITY_MATCH: 'intent.reason.accessibility',
  INTENT_OPEN_NOW_MATCH: 'intent.reason.openNow',
  INTENT_OPEN_LATE_MATCH: 'intent.reason.openLate',
  INTENT_NEARBY_MATCH: 'intent.reason.nearby',
};

const CHIP_KEY: Readonly<Record<IntentId, TranslationKey>> = {
  BREAKFAST: 'intent.chip.BREAKFAST', COFFEE: 'intent.chip.COFFEE', LUNCH: 'intent.chip.LUNCH',
  DINNER: 'intent.chip.DINNER', NIGHTLIFE: 'intent.chip.NIGHTLIFE', FAMILY_ACTIVITY: 'intent.chip.FAMILY_ACTIVITY',
  QUICK_STOP: 'intent.chip.QUICK_STOP', SHOPPING: 'intent.chip.SHOPPING', PHARMACY: 'intent.chip.PHARMACY',
  MEDICAL: 'intent.chip.MEDICAL', FUEL: 'intent.chip.FUEL', LODGING: 'intent.chip.LODGING',
  ENTERTAINMENT: 'intent.chip.ENTERTAINMENT', ACCESSIBLE: 'intent.chip.ACCESSIBLE', OPEN_NOW: 'intent.chip.OPEN_NOW',
  OPEN_LATE: 'intent.chip.OPEN_LATE', NEARBY: 'intent.chip.NEARBY',
};

export function intentReasonLabelKey(code: IntentReasonCode): TranslationKey {
  return INTENT_REASON_KEY[code];
}
export function intentChipLabelKey(id: IntentId): TranslationKey {
  return CHIP_KEY[id];
}

export interface IntentTodayCardModel {
  today: PersonalizedTodayCardModel['today'];
  preferenceBadgeKey?: TranslationKey;
  intentBadgeKey?: TranslationKey;
  finalScore: number;
  rank: number;
}

export interface IntentTodayDiagnostics {
  candidatesExcluded: number;
  adjustmentsApplied: number;
  cappedAdjustments: number;
}

export interface IntentTodayResult {
  models: IntentTodayCardModel[];
  diagnostics: IntentTodayDiagnostics;
}

export function buildIntentTodayModels(
  baseModels: readonly RecommendationCardModel[],
  placesById: ReadonlyMap<string, LocavoPlace>,
  context: ContextSnapshot,
  preferences: PreferenceSnapshot,
  intent: IntentSnapshot | null,
  limit = 5,
): IntentTodayResult {
  // Personalizado (V5.4) sobre TODA la población, sin truncar.
  const personalized = buildPersonalizedTodayModels(baseModels, placesById, context, preferences, baseModels.length).models;

  const diagnostics: IntentTodayDiagnostics = { candidatesExcluded: 0, adjustmentsApplied: 0, cappedAdjustments: 0 };

  interface Entry {
    base: PersonalizedTodayCardModel;
    intentBadgeKey?: TranslationKey;
    finalScore: number;
  }
  const entries: Entry[] = [];

  for (const pm of personalized) {
    if (!intent) {
      entries.push({ base: pm, finalScore: pm.personalizedScore });
      continue;
    }
    const place = placesById.get(pm.today.model.placeId);
    const adjustment = evaluateIntentAdjustment(
      {
        placeId: pm.today.model.placeId,
        category: pm.today.model.category,
        openState: pm.today.model.openState,
        distanceKm: pm.today.model.distanceKm,
        accessible: place?.features?.wheelchairAccessible,
        family: place?.features?.familyFriendly,
      },
      intent,
    );
    if (adjustment.exclusion) {
      diagnostics.candidatesExcluded += 1;
      continue;
    }
    diagnostics.adjustmentsApplied += adjustment.adjustments;
    if (adjustment.capped) {
      diagnostics.cappedAdjustments += 1;
    }
    const intentReasonKeys = adjustment.reasonCodes.map(intentReasonLabelKey);
    const merged: PersonalizedTodayCardModel = {
      ...pm,
      today: {
        ...pm.today,
        model: { ...pm.today.model, reasonKeys: [...pm.today.model.reasonKeys, ...intentReasonKeys] },
      },
    };
    entries.push({
      base: merged,
      intentBadgeKey: adjustment.reasonCodes.length > 0 ? intentChipLabelKey(intent.primaryIntent) : undefined,
      finalScore: pm.personalizedScore * adjustment.multiplier,
    });
  }

  entries.sort((a, b) => {
    if (b.finalScore !== a.finalScore) {
      return b.finalScore - a.finalScore;
    }
    return a.base.today.model.placeId < b.base.today.model.placeId ? -1 : a.base.today.model.placeId > b.base.today.model.placeId ? 1 : 0;
  });

  const models = entries.slice(0, limit).map((entry, index) => ({
    today: entry.base.today,
    preferenceBadgeKey: entry.base.preferenceBadgeKey,
    intentBadgeKey: entry.intentBadgeKey,
    finalScore: entry.finalScore,
    rank: index + 1,
  }));

  return { models, diagnostics };
}
