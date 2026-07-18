import { useCallback, useEffect, useMemo, useState } from 'react';

import type { CategoryId, Place } from '../domain/place';
import { rankPlaces, type ScoredPlace } from '../domain/recommendation';
import { searchPlaces } from '../domain/search';
import { placeRepository } from '../services/container';
import { useLocationState } from '../state/LocationContext';

export type QueryStatus = 'loading' | 'ready' | 'error';

export interface PlacesQueryOptions {
  category?: CategoryId | null;
  query?: string;
  openOnly?: boolean;
  /** 'best' = puntuación del motor; 'distance' = más cercanos primero. */
  sort?: 'best' | 'distance';
}

export interface PlacesQueryResult {
  status: QueryStatus;
  /** Resultados ordenados; el primero es la recomendación principal. */
  results: ScoredPlace[];
  recommended: ScoredPlace | null;
  reload: () => void;
}

/**
 * Carga lugares del repositorio, aplica categoría/búsqueda/filtros y los
 * ordena con el motor de recomendación usando la ubicación activa.
 */
export function usePlacesQuery(options: PlacesQueryOptions = {}): PlacesQueryResult {
  const { coords } = useLocationState();
  const { category = null, query = '', openOnly = false, sort = 'best' } = options;

  const [allPlaces, setAllPlaces] = useState<Place[] | null>(null);
  const [status, setStatus] = useState<QueryStatus>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    placeRepository
      .listPlaces()
      .then((places) => {
        if (!cancelled) {
          setAllPlaces(places);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = useCallback(() => {
    setStatus('loading');
    setReloadToken((t) => t + 1);
  }, []);

  const results = useMemo<ScoredPlace[]>(() => {
    if (!allPlaces) {
      return [];
    }
    const now = new Date();
    let filtered = category ? allPlaces.filter((p) => p.category === category) : allPlaces;
    filtered = searchPlaces(filtered, query);
    let ranked = rankPlaces(filtered, coords, now);
    if (openOnly) {
      ranked = ranked.filter((r) => r.status.state === 'open');
    }
    if (sort === 'distance') {
      ranked = [...ranked].sort((a, b) => a.distanceKm - b.distanceKm);
    }
    return ranked;
  }, [allPlaces, category, query, openOnly, sort, coords]);

  return {
    status,
    results,
    recommended: results.length > 0 ? results[0] : null,
    reload,
  };
}
