/**
 * Hook "Sugerencias de hoy" (V5.2, retrieval V5.3, personalización V5.4).
 *
 * Flujo determinista de una sola pasada:
 *   recuperar candidatos (V5.3) → evaluar V5.0 una vez → evaluar contexto una
 *   vez → cargar preferencias una vez → aplicar ajuste de preferencias una vez
 *   → construir modelos de hoy una vez.
 *
 * Nunca reemplaza el score base de V5.0, la confianza ni los multiplicadores de
 * contexto de V5.2. Los lugares ocultos no llegan a Today.
 */
import { useEffect, useMemo, useState } from 'react';

import { evaluateContext } from '../../context';
import type { Coordinates } from '../../domain/place';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import { usePreferences } from '../../preferences/PreferenceContext';
import {
  DEFAULT_CANDIDATE_SAFETY_LIMIT,
  retrieveRecommendationCandidates,
} from '../../recommendationCandidates';
import { placeRepository } from '../../services/container';
import { buildRecommendationModels, type RecommendationStatus } from '../recommendations';
import { buildPersonalizedTodayModels, type PersonalizedTodayCardModel } from './personalizedToday';

const TODAY_LIMIT = 5;
const TODAY_PREFS = { openNow: true } as const;

export interface UseTodayInput {
  origin: Coordinates | null;
  now?: Date;
}

export interface UseTodayResult {
  status: RecommendationStatus;
  models: readonly PersonalizedTodayCardModel[];
}

export function useToday(input: UseTodayInput): UseTodayResult {
  const [capturedNow] = useState(() => input.now ?? new Date());
  const now = input.now ?? capturedNow;
  const { origin } = input;
  const lat = origin?.latitude;
  const lng = origin?.longitude;
  const { snapshot: preferences } = usePreferences();

  const context = useMemo(() => evaluateContext(now), [now]);

  const [candidates, setCandidates] = useState<LocavoPlace[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await retrieveRecommendationCandidates({
          repository: placeRepository,
          origin,
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
  }, [lat, lng]);

  const models = useMemo(() => {
    if (!candidates) {
      return null;
    }
    const { models: baseModels } = buildRecommendationModels(
      { now, intent: 'surprise', origin, preferences: TODAY_PREFS, maxResults: candidates.length },
      candidates,
    );
    const placesById = new Map(candidates.map((p) => [p.id, p]));
    return buildPersonalizedTodayModels(baseModels, placesById, context, preferences, TODAY_LIMIT).models;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, context, preferences, lat, lng, now]);

  return { status: candidates ? 'ready' : 'loading', models: models ?? [] };
}
