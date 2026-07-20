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

  it('V4C: la bandera useCityPackRepository está ACTIVA por defecto (comprometida)', () => {
    expect(FEATURE_FLAGS.useCityPackRepository).toBe(true);
    expect(isCityPackEnabled(FEATURE_FLAGS)).toBe(true);
  });

  it('V4C: CityPackRepository es el repositorio por defecto (con respaldo local dentro)', () => {
    const { files } = buildRuntimePack(fixturePack());
    const repo = createPlaceRepository(
      FEATURE_FLAGS,
      { status: 'missing', reason: 'sin variables' },
      fakeLoaderFrom(files).loader,
    );
    expect(repo).toBeInstanceOf(CityPackRepository);
    expect(repo).not.toBeInstanceOf(LocalPlaceRepository);
  });

  it('la activación NO depende de crear un .env local', () => {
    // Sin EXPO_PUBLIC_USE_CITY_PACK definido, la bandera comprometida basta.
    delete process.env.EXPO_PUBLIC_USE_CITY_PACK;
    expect(isCityPackEnabled(FEATURE_FLAGS)).toBe(true);
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

  it('Cloud/Supabase permanece OFF con el city pack activo (nunca es la fuente)', () => {
    expect(FEATURE_FLAGS.useCloudPlaceRepository).toBe(false);
    // getDataMode solo distingue nube de no-nube: el city pack es offline.
    expect(getDataMode(FEATURE_FLAGS)).not.toBe('cloud');
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
    for (const file of [
      'scripts/citypack/build-culiacan.ts',
      'scripts/citypack/stage.ts',
      'scripts/citypack/build-bundled.ts',
    ]) {
      const source = read(file);
      expect(source).not.toMatch(/[CE]:\\{1,2}GeoData/);
      expect(source).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it('el mapa de Explorar tiene tope explícito de marcadores (sin acumulación)', () => {
    const source = read('src/app/(tabs)/explore.tsx');
    expect(source).toMatch(/MAX_MAP_MARKERS = 200/);
    expect(source).toMatch(/results\.slice\(0, MAX_MAP_MARKERS\)/);
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
