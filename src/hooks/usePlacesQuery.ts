import { useCallback, useEffect, useRef, useState } from 'react';

import type { CategoryId } from '../domain/place';
import { effectiveSearchCategory } from '../domain/searchMode';
import type { SearchIntent } from '../domain/searchIntent';
import { placeSearchService } from '../services/container';
import type { ScoredPlace } from '../services/places/PlaceRankingService';
import type { SearchNotice } from '../services/places/PlaceSearchService';
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
  /** Páginas acumuladas ordenadas; el primero es la recomendación principal. */
  results: ScoredPlace[];
  recommended: ScoredPlace | null;
  /** true mientras se carga una página adicional (no la inicial). */
  loadingMore: boolean;
  /** true cuando el repositorio anuncia más resultados. */
  hasMore: boolean;
  /** Carga la siguiente página y la anexa sin duplicados. */
  loadMore: () => void;
  reload: () => void;
  /** Interpretación de la consulta de texto (V4D), si la hubo. */
  intent: SearchIntent | null;
  /** Aviso truthful (p. ej. horarios no confirmados). Null si no aplica. */
  notice: SearchNotice | null;
}

/**
 * Anexa una página deduplicando por id canónico (orden estable, sin
 * duplicados entre páginas). Pura e independiente de React para pruebas.
 */
export function appendResults(
  previous: readonly ScoredPlace[],
  incoming: readonly ScoredPlace[],
): ScoredPlace[] {
  const seen = new Set(previous.map((scored) => scored.place.id));
  const fresh = incoming.filter((scored) => !seen.has(scored.place.id));
  return [...previous, ...fresh];
}

/**
 * Puente pantalla ↔ PlaceSearchService (V3, paginado en V4D.1).
 * Cambiar categoría, búsqueda, filtros o ubicación REINICIA la paginación:
 * los resultados anteriores se sueltan (no se acumulan entre consultas).
 */
export function usePlacesQuery(options: PlacesQueryOptions = {}): PlacesQueryResult {
  const { coords } = useLocationState();
  const { category = null, query = '', openOnly = false, sort = 'best' } = options;

  // Búsqueda UNIVERSAL: con texto, la categoría deja de filtrar (Search Mode);
  // sin texto se respeta la categoría (Decision Mode). El estado `category` del
  // consumidor se conserva para restaurar la navegación al limpiar el texto.
  const activeCategory = effectiveSearchCategory(category, query);

  const [results, setResults] = useState<ScoredPlace[]>([]);
  const [status, setStatus] = useState<QueryStatus>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [intent, setIntent] = useState<SearchIntent | null>(null);
  const [notice, setNotice] = useState<SearchNotice | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const requestSeq = useRef(0);

  useEffect(() => {
    const seq = ++requestSeq.current;
    let cancelled = false;
    placeSearchService
      .search({
        origin: coords,
        category: activeCategory,
        text: query,
        openNow: openOnly,
        sort,
      })
      .then((response) => {
        if (!cancelled && seq === requestSeq.current) {
          setResults(response.results);
          setNextCursor(response.nextCursor);
          setIntent(response.intent ?? null);
          setNotice(response.notice ?? null);
          setLoadingMore(false);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled && seq === requestSeq.current) {
          setLoadingMore(false);
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [coords, activeCategory, query, openOnly, sort, reloadToken]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore || status !== 'ready') {
      return;
    }
    const seq = requestSeq.current;
    setLoadingMore(true);
    placeSearchService
      .search({
        origin: coords,
        category: activeCategory,
        text: query,
        openNow: openOnly,
        sort,
        cursor: nextCursor,
      })
      .then((response) => {
        if (seq === requestSeq.current) {
          setResults((previous) => appendResults(previous, response.results));
          setNextCursor(response.nextCursor);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (seq === requestSeq.current) {
          setLoadingMore(false);
        }
      });
  }, [nextCursor, loadingMore, status, coords, activeCategory, query, openOnly, sort]);

  const reload = useCallback(() => {
    setStatus('loading');
    setReloadToken((t) => t + 1);
  }, []);

  return {
    status,
    results,
    recommended: results.length > 0 ? results[0] : null,
    loadingMore,
    hasMore: nextCursor !== undefined,
    loadMore,
    reload,
    intent,
    notice,
  };
}
