/**
 * Modelo de ACCIONES seguras sobre un lugar (V5.7) — determinista, inmutable,
 * SIN cadenas de UI, sin React, sin `Linking`, sin red ni persistencia.
 *
 * Responde: ¿puede el usuario actuar de forma SEGURA sobre una decisión de
 * Locavo? No cambia cómo se eligió el lugar (V5.0–V5.6 intactos). La capa de
 * dominio solo emite CÓDIGOS estructurados; la presentación los mapea a claves
 * i18n tipadas. La ejecución externa vive en una frontera separada.
 */

export type PlaceActionType = 'DIRECTIONS' | 'CALL' | 'WEBSITE';

export type PlaceActionAvailability = 'AVAILABLE' | 'UNAVAILABLE' | 'INVALID';

/**
 * Razón estructurada de disponibilidad. `ACTION_OPEN_FAILED` NO aparece aquí:
 * es un resultado de EJECUCIÓN (frontera de plataforma), no de construcción.
 */
export type PlaceActionReasonCode =
  | 'ACTION_AVAILABLE'
  | 'ACTION_MISSING_VALUE'
  | 'ACTION_INVALID_COORDINATES'
  | 'ACTION_INVALID_PHONE'
  | 'ACTION_INVALID_URL'
  | 'ACTION_UNSUPPORTED_SCHEME';

export const PLACE_ACTION_TYPES: readonly PlaceActionType[] = ['DIRECTIONS', 'CALL', 'WEBSITE'];

export const PLACE_ACTION_REASON_CODES: readonly PlaceActionReasonCode[] = [
  'ACTION_AVAILABLE',
  'ACTION_MISSING_VALUE',
  'ACTION_INVALID_COORDINATES',
  'ACTION_INVALID_PHONE',
  'ACTION_INVALID_URL',
  'ACTION_UNSUPPORTED_SCHEME',
];

/**
 * Acción segura ya validada. `target` es el destino canónico listo para el
 * ejecutor (`tel:…`, `https:…`, o `"lat,lng"` para direcciones) o `null` cuando
 * no está disponible. Nunca contiene el valor crudo del repositorio.
 */
export interface PlaceAction {
  readonly type: PlaceActionType;
  readonly availability: PlaceActionAvailability;
  readonly target: string | null;
  readonly reasonCode: PlaceActionReasonCode;
}

export interface PlaceActionSet {
  readonly directions: PlaceAction;
  readonly call: PlaceAction;
  readonly website: PlaceAction;
}

/** Resultado de EJECUCIÓN externa (frontera de plataforma), separado del dominio. */
export type PlaceActionOutcomeCode = 'ACTION_OPENED' | 'ACTION_BLOCKED' | 'ACTION_OPEN_FAILED';

export interface PlaceActionOutcome {
  readonly opened: boolean;
  readonly reasonCode: PlaceActionOutcomeCode;
}
