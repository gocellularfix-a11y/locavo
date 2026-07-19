import { CityPackRepository } from './citypack/CityPackRepository';
import type { CityPackAssetLoader } from './citypack/CityPackAssetLoader';
import { createPlatformCityPackLoader } from './citypack/createPlatformCityPackLoader';
import { LocalPlaceRepository } from './LocalPlaceRepository';
import type { PlaceRepository } from './PlaceRepository';
import { FEATURE_FLAGS, isCityPackEnabled, type FeatureFlags } from '../../config/featureFlags';
import { readSupabaseConfig, type SupabaseConfig } from '../../config/supabaseConfig';
import { createCloudTransport } from '../supabase/client';
import { CloudRepositoryError } from '../supabase/errors';
import { SupabasePlaceRepository } from '../supabase/SupabasePlaceRepository';

/**
 * Composición del repositorio de lugares (V4A/V4D).
 *
 * Reglas:
 * - Flags apagados → LocalPlaceRepository (SIEMPRE, aunque existan
 *   variables de Supabase: la nube nunca se activa accidentalmente).
 * - City pack activo (flag o configuración explícita de desarrollo) →
 *   CityPackRepository con carga perezosa y RESPALDO automático en
 *   LocalPlaceRepository ante pack ausente/corrupto. El repositorio local
 *   nunca desaparece.
 * - Flag cloud encendido + configuración válida → SupabasePlaceRepository.
 * - Flag cloud encendido + configuración ausente/inválida → error
 *   controlado y diagnosticable, nunca un fallback silencioso que mezcle
 *   datos demo con producción.
 */
export function createPlaceRepository(
  flags: Readonly<FeatureFlags> = FEATURE_FLAGS,
  config: SupabaseConfig = readSupabaseConfig(),
  cityPackLoader?: CityPackAssetLoader,
): PlaceRepository {
  if (flags.useCloudPlaceRepository) {
    if (config.status !== 'valid') {
      throw new CloudRepositoryError('SUPABASE_CONFIGURATION_MISSING', config.reason);
    }
    return new SupabasePlaceRepository(createCloudTransport(config));
  }
  if (isCityPackEnabled(flags)) {
    const loader = cityPackLoader ?? createPlatformCityPackLoader();
    return new CityPackRepository(loader, new LocalPlaceRepository());
  }
  return new LocalPlaceRepository();
}
