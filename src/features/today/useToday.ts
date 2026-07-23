/**
 * Hook "Sugerencias de hoy" — contexto (V5.2), retrieval (V5.3), preferencias
 * (V5.4) e intención (V5.5).
 *
 * Una sola pasada por intención enviada:
 *   recuperar candidatos (alcance de intención si es fiable) → V5.0 una vez →
 *   contexto una vez → preferencias una vez → intención una vez.
 * Sin intención → Today personalizado normal (limpiar la intención restaura).
 */
import { useEffect, useMemo, useState } from 'react';

import { evaluateContext } from '../../context';
import type { Coordinates } from '../../domain/place';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import { intentCategoryScope, type IntentSnapshot } from '../../intent';
import { usePreferences } from '../../preferences/PreferenceContext';
import {
  DEFAULT_CANDIDATE_SAFETY_LIMIT,
  retrieveRecommendationCandidates,
} from '../../recommendationCandidates';
import { placeRepository } from '../../services/container';
import { buildRecommendationModels, type RecommendationStatus } from '../recommendations';
import { buildIntentTodayModels, type IntentTodayCardModel } from './intentToday';

const TODAY_LIMIT = 5;
const TODAY_PREFS = { openNow: true } as const;

export interface UseTodayInput {
  origin: Coordinates | null;
  intent?: IntentSnapshot | null;
  now?: Date;
}

export interface UseTodayResult {
  status: RecommendationStatus;
  models: readonly IntentTodayCardModel[];
}

export function useToday(input: UseTodayInput): UseTodayResult {
  const [capturedNow] = useState(() => input.now ?? new Date());
  const now = input.now ?? capturedNow;
  const { origin } = input;
  const intent = input.intent ?? null;
  const lat = origin?.latitude;
  const lng = origin?.longitude;
  const { snapshot: preferences } = usePreferences();

  const context = useMemo(() => evaluateContext(now), [now]);

  const scope = useMemo(() => (intent ? intentCategoryScope(intent) : undefined), [intent]);
  const scopeKey = scope ? scope.join(',') : '';

  const [candidates, setCandidates] = useState<LocavoPlace[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await retrieveRecommendationCandidates({
          repository: placeRepository,
          origin,
          categories: scope,
          safetyLimit: DEFAULT_CANDIDATE_SAFETY_LIMIT,
        });
        if (!cancelled) {
          setCandidates(result.candidates);
        }
      } catch {
        if (!cancelled) {
          setCandidates([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, scopeKey]);

  const models = useMemo(() => {
    if (!candidates) {
      return null;
    }
    const { models: baseModels } = buildRecommendationModels(
      { now, intent: 'surprise', origin, preferences: TODAY_PREFS, maxResults: candidates.length },
      candidates,
    );
    const placesById = new Map(candidates.map((p) => [p.id, p]));
    return buildIntentTodayModels(baseModels, placesById, context, preferences, intent, TODAY_LIMIT).models;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, context, preferences, intent, lat, lng, now]);

  return { status: candidates ? 'ready' : 'loading', models: models ?? [] };
}
