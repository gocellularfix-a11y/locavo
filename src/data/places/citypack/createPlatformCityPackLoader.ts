import { Platform } from 'react-native';

import { CityPackAssetError, type CityPackAssetLoader } from './CityPackAssetLoader';

/**
 * Cargadores por plataforma del city pack (V4D).
 *
 * - Web/PWA: fetch de estáticos same-origin bajo /citypack/ (fuera del
 *   bundle de JavaScript; el service worker existente los cachea tras la
 *   primera lectura, quedando usables offline).
 * - Android: assets empaquetados en el APK (asset:///citypack) leídos
 *   perezosamente con expo-file-system (API legacy, estable).
 * - iOS: misma mecánica desde el bundle de la app (mejor esfuerzo; sin
 *   dispositivo iOS en esta fase).
 *
 * Sin APIs de terceros: solo recursos locales/instalados.
 */

const WEB_BASE = '/citypack';
// Esquema de assets empaquetados del APK (expo-file-system legacy).
const ANDROID_BASE = 'asset:///citypack';

export function createPlatformCityPackLoader(): CityPackAssetLoader {
  if (Platform.OS === 'web') {
    return {
      async load(path: string): Promise<string> {
        const response = await fetch(`${WEB_BASE}/${path}`, { credentials: 'same-origin' });
        if (!response.ok) {
          throw new CityPackAssetError(`Recurso no disponible: ${path} (HTTP ${response.status})`);
        }
        return response.text();
      },
    };
  }

  return {
    async load(path: string): Promise<string> {
      // Carga perezosa del módulo nativo: solo cuando el pack está activo.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
      let base: string;
      if (Platform.OS === 'android') {
        base = ANDROID_BASE;
      } else {
        // iOS: assets dentro del bundle de la app. Sin bundleDirectory
        // (entorno inesperado) se falla LIMPIO hacia el respaldo local en
        // lugar de leer una ruta relativa sin sentido. El esquema
        // asset:///android_asset jamás se usa fuera de Android.
        const bundleDir = FileSystem.bundleDirectory;
        if (!bundleDir) {
          throw new CityPackAssetError(
            `Recurso no disponible: ${path} (bundleDirectory no definido en ${Platform.OS})`,
          );
        }
        base = `${bundleDir.replace(/\/$/, '')}/citypack`;
      }
      try {
        return await FileSystem.readAsStringAsync(`${base}/${path}`);
      } catch (error) {
        throw new CityPackAssetError(
          `Recurso no disponible: ${path} (${error instanceof Error ? error.message : 'error'})`,
        );
      }
    },
  };
}
