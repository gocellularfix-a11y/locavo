/**
 * Hook "Sugerencias de hoy" (V5.2).
 *
 * Ejecuta el contexto UNA vez y la recomendación UNA vez (vía el hook V5.1),
 * y compone ambos con `buildTodayModels`. No recalcula scores: reordena.
 */
import { useMemo, useState } from 'react';

import { evaluateContext } from '../../context';
import type { Coordinates } from '../../domain/place';
import { useRecommendations, type RecommendationStatus } from '../recommendations';
import { buildTodayModels, type TodayCardModel } from './todayModel';

/** Pool amplio (tope del motor) reordenado por contexto; se muestran 5. */
const TODAY_POOL = 100;
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

  const snapshot = useMemo(() => evaluateContext(now), [now]);

  // `surprise` = todas las categorías; el reordenamiento por contexto define el
  // orden final "ahora", así que el orden del motor aquí es irrelevante.
  const { status, models } = useRecommendations({
    intent: 'surprise',
    origin: input.origin,
    now,
    preferences: TODAY_PREFS,
    maxResults: TODAY_POOL,
  });

  const today = useMemo(
    () => buildTodayModels(models, snapshot, TODAY_LIMIT),
    [models, snapshot],
  );

  return { status, models: today };
}
