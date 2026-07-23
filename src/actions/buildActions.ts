/**
 * Constructor de ACCIONES seguras (V5.7) — puro, determinista, inmutable.
 *
 * Convierte los campos canónicos de un lugar (coordenadas, teléfono, sitio web)
 * en un conjunto de acciones validadas. No muta el registro, no ejecuta nada, no
 * accede a red ni persistencia. Mismas entradas → misma salida.
 */
import type { Coordinates } from '../domain/place';
import type {
  PlaceAction,
  PlaceActionAvailability,
  PlaceActionReasonCode,
  PlaceActionSet,
  PlaceActionType,
} from './actionModel';
import { validateDirections } from './coordinatePolicy';
import { normalizePhone } from './phonePolicy';
import { validateWebsite } from './urlPolicy';

/** Entrada estructural mínima; `LocavoPlace` la satisface sin acoplar el dominio. */
export interface PlaceActionInput {
  readonly coordinates?: Coordinates | null;
  readonly contact?: {
    readonly phone?: string;
    readonly website?: string;
  };
}

interface Validation {
  readonly valid: boolean;
  readonly target: string | null;
  readonly reasonCode: PlaceActionReasonCode;
}

/** Mapea una validación pura a disponibilidad: válido / ausente / inválido. */
function toAvailability(reasonCode: PlaceActionReasonCode, valid: boolean): PlaceActionAvailability {
  if (valid) {
    return 'AVAILABLE';
  }
  return reasonCode === 'ACTION_MISSING_VALUE' ? 'UNAVAILABLE' : 'INVALID';
}

function toAction(type: PlaceActionType, v: Validation): PlaceAction {
  return {
    type,
    availability: toAvailability(v.reasonCode, v.valid),
    target: v.valid ? v.target : null,
    reasonCode: v.reasonCode,
  };
}

/**
 * Construye el conjunto de acciones seguras para un lugar. Cada acción es
 * independiente: una acción inválida jamás suprime a las demás válidas.
 */
export function buildPlaceActions(place: PlaceActionInput): PlaceActionSet {
  const directions = toAction('DIRECTIONS', validateDirections(place.coordinates ?? null));
  const call = toAction('CALL', normalizePhone(place.contact?.phone));
  const website = toAction('WEBSITE', validateWebsite(place.contact?.website));
  return { directions, call, website };
}
