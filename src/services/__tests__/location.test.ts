import { readCurrentLocation, type LocationApi } from '../location';

function makeApi(overrides: Partial<LocationApi> = {}): LocationApi {
  return {
    requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    hasServicesEnabledAsync: async () => true,
    getCurrentPositionAsync: async () => ({
      coords: { latitude: 24.81, longitude: -107.39 },
    }),
    ...overrides,
  };
}

describe('readCurrentLocation', () => {
  it('permiso concedido y posición válida', async () => {
    const result = await readCurrentLocation(makeApi());
    expect(result).toEqual({
      status: 'granted',
      coords: { latitude: 24.81, longitude: -107.39 },
    });
  });

  it('permiso rechazado', async () => {
    const api = makeApi({
      requestForegroundPermissionsAsync: async () => ({ status: 'denied' }),
    });
    const result = await readCurrentLocation(api);
    expect(result).toEqual({ status: 'failed', reason: 'denied', coords: null });
  });

  it('servicios de ubicación desactivados', async () => {
    const api = makeApi({ hasServicesEnabledAsync: async () => false });
    const result = await readCurrentLocation(api);
    expect(result).toEqual({ status: 'failed', reason: 'services-off', coords: null });
  });

  it('timeout cuando la posición nunca llega', async () => {
    const api = makeApi({
      getCurrentPositionAsync: () => new Promise(() => undefined),
    });
    const result = await readCurrentLocation(api, 50);
    expect(result).toEqual({ status: 'failed', reason: 'timeout', coords: null });
  });

  it('coordenadas inválidas', async () => {
    const api = makeApi({
      getCurrentPositionAsync: async () => ({ coords: { latitude: NaN, longitude: 0 } }),
    });
    const result = await readCurrentLocation(api);
    expect(result).toEqual({ status: 'failed', reason: 'invalid', coords: null });
  });

  it('error temporal del sistema', async () => {
    const api = makeApi({
      getCurrentPositionAsync: async () => {
        throw new Error('boom');
      },
    });
    const result = await readCurrentLocation(api);
    expect(result).toEqual({ status: 'failed', reason: 'error', coords: null });
  });

  it('nunca lanza aunque el permiso falle', async () => {
    const api = makeApi({
      requestForegroundPermissionsAsync: async () => {
        throw new Error('crash');
      },
    });
    await expect(readCurrentLocation(api)).resolves.toEqual({
      status: 'failed',
      reason: 'error',
      coords: null,
    });
  });
});

// La resolución de zona manual y de ubicación efectiva se prueba en
// `effectiveLocation.test.ts` (fuente canónica única).

// Los mensajes humanos de falla se prueban en i18n/__tests__/format.test.ts.
