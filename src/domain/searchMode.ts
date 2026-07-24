/**
 * Modos de descubrimiento (UX-S1) — puros y deterministas.
 *
 * Decision Mode: sin texto → el usuario navega por categoría y Locavo decide.
 * Search Mode:   con texto → el usuario ya sabe qué quiere; la búsqueda es
 *                GLOBAL en toda la ciudad y la categoría deja de filtrar.
 *
 * Al escribir texto, la búsqueda anula el filtrado pasivo por categoría (evita
 * falsos negativos como "Gasolineras + 'tacos' → sin resultados"). La categoría
 * seleccionada se CONSERVA en el estado de la pantalla para restaurar la
 * navegación al limpiar el texto; solo se ignora mientras hay texto activo.
 */
export type SearchMode = 'decision' | 'search';

export function searchModeOf(query: string): SearchMode {
  return query.trim().length > 0 ? 'search' : 'decision';
}

/**
 * Categoría EFECTIVA para ejecutar la consulta: en Search Mode es `null`
 * (global); en Decision Mode respeta la categoría en curso. No muta el estado.
 */
export function effectiveSearchCategory<T>(category: T | null, query: string): T | null {
  return searchModeOf(query) === 'search' ? null : category;
}
