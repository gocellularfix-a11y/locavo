import { useCallback, useEffect, useRef, useState } from 'react';

import type { CategoryId } from '../domain/place';
import { placeSearchService } from '../services/container';
import type { ScoredPlace } from '../services/places/PlaceRankingService';
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
 * Puente pantalla ↔ PlaceSearchService (V3).
 * Las pantallas nunca tocan repositorios ni datos mock directamente.
 */
export function usePlacesQuery(options: PlacesQueryOptions = {}): PlacesQueryResult {
  const { coords } = useLocationState();
  const { category = null, query = '', openOnly = false, sort = 'best' } = options;

  const [results, setResults] = useState<ScoredPlace[]>([]);
  const [status, setStatus] = useState<QueryStatus>('loading');
  const [reloadToken, setReloadToken] = useState(0);
  const requestSeq = useRef(0);

  useEffect(() => {
    const seq = ++requestSeq.current;
    let cancelled = false;
    placeSearchService
      .search({
        origin: coords,
        category,
        text: query,
        openNow: openOnly,
        sort,
      })
      .then((response) => {
        if (!cancelled && seq === requestSeq.current) {
          setResults(response.results);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled && seq === requestSeq.current) {
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [coords, category, query, openOnly, sort, reloadToken]);

  const reload = useCallback(() => {
    setStatus('loading');
    setReloadToken((t) => t + 1);
  }, []);

  return {
    status,
    results,
    recommended: results.length > 0 ? results[0] : null,
    reload,
  };
}
