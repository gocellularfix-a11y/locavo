import { FEATURE_FLAGS, getDataMode } from '../featureFlags';

describe('feature flags', () => {
  it('defaults seguros: toda la transición cloud está apagada', () => {
    expect(FEATURE_FLAGS).toEqual({
      useCloudPlaceRepository: false,
      useCityPackRepository: false,
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
