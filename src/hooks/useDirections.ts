import { useCallback, useState } from 'react';

import { buildPlaceActions } from '../actions';
import type { LocavoPlace } from '../domain/places/LocavoPlace';
import { analytics, navigationProvider } from '../services/container';
import { executePlaceAction } from '../services/placeActionExecutor';

/**
 * Abre direcciones a través de la ÚNICA frontera de ejecución externa
 * (`executePlaceAction`), que a su vez delega en el proveedor de navegación
 * aprobado (Google Maps universal). NO llama al proveedor directamente: así
 * todas las acciones externas (direcciones, llamada, sitio web) comparten una
 * sola puerta de ejecución. Conserva la analítica existente
 * (`navigation_requested` / `directions_opened`); no añade analítica nueva.
 * Función pura de orquestación, testeable sin React.
 */
export async function openDirectionsFor(place: LocavoPlace): Promise<boolean> {
  analytics.track({
    eventName: 'navigation_requested',
    navigationProvider: navigationProvider.id,
    placeId: place.id,
  });
  const action = buildPlaceActions(place).directions;
  const outcome = await executePlaceAction(action);
  if (outcome.opened) {
    analytics.track({
      eventName: 'directions_opened',
      navigationProvider: navigationProvider.id,
      placeId: place.id,
    });
  }
  return outcome.opened;
}

/**
 * Flujo compartido de "Cómo llegar":
 * 1. Ejecuta la apertura por la frontera canónica (`openDirectionsFor`).
 * 2. Si el sistema no puede abrirla, expone el fallo para mostrar un aviso con
 *    reintento (la app nunca truena por esto).
 */
export function useDirections() {
  const [failedPlace, setFailedPlace] = useState<LocavoPlace | null>(null);

  const navigateTo = useCallback(async (place: LocavoPlace) => {
    const opened = await openDirectionsFor(place);
    setFailedPlace(opened ? null : place);
  }, []);

  const retry = useCallback(() => {
    if (failedPlace) {
      navigateTo(failedPlace);
    }
  }, [failedPlace, navigateTo]);

  const dismiss = useCallback(() => setFailedPlace(null), []);

  return { navigateTo, failedPlace, retry, dismiss };
}
