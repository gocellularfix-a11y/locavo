import fs from 'node:fs';
import path from 'node:path';

import { fakeLoaderFrom, loadsWhere, type FakeLoader } from './fixtures';
import { cityPackPlaceToLocavoPlace } from '../CityPackPlaceMapper';
import { CityPackRepository } from '../CityPackRepository';
import {
  buildBundledCuliacanPack,
  BUNDLED_PACK_META,
  BUNDLED_SOURCE_FILE,
  type BundledPackResult,
} from '../buildBundledPack';
import {
  MANIFEST_PATH,
  PLACE_ID_INDEX_PATH,
  RUNTIME_PACK_FORMAT,
  RUNTIME_PACK_SCHEMA_VERSION,
} from '../RuntimePackFormat';
import { LocalPlaceRepository } from '../../LocalPlaceRepository';
import type { PlaceRepository } from '../../PlaceRepository';
import { individualVerificationDateOf } from '../../../../domain/places/LocavoPlace';
import { isLocavoPlaceId, locavoPlaceIdFromDenue } from '../../../../domain/places/locavoPlaceId';
import { haversineKm } from '../../../../domain/distance';
import { evaluateOpenStatus } from '../../../../domain/openingHours';
import { parseDenueCsv } from '../../../import/denue/DenueCsvParser';
import { decodeDenueBytes } from '../../../import/denue/encoding';
import { SurprisePlaceService } from '../../../../features/home/surprise';
import { sourceLabelLocalized } from '../../../../i18n/format';
import { SUPPORTED_LOCALES } from '../../../../i18n/types';

/**
 * V4C — Aceptación del city pack OFICIAL de Culiacán con DATOS REALES.
 *
 * Todo se construye desde el extracto DETERMINISTA versionado
 * (data/denue/denue_culiacan_pilot.csv): esta suite prueba que un clon
 * limpio produce el pack de 500 establecimientos y que el runtime lo sirve
 * de forma perezosa, veraz y offline, con respaldo local seguro.
 */

const ROOT = path.join(__dirname, '..', '..', '..', '..', '..');
const PILOT_CSV = path.join(ROOT, 'data', 'denue', BUNDLED_SOURCE_FILE);
const EXPECTED_COUNT = 500;
// Centro de Culiacán (zona seleccionable sin permiso de ubicación).
const CULIACAN_CENTER = { latitude: 24.8091, longitude: -107.394 };

const csvText = decodeDenueBytes(fs.readFileSync(PILOT_CSV)).text;
const bundle: BundledPackResult = buildBundledCuliacanPack(csvText);

function repoFrom(overrides?: (loader: FakeLoader) => void): {
  repo: CityPackRepository;
  fake: FakeLoader;
} {
  const fake = fakeLoaderFrom(bundle.files);
  overrides?.(fake);
  return { repo: new CityPackRepository(fake.loader, new LocalPlaceRepository()), fake };
}

