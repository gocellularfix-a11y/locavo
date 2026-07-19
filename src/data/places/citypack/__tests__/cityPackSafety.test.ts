import fs from 'node:fs';
import path from 'node:path';

import { fakeLoaderFrom, fixturePack } from './fixtures';
import { buildRuntimePack } from '../buildRuntimePack';
import { CityPackRepository } from '../CityPackRepository';
import { FEATURE_FLAGS, getDataMode, isCityPackEnabled } from '../../../../config/featureFlags';
import { createPlaceRepository } from '../../createPlaceRepository';
import { LocalPlaceRepository } from '../../LocalPlaceRepository';

const ROOT = path.join(__dirname, '..', '..', '..', '..', '..');

function read(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('seguridad del milestone V4D', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_USE_CITY_PACK;
  });

  it('la bandera useCityPackRepository existe y su default comprometido es false', () => {
    expect(FEATURE_FLAGS.useCityPackRepository).toBe(false);
    expect(isCityPackEnabled(FEATURE_FLAGS)).toBe(false);
  });

  it('LocalPlaceRepository sigue siendo el repositorio por defecto', () => {
    const repo = createPlaceRepository();
    expect(repo).toBeInstanceOf(LocalPlaceRepository);
    expect(repo).not.toBeInstanceOf(CityPackRepository);
  });

  it('la configuración explícita de desarrollo activa el pack con respaldo local', () => {
    process.env.EXPO_PUBLIC_USE_CITY_PACK = '1';
    expect(isCityPackEnabled(FEATURE_FLAGS)).toBe(true);
    const { files } = buildRuntimePack(fixturePack());
    const repo = createPlaceRepository(
      FEATURE_FLAGS,
      { status: 'missing', reason: 'sin variables' },
      fakeLoaderFrom(files).loader,
    );
    expect(repo).toBeInstanceOf(CityPackRepository);
  });

  it('la bandera en true también compone CityPackRepository', () => {
    const { files } = buildRuntimePack(fixturePack());
    const repo = createPlaceRepository(
      { ...FEATURE_FLAGS, useCityPackRepository: true },
      { status: 'missing', reason: 'sin variables' },
      fakeLoaderFrom(files).loader,
    );
    expect(repo).toBeInstanceOf(CityPackRepository);
  });

  it('Cloud permanece OFF y el modo de datos sigue siendo mock', () => {
    expect(FEATURE_FLAGS.useCloudPlaceRepository).toBe(false);
    expect(getDataMode(FEATURE_FLAGS)).toBe('mock');
  });

  it('el runtime no importa el pack completo de forma ansiosa (sin JSON embebido)', () => {
    const sources = [
      'src/data/places/citypack/CityPackRepository.ts',
      'src/data/places/citypack/createPlatformCityPackLoader.ts',
      'src/data/places/createPlaceRepository.ts',
      'src/services/container.ts',
    ];
    for (const file of sources) {
      const source = read(file);
      // Nada de require/import de .json de datos en el runtime del pack.
      expect(source).not.toMatch(/require\([^)]*\.json/);
      expect(source).not.toMatch(/from\s+['"][^'"]*pack[^'"]*\.json/);
      expect(source).not.toMatch(/culiacan\.pack/);
    }
  });

  it('el repositorio de runtime no contiene lógica específica de DENUE (neutral al proveedor)', () => {
    const source = read('src/data/places/citypack/CityPackRepository.ts');
    expect(source).not.toMatch(/denue/i);
    expect(source.toLowerCase()).not.toContain('google');
    expect(source.toLowerCase()).not.toContain('supabase');
  });

  it('.gitignore protege los assets staged y los packs generados', () => {
    const gitignore = read('.gitignore');
    expect(gitignore).toMatch(/^public\/citypack\/$/m);
    expect(gitignore).toMatch(/^citypack-staged\/$/m);
    expect(gitignore).toMatch(/^GeoData\/$/m);
    expect(gitignore).toMatch(/^\*\.pack\.json$/m);
  });

  it('no hay pack real generado dentro del árbol versionable', () => {
    // El único citypack permitido en public/ es el staged (gitignored);
    // si existe, git debe ignorarlo — se valida vía las reglas anteriores.
    const publicDir = path.join(ROOT, 'public');
    for (const entry of fs.readdirSync(publicDir)) {
      if (entry === 'citypack') {
        continue; // staging local permitido; git lo ignora
      }
      const full = path.join(publicDir, entry);
      const stat = fs.statSync(full);
      if (stat.isFile()) {
        expect(stat.size).toBeLessThan(1_000_000);
      }
    }
  });

  it('los scripts del city pack no fijan letras de unidad de esta máquina', () => {
    for (const file of ['scripts/citypack/build-culiacan.ts', 'scripts/citypack/stage.ts']) {
      const source = read(file);
      expect(source).not.toMatch(/[CE]:\\{1,2}GeoData/);
      expect(source).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it('las pantallas siguen sin importar Supabase ni Google Places', () => {
    for (const screen of [
      'src/app/(tabs)/index.tsx',
      'src/app/(tabs)/explore.tsx',
      'src/app/(tabs)/settings.tsx',
    ]) {
      const source = read(screen).toLowerCase();
      expect(source).not.toContain('supabase');
      expect(source).not.toContain('google places');
      expect(source).not.toContain('places.googleapis');
    }
  });
});
