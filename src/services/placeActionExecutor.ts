/**
 * Frontera de EJECUCIÓN de acciones de lugar (V5.7) — única puerta de salida
 * externa para las acciones de detalle previamente inseguras (llamar / web) y
 * capaz también de direcciones. Recibe una acción YA validada por el dominio
 * (`src/actions`), confirma disponibilidad y destino, y realiza la apertura sin
 * jamás pasar un valor crudo del repositorio. Separada de la validación pura.
 *
 * Direcciones conservan el proveedor de navegación aprobado (Google Maps
 * universal), que valida coordenadas y captura fallos; no se introduce un nuevo
 * proveedor de mapas.
 */
import { Linking } from 'react-native';

import { parseDirectionsTarget, type PlaceAction, type PlaceActionOutcome } from '../actions';
import { googleMapsProvider } from './navigation';

const BLOCKED: PlaceActionOutcome = { opened: false, reasonCode: 'ACTION_BLOCKED' };
const OPENED: PlaceActionOutcome = { opened: true, reasonCode: 'ACTION_OPENED' };
const FAILED: PlaceActionOutcome = { opened: false, reasonCode: 'ACTION_OPEN_FAILED' };

/**
 * Ejecuta una acción segura. Bloquea si no está `AVAILABLE` o si no hay destino.
 * Nunca lanza: un rechazo o fallo del sistema se reporta como `ACTION_OPEN_FAILED`.
 */
export async function executePlaceAction(action: PlaceAction): Promise<PlaceActionOutcome> {
  if (action.availability !== 'AVAILABLE' || !action.target) {
    return BLOCKED;
  }
  try {
    if (action.type === 'DIRECTIONS') {
      const coords = parseDirectionsTarget(action.target);
      if (!coords) {
        return BLOCKED;
      }
      const opened = await googleMapsProvider.openDirections(coords);
      return opened ? OPENED : FAILED;
    }
    // CALL (`tel:`) y WEBSITE (`https:`/`http:`) ya canónicos y validados.
    await Linking.openURL(action.target);
    return OPENED;
  } catch {
    return FAILED;
  }
}
