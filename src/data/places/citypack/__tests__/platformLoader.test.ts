import { Platform } from 'react-native';

import { CityPackAssetError } from '../CityPackAssetLoader';
import { createPlatformCityPackLoader } from '../createPlatformCityPackLoader';

/**
 * V4D.2 — Selección de plataforma del cargador de assets.
 * iOS se audita a nivel de fuente/unidad (sin hardware iOS): rutas del
 * bundle correctas, sin fugas de asset:///android_asset y fallo limpio
 * hacia el respaldo local cuando el entorno no ofrece bundleDirectory.
 */

let mockBundleDirectory: string | null = 'file:///var/containers/App.app/';
const mockReadAsStringAsync = jest.fn();

jest.mock('expo-file-system/legacy', () => ({
  get bundleDirectory() {
    return mockBundleDirectory;
  },
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
}));

afterEach(() => {
  jest.restoreAllMocks();
  mockReadAsStringAsync.mockReset();
  mockBundleDirectory = 'file:///var/containers/App.app/';
  delete (globalThis as Record<string, unknown>).fetch;
});

describe('createPlatformCityPackLoader', () => {
  it('web: fetch same-origin bajo /citypack/ y error limpio en HTTP no-ok', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, text: async () => '{"ok":true}' })
      .mockResolvedValueOnce({ ok: false, status: 404 });
    (globalThis as Record<string, unknown>).fetch = fetchMock;

    const loader = createPlatformCityPackLoader();
    await expect(loader.load('manifest.json')).resolves.toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledWith('/citypack/manifest.json', {
      credentials: 'same-origin',
    });
    await expect(loader.load('manifest.json')).rejects.toThrow(CityPackAssetError);
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
  });

  it('android: lee assets del APK vía asset:/// (nunca rutas de bundle iOS)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    mockReadAsStringAsync.mockResolvedValue('contenido');

    const loader = createPlatformCityPackLoader();
    await expect(loader.load('categories/food/chunk-000.json')).resolves.toBe('contenido');
    expect(mockReadAsStringAsync).toHaveBeenCalledWith(
      'asset:///citypack/categories/food/chunk-000.json',
    );
  });

  it('ios: lee desde bundleDirectory sin fugas de android_asset', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockReadAsStringAsync.mockResolvedValue('contenido');

    const loader = createPlatformCityPackLoader();
    await expect(loader.load('manifest.json')).resolves.toBe('contenido');
    const uri = mockReadAsStringAsync.mock.calls[0][0] as string;
    expect(uri).toBe('file:///var/containers/App.app/citypack/manifest.json');
    expect(uri).not.toContain('android_asset');
  });

  it('ios sin bundleDirectory: falla LIMPIO (CityPackAssetError → respaldo local)', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockBundleDirectory = null;

    const loader = createPlatformCityPackLoader();
    await expect(loader.load('manifest.json')).rejects.toThrow(CityPackAssetError);
    expect(mockReadAsStringAsync).not.toHaveBeenCalled();
  });

  it('error nativo de lectura se convierte en CityPackAssetError (nunca crashea)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    mockReadAsStringAsync.mockRejectedValue(new Error('asset inexistente'));

    const loader = createPlatformCityPackLoader();
    await expect(loader.load('manifest.json')).rejects.toThrow(CityPackAssetError);
  });
});
