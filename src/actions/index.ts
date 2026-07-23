/**
 * Acciones seguras de decisión (V5.7) — API pública del DOMINIO. Puro, sin
 * React, sin `Linking`, sin red ni persistencia. La ejecución externa vive en
 * `services/placeActionExecutor` (frontera de plataforma), no aquí.
 */
export {
  PLACE_ACTION_TYPES,
  PLACE_ACTION_REASON_CODES,
  type PlaceActionType,
  type PlaceActionAvailability,
  type PlaceActionReasonCode,
  type PlaceAction,
  type PlaceActionSet,
  type PlaceActionOutcome,
  type PlaceActionOutcomeCode,
} from './actionModel';
export { buildPlaceActions, type PlaceActionInput } from './buildActions';
export {
  normalizePhone,
  MIN_PHONE_DIGITS,
  MAX_PHONE_DIGITS,
  type PhoneValidation,
  type PhoneReasonCode,
} from './phonePolicy';
export {
  validateWebsite,
  ALLOWED_WEB_SCHEMES,
  type UrlValidation,
  type UrlReasonCode,
} from './urlPolicy';
export {
  validateDirections,
  parseDirectionsTarget,
  type DirectionsValidation,
  type DirectionsReasonCode,
} from './coordinatePolicy';
