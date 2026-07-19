import { fakeLoaderFrom, fixturePack, fixturePlace, loadsWhere } from './fixtures';
import { buildRuntimePack } from '../buildRuntimePack';
import { CityPackRepository } from '../CityPackRepository';
import { MANIFEST_PATH, SEARCH_SHARD_DIR } from '../RuntimePackFormat';
import { cityPackPlaceToLocavoPlace } from '../CityPackPlaceMapper';
import type { CityPackPlace } from '../../../import/denue/CityPackBuilder';
import { LocalPlaceRepository } from '../../LocalPlaceRepository';
import { InvalidPlaceQueryError } from '../../PlaceQuery';

const CENTER = { latitude: 24.8069, longitude: -107.394 };

function makeRepo(options?: {
  maxCachedChunks?: number;
  maxChunkRecords?: number;
  places?: CityPackPlace[];
}) {
  const pack = fixturePack(options?.places);
  const { files, manifest } = buildRuntimePack(pack, {
    maxChunkRecords: options?.maxChunkRecords ?? 1,
    // Umbral relativo alto para que el fixture pequeño conserve postings
    // selectivos (en el pack real el default 0.15 aplica sobre 12k lugares).
    commonTokenFraction: 0.5,
  });
  const fake = fakeLoaderFrom(files);
  const fallback = new LocalPlaceRepository();
  const repo = new CityPackRepository(fake.loader, fallback, {
    maxCachedChunks: options?.maxCachedChunks,
  });
  return { repo, fake, fallback, manifest, pack };
}

/** 40 lugares de comida repartidos en una malla amplia (~9 km). */
function manyFoodPlaces(): CityPackPlace[] {
  const places: CityPackPlace[] = [];
  for (let i = 0; i < 40; i++) {
    places.push(
      fixturePlace({
        id: `denue-${1000 + i}`,
        name: `FONDA ${i}`,
        normalizedName: `fonda ${i}`,
        latitude: 24.76 + 0.02 * (i % 5),
        longitude: -107.44 + 0.02 * Math.floor(i / 5),
        searchTerms: ['fonda'],
      }),
    );
  }
  return places;
}

const shardLoads = (loads: Map<string, number>) =>
  loadsWhere(loads, (p) => p.startsWith(SEARCH_SHARD_DIR));
