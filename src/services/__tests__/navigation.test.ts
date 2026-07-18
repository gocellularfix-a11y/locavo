import { Linking } from 'react-native';

import {
  GoogleMapsNavigationProvider,
  InvalidCoordinatesError,
} from '../navigation';

const provider = new GoogleMapsNavigationProvider();

describe('GoogleMapsNavigationProvider', () => {
  it('usa el identificador google_maps', () => {
    expect(provider.id).toBe('google_maps');
  });

  it('construye el enlace universal de Google Maps', () => {
    const url = provider.buildDirectionsUrl({ latitude: 24.8069, longitude: -107.394 });
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=24.8069%2C-107.394');
  });

  it('rechaza coordenadas inválidas', () => {
    expect(() => provider.buildDirectionsUrl({ latitude: NaN, longitude: 0 })).toThrow(
      InvalidCoordinatesError,
    );
    expect(() => provider.buildDirectionsUrl({ latitude: 95, longitude: 0 })).toThrow(
      InvalidCoordinatesError,
    );
    expect(() => provider.buildDirectionsUrl({ latitude: 0, longitude: -200 })).toThrow(
      InvalidCoordinatesError,
    );
  });

  it('openDirections abre la URL con Linking', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const ok = await provider.openDirections({ latitude: 24.8069, longitude: -107.394 });
    expect(ok).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      'https://www.google.com/maps/dir/?api=1&destination=24.8069%2C-107.394',
    );
  });

  it('openDirections devuelve false si el sistema no puede abrir la URL', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const ok = await provider.openDirections({ latitude: 24.8069, longitude: -107.394 });
    expect(ok).toBe(false);
  });

  it('openDirections no lanza con coordenadas inválidas: devuelve false y no abre nada', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const ok = await provider.openDirections({ latitude: NaN, longitude: Infinity });
    expect(ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('permite reintentar tras un fallo (intentos repetidos)', async () => {
    const spy = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(true);
    const dest = { latitude: 24.8069, longitude: -107.394 };
    await expect(provider.openDirections(dest)).resolves.toBe(false);
    await expect(provider.openDirections(dest)).resolves.toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
