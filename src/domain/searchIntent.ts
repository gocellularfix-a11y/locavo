import type { CategoryId } from './place';

/**
 * Señales estructuradas derivadas de una consulta de búsqueda (V4D).
 *
 * Provider-neutral: describe la INTENCIÓN del usuario, no cómo la resuelve
 * ningún repositorio. La produce el intérprete de consultas de forma
 * determinista a partir del léxico centralizado; la usan el ranking y la UI.
 */
export interface SearchIntent {
  /** Consulta cruda tal cual la escribió el usuario. */
  raw: string;
  /** Texto normalizado: minúsculas, sin acentos, sin puntuación, 1 espacio. */
  normalized: string;
  /** Tokens con valor de búsqueda (relleno, cercanía y "abierto" removidos). */
  terms: string[];
  /** Texto efectivo para el repositorio (los `terms` unidos). Puede ser "". */
  searchText: string;
  /** Categorías inferidas: alias directo, subtipo o palabra de intención. */
  categories: CategoryId[];
  /** Intención de cercanía ("cerca", "nearby", "perto"…). */
  nearby: boolean;
  /** Intención de "abierto ahora" ("abierto", "open now", "24 horas"…). */
  openNow: boolean;
  /** Tokens de relleno/cercanía/apertura descartados (diagnóstico y hints). */
  removed: string[];
  /** ¿La consulta aportó texto útil (no vacía tras normalizar)? */
  hasText: boolean;
}
