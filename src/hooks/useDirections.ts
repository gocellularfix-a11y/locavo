import { useCallback, useState } from 'react';

import type { Place } from '../domain/place';
import { analytics, navigationProvider } from '../services/container';

/**
 * Flujo compartido de "Cómo llegar":
 * 1. Registra el evento local `navigation_requested` (intención, no visita).
 * 2. Abre el enlace universal de Google Maps.
 * 3. Si el sistema no puede abrirlo, expone el fallo para mostrar un aviso
 *    con reintento (la app nunca truena por esto).
 */
export function useDirections() {
  const [failedPlace, setFailedPlace] = useState<Place | null>(null);

  const navigateTo = useCallback(async (place: Place) => {
    analytics.track({
      eventName: 'navigation_requested',
      navigationProvider: navigationProvider.id,
      placeId: place.id,
    });
    const opened = await navigationProvider.openDirections(place);
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
