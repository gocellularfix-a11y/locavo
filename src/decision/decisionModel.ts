/**
 * Modelo canónico de DECISIÓN (V5.6) — determinista, inmutable, sin cadenas de UI.
 *
 * El ranking (V5.0–V5.5) responde: ¿qué candidato puntuó más alto? La decisión
 * responde: ¿qué opciones significativamente distintas debería comparar el
 * usuario? Esta capa CONSUME modelos ya rankeados; no recupera lugares, no
 * calcula scores V5.0, no toca confianza, contexto, preferencias ni intención,
 * no analiza texto y no persiste nada. Solo devuelve CÓDIGOS estructurados; la
 * presentación los mapea a claves i18n tipadas (jamás prosa generada).
 */
import type { CategoryId } from '../domain/place';
import type { EvidenceConfidence } from '../intelligence';

/** Papel de decisión. Solo se implementan papeles sustentables por datos canónicos. */
export type DecisionRole =
  | 'BEST_MATCH'
  | 'CLOSEST'
  | 'MOST_RELIABLE'
  | 'BEST_INTENT_FIT'
  | 'BEST_PREFERENCE_FIT'
  | 'OPEN_NOW'
  | 'ACCESSIBLE'
  | 'FAMILY_PICK'
  | 'ALTERNATIVE';

export const DECISION_ROLES: readonly DecisionRole[] = [
  'BEST_MATCH', 'CLOSEST', 'MOST_RELIABLE', 'BEST_INTENT_FIT', 'BEST_PREFERENCE_FIT',
  'OPEN_NOW', 'ACCESSIBLE', 'FAMILY_PICK', 'ALTERNATIVE',
];

/**
 * Prioridad determinista de papeles alternativos (BEST_MATCH es siempre el
 * primario). El primer papel que aporte valor de decisión NUEVO gana el hueco.
 */
export const ALTERNATIVE_ROLE_PRIORITY: readonly DecisionRole[] = [
  'CLOSEST', 'MOST_RELIABLE', 'BEST_INTENT_FIT', 'BEST_PREFERENCE_FIT',
  'OPEN_NOW', 'ACCESSIBLE', 'FAMILY_PICK', 'ALTERNATIVE',
];

/** Razón estructurada de por qué una opción ocupa su papel. */
export type DecisionReasonCode =
  | 'DECISION_BEST_OVERALL'
  | 'DECISION_CLOSEST'
  | 'DECISION_MOST_RELIABLE'
  | 'DECISION_BEST_INTENT_MATCH'
  | 'DECISION_BEST_PREFERENCE_MATCH'
  | 'DECISION_OPEN_NOW'
  | 'DECISION_ACCESSIBLE'
  | 'DECISION_FAMILY_PICK'
  | 'DECISION_STRONG_ALTERNATIVE';

export const DECISION_REASON_CODES: readonly DecisionReasonCode[] = [
  'DECISION_BEST_OVERALL', 'DECISION_CLOSEST', 'DECISION_MOST_RELIABLE',
  'DECISION_BEST_INTENT_MATCH', 'DECISION_BEST_PREFERENCE_MATCH', 'DECISION_OPEN_NOW',
  'DECISION_ACCESSIBLE', 'DECISION_FAMILY_PICK', 'DECISION_STRONG_ALTERNATIVE',
];

/**
 * Compromiso estructurado que distingue una alternativa del primario. Solo se
 * expone cuando lo sustenta un dato canónico y la diferencia NO es negligible.
 * No se implementa TRADEOFF_CLOSED_SOON: no existe señal canónica de "cierra
 * pronto" y fabricarla violaría la política de datos.
 */
export type DecisionTradeoffCode =
  | 'TRADEOFF_FARTHER'
  | 'TRADEOFF_LOWER_CONFIDENCE'
  | 'TRADEOFF_WEAKER_INTENT_MATCH'
  | 'TRADEOFF_WEAKER_PREFERENCE_MATCH'
  | 'TRADEOFF_LIMITED_EVIDENCE'
  | 'TRADEOFF_DIFFERENT_CATEGORY';

/** Orden canónico determinista de emisión de compromisos. */
export const DECISION_TRADEOFF_CODES: readonly DecisionTradeoffCode[] = [
  'TRADEOFF_FARTHER', 'TRADEOFF_LOWER_CONFIDENCE', 'TRADEOFF_WEAKER_INTENT_MATCH',
  'TRADEOFF_WEAKER_PREFERENCE_MATCH', 'TRADEOFF_LIMITED_EVIDENCE', 'TRADEOFF_DIFFERENT_CATEGORY',
];

export type DecisionOpenState = 'open' | 'closed' | 'unknown';

/**
 * Snapshot normalizado y comparable por candidato. Consume valores YA evaluados
 * por capas previas; jamás recalcula sus fórmulas. La evidencia faltante se
 * preserva como desconocida (nunca se interpreta como `false`):
 * - `distanceKm === null` → distancia desconocida;
 * - `openState === 'unknown'` → horario no confirmado (no "cerrado");
 * - `accessible === undefined` → sin evidencia (no "no accesible");
 * - `familyFriendly === undefined` → sin evidencia (no "no familiar").
 *
 * `recommendationConfidence` es también la señal canónica de CALIDAD DE
 * EVIDENCIA (V5.0); no se define un modelo de confianza nuevo.
 */
export interface DecisionCandidateSnapshot {
  readonly placeId: string;
  readonly sourceRank: number;
  readonly finalScore: number;
  readonly distanceKm: number | null;
  readonly recommendationConfidence: EvidenceConfidence;
  readonly intentStrength: number;
  readonly preferenceStrength: number;
  readonly openState: DecisionOpenState;
  readonly category: CategoryId;
  readonly accessible?: boolean;
  readonly familyFriendly?: boolean;
}

export interface DecisionOption {
  readonly placeId: string;
  readonly role: DecisionRole;
  /** Posición 1-based dentro del set de decisión (primario = 1). */
  readonly rank: number;
  readonly finalScore: number;
  readonly reasonCodes: readonly DecisionReasonCode[];
  readonly tradeoffCodes: readonly DecisionTradeoffCode[];
  /** Rango original en los modelos rankeados de entrada (V5.5). */
  readonly sourceRank: number;
}

export interface DecisionSelectionDiagnostics {
  readonly received: number;
  readonly eligible: number;
  readonly selected: number;
  readonly duplicatePlacesRejected: number;
  readonly duplicateRolesRejected: number;
  readonly insufficientDifferentiationRejected: number;
  readonly missingEvidenceRejected: number;
  readonly roleCandidatesEvaluated: number;
}

export interface DecisionSet {
  readonly primary: DecisionOption | null;
  readonly alternatives: readonly DecisionOption[];
  readonly diagnostics: DecisionSelectionDiagnostics;
}

/** Razón principal asociada a cada papel (uno a uno, determinista). */
export const ROLE_REASON: Readonly<Record<DecisionRole, DecisionReasonCode>> = {
  BEST_MATCH: 'DECISION_BEST_OVERALL',
  CLOSEST: 'DECISION_CLOSEST',
  MOST_RELIABLE: 'DECISION_MOST_RELIABLE',
  BEST_INTENT_FIT: 'DECISION_BEST_INTENT_MATCH',
  BEST_PREFERENCE_FIT: 'DECISION_BEST_PREFERENCE_MATCH',
  OPEN_NOW: 'DECISION_OPEN_NOW',
  ACCESSIBLE: 'DECISION_ACCESSIBLE',
  FAMILY_PICK: 'DECISION_FAMILY_PICK',
  ALTERNATIVE: 'DECISION_STRONG_ALTERNATIVE',
};
