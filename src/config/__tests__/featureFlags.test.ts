import { FEATURE_FLAGS, getDataMode } from '../featureFlags';

describe('feature flags', () => {
  it('V4C: city pack ACTIVO, nube y proveedores externos APAGADOS', () => {
    expect(FEATURE_FLAGS).toEqual({
      useCloudPlaceRepository: false,
      // V4C: pack oficial de Culiacán offline, activo por defecto.
      useCityPackRepository: true,
      enableDenueProvider: false,
      enableOpenStreetMapProvider: false,
      enableOwnerData: false,
      enableCommunityVerification: false,
    });
  });

  it('los flags están congelados (una sola fuente de verdad)', () => {
    expect(Object.isFrozen(FEATURE_FLAGS)).toBe(true);
  });

  it('dataMode deriva de los flags', () => {
    expect(getDataMode()).toBe('mock');
    expect(getDataMode({ ...FEATURE_FLAGS, useCloudPlaceRepository: true })).toBe('cloud');
  });
});
