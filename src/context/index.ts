/**
 * Motor de Contexto (V5.2) — API pública. Determinista, offline, independiente
 * del motor de recomendación. Ver docs de arquitectura de inteligencia.
 */
export {
  evaluateContext,
  bandOfMinutes,
  profileOf,
  type ContextSnapshot,
  type ContextTimeBand,
  type ContextProfile,
} from './contextEngine';
export { contextMultiplier } from './contextBoost';
export {
  contextReasonCodes,
  contextBadgesFor,
  isContextuallyRelevant,
  type ContextReasonCode,
  type ContextBadge,
  type OpenStateLike,
} from './contextExplanation';
