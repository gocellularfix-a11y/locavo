import fs from 'node:fs';
import path from 'node:path';

import { FEATURE_FLAGS, getDataMode } from '../../../../config/featureFlags';
import { createPlaceRepository } from '../../../places/createPlaceRepository';
import { LocalPlaceRepository } from '../../../places/LocalPlaceRepository';

const ROOT = path.join(__dirname, '..', '..', '..', '..', '..');

function read(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

/**
 * Guardas del milestone V4C: el pipeline de datos no toca la frontera de
 * runtime ni introduce dependencias de red, rutas de máquina o datos
 * masivos en git.
 */
describe('seguridad del pipeline DENUE (V4C)', () => {
  const PIPELINE_SOURCES = [
    'scripts/denue/prepare-culiacan.ts',
    'scripts/denue/build-archive-manifest.ts',
    'src/data/import/denue/CityPackBuilder.ts',
    'src/data/import/denue/geodataRoot.ts',
    'src/data/import/denue/encoding.ts',
  ];

  it('la preparación local no hace llamadas de red (sin fetch/http en el pipeline)', () => {
    for (const file of PIPELINE_SOURCES) {
      const source = read(file);
      expect(source).not.toMatch(/\bfetch\s*\(/);
      expect(source).not.toMatch(/require\(['"]https?['"]\)/);
      expect(source).not.toMatch(/from\s+['"]node:https?['"]/);
      expect(source).not.toMatch(/XMLHttpRequest/);
    }
  });

  it('sin raíces de máquina como default (C:\\GeoData / E:\\GeoData prohibidos)', () => {
    for (const file of PIPELINE_SOURCES) {
      const source = read(file);
      // "D:\GeoData" aparece solo como EJEMPLO en textos de ayuda; las
      // raíces reales de esta máquina jamás se codifican en el fuente.
      expect(source).not.toMatch(/[CE]:\\{1,2}GeoData/);
    }
  });

  it('sin Google Places en el pipeline', () => {
    for (const file of PIPELINE_SOURCES) {
      expect(read(file).toLowerCase()).not.toContain('google');
    }
  });

  it('.gitignore protege el archivo oficial y los packs generados', () => {
    const gitignore = read('.gitignore');
    expect(gitignore).toMatch(/^GeoData\/$/m);
    expect(gitignore).toMatch(/^data\/denue\/\*\.zip$/m);
    expect(gitignore).toMatch(/^data\/denue\/derived\/$/m);
    expect(gitignore).toMatch(/^\*\.pack\.json$/m);
    expect(gitignore).toMatch(/^\*\.part$/m);
    expect(gitignore).toMatch(/^denue-\*-manifest\.json$/m);
  });

  it('el repositorio no contiene datos crudos DENUE (zip/csv masivos)', () => {
    const dataDir = path.join(ROOT, 'data', 'denue');
    const entries = fs.readdirSync(dataDir);
    for (const entry of entries) {
      expect(entry.endsWith('.zip')).toBe(false);
      const size = fs.statSync(path.join(dataDir, entry)).size;
      // Solo fixtures pequeños y el mapa SCIAN; nunca extractos masivos.
      expect(size).toBeLessThan(1_000_000);
    }
  });

  it('Cloud permanece OFF y LocalPlaceRepository sigue disponible por defecto', () => {
    expect(FEATURE_FLAGS.useCloudPlaceRepository).toBe(false);
    expect(getDataMode(FEATURE_FLAGS)).toBe('mock');
    expect(createPlaceRepository()).toBeInstanceOf(LocalPlaceRepository);
  });

  it('no se activó Supabase en la UI (las pantallas no importan supabase)', () => {
    const screens = ['src/app/(tabs)/index.tsx', 'src/app/(tabs)/explore.tsx', 'src/app/(tabs)/settings.tsx'];
    for (const screen of screens) {
      expect(read(screen).toLowerCase()).not.toContain('supabase');
    }
  });
});
