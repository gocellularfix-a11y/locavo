/**
 * Mapeo de PRESENTACIÓN de acciones (V5.7) — códigos estructurados → claves
 * i18n tipadas. El dominio (`src/actions`) solo emite códigos; aquí (y solo
 * aquí) se traducen. Sin prosa generada.
 */
import type { PlaceActionOutcomeCode, PlaceActionReasonCode } from '../../actions';
import type { TranslationKey } from '../../i18n/locales/es';

const REASON_KEY: Readonly<Record<PlaceActionReasonCode, TranslationKey>> = {
  ACTION_AVAILABLE: 'place.action.available',
  ACTION_MISSING_VALUE: 'place.action.missing',
  ACTION_INVALID_COORDINATES: 'place.action.invalidCoords',
  ACTION_INVALID_PHONE: 'place.action.invalidPhone',
  ACTION_INVALID_URL: 'place.action.invalidUrl',
  ACTION_UNSUPPORTED_SCHEME: 'place.action.unsupportedScheme',
};

const OUTCOME_KEY: Readonly<Record<PlaceActionOutcomeCode, TranslationKey>> = {
  ACTION_OPENED: 'place.action.available',
  ACTION_BLOCKED: 'place.action.missing',
  ACTION_OPEN_FAILED: 'place.actionFailed',
};

export function placeActionReasonLabelKey(code: PlaceActionReasonCode): TranslationKey {
  return REASON_KEY[code];
}

export function placeActionOutcomeLabelKey(code: PlaceActionOutcomeCode): TranslationKey {
  return OUTCOME_KEY[code];
}
