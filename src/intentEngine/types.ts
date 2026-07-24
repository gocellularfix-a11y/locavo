/**
 * Intent Engine V1 — tipos canónicos (dominio NUEVO e independiente).
 *
 * Única responsabilidad: traducir lenguaje natural a una INTENCIÓN de búsqueda
 * estructurada. NUNCA rankea, NUNCA recomienda, NUNCA consulta proveedores.
 * 100% determinista, local, explicable: sin LLM, sin IA generativa, sin red,
 * sin embeddings, sin fuzzy. Independiente del engine de intención V5.5
 * (`src/intent`), que es una capa de AJUSTE de ranking distinta.
 */
import type { CategoryId } from '../domain/place';

/** Catálogo cerrado de intenciones de búsqueda soportadas (V1). */
export type SearchIntentId =
  | 'FOOD'
  | 'COFFEE'
  | 'BEER'
  | 'LODGING'
  | 'FUEL'
  | 'PHARMACY'
  | 'SHOPPING'
  | 'NIGHTLIFE'
  | 'SUPERMARKET'
  | 'CONVENIENCE_STORE'
  | 'TOURIST_ATTRACTION'
  | 'ATM'
  | 'HOSPITAL'
  | 'PARKING'
  | 'PUBLIC_RESTROOM'
  | 'EV_CHARGING'
  | 'AIRPORT'
  | 'BUS_STATION'
  | 'TAXI'
  | 'POLICE'
  | 'FIRE_DEPARTMENT'
  | 'BANK';

export type IntentLanguage = 'en' | 'es' | 'pt';

/** Cómo se reconoció la intención (determinista, sin caja negra). */
export type IntentReasonCode = 'EXACT_MATCH' | 'PHRASE_MATCH' | 'TOKEN_MATCH' | 'UNKNOWN';

export interface IntentExplanation {
  /** Tokens del texto que coincidieron con el diccionario. */
  readonly matchedWords: readonly string[];
  /** Frases (multi-palabra) que coincidieron. */
  readonly matchedPhrases: readonly string[];
  /** Categoría Locavo resuelta, o `null` si la intención no mapea a una. */
  readonly resolvedCategory: CategoryId | null;
  /** Idioma del diccionario que produjo la coincidencia. */
  readonly language: IntentLanguage | null;
  readonly reason: IntentReasonCode;
}

export interface IntentDetection {
  /** Intención detectada, o `null` si es desconocida (→ búsqueda universal). */
  readonly intent: SearchIntentId | null;
  /** Confianza SOLO de la detección de intención (0..1). No es calidad de recomendación. */
  readonly confidence: number;
  /** Categorías Locavo asociadas (vacío si la intención no mapea a categoría). */
  readonly categories: readonly CategoryId[];
  /** Términos residuales para búsqueda por texto (fallback). */
  readonly keywords: readonly string[];
  /** Explicabilidad determinista. */
  readonly explanation: IntentExplanation;
}

/**
 * Ruteo del texto del usuario:
 * - `decision`: intención conocida que mapea a una categoría Locavo → Decision Engine.
 * - `search`:   desconocida, sin categoría o baja confianza → búsqueda universal (fallback).
 */
export type SearchRoute =
  | { readonly kind: 'decision'; readonly intent: SearchIntentId; readonly category: CategoryId; readonly detection: IntentDetection }
  | { readonly kind: 'search'; readonly text: string; readonly detection: IntentDetection };

/** Umbral mínimo de confianza para rutear a Decision Engine. */
export const DECISION_CONFIDENCE_THRESHOLD = 0.6;
