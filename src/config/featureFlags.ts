/**
 * Feature flags de la transición de datos (V3/V4C).
 *
 * V4C: el city pack OFICIAL de Culiacán (500 establecimientos DENUE
 * empaquetados y offline) es la fuente de datos ACTIVA por defecto, con
 * respaldo automático en el repositorio local. La nube (Supabase) permanece
 * APAGADA: jamás se activa por accidente. Un solo punto de verdad; prohibido
 * esparcir banderas por el código.
 */
export interface FeatureFlags {
  useCloudPlaceRepository: boolean;
  /** City pack de runtime (V4D): trozos perezosos con respaldo local. */
  useCityPackRepository: boolean;
  enableDenueProvider: boolean;
  enableOpenStreetMapProvider: boolean;
  enableOwnerData: boolean;
  enableCommunityVerification: boolean;
}

export const FEATURE_FLAGS: Readonly<FeatureFlags> = Object.freeze({
  useCloudPlaceRepository: false,
  // V4C: city pack oficial de Culiacán ACTIVO (offline, con respaldo local).
  useCityPackRepository: true,
  enableDenueProvider: false,
  enableOpenStreetMapProvider: false,
  enableOwnerData: false,
  enableCommunityVerification: false,
});

/**
 * Activación del city pack: bandera comprometida (V4C: default ON para el
 * pack bundled de Culiacán) o, como anulación explícita de desarrollo,
 * EXPO_PUBLIC_USE_CITY_PACK=1 (variable local .env, nunca versionada). La
 * activación NO depende de crear un .env: la configuración vive en la
 * bandera comprometida. Con pack inválido/ausente el repositorio degrada
 * solo al local (con diagnóstico de desarrollo).
 */
export function isCityPackEnabled(flags: Readonly<FeatureFlags> = FEATURE_FLAGS): boolean {
  if (flags.useCityPackRepository) {
    return true;
  }
  return process.env.EXPO_PUBLIC_USE_CITY_PACK === '1';
}

export type DataMode = 'mock' | 'cloud';

/** Modo de datos derivado de los flags (visible en desarrollo, no para el usuario). */
export function getDataMode(flags: Readonly<FeatureFlags> = FEATURE_FLAGS): DataMode {
  return flags.useCloudPlaceRepository ? 'cloud' : 'mock';
}

/** Inspección en desarrollo: `globalThis.locavoFlags` en la consola. */
export function exposeFlagsForDevInspection(): void {
  if (__DEV__) {
    (globalThis as Record<string, unknown>).locavoFlags = {
      ...FEATURE_FLAGS,
      dataMode: getDataMode(),
    };
  }
}
