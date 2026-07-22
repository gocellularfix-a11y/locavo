/**
 * Hook de recomendaciones (V5.1).
 *
 * SEPARA recuperación de candidatos (repositorio) de la evaluación (motor V5.0).
 * El motor se ejecuta UNA vez por conjunto de datos (memoizado). Defensivo:
 * cualquier fallo del repositorio degrada a vacío, nunca lanza. No cambia el
 * ranking; solo lo consume.
 */
import { useEffect, useMemo, useState } from 'react';

import type { Coordinates } from '../../domain/place';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import {
  categoriesForIntent,
  type RecommendationContext,
  type RecommendationIntent,
  type RecommendationPreferences,
} from '../../intelligence';
import { placeRepository } from '../../services/container';
import { buildRecommendationModels, type RecommendationCardModel } from './recommendationModel';

const FETCH_LIMIT = 50;

export interface UseRecommendationsInput {
  intent: RecommendationIntent;
  origin: Coordinates | null;
  now?: Date;
  maxResults?: number;
  radiusMeters?: number;
  preferences?: RecommendationPreferences;
}

export type RecommendationStatus = 'loading' | 'ready';

export interface UseRecommendationsResult {
  status: RecommendationStatus;
  models: readonly RecommendationCardModel[];
}

export function useRecommendations(input: UseRecommendationsInput): UseRecommendationsResult {
  const { intent, origin, maxResults, radiusMeters, preferences } = input;
  const [data, setData] = useState<{ places: LocavoPlace[]; now: Date } | null>(null);
  const lat = origin?.latitude;
  const lng = origin?.longitude;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const seen = new Map<string, LocavoPlace>();
        for (const category of categoriesForIntent(intent)) {
          const result = await placeRepository.listByCategory(category, {
            latitude: lat,
            longitude: lng,
            limit: FETCH_LIMIT,
          });
          for (const place of result.places) {
            seen.set(place.id, place);
          }
        }
        if (!cancelled) {
          setData({ places: [...seen.values()], now: input.now ?? new Date() });
        }
      } catch {
        if (!cancelled) {
          setData({ places: [], now: input.now ?? new Date() });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, lat, lng]);

  const models = useMemo(() => {
    if (!data) {
      return null;
    }
    const context: RecommendationContext = {
      now: data.now,
      intent,
      origin,
      maxResults,
      radiusMeters,
      preferences,
    };
    return buildRecommendationModels(context, data.places).models;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, intent, lat, lng, maxResults, radiusMeters, preferences]);

  return { status: data ? 'ready' : 'loading', models: models ?? [] };
}
