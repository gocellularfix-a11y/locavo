/**
 * Mapeo de PRESENTACIÓN de acciones (V5.7) — códigos estructurados → claves
 * i18n tipadas. El dominio (`src/actions`) solo emite códigos; aquí (y solo
 * aquí) se traducen. Sin prosa generada.
 */
import type { PlaceAction, PlaceActionOutcomeCode, PlaceActionReasonCode } from '../../actions';
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

/**
 * Política DETERMINISTA de presentación de una acción de contacto (V5.7.1):
 * - `AVAILABLE`  → accionable; la UI muestra el valor NORMALIZADO (nunca el
 *   crudo) y ejecuta solo el destino validado.
 * - `INVALID`    → NO accionable; se muestra una razón localizada, jamás el
 *   texto crudo malformado/inseguro como si fuera información útil.
 * - `UNAVAILABLE` (o cualquier otro) → oculto (se conserva el comportamiento
 *   existente de "no disponible": la fila se omite).
 */
export type PlaceActionDisplay =
  | { readonly kind: 'actionable' }
  | { readonly kind: 'invalid'; readonly reasonKey: TranslationKey }
  | { readonly kind: 'hidden' };

export function placeActionDisplay(action: PlaceAction): PlaceActionDisplay {
  switch (action.availability) {
    case 'AVAILABLE':
      return { kind: 'actionable' };
    case 'INVALID':
      return { kind: 'invalid', reasonKey: placeActionReasonLabelKey(action.reasonCode) };
    case 'UNAVAILABLE':
    default:
      return { kind: 'hidden' };
  }
}
