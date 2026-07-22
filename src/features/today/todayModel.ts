/**
 * Modelo de "Sugerencias de hoy" (V5.2) — puro y determinista.
 *
 * Construye SOBRE los modelos de V5.1 (no los modifica) aplicando un
 * reordenamiento contextual: `contextualScore = scoreBase * multiplicador de
 * contexto`. El score base de V5.0 y sus estrellas (calidad) se conservan; el
 * contexto solo cambia el ORDEN "ahora" y añade razones/insignias de contexto.
 */
import {
  contextBadgesFor,
  contextMultiplier,
  contextReasonCodes,
  type ContextBadge,
  type ContextSnapshot,
} from '../../context';
import type { TranslationKey } from '../../i18n/locales/es';
import type { RecommendationCardModel } from '../recommendations';
import { contextBadgeLabelKey, contextReasonLabelKey } from './todayLabels';

export interface TodayCardModel {
  /** Modelo base V5.1 con las razones de contexto ya fusionadas en reasonKeys. */
  model: RecommendationCardModel;
  contextBadges: readonly ContextBadge[];
  contextBadgeKeys: readonly TranslationKey[];
  contextualScore: number;
  todayRank: number;
}

/**
 * Aplica contexto a los modelos base y reordena por relevancia "ahora".
 * Determinista: mismo orden base + contexto → mismos modelos. Desempate estable
 * por rank base y luego por placeId.
 */
export function buildTodayModels(
  baseModels: readonly RecommendationCardModel[],
  snapshot: ContextSnapshot,
  limit = 5,
): TodayCardModel[] {
  const enriched = baseModels.map((base) => {
    const multiplier = contextMultiplier(snapshot.profile, base.category);
    const reasonKeys: TranslationKey[] = [
      ...base.reasonKeys,
      ...contextReasonCodes(snapshot, base.category).map(contextReasonLabelKey),
    ];
    const contextBadges = contextBadgesFor(snapshot, base.category, base.openState);
    return {
      model: { ...base, reasonKeys },
      contextBadges,
      contextBadgeKeys: contextBadges.map(contextBadgeLabelKey),
      contextualScore: base.scoreTotal * multiplier,
      baseRank: base.rank,
    };
  });

  enriched.sort((a, b) => {
    if (b.contextualScore !== a.contextualScore) {
      return b.contextualScore - a.contextualScore;
    }
    if (a.baseRank !== b.baseRank) {
      return a.baseRank - b.baseRank;
    }
    return a.model.placeId < b.model.placeId ? -1 : a.model.placeId > b.model.placeId ? 1 : 0;
  });

  return enriched.slice(0, limit).map((entry, index) => ({
    model: entry.model,
    contextBadges: entry.contextBadges,
    contextBadgeKeys: entry.contextBadgeKeys,
    contextualScore: entry.contextualScore,
    todayRank: index + 1,
  }));
}
