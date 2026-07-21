/**
 * Configuración canónica del ranking de BÚSQUEDA (V4E.1).
 *
 * Única fuente de verdad de los pesos y umbrales del Search Ranking. Se extrae
 * de `SearchRankingService` SIN cambiar ningún valor: mismos pesos → mismo
 * score → mismo orden; solo se reubica la fuente de verdad. Con el tiempo
 * contendrá más que pesos (de ahí "Config", no "Weights").
 *
 * Separación de conceptos que NUNCA deben mezclarse (invariante de arquitectura):
 *
 *   Ranking Score  ≠  Match Confidence  ≠  Verification Confidence  ≠  Data Availability
 *
 * - Ranking Score: determina el ORDEN de los resultados (esta configuración).
 * - Match Confidence: solidez de la COINCIDENCIA de búsqueda (explicación V4E.1).
 * - Verification Confidence: confianza en el DATO del negocio (`place.verification`).
 * - Data Availability: si un atributo EXISTE o no (horario/precio "no confirmado").
 */
export const SEARCH_RANKING_CONFIG = {
  /** Pesos del score de relevancia de búsqueda (decrecientes; el nombre manda). */
  weights: {
    /** nombre normalizado == consulta (coincidencia exacta). */
    exactName: 1000,
    /** el nombre EMPIEZA con la consulta. */
    namePrefix: 500,
    /** un término coincide como palabra completa del nombre. */
    nameToken: 200,
    /** la categoría inferida coincide (base); el bono adicional es `category / 2`. */
    category: 80,
    /** cada término presente en el índice del lugar (actividad/dirección/términos). */
    term: 30,
    /** bono por múltiples términos coincidentes. */
    multiTerm: 10,
    /** desempate menor por completitud de datos (fracción 0–1 × este peso). */
    completeness: 5,
    /** peso de distancia SIN intención de cercanía. */
    distanceBase: 15,
    /** peso de distancia CON intención de cercanía ("cerca"). */
    distanceNearby: 40,
  },
  /** Horizonte (km) tras el cual la distancia deja de sumar al score. */
  distanceHorizonKm: 8,
  /** Radio (km) para marcar "cerca" con veracidad (solo si hay ancla válida). */
  nearbyKm: 2,
} as const;
