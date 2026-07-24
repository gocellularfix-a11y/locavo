import { useCallback, useEffect, useState } from 'react';

/**
 * Controlador del campo de búsqueda (UX-S1).
 *
 * Separa el TEXTO que el usuario ve (`query`, inmediato) de la consulta que se
 * EJECUTA (`activeQuery`, con debounce). Escribir refresca resultados tras una
 * breve pausa; presionar Buscar ejecuta de inmediato (flush); limpiar reinicia
 * ambos al instante (volver a Decision Mode). Determinista y aislable.
 */
export const SEARCH_DEBOUNCE_MS = 350;

export interface SearchQueryController {
  /** Texto en el campo (refleja cada pulsación). */
  readonly query: string;
  /** Consulta efectiva a ejecutar (con debounce / flush). */
  readonly activeQuery: string;
  readonly setQuery: (text: string) => void;
  /** Ejecuta ya, sin esperar el debounce (tecla Buscar). */
  readonly submit: () => void;
  /** Limpia texto y consulta al instante (X → Decision Mode). */
  readonly clear: () => void;
}

export function useSearchQuery(initial = '', delayMs: number = SEARCH_DEBOUNCE_MS): SearchQueryController {
  const [query, setQueryState] = useState(initial);
  const [activeQuery, setActiveQuery] = useState(initial);

  useEffect(() => {
    if (query === activeQuery) {
      return;
    }
    const id = setTimeout(() => setActiveQuery(query), delayMs);
    return () => clearTimeout(id);
  }, [query, activeQuery, delayMs]);

  const setQuery = useCallback((text: string) => {
    setQueryState(text);
    // Limpiar por completo aplica de inmediato (no se espera el debounce).
    if (text.length === 0) {
      setActiveQuery('');
    }
  }, []);

  const submit = useCallback(() => setActiveQuery(query), [query]);

  const clear = useCallback(() => {
    setQueryState('');
    setActiveQuery('');
  }, []);

  return { query, activeQuery, setQuery, submit, clear };
}
