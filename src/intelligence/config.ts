/**
 * Configuración CENTRALIZADA de la fundación de inteligencia (V5.0).
 *
 * Todos los pesos y límites viven aquí (fuente única, sin números mágicos
 * dispersos). Los pesos de scoring suman 1.0 → el `total` queda en [0, 1].
 * Es congelado y determinista; los valores son auditables.
 */
export interface ScoreWeights {
  intentMatch: number;
  distance: number;
  openStatus: number;
  preferences: number;
  evidenceCompleteness: number;
  confidenceAdjustment: number;
}

export interface IntelligenceConfig {
  weights: ScoreWeights;
  /** Límite de resultados por defecto y máximo permitido. */
  defaultMaxResults: number;
  maxResultsCap: number;
  /**
   * Escala de decaimiento de distancia (km) del término `1/(1 + km/scale)`.
   * A `distanceScaleKm` km el aporte de distancia vale 0.5.
   */
  distanceScaleKm: number;
  /** Valor neutro [0,1] usado cuando una dimensión es desconocida. */
  neutralUnknown: number;
}

export const DEFAULT_INTELLIGENCE_CONFIG: Readonly<IntelligenceConfig> = Object.freeze({
  weights: Object.freeze({
    intentMatch: 0.3,
    distance: 0.25,
    openStatus: 0.2,
    preferences: 0.15,
    evidenceCompleteness: 0.05,
    confidenceAdjustment: 0.05,
  }),
  defaultMaxResults: 20,
  maxResultsCap: 100,
  distanceScaleKm: 2,
  neutralUnknown: 0.5,
});
