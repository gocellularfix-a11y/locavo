import { LocalPlaceRepository } from './LocalPlaceRepository';
import type { PlaceRepository } from './PlaceRepository';
import { FEATURE_FLAGS, type FeatureFlags } from '../../config/featureFlags';
import { readSupabaseConfig, type SupabaseConfig } from '../../config/supabaseConfig';
import { createCloudTransport } from '../supabase/client';
import { CloudRepositoryError } from '../supabase/errors';
import { SupabasePlaceRepository } from '../supabase/SupabasePlaceRepository';

/**
 * Composición del repositorio de lugares (V4A).
 *
 * Reglas:
 * - Flag apagado → LocalPlaceRepository (SIEMPRE, aunque existan variables
 *   de Supabase: la nube nunca se activa accidentalmente).
 * - Flag encendido + configuración válida → SupabasePlaceRepository.
 * - Flag encendido + configuración ausente/ inválida → error controlado y
 *   diagnosticable (SUPABASE_CONFIGURATION_MISSING), nunca un fallback
 *   silencioso que mezcle datos demo con producción.
 */
export function createPlaceRepository(
  flags: Readonly<FeatureFlags> = FEATURE_FLAGS,
  config: SupabaseConfig = readSupabaseConfig(),
): PlaceRepository {
  if (!flags.useCloudPlaceRepository) {
    return new LocalPlaceRepository();
  }
  if (config.status !== 'valid') {
    throw new CloudRepositoryError('SUPABASE_CONFIGURATION_MISSING', config.reason);
  }
  return new SupabasePlaceRepository(createCloudTransport(config));
}
