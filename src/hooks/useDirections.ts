import { useCallback, useState } from 'react';

import type { LocavoPlace } from '../domain/places/LocavoPlace';
import { analytics, navigationProvider } from '../services/container';

/**
 * Flujo compartido de "Cómo llegar":
 * 1. Registra localmente la intención (`navigation_requested`, contrato
 *    Fase 1) y la apertura (`directions_opened`, contrato V3). Nunca una
 *    visita confirmada; sin coordenadas del usuario.
 * 2. Abre el enlace universal de Google Maps (sin API key ni Places).
 * 3. Si el sistema no puede abrirlo, expone el fallo para mostrar un aviso
 *    con reintento (la app nunca truena por esto).
 */
export function useDirections() {
  const [failedPlace, setFailedPlace] = useState<LocavoPlace | null>(null);

  const navigateTo = useCallback(async (place: LocavoPlace) => {
    analytics.track({
      eventName: 'navigation_requested',
      navigationProvider: navigationProvider.id,
      placeId: place.id,
    });
    const opened = await navigationProvider.openDirections(place.coordinates);
    if (opened) {
      analytics.track({
        eventName: 'directions_opened',
        navigationProvider: navigationProvider.id,
        placeId: place.id,
      });
    }
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
