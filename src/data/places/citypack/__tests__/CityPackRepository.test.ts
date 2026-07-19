import { fakeLoaderFrom, fixturePack, loadsWhere } from './fixtures';
import { buildRuntimePack } from '../buildRuntimePack';
import { CityPackRepository } from '../CityPackRepository';
import { MANIFEST_PATH, SEARCH_INDEX_PATH } from '../RuntimePackFormat';
import { cityPackPlaceToLocavoPlace } from '../CityPackPlaceMapper';
import { LocalPlaceRepository } from '../../LocalPlaceRepository';
import { InvalidPlaceQueryError } from '../../PlaceQuery';

const CENTER = { latitude: 24.8069, longitude: -107.394 };

function makeRepo(options?: { maxCachedChunks?: number; maxChunkRecords?: number }) {
  const { files } = buildRuntimePack(fixturePack(), {
    maxChunkRecords: options?.maxChunkRecords ?? 1,
  });
  const fake = fakeLoaderFrom(files);
  const fallback = new LocalPlaceRepository();
  const repo = new CityPackRepository(fake.loader, fallback, {
    maxCachedChunks: options?.maxCachedChunks,
  });
  return { repo, fake, fallback };
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('CityPackRepository — carga perezosa', () => {
  it('getById carga manifiesto + índice de ids + EXACTAMENTE un trozo', async () => {
    const { repo, fake } = makeRepo();
    const place = await repo.getById('denue-200');
    expect(place?.name).toBe('CAFÉ DOÑA ÑOÑA');
    expect(loadsWhere(fake.loads, (p) => p.startsWith('categories/'))).toBe(1);
    expect(fake.loads.get(SEARCH_INDEX_PATH)).toBeUndefined();
  });

  it('getById preserva procedencia (sourceRefs y provenance del proveedor)', async () => {
    const { repo } = makeRepo();
    const place = await repo.getById('denue-100');
    expect(place?.sourceRefs.denueId).toBe('100');
    expect(place?.provenance[0].source).toBe('denue');
    expect(place?.verification.status).toBe('source_verified');
    // Sin datos inventados: ni horarios ni precios ni calificaciones.
    expect(place?.hours).toBeUndefined();
    expect(place?.price).toBeUndefined();
  });

  it('listByCategory NO carga trozos de otras categorías', async () => {
    const { repo, fake } = makeRepo();
    const result = await repo.listByCategory('coffee', { ...CENTER, limit: 10 });
    expect(result.places.map((p) => p.category)).toEqual(['coffee', 'coffee']);
    expect(loadsWhere(fake.loads, (p) => p.includes('/food/'))).toBe(0);
    expect(loadsWhere(fake.loads, (p) => p.includes('/beer/'))).toBe(0);
  });

  it('listByCategory con origen limita trozos: no carga lejanos si el top-N ya está resuelto', async () => {
    const { repo, fake } = makeRepo();
    // Con límite 1 desde el centro, el trozo norte de coffee no aporta nada.
    const result = await repo.listByCategory('coffee', { ...CENTER, limit: 1 });
    expect(result.places[0].id).toBe('denue-200');
    expect(loadsWhere(fake.loads, (p) => p.includes('/coffee/'))).toBe(1);
  });

  it('searchText usa el índice compacto y solo hidrata trozos candidatos', async () => {
    const { repo, fake } = makeRepo();
    // "dona" solo aparece en el nombre de CAFÉ DOÑA ÑOÑA (no es término de
    // categoría): un único candidato → un único trozo hidratado.
    const result = await repo.searchText({ text: 'dona', ...CENTER, limit: 10 });
    expect(result.places.map((p) => p.id)).toEqual(['denue-200']);
    expect(fake.loads.get(SEARCH_INDEX_PATH)).toBe(1);
    expect(loadsWhere(fake.loads, (p) => p.startsWith('categories/'))).toBe(1);
  });

  it('la búsqueda con acentos y ñ encuentra nombres reales (CAFÉ → cafe)', async () => {
    const { repo } = makeRepo();
    const byAccent = await repo.searchText({ text: 'CAFÉ DOÑA', limit: 10 });
    expect(byAccent.places.map((p) => p.name)).toEqual(['CAFÉ DOÑA ÑOÑA']);
    const byAlias = await repo.searchText({ text: 'beer', limit: 10 });
    expect(byAlias.places.every((p) => p.category === 'beer')).toBe(true);
    expect(byAlias.places.length).toBe(2);
  });

  it('searchNearby carga solo trozos cuyo rectángulo toca el radio', async () => {
    const { repo, fake } = makeRepo();
    // Radio 1 km desde el centro: los trozos del norte (~3.7 km) no se tocan.
    const result = await repo.searchNearby({ ...CENTER, radiusMeters: 1000, limit: 10 });
    expect(result.places.map((p) => p.id).sort()).toEqual(['denue-100', 'denue-200', 'denue-300']);
    expect(loadsWhere(fake.loads, (p) => p.startsWith('categories/'))).toBe(3);
  });

  it('ranking determinista: mismos resultados y orden en corridas repetidas', async () => {
    const run = async () => {
      const { repo } = makeRepo();
      const r = await repo.searchText({ text: 'norte', ...CENTER, limit: 10 });
      return r.places.map((p) => p.id);
    };
    const first = await run();
    expect(first).toEqual(await run());
    expect(first.length).toBe(3);
  });
});

describe('CityPackRepository — caché acotada', () => {
  it('una consulta repetida reutiliza el trozo cacheado (sin recargas)', async () => {
    const { repo, fake } = makeRepo();
    await repo.getById('denue-100');
    const loadsAfterFirst = loadsWhere(fake.loads, (p) => p.startsWith('categories/'));
    await repo.getById('denue-100');
    await repo.getById('denue-100');
    expect(loadsWhere(fake.loads, (p) => p.startsWith('categories/'))).toBe(loadsAfterFirst);
    expect(fake.loads.get(MANIFEST_PATH)).toBe(1);
  });

  it('desaloja el trozo más antiguo al exceder el límite de caché', async () => {
    const { repo, fake } = makeRepo({ maxCachedChunks: 1 });
    await repo.getById('denue-100'); // trozo A
    await repo.getById('denue-200'); // trozo B desaloja A
    await repo.getById('denue-100'); // A se recarga
    const chunkLoads = loadsWhere(fake.loads, (p) => p.startsWith('categories/'));
    expect(chunkLoads).toBe(3);
  });
});

describe('CityPackRepository — degradación segura al repositorio local', () => {
  it('pack ausente → responde el respaldo local (Inicio nunca se cae)', async () => {
    const fake = fakeLoaderFrom([]);
    const repo = new CityPackRepository(fake.loader, new LocalPlaceRepository());
    const nearby = await repo.searchNearby({ ...CENTER, radiusMeters: 5000, limit: 5 });
    expect(nearby.places.length).toBeGreaterThan(0);
    expect(nearby.places[0].name).toContain('Demo');
  });

  it('manifiesto corrupto → respaldo local', async () => {
    const { files } = buildRuntimePack(fixturePack());
    const fake = fakeLoaderFrom(files);
    fake.set(MANIFEST_PATH, '{esto no es json');
    const repo = new CityPackRepository(fake.loader, new LocalPlaceRepository());
    const result = await repo.listByCategory('food', { ...CENTER, limit: 3 });
    expect(result.places.length).toBeGreaterThan(0);
    expect(result.places[0].name).toContain('Demo');
  });

  it('versión de esquema desconocida → rechazo y respaldo local', async () => {
    const { files, manifest } = buildRuntimePack(fixturePack());
    const fake = fakeLoaderFrom(files);
    fake.set(MANIFEST_PATH, JSON.stringify({ ...manifest, schemaVersion: 99 }));
    const repo = new CityPackRepository(fake.loader, new LocalPlaceRepository());
    const result = await repo.searchText({ text: 'tacos', limit: 5 });
    expect(result.places.every((p) => p.name.includes('Demo'))).toBe(true);
  });

  it('trozo corrupto → esa llamada degrada al respaldo sin lanzar', async () => {
    const { files, manifest } = buildRuntimePack(fixturePack(), { maxChunkRecords: 1 });
    const fake = fakeLoaderFrom(files);
    const foodChunk = manifest.chunks.find((c) => c.category === 'food')!;
    fake.set(foodChunk.name, '{"places": "corrupto"}');
    const repo = new CityPackRepository(fake.loader, new LocalPlaceRepository());
    const result = await repo.listByCategory('food', { ...CENTER, limit: 3 });
    expect(result.places.length).toBeGreaterThan(0);
    expect(result.places[0].name).toContain('Demo');
  });

  it('consultas inválidas NO degradan: propagan el error de validación', async () => {
    const { repo } = makeRepo();
    await expect(
      repo.searchNearby({ latitude: 999, longitude: 0, radiusMeters: 1000 }),
    ).rejects.toThrow(InvalidPlaceQueryError);
    await expect(repo.searchText({ text: '   ' })).rejects.toThrow(InvalidPlaceQueryError);
  });
});

describe('CityPackRepository — paridad con la búsqueda de dominio', () => {
  it('searchText coincide con LocalPlaceRepository sobre los mismos datos', async () => {
    const pack = fixturePack();
    const { files } = buildRuntimePack(pack, { maxChunkRecords: 2 });
    const cityRepo = new CityPackRepository(
      fakeLoaderFrom(files).loader,
      new LocalPlaceRepository([]),
    );
    const localRepo = new LocalPlaceRepository(pack.places.map(cityPackPlaceToLocavoPlace));

    for (const text of ['cafe', 'norte', 'cerveza', 'tacos centro', 'coffee']) {
      const fromPack = await cityRepo.searchText({ text, ...CENTER, limit: 20 });
      const fromLocal = await localRepo.searchText({ text, ...CENTER, limit: 20 });
      expect(fromPack.places.map((p) => p.id)).toEqual(fromLocal.places.map((p) => p.id));
    }
  });

  it('searchNearby y listByCategory coinciden con LocalPlaceRepository', async () => {
    const pack = fixturePack();
    const { files } = buildRuntimePack(pack, { maxChunkRecords: 1 });
    const cityRepo = new CityPackRepository(
      fakeLoaderFrom(files).loader,
      new LocalPlaceRepository([]),
    );
    const localRepo = new LocalPlaceRepository(pack.places.map(cityPackPlaceToLocavoPlace));

    const nearbyPack = await cityRepo.searchNearby({ ...CENTER, radiusMeters: 10_000, limit: 20 });
    const nearbyLocal = await localRepo.searchNearby({ ...CENTER, radiusMeters: 10_000, limit: 20 });
    expect(nearbyPack.places.map((p) => p.id)).toEqual(nearbyLocal.places.map((p) => p.id));

    for (const category of ['food', 'coffee', 'beer'] as const) {
      const byCatPack = await cityRepo.listByCategory(category, { ...CENTER, limit: 20 });
      const byCatLocal = await localRepo.listByCategory(category, { ...CENTER, limit: 20 });
      expect(byCatPack.places.map((p) => p.id)).toEqual(byCatLocal.places.map((p) => p.id));
      expect(byCatPack.total).toBe(byCatLocal.total);
    }
  });
});
