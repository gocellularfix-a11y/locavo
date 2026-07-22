/**
 * Modelo de CONTEXTO de recomendación (V5.0).
 *
 * Solo contiene datos que pueden suministrarse de forma determinista. No hay
 * clima, tráfico, popularidad ni condiciones externas: Locavo no tiene una
 * fuente offline canónica para ellas. Los valores desconocidos permanecen
 * desconocidos; no se infieren atributos del usuario.
 */
import type { Coordinates } from '../domain/place';
import { isValidCoordinates } from '../domain/distance';
import { DEFAULT_INTELLIGENCE_CONFIG, type IntelligenceConfig } from './config';
import type { RecommendationIntent } from './intent';

/** Restricciones DURAS: si no se cumplen, el candidato queda inelegible. */
export interface RecommendationConstraints {
  /** Exigir explícitamente ABIERTO (cerrado conocido → inelegible). */
  openNow?: boolean;
  /** Exigir accesibilidad CONFIRMADA (desconocida/negativa → inelegible). */
  accessible?: boolean;
}

/** Preferencias BLANDAS: influyen en el ranking, nunca excluyen. */
export interface RecommendationPreferences {
  openNow?: boolean;
  accessible?: boolean;
  parking?: boolean;
  family?: boolean;
}

export interface RecommendationContext {
  /** Instante de evaluación (inyectado; el núcleo nunca lee el reloj). */
  now: Date;
  intent: RecommendationIntent;
  /** Origen para ponderación de distancia. Nulo/ausente → sin distancia. */
  origin?: Coordinates | null;
  /** Radio duro opcional (m). Con origen válido, fuera del radio → inelegible. */
  radiusMeters?: number;
  /** Límite de resultados solicitado (se valida/clampa). */
  maxResults?: number;
  /** Identificadores no visibles (nunca etiquetas de idioma en dominio). */
  locale?: string;
  cityPackId?: string;
  /** Semilla determinista para el orden `surprise`. */
  seed?: number;
  constraints?: RecommendationConstraints;
  preferences?: RecommendationPreferences;
}

/** Contexto ya validado/normalizado que consume el núcleo. */
export interface NormalizedContext extends RecommendationContext {
  origin: Coordinates | null;
  maxResults: number;
  seed: number;
  constraints: RecommendationConstraints;
  preferences: RecommendationPreferences;
}

export class InvalidContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidContextError';
  }
}

/**
 * Valida y normaliza el contexto. Lanza `InvalidContextError` ante datos
 * estructuralmente inválidos (no ante datos simplemente ausentes).
 */
export function normalizeContext(
  context: RecommendationContext,
  config: IntelligenceConfig = DEFAULT_INTELLIGENCE_CONFIG,
): NormalizedContext {
  if (!(context.now instanceof Date) || Number.isNaN(context.now.getTime())) {
    throw new InvalidContextError('now inválido');
  }
  if (context.radiusMeters !== undefined && !(context.radiusMeters > 0)) {
    throw new InvalidContextError('radiusMeters debe ser > 0');
  }

  const origin =
    context.origin && isValidCoordinates(context.origin) ? context.origin : null;

  const requested = context.maxResults ?? config.defaultMaxResults;
  const maxResults = Number.isFinite(requested)
    ? Math.max(0, Math.min(config.maxResultsCap, Math.floor(requested)))
    : config.defaultMaxResults;

  return {
    ...context,
    origin,
    maxResults,
    seed: Number.isFinite(context.seed) ? (context.seed as number) : 0,
    constraints: context.constraints ?? {},
    preferences: context.preferences ?? {},
  };
}
