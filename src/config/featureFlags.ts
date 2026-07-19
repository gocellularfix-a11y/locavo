/**
 * Feature flags de la transición de datos (V3).
 *
 * Defaults SEGUROS: todo apagado → la app usa el repositorio local (mock).
 * Un solo punto de verdad; prohibido esparcir banderas por el código.
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
  useCityPackRepository: false,
  enableDenueProvider: false,
  enableOpenStreetMapProvider: false,
  enableOwnerData: false,
  enableCommunityVerification: false,
});

/**
 * Activación del city pack: bandera comprometida (default OFF) o
 * configuración EXPLÍCITA de desarrollo vía EXPO_PUBLIC_USE_CITY_PACK=1
 * (variable local .env, nunca versionada) para las pruebas de aceptación
 * en Samsung y web. Con pack inválido/ausente el repositorio degrada solo
 * al local.
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
