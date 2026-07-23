/**
 * Capa PERSONALIZADA de Today (V5.4) — pura y determinista.
 *
 * Compone, sin modificarlos: V5.2 `buildTodayModels` (contexto) + el ajuste de
 * preferencias (V5.4). Orden final:
 *   personalizedScore = contextualScore × preferenceMultiplier (acotado).
 * NO reemplaza el score base de V5.0, NO cambia la confianza, NO altera los
 * multiplicadores de contexto de V5.2. Los lugares ocultos se excluyen.
 * Desempate estable por placeId.
 */
import type { ContextSnapshot } from '../../context';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import type { TranslationKey } from '../../i18n/locales/es';
import {
  evaluatePreferenceAdjustment,
  type PreferenceReasonCode,
  type PreferenceSnapshot,
} from '../../preferences';
import { buildTodayModels, type TodayCardModel } from './todayModel';

const PREF_REASON_KEY: Readonly<Record<PreferenceReasonCode, TranslationKey>> = {
  PREF_FAVORITE_PLACE: 'pref.reason.favorite',
  PREF_FAVORITE_CATEGORY: 'pref.reason.favoriteCategory',
  PREF_DISTANCE_MATCH: 'pref.reason.distance',
  PREF_ACCESSIBILITY_MATCH: 'pref.reason.accessibility',
  PREF_FAMILY_MATCH: 'pref.reason.family',
  PREF_PARKING_MATCH: 'pref.reason.parking',
  PREF_OPEN_NOW_MATCH: 'pref.reason.openNow',
  PREF_PREVIOUS_DIRECTIONS: 'pref.reason.previousDirections',
};

export function preferenceReasonLabelKey(code: PreferenceReasonCode): TranslationKey {
  return PREF_REASON_KEY[code];
}

export interface PersonalizedTodayCardModel {
  /** Modelo de Today (contexto) con las razones de preferencia fusionadas. */
  today: TodayCardModel;
  /** Una insignia de preferencia primaria (favorito > coincidencia), o ninguna. */
  preferenceBadgeKey?: TranslationKey;
  personalizedScore: number;
  rank: number;
}

export interface PreferenceEvaluationDiagnostics {
  profileSchemaVersion: number;
  explicitSignalsApplied: number;
  interactionSignalsApplied: number;
  excludedByHiddenPreference: number;
  malformedSignalsIgnored: number;
  cappedSignals: number;
}

export interface PersonalizedTodayResult {
  models: PersonalizedTodayCardModel[];
  diagnostics: PreferenceEvaluationDiagnostics;
}

export function buildPersonalizedTodayModels(
  baseModels: readonly import('../recommendations').RecommendationCardModel[],
  placesById: ReadonlyMap<string, LocavoPlace>,
  context: ContextSnapshot,
  preferences: PreferenceSnapshot,
  limit = 5,
): PersonalizedTodayResult {
  // Contexto V5.2 sobre TODA la población (sin truncar) para reordenar después.
  const contextModels = buildTodayModels(baseModels, context, baseModels.length);

  const diagnostics: PreferenceEvaluationDiagnostics = {
    profileSchemaVersion: preferences.schemaVersion,
    explicitSignalsApplied: 0,
    interactionSignalsApplied: 0,
    excludedByHiddenPreference: 0,
    malformedSignalsIgnored: 0,
    cappedSignals: 0,
  };

  interface Entry {
    today: TodayCardModel;
    preferenceBadgeKey?: TranslationKey;
    personalizedScore: number;
  }
  const entries: Entry[] = [];

  for (const tm of contextModels) {
    const place = placesById.get(tm.model.placeId);
    const adjustment = evaluatePreferenceAdjustment(
      {
        placeId: tm.model.placeId,
        category: tm.model.category,
        openState: tm.model.openState,
        distanceKm: tm.model.distanceKm,
        accessible: place?.features?.wheelchairAccessible,
        family: place?.features?.familyFriendly,
        parking: place?.features?.parking,
      },
      preferences,
    );

    if (adjustment.exclusion === 'PREF_PLACE_HIDDEN') {
      diagnostics.excludedByHiddenPreference += 1;
      continue;
    }

    diagnostics.explicitSignalsApplied += adjustment.explicitSignals;
    diagnostics.interactionSignalsApplied += adjustment.interactionSignals;
    if (adjustment.capped) {
      diagnostics.cappedSignals += 1;
    }

    const preferenceReasonKeys = adjustment.reasonCodes.map(preferenceReasonLabelKey);
    const preferenceBadgeKey: TranslationKey | undefined = adjustment.reasonCodes.includes('PREF_FAVORITE_PLACE')
      ? 'pref.badge.favorite'
      : adjustment.reasonCodes.length > 0
        ? 'pref.badge.match'
        : undefined;

    entries.push({
      today: {
        ...tm,
        model: { ...tm.model, reasonKeys: [...tm.model.reasonKeys, ...preferenceReasonKeys] },
      },
      preferenceBadgeKey,
      personalizedScore: tm.contextualScore * adjustment.multiplier,
    });
  }

  entries.sort((a, b) => {
    if (b.personalizedScore !== a.personalizedScore) {
      return b.personalizedScore - a.personalizedScore;
    }
    return a.today.model.placeId < b.today.model.placeId ? -1 : a.today.model.placeId > b.today.model.placeId ? 1 : 0;
  });

  const models = entries.slice(0, limit).map((entry, index) => ({
    today: entry.today,
    preferenceBadgeKey: entry.preferenceBadgeKey,
    personalizedScore: entry.personalizedScore,
    rank: index + 1,
  }));

  return { models, diagnostics };
}
