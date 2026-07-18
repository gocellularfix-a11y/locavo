import { exposeFlagsForDevInspection, FEATURE_FLAGS, getDataMode } from '../config/featureFlags';
import { LocalPlaceRepository } from '../data/places/LocalPlaceRepository';
import type { PlaceRepository } from '../data/places/PlaceRepository';
import {
  exposeForDevInspection,
  LocalAnalyticsService,
  type AnalyticsService,
} from './analytics';
import { googleMapsProvider, type NavigationProvider } from './navigation';
import { PlaceSearchService } from './places/PlaceSearchService';

/**
 * Composición de servicios de la app (única fuente de instancias).
 *
 * V3: las pantallas consumen `placeSearchService`; el repositorio concreto
 * se decide aquí según los feature flags. Cuando exista
 * `CloudPlaceRepository`, cambiar de implementación solo toca este archivo.
 */

export const analytics: AnalyticsService = new LocalAnalyticsService();
exposeForDevInspection(analytics);
exposeFlagsForDevInspection();

/** dataMode: 'mock' hoy; 'cloud' cuando useCloudPlaceRepository esté activo. */
export const dataMode = getDataMode(FEATURE_FLAGS);

// `useCloudPlaceRepository` está apagado por default; no existe todavía un
// CloudPlaceRepository y el flag no debe encenderse en V3.
export const placeRepository: PlaceRepository = new LocalPlaceRepository();

export const placeSearchService = new PlaceSearchService(placeRepository, analytics);

export const navigationProvider: NavigationProvider = googleMapsProvider;