const chunkLoads = (loads: Map<string, number>) =>
  loadsWhere(loads, (p) => p.startsWith('categories/'));

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('CityPackRepository v2 — carga perezosa', () => {
  it('getById carga manifiesto + índice de ids + EXACTAMENTE un trozo', async () => {
    const { repo, fake } = makeRepo();
    const place = await repo.getById('denue-200');
    expect(place?.name).toBe('CAFÉ DOÑA ÑOÑA');
    expect(chunkLoads(fake.loads)).toBe(1);
    expect(shardLoads(fake.loads)).toBe(0);
  });

  it('getById preserva procedencia y no inventa verificación individual', async () => {
    const { repo } = makeRepo();
    const place = await repo.getById('denue-100');
    expect(place?.sourceRefs.denueId).toBe('100');
    expect(place?.provenance[0].source).toBe('denue');
    expect(place?.verification.status).toBe('source_verified');
    // La fecha de la edición del dataset NO es verificación individual.
    expect(place?.verification.sourceDatasetUpdatedAt).toBe('2026-07-01T00:00:00.000Z');
    expect(place?.verification.canonicalVerifiedAt).toBeUndefined();
    expect(place?.verification.lastVerifiedAt).toBeUndefined();
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

  it('la primera página de una categoría grande NO hidrata la categoría completa', async () => {
    const { repo, fake, manifest } = makeRepo({
      places: manyFoodPlaces(),
      maxChunkRecords: 5,
    });
    const totalFoodChunks = manifest.chunks.filter((c) => c.category === 'food').length;
    expect(totalFoodChunks).toBeGreaterThanOrEqual(8);

    const page = await repo.listByCategory('food', { ...CENTER, limit: 5 });
    expect(page.places.length).toBe(5);
    // Corte temprano: solo los trozos cercanos (más el margen del
    // rectángulo), nunca toda la categoría.
    expect(chunkLoads(fake.loads)).toBeLessThan(totalFoodChunks);
    expect(chunkLoads(fake.loads)).toBeLessThanOrEqual(5);
  });

  it('paginación determinista sin duplicados entre páginas', async () => {
    const { repo } = makeRepo({ places: manyFoodPlaces(), maxChunkRecords: 5 });
    const page1 = await repo.listByCategory('food', { ...CENTER, limit: 5 });
    expect(page1.nextCursor).toBeDefined();
    const page2 = await repo.listByCategory('food', {
      ...CENTER,
      limit: 5,
      cursor: page1.nextCursor,
    });
    const ids1 = page1.places.map((p) => p.id);
    const ids2 = page2.places.map((p) => p.id);
    expect(new Set([...ids1, ...ids2]).size).toBe(10);

    // Determinista: repetir la secuencia da exactamente lo mismo.
    const { repo: repo2 } = makeRepo({ places: manyFoodPlaces(), maxChunkRecords: 5 });
    const again1 = await repo2.listByCategory('food', { ...CENTER, limit: 5 });
    expect(again1.places.map((p) => p.id)).toEqual(ids1);
  });

  it('searchText carga SOLO el fragmento del prefijo y los trozos candidatos', async () => {
    const { repo, fake } = makeRepo();
    const result = await repo.searchText({ text: 'dona', ...CENTER, limit: 10 });
    expect(result.places.map((p) => p.id)).toEqual(['denue-200']);
    expect(shardLoads(fake.loads)).toBe(1);
    expect(loadsWhere(fake.loads, (p) => p.includes('prefix-d.json'))).toBe(1);
    expect(chunkLoads(fake.loads)).toBe(1);
  });

  it('búsqueda multi-token intersecta candidatos (fragmentos por letra)', async () => {
    const { repo, fake } = makeRepo();
    const result = await repo.searchText({ text: 'cafe dona', ...CENTER, limit: 10 });
    expect(result.places.map((p) => p.name)).toEqual(['CAFÉ DOÑA ÑOÑA']);
    expect(loadsWhere(fake.loads, (p) => p.includes('prefix-c.json'))).toBe(1);
    expect(loadsWhere(fake.loads, (p) => p.includes('prefix-d.json'))).toBe(1);
  });

  it('acentos y ñ: CAFÉ/DOÑA con y sin acentos encuentran lo mismo', async () => {
    const { repo } = makeRepo();
    const accented = await repo.searchText({ text: 'CAFÉ DOÑA', ...CENTER, limit: 10 });
    const plain = await repo.searchText({ text: 'cafe dona', ...CENTER, limit: 10 });
    expect(accented.places.map((p) => p.id)).toEqual(['denue-200']);
    expect(plain.places.map((p) => p.id)).toEqual(accented.places.map((p) => p.id));
  });

  it('token común (comodín, p. ej. "obregon" en dirección) sigue encontrando con verificación exacta', async () => {
    const { repo, manifest } = makeRepo();
    expect(manifest.commonTokens).toContain('obregon');
    const result = await repo.searchText({ text: 'obregon dona', ...CENTER, limit: 10 });
    // 'obregon' es comodín (todas las direcciones), 'dona' restringe.
    expect(result.places.map((p) => p.id)).toEqual(['denue-200']);
  });

  it('alias de categoría ("beer") con carga acotada por cercanía', async () => {
    const { repo } = makeRepo();
    const byAlias = await repo.searchText({ text: 'beer', ...CENTER, limit: 10 });
    expect(byAlias.places.every((p) => p.category === 'beer')).toBe(true);
    expect(byAlias.places.length).toBe(2);
  });

  it('searchNearby carga solo trozos cuyo rectángulo toca el radio', async () => {
    const { repo, fake } = makeRepo();
    const result = await repo.searchNearby({ ...CENTER, radiusMeters: 1000, limit: 10 });
    expect(result.places.map((p) => p.id).sort()).toEqual(['denue-100', 'denue-200', 'denue-300']);
    expect(chunkLoads(fake.loads)).toBe(3);
  });

  it('searchNearby pagina de forma acotada (no hidrata todo el radio)', async () => {
    const { repo, fake, manifest } = makeRepo({ places: manyFoodPlaces(), maxChunkRecords: 5 });
    const page = await repo.searchNearby({ ...CENTER, radiusMeters: 20_000, limit: 5 });
    expect(page.places.length).toBe(5);
    expect(page.nextCursor).toBeDefined();
    expect(chunkLoads(fake.loads)).toBeLessThan(manifest.chunks.length);
  });
});

describe('CityPackRepository v2 — cachés acotadas', () => {
  it('consulta repetida reutiliza trozo y fragmento cacheados', async () => {
    const { repo, fake } = makeRepo();
    await repo.searchText({ text: 'dona', ...CENTER, limit: 5 });
    const chunksAfter = chunkLoads(fake.loads);
    const shardsAfter = shardLoads(fake.loads);
    await repo.searchText({ text: 'dona', ...CENTER, limit: 5 });
    expect(chunkLoads(fake.loads)).toBe(chunksAfter);
    expect(shardLoads(fake.loads)).toBe(shardsAfter);
    expect(fake.loads.get(MANIFEST_PATH)).toBe(1);
  });

  it('desaloja el trozo más antiguo al exceder el límite de caché', async () => {
    const { repo, fake } = makeRepo({ maxCachedChunks: 1 });
    await repo.getById('denue-100');
    await repo.getById('denue-200');
    await repo.getById('denue-100');
    expect(chunkLoads(fake.loads)).toBe(3);
  });
});

describe('CityPackRepository v2 — degradación segura al repositorio local', () => {
  it('pack ausente → responde el respaldo local', async () => {
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
    expect(result.places[0].name).toContain('Demo');
  });

  it('versión de esquema desconocida → rechazo y respaldo local', async () => {
    const { files, manifest } = buildRuntimePack(fixturePack());
    const fake = fakeLoaderFrom(files);
    fake.set(MANIFEST_PATH, JSON.stringify({ ...manifest, schemaVersion: 99 }));
    const repo = new CityPackRepository(fake.loader, new LocalPlaceRepository());
    const result = await repo.searchText({ text: 'tacos', ...CENTER, limit: 5 });
    expect(result.places.every((p) => p.name.includes('Demo'))).toBe(true);
  });

  it('fragmento de búsqueda corrupto → respaldo local para esa llamada', async () => {
    const { files, manifest } = buildRuntimePack(fixturePack());
    const fake = fakeLoaderFrom(files);
    fake.set(manifest.indexes.searchShards['d'].name, '{"tokens": 42}');
    const repo = new CityPackRepository(fake.loader, new LocalPlaceRepository());
    const result = await repo.searchText({ text: 'dona', ...CENTER, limit: 5 });
    expect(result.places.every((p) => p.name.includes('Demo'))).toBe(true);
  });

  it('fragmento anunciado pero AUSENTE → respaldo local sin lanzar', async () => {
    const { files, manifest } = buildRuntimePack(fixturePack());
    const fake = fakeLoaderFrom(files);
    fake.remove(manifest.indexes.searchShards['d'].name);
    const repo = new CityPackRepository(fake.loader, new LocalPlaceRepository());
    const result = await repo.searchText({ text: 'dona', ...CENTER, limit: 5 });
    expect(result.places.every((p) => p.name.includes('Demo'))).toBe(true);
  });

  it('trozo corrupto → esa llamada degrada al respaldo sin lanzar', async () => {
    const { files, manifest } = buildRuntimePack(fixturePack(), { maxChunkRecords: 1 });
    const fake = fakeLoaderFrom(files);
    const foodChunk = manifest.chunks.find((c) => c.category === 'food')!;
    fake.set(foodChunk.name, '{"places": "corrupto"}');
    const repo = new CityPackRepository(fake.loader, new LocalPlaceRepository());
    const result = await repo.listByCategory('food', { ...CENTER, limit: 3 });
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

describe('CityPackRepository v2 — paridad con LocalPlaceRepository', () => {
  it('searchText coincide con LocalPlaceRepository sobre los mismos datos', async () => {
    const pack = fixturePack();
    const { files } = buildRuntimePack(pack, { maxChunkRecords: 2 });
    const cityRepo = new CityPackRepository(
      fakeLoaderFrom(files).loader,
      new LocalPlaceRepository([]),
    );
    const localRepo = new LocalPlaceRepository(pack.places.map(cityPackPlaceToLocavoPlace));

    for (const text of ['cafe', 'norte', 'cerveza', 'tacos centro', 'coffee', 'doña']) {
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

  it('paginación multi-página coincide con el orden global de LocalPlaceRepository', async () => {
    const places = manyFoodPlaces();
    const { files } = buildRuntimePack(fixturePack(places), { maxChunkRecords: 5 });
    const cityRepo = new CityPackRepository(
      fakeLoaderFrom(files).loader,
      new LocalPlaceRepository([]),
    );
    const localRepo = new LocalPlaceRepository(places.map(cityPackPlaceToLocavoPlace));

    const cityIds: string[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 3; i++) {
      const page = await cityRepo.listByCategory('food', { ...CENTER, limit: 5, cursor });
      cityIds.push(...page.places.map((p) => p.id));
      cursor = page.nextCursor;
    }
    const local = await localRepo.listByCategory('food', { ...CENTER, limit: 15 });
    expect(cityIds).toEqual(local.places.map((p) => p.id));
  });
});
