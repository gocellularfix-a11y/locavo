/**
 * Feature flags de la transición de datos (V3).
 *
 * Defaults SEGUROS: todo apagado → la app usa el repositorio local (mock).
 * Un solo punto de verdad; prohibido esparcir banderas por el código.
 */
export interface FeatureFlags {
  useCloudPlaceRepository: boolean;
  enableDenueProvider: boolean;
  enableOpenStreetMapProvider: boolean;
  enableOwnerData: boolean;
  enableCommunityVerification: boolean;
}

export const FEATURE_FLAGS: Readonly<FeatureFlags> = Object.freeze({
  useCloudPlaceRepository: false,
  enableDenueProvider: false,
  enableOpenStreetMapProvider: false,
  enableOwnerData: false,
  enableCommunityVerification: false,
});

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
