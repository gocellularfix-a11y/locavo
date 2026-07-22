/**
 * Hook "Sugerencias de hoy" (V5.2, reintegrado en V5.3).
 *
 * Flujo determinista y de una sola pasada:
 *   recuperar candidatos (V5.3) → evaluar V5.0 una vez → evaluar contexto una
 *   vez → construir modelos de hoy una vez.
 *
 * V5.3: ya NO usa el orden de Surprise como fuente de candidatos. Los
 * candidatos vienen del servicio canónico de recuperación (población completa
 * acotada por límite de seguridad geográfico), de modo que un candidato fuerte
 * ya no puede quedar excluido por el orden hash antes de rankear.
 */
import { useEffect, useMemo, useState } from 'react';

import { evaluateContext } from '../../context';
import type { Coordinates } from '../../domain/place';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import {
  DEFAULT_CANDIDATE_SAFETY_LIMIT,
  retrieveRecommendationCandidates,
} from '../../recommendationCandidates';
import { placeRepository } from '../../services/container';
import { buildRecommendationModels, type RecommendationStatus } from '../recommendations';
import { buildTodayModels, type TodayCardModel } from './todayModel';

const TODAY_LIMIT = 5;
const TODAY_PREFS = { openNow: true } as const;

export interface UseTodayInput {
  origin: Coordinates | null;
  now?: Date;
}

export interface UseTodayResult {
  status: RecommendationStatus;
  models: readonly TodayCardModel[];
}

export function useToday(input: UseTodayInput): UseTodayResult {
  const [capturedNow] = useState(() => input.now ?? new Date());
  const now = input.now ?? capturedNow;
  const { origin } = input;
  const lat = origin?.latitude;
  const lng = origin?.longitude;

  const snapshot = useMemo(() => evaluateContext(now), [now]);

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

  const today = useMemo(() => {
    if (!candidates) {
      return null;
    }
    // V5.0 una sola vez sobre TODOS los candidatos (maxResults = población →
    // sin truncamiento); el reordenamiento final lo define el contexto (V5.2).
    const { models } = buildRecommendationModels(
      {
        now,
        intent: 'surprise',
        origin,
        preferences: TODAY_PREFS,
        maxResults: candidates.length,
      },
      candidates,
    );
    return buildTodayModels(models, snapshot, TODAY_LIMIT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, snapshot, lat, lng, now]);

  return { status: candidates ? 'ready' : 'loading', models: today ?? [] };
}
