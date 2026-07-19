import { exposeFlagsForDevInspection, FEATURE_FLAGS, getDataMode } from '../config/featureFlags';
import { createPlaceRepository } from '../data/places/createPlaceRepository';
import type { PlaceRepository } from '../data/places/PlaceRepository';
import { SurprisePlaceService } from '../features/home/surprise';
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

// Composición vía factory (V4A): con el flag apagado SIEMPRE es
// LocalPlaceRepository, existan o no variables de Supabase. La activación
// cloud será una decisión explícita futura (V4B+), nunca accidental.
export const placeRepository: PlaceRepository = createPlaceRepository();

export const placeSearchService = new PlaceSearchService(placeRepository, analytics);

/** "Sorpréndeme" (V4A.2): usa el MISMO repositorio activo (local hoy). */
export const surprisePlaceService = new SurprisePlaceService(placeRepository);

export const navigationProvider: NavigationProvider = googleMapsProvider;