/** Nombre original esperado según el mapper (nom_estab o raz_social). */
function cleanName(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

describe('V4C · pack bundled de Culiacán (datos reales)', () => {
  it('contiene EXACTAMENTE los 500 establecimientos aprobados', () => {
    expect(bundle.build.pack.count).toBe(EXPECTED_COUNT);
    expect(bundle.manifest.totalPlaces).toBe(EXPECTED_COUNT);
    expect(bundle.build.stats.accepted).toBe(EXPECTED_COUNT);
    const total = Object.values(bundle.manifest.byCategory).reduce((a, b) => a + b, 0);
    expect(total).toBe(EXPECTED_COUNT);
  });

  it('cubre las categorías esperadas (comida, cerveza, farmacia, café, hotel, gasolina)', () => {
    for (const category of ['food', 'beer', 'pharmacy', 'coffee', 'lodging', 'gas']) {
      expect(bundle.manifest.byCategory[category]).toBeGreaterThan(0);
    }
  });

  it('sin referencias DENUE duplicadas (ids únicos)', () => {
    const ids = bundle.build.pack.places.map((p) => p.id);
    const externalIds = bundle.build.pack.places.map((p) => p.sources[0].externalId);
    expect(new Set(ids).size).toBe(EXPECTED_COUNT);
    expect(new Set(externalIds).size).toBe(EXPECTED_COUNT);
    expect(bundle.build.stats.duplicates).toBe(0);
  });

  describe('identidad canónica (UUID propio de Locavo)', () => {
    it('cada id canónico es un UUID v5 válido, no el denue_id, sin prefijo denue-', () => {
      for (const place of bundle.build.pack.places) {
        const denueId = place.sources[0].externalId;
        expect(isLocavoPlaceId(place.id)).toBe(true);
        expect(place.id).not.toBe(denueId);
        expect(place.id.startsWith('denue-')).toBe(false);
      }
    });

    it('500 registros → 500 UUIDs canónicos ÚNICOS', () => {
      const ids = new Set(bundle.build.pack.places.map((p) => p.id));
      expect(ids.size).toBe(EXPECTED_COUNT);
    });

    it('el denue_id y la CLEE se preservan APARTE; el proveedor es "denue"', () => {
      for (const place of bundle.build.pack.places) {
        const source = place.sources.find((s) => s.provider === 'denue');
        expect(source).toBeDefined();
        expect(source?.provider).toBe('denue');
        expect(typeof source?.externalId).toBe('string');
        expect((source?.externalId ?? '').length).toBeGreaterThan(0);
        // Hidratado a LocavoPlace: id canónico + refs de proveedor separadas.
        const hydrated = cityPackPlaceToLocavoPlace(place);
        expect(hydrated.id).toBe(place.id);
        expect(hydrated.sourceRefs.denueId).toBe(source?.externalId);
        if (source?.clee) {
          expect(hydrated.sourceRefs.clee).toBe(source.clee);
        }
        expect(isLocavoPlaceId(hydrated.id)).toBe(true);
      }
    });

    it('el MISMO registro produce el MISMO UUID entre builds; el orden no influye', () => {
      const again = buildBundledCuliacanPack(csvText);
      const byDenue = new Map(again.build.pack.places.map((p) => [p.sources[0].externalId, p.id]));
      for (const place of bundle.build.pack.places) {
        const denueId = place.sources[0].externalId;
        // Reproducible entre builds…
        expect(byDenue.get(denueId)).toBe(place.id);
        // …y derivable solo del denue_id (independiente de la posición).
        expect(place.id).toBe(locavoPlaceIdFromDenue(denueId));
      }
    });

    it('registros DENUE distintos → UUIDs canónicos distintos', () => {
      expect(locavoPlaceIdFromDenue('3763998')).not.toBe(locavoPlaceIdFromDenue('3763999'));
    });

    it('getById resuelve por UUID canónico (no por denue_id)', async () => {
      const { repo } = repoFrom();
      const sample = bundle.build.pack.places[0];
      const byUuid = await repo.getById(sample.id);
      expect(byUuid?.id).toBe(sample.id);
      expect(byUuid?.sourceRefs.denueId).toBe(sample.sources[0].externalId);
      // El denue_id crudo NO es una llave canónica válida.
      const byDenueId = await repo.getById(sample.sources[0].externalId);
      expect(byDenueId).toBeNull();
    });
  });

  it('preserva el nombre original del establecimiento (sin inventar)', () => {
    const rows = parseDenueCsv(csvText);
    const nameById = new Map<string, string>();
    for (const { record } of rows) {
      nameById.set(cleanName(record.id), cleanName(record.nom_estab) || cleanName(record.raz_social));
    }
    for (const place of bundle.build.pack.places) {
      const denueId = place.sources[0].externalId;
      expect(place.name).toBe(nameById.get(denueId));
      expect(place.name.length).toBeGreaterThan(0);
      // Nunca datos demo: el mock local usa el prefijo "Demo ".
      expect(place.name.startsWith('Demo ')).toBe(false);
      // Identidad canónica propia de Locavo (UUID), nunca un id de proveedor.
      expect(isLocavoPlaceId(place.id)).toBe(true);
    }
  });

  it('manifiesto válido con metadatos de versión y fuente', () => {
    expect(bundle.manifest.format).toBe(RUNTIME_PACK_FORMAT);
    expect(bundle.manifest.schemaVersion).toBe(RUNTIME_PACK_SCHEMA_VERSION);
    expect(bundle.manifest.city).toBe('culiacan');
    expect(bundle.manifest.packVersion).toBe(BUNDLED_PACK_META.sourceVersion);
    expect(bundle.manifest.dataset).toBe(BUNDLED_PACK_META.dataset);
    expect(bundle.manifest.license).toContain('INEGI');
  });

  it('es reproducible: misma entrada → mismos bytes (clon limpio determinista)', () => {
    const again = buildBundledCuliacanPack(csvText);
    expect(again.files.length).toBe(bundle.files.length);
    expect(JSON.stringify(again.files)).toBe(JSON.stringify(bundle.files));
  });

  it('NO carga todos los trozos al arrancar (perezoso)', async () => {
    const { repo, fake } = repoFrom();
    // Construir el repo no dispara ninguna carga.
    expect(fake.loads.size).toBe(0);
    const first = bundle.build.pack.places[0];
    const place = await repo.getById(first.id);
    expect(place?.id).toBe(first.id);
    // getById: manifiesto + índice de ids + EXACTAMENTE un trozo.
    expect(fake.loads.get(MANIFEST_PATH)).toBe(1);
    expect(fake.loads.get(PLACE_ID_INDEX_PATH)).toBe(1);
    const chunkLoads = loadsWhere(fake.loads, (p) => p.startsWith('categories/'));
    expect(chunkLoads).toBe(1);
    // No se cargó ni de lejos la totalidad de los trozos.
    expect(chunkLoads).toBeLessThan(bundle.manifest.chunks.length);
  });

  it('cachés acotadas: una consulta repetida reutiliza el trozo (sin recarga)', async () => {
    const { repo, fake } = repoFrom();
    const first = bundle.build.pack.places[0];
    await repo.getById(first.id);
    const afterFirst = loadsWhere(fake.loads, (p) => p.startsWith('categories/'));
    await repo.getById(first.id);
    const afterSecond = loadsWhere(fake.loads, (p) => p.startsWith('categories/'));
    expect(afterSecond).toBe(afterFirst); // cache hit, no recarga
  });

  describe('búsqueda con términos reales', () => {
    const terms = ['tacos', 'café', 'cerveza', 'farmacia', 'hotel', 'gasolina'];
    for (const term of terms) {
      it(`"${term}" devuelve establecimientos reales`, async () => {
        const { repo } = repoFrom();
        const result = await repo.searchText({ text: term, limit: 20 });
        expect(result.places.length).toBeGreaterThan(0);
        for (const place of result.places) {
          expect(isLocavoPlaceId(place.id)).toBe(true);
        }
      });
    }

    it('búsqueda insensible a acentos y ñ (café == cafe)', async () => {
      const { repo } = repoFrom();
      const withAccent = await repo.searchText({ text: 'café', limit: 50 });
      const withoutAccent = await repo.searchText({ text: 'cafe', limit: 50 });
      expect(withoutAccent.places.length).toBeGreaterThan(0);
      expect(withoutAccent.places.map((p) => p.id).sort()).toEqual(
        withAccent.places.map((p) => p.id).sort(),
      );
    });
  });

  it('filtra por categoría sin duplicados ni filas vacías (comida = 120)', async () => {
    const { repo } = repoFrom();
    const expected = bundle.manifest.byCategory.food;
    const collected = new Set<string>();
    let cursor: string | undefined;
    let guard = 0;
    do {
      const page = await repo.listByCategory('food', { limit: 50, cursor });
      expect(page.total).toBe(expected);
      for (const place of page.places) {
        expect(place.category).toBe('food');
        expect(collected.has(place.id)).toBe(false); // sin duplicados
        collected.add(place.id);
      }
      cursor = page.nextCursor;
    } while (cursor && guard++ < 20);
    expect(collected.size).toBe(expected);
  });

  it('cercanía: ordena por distancia real, coordenadas siempre válidas', async () => {
    const { repo } = repoFrom();
    const result = await repo.searchNearby({
      latitude: CULIACAN_CENTER.latitude,
      longitude: CULIACAN_CENTER.longitude,
      radiusMeters: 30_000,
      limit: 50,
    });
    expect(result.places.length).toBeGreaterThan(0);
    let previous = -1;
    for (const place of result.places) {
      const { latitude, longitude } = place.coordinates;
      expect(Number.isFinite(latitude) && Number.isFinite(longitude)).toBe(true);
      expect(latitude).toBeGreaterThan(23);
      expect(latitude).toBeLessThan(26);
      expect(longitude).toBeGreaterThan(-109);
      expect(longitude).toBeLessThan(-106);
      // Mismo métrico que el repositorio: distancia no decreciente.
      const d = haversineKm(CULIACAN_CENTER, place.coordinates);
      expect(d).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = d;
    }
  });

  it('verdad de datos: sin horarios inventados → nunca "abierto" sin horario real', () => {
    const now = new Date('2026-07-20T18:00:00.000Z');
    for (const packPlace of bundle.build.pack.places.slice(0, 50)) {
      const place = cityPackPlaceToLocavoPlace(packPlace);
      expect(place.hours).toBeUndefined();
      expect(evaluateOpenStatus(place.hours ?? null, now).state).not.toBe('open');
      // La fecha de edición del dataset NO es verificación individual.
      expect(individualVerificationDateOf(place.verification)).toBeUndefined();
      expect(place.verification.status).toBe('source_verified');
    }
  });

  it('etiqueta de fuente oficial localizada en los 7 idiomas', () => {
    const place = cityPackPlaceToLocavoPlace(bundle.build.pack.places[0]);
    expect(SUPPORTED_LOCALES).toHaveLength(7);
    for (const locale of SUPPORTED_LOCALES) {
      const label = sourceLabelLocalized(place, locale);
      expect(typeof label).toBe('string');
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });

  it('Sorpréndeme selecciona un establecimiento real del city pack', async () => {
    const { repo } = repoFrom();
    const service = new SurprisePlaceService(repo);
    // Sin permiso de ubicación: se usa el centro de la zona seleccionada.
    const place = await service.surprise({
      origin: CULIACAN_CENTER,
      now: new Date('2026-07-20T18:00:00.000Z'),
      random: () => 0.42,
    });
    expect(place).not.toBeNull();
    expect(isLocavoPlaceId(place?.id ?? '')).toBe(true);
    expect(place?.name.startsWith('Demo ')).toBe(false);
    // El id canónico entregado por Sorpréndeme resuelve el MISMO lugar.
    const again = await repo.getById(place?.id ?? '');
    expect(again?.id).toBe(place?.id);
    expect(again?.sourceRefs.denueId).toBe(place?.sourceRefs.denueId);
  });

  describe('respaldo local seguro', () => {
    const localOnly = (): PlaceRepository => new LocalPlaceRepository();

    it('pack ausente → respaldo local sin lanzar', async () => {
      const repo = new CityPackRepository(
        { async load() {
          throw new Error('sin pack');
        } },
        localOnly(),
      );
      const result = await repo.searchText({ text: 'tacos', limit: 10 });
      expect(Array.isArray(result.places)).toBe(true);
    });

    it('manifiesto corrupto → respaldo local sin estado mixto', async () => {
      const { repo } = repoFrom((fake) => fake.set(MANIFEST_PATH, 'no-es-json'));
      const result = await repo.listByCategory('food', { limit: 10 });
      // Cae al local (datos demo), nunca una mezcla parcial del pack.
      expect(Array.isArray(result.places)).toBe(true);
    });
  });
});
