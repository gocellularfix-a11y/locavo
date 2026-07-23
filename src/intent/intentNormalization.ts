/**
 * Normalización de entrada de intención (V5.5). Reutiliza `normalizeQuery`
 * (acentos/mayúsculas/puntuación/espacios) del dominio de búsqueda; NO duplica
 * lógica. Entrada ACOTADA (anti-DoS/ReDoS): longitud y tokens limitados. Puro.
 */
import { normalizeQuery } from '../domain/queryNormalizer';
import { MAX_INTENT_INPUT_LENGTH, MAX_INTENT_TOKENS } from './intentModel';

export interface NormalizedIntentInput {
  normalized: string;
  tokens: string[];
}

export function normalizeIntentInput(raw: unknown): NormalizedIntentInput {
  if (typeof raw !== 'string' || raw.length === 0) {
    return { normalized: '', tokens: [] };
  }
  const bounded = raw.slice(0, MAX_INTENT_INPUT_LENGTH);
  const normalized = normalizeQuery(bounded);
  const tokens = normalized.length === 0 ? [] : normalized.split(' ').slice(0, MAX_INTENT_TOKENS);
  return { normalized, tokens };
}
