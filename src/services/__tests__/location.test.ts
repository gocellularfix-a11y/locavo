import {
  DEFAULT_MANUAL_LOCATION,
  describeLocationFailure,
  MANUAL_LOCATIONS,
  readCurrentLocation,
  resolveManualLocation,
  type LocationApi,
} from '../location';

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

describe('resolveManualLocation', () => {
  it('resuelve un id válido', () => {
    expect(resolveManualLocation('tres-rios').id).toBe('tres-rios');
  });

  it('id desconocido u obsoleto → default (Centro)', () => {
    expect(resolveManualLocation('zona-que-ya-no-existe')).toBe(DEFAULT_MANUAL_LOCATION);
  });

  it('valores corruptos → default', () => {
    expect(resolveManualLocation(null)).toBe(DEFAULT_MANUAL_LOCATION);
    expect(resolveManualLocation(42)).toBe(DEFAULT_MANUAL_LOCATION);
    expect(resolveManualLocation({ id: 'centro' })).toBe(DEFAULT_MANUAL_LOCATION);
  });

  it('todas las zonas manuales están en Culiacán con coordenadas válidas', () => {
    for (const manual of MANUAL_LOCATIONS) {
      expect(Math.abs(manual.coords.latitude - 24.8)).toBeLessThan(0.2);
      expect(Math.abs(manual.coords.longitude - -107.4)).toBeLessThan(0.2);
    }
  });
});

describe('describeLocationFailure', () => {
  it('mensajes humanos por cada motivo', () => {
    expect(describeLocationFailure('denied', 'Centro de Culiacán')).toContain('Permiso');
    expect(describeLocationFailure('services-off', 'Centro de Culiacán')).toContain('desactivada');
    expect(describeLocationFailure('timeout', 'Centro de Culiacán')).toContain('tardó');
    expect(describeLocationFailure('error', 'Centro de Culiacán')).toContain('no está disponible');
    expect(describeLocationFailure('invalid', 'Centro de Culiacán')).toContain('no está disponible');
  });
});
