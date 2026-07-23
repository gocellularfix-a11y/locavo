/**
 * Mapeo de PRESENTACIÓN de decisión (V5.6) — códigos estructurados → claves
 * i18n tipadas. La capa de dominio (src/decision) solo devuelve códigos; aquí
 * (y solo aquí) se traducen a claves. Nunca prosa generada.
 */
import type { DecisionReasonCode, DecisionRole, DecisionTradeoffCode } from '../../decision';
import type { TranslationKey } from '../../i18n/locales/es';

const ROLE_KEY: Readonly<Record<DecisionRole, TranslationKey>> = {
  BEST_MATCH: 'decision.role.BEST_MATCH',
  CLOSEST: 'decision.role.CLOSEST',
  MOST_RELIABLE: 'decision.role.MOST_RELIABLE',
  BEST_INTENT_FIT: 'decision.role.BEST_INTENT_FIT',
  BEST_PREFERENCE_FIT: 'decision.role.BEST_PREFERENCE_FIT',
  OPEN_NOW: 'decision.role.OPEN_NOW',
  ACCESSIBLE: 'decision.role.ACCESSIBLE',
  FAMILY_PICK: 'decision.role.FAMILY_PICK',
  ALTERNATIVE: 'decision.role.ALTERNATIVE',
};

const REASON_KEY: Readonly<Record<DecisionReasonCode, TranslationKey>> = {
  DECISION_BEST_OVERALL: 'decision.reason.DECISION_BEST_OVERALL',
  DECISION_CLOSEST: 'decision.reason.DECISION_CLOSEST',
  DECISION_MOST_RELIABLE: 'decision.reason.DECISION_MOST_RELIABLE',
  DECISION_BEST_INTENT_MATCH: 'decision.reason.DECISION_BEST_INTENT_MATCH',
  DECISION_BEST_PREFERENCE_MATCH: 'decision.reason.DECISION_BEST_PREFERENCE_MATCH',
  DECISION_OPEN_NOW: 'decision.reason.DECISION_OPEN_NOW',
  DECISION_ACCESSIBLE: 'decision.reason.DECISION_ACCESSIBLE',
  DECISION_FAMILY_PICK: 'decision.reason.DECISION_FAMILY_PICK',
  DECISION_STRONG_ALTERNATIVE: 'decision.reason.DECISION_STRONG_ALTERNATIVE',
};

const TRADEOFF_KEY: Readonly<Record<DecisionTradeoffCode, TranslationKey>> = {
  TRADEOFF_FARTHER: 'decision.tradeoff.TRADEOFF_FARTHER',
  TRADEOFF_LOWER_CONFIDENCE: 'decision.tradeoff.TRADEOFF_LOWER_CONFIDENCE',
  TRADEOFF_WEAKER_INTENT_MATCH: 'decision.tradeoff.TRADEOFF_WEAKER_INTENT_MATCH',
  TRADEOFF_WEAKER_PREFERENCE_MATCH: 'decision.tradeoff.TRADEOFF_WEAKER_PREFERENCE_MATCH',
  TRADEOFF_LIMITED_EVIDENCE: 'decision.tradeoff.TRADEOFF_LIMITED_EVIDENCE',
  TRADEOFF_DIFFERENT_CATEGORY: 'decision.tradeoff.TRADEOFF_DIFFERENT_CATEGORY',
};

export function decisionRoleLabelKey(role: DecisionRole): TranslationKey {
  return ROLE_KEY[role];
}
export function decisionReasonLabelKey(code: DecisionReasonCode): TranslationKey {
  return REASON_KEY[code];
}
export function decisionTradeoffLabelKey(code: DecisionTradeoffCode): TranslationKey {
  return TRADEOFF_KEY[code];
}
