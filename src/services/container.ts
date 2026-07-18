import { MockPlaceRepository } from '../data/mockPlaceRepository';
import type { PlaceRepository } from '../domain/repositories';
import {
  exposeForDevInspection,
  LocalAnalyticsService,
  type AnalyticsService,
} from './analytics';
import { googleMapsProvider, type NavigationProvider } from './navigation';

/**
 * Composición de servicios de la app (única fuente de instancias).
 * Cambiar de implementación (p. ej. repositorio remoto en Fase 2)
 * solo requiere tocar este archivo.
 */

export const placeRepository: PlaceRepository = new MockPlaceRepository();

export const analytics: AnalyticsService = new LocalAnalyticsService();
exposeForDevInspection(analytics);

export const navigationProvider: NavigationProvider = googleMapsProvider;
