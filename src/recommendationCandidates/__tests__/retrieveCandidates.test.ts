import type { LocavoCategory, LocavoPlace } from '../../domain/places/LocavoPlace';
import type { PlaceRepository } from '../../data/places/PlaceRepository';
import type { PlaceSearchResult } from '../../data/places/PlaceSearchResult';
import { retrieveRecommendationCandidates } from '../retrieveCandidates';

const ORIGIN = { latitude: 24.8, longitude: -107.4 };
const latOff = (m: number) => m / 111320;

function place(id: string, category: LocavoCategory, latMeters = 0): LocavoPlace {
  return {
    id,
    sourceRefs: { denueId: id },
    name: `P ${id}`,
    normalizedName: `p ${id}`,
    category,
    coordinates: { latitude: ORIGIN.latitude + latOff(latMeters), longitude: ORIGIN.longitude },
    verification: { status: 'source_verified', confidence: 0.6 },
    provenance: [{ source: 'denue' }],
    status: { active: true },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

function fakeRepo(places: LocavoPlace[], opts: { throwCategory?: LocavoCategory } = {}): PlaceRepository {
  const empty: PlaceSearchResult = { places: [], total: 0 };
  return {
    async getById(id) {
      return places.find((p) => p.id === id) ?? null;
    },
    async searchNearby() {
      return empty;
    },
    async searchText() {
      return empty;
    },
    async listByCategory(category, options) {
      if (opts.throwCategory === category) {
        throw new Error('repo boom');
      }
      const all = places.filter((p) => p.category === category);
      const limit = options?.limit ?? 20;
      const offset = options?.cursor ? Number.parseInt(options.cursor, 10) || 0 : 0;
      const page = all.slice(offset, offset + limit);
      const nextOffset = offset + page.length;
      return {
        places: page,
        total: all.length,
        nextCursor: nextOffset < all.length ? String(nextOffset) : undefined,
      };
    },
  };
}

const arithmeticHolds = (d: {
  received: number;
  emitted: number;
  malformedExcluded: number;
  categoryExcluded: number;
  duplicatesRemoved: number;
  outsideRadiusExcluded: number;
  safetyLimitDropped: number;
}) =>
  d.received ===
  d.emitted + d.malformedExcluded + d.categoryExcluded + d.duplicatesRemoved + d.outsideRadiusExcluded + d.safetyLimitDropped;

describe('retrieveRecommendationCandidates', () => {
  it('repositorio vacío → sin candidatos', async () => {
    const r = await retrieveRecommendationCandidates({ repository: fakeRepo([]), origin: ORIGIN });
    expect(r.candidates).toEqual([]);
    expect(r.diagnostics.received).toBe(0);
    expect(r.diagnostics.emitted).toBe(0);
  });

  it('un candidato', async () => {
    const r = await retrieveRecommendationCandidates({ repository: fakeRepo([place('a', 'food')]), origin: ORIGIN });
    expect(r.candidates.map((c) => c.id)).toEqual(['a']);
  });

  it('población completa multi-categoría (paginación por categoría)', async () => {
    const many = Array.from({ length: 120 }, (_, i) => place(`f${i}`, 'food', i)); // >50 → paginado
    const coffee = [place('c1', 'coffee', 5)];
    const r = await retrieveRecommendationCandidates({ repository: fakeRepo([...many, ...coffee]), origin: ORIGIN, safetyLimit: 1000 });
    expect(r.candidates).toHaveLength(121);
    expect(r.candidates.some((c) => c.id === 'c1')).toBe(true);
  });

  it('independiente del orden de entrada', async () => {
    const set = [place('b', 'food', 20), place('a', 'food', 10), place('c', 'coffee', 5)];
    const r1 = await retrieveRecommendationCandidates({ repository: fakeRepo(set), origin: ORIGIN });
    const r2 = await retrieveRecommendationCandidates({ repository: fakeRepo([...set].reverse()), origin: ORIGIN });
    expect(r2.candidates.map((c) => c.id)).toEqual(r1.candidates.map((c) => c.id));
  });

  it('ids duplicados idénticos → uno emitido, contados', async () => {
    const p = place('dup', 'food', 10);
    const r = await retrieveRecommendationCandidates({ repository: fakeRepo([p, { ...p }]), origin: ORIGIN });
    expect(r.candidates.filter((c) => c.id === 'dup')).toHaveLength(1);
    expect(r.diagnostics.duplicatesRemoved).toBe(1);
    expect(r.diagnostics.conflictingDuplicates).toBe(0);
  });

  it('ids duplicados con contenido en conflicto → resolución determinista', async () => {
    const a = place('dup', 'food', 10);
    const b = { ...a, name: 'Otro nombre' };
    const r1 = await retrieveRecommendationCandidates({ repository: fakeRepo([a, b]), origin: ORIGIN });
    const r2 = await retrieveRecommendationCandidates({ repository: fakeRepo([b, a]), origin: ORIGIN });
    expect(r1.diagnostics.conflictingDuplicates).toBe(1);
    expect(r1.candidates[0].name).toBe(r2.candidates[0].name); // mismo ganador sin importar orden
  });

  it('coordenadas inválidas con origen → excluidas (malformed)', async () => {
    const bad = place('bad', 'food');
    bad.coordinates = { latitude: 999, longitude: 0 };
    const r = await retrieveRecommendationCandidates({ repository: fakeRepo([bad, place('ok', 'food', 5)]), origin: ORIGIN });
    expect(r.candidates.map((c) => c.id)).toEqual(['ok']);
    expect(r.diagnostics.malformedExcluded).toBe(1);
  });

  it('sin origen → sin filtro/orden por distancia; orden por id; coords inválidas permitidas', async () => {
    const bad = place('zbad', 'food');
    bad.coordinates = { latitude: 999, longitude: 0 };
    const r = await retrieveRecommendationCandidates({ repository: fakeRepo([bad, place('a', 'food', 40), place('m', 'food', 1)]), origin: null });
    expect(r.candidates.map((c) => c.id)).toEqual(['a', 'm', 'zbad']); // id asc
    expect(r.diagnostics.malformedExcluded).toBe(0);
  });

  it('filtro por radio', async () => {
    const near = place('near', 'food', 200);
    const far = place('far', 'food', 3000); // ~3 km
    const r = await retrieveRecommendationCandidates({ repository: fakeRepo([near, far]), origin: ORIGIN, radiusMeters: 1000 });
    expect(r.candidates.map((c) => c.id)).toEqual(['near']);
    expect(r.diagnostics.outsideRadiusExcluded).toBe(1);
  });

  it('filtro por categoría (alcance explícito)', async () => {
    const r = await retrieveRecommendationCandidates({
      repository: fakeRepo([place('f', 'food'), place('c', 'coffee', 5)]),
      origin: ORIGIN,
      categories: ['coffee'],
    });
    expect(r.candidates.map((c) => c.id)).toEqual(['c']);
    expect(r.diagnostics.received).toBe(1);
  });

  it('límite de seguridad al final sobre población ordenada por distancia', async () => {
    const set = Array.from({ length: 150 }, (_, i) => place(`p${String(i).padStart(3, '0')}`, 'food', i)); // dist crece con i
    const r = await retrieveRecommendationCandidates({ repository: fakeRepo(set), origin: ORIGIN, safetyLimit: 100 });
    expect(r.candidates).toHaveLength(100);
    expect(r.diagnostics.safetyLimitApplied).toBe(true);
    expect(r.diagnostics.safetyLimitDropped).toBe(50);
    expect(r.candidates[0].id).toBe('p000'); // el más cercano
    expect(r.candidates.some((c) => c.id === 'p149')).toBe(false); // el más lejano cae
  });

  it('empate de distancia se rompe por id canónico', async () => {
    const north = place('north', 'food', 500);
    const south = place('south', 'food');
    south.coordinates = { latitude: ORIGIN.latitude - latOff(500), longitude: ORIGIN.longitude }; // misma distancia
    const r = await retrieveRecommendationCandidates({ repository: fakeRepo([south, north]), origin: ORIGIN });
    expect(r.candidates.map((c) => c.id)).toEqual(['north', 'south']); // id asc en empate
  });

  it('no muta las entradas del repositorio', async () => {
    const set = [place('a', 'food', 10), place('b', 'coffee', 5)];
    const snapshot = JSON.stringify(set);
    await retrieveRecommendationCandidates({ repository: fakeRepo(set), origin: ORIGIN });
    expect(JSON.stringify(set)).toBe(snapshot);
  });

  it('invocación repetida es determinista', async () => {
    const set = [place('a', 'food', 10), place('b', 'food', 5), place('c', 'coffee', 8)];
    const a = await retrieveRecommendationCandidates({ repository: fakeRepo(set), origin: ORIGIN });
    const b = await retrieveRecommendationCandidates({ repository: fakeRepo(set), origin: ORIGIN });
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('fallo del repositorio degrada sin lanzar', async () => {
    const r = await retrieveRecommendationCandidates({
      repository: fakeRepo([place('f', 'food'), place('c', 'coffee', 5)], { throwCategory: 'food' }),
      origin: ORIGIN,
    });
    expect(r.candidates.map((c) => c.id)).toEqual(['c']); // food falló, coffee sobrevive
  });

  it('la aritmética de diagnósticos es consistente', async () => {
    const bad = place('bad', 'food');
    bad.coordinates = { latitude: 999, longitude: 0 };
    const dup = place('d', 'food', 10);
    const far = place('far', 'food', 5000);
    const set = [bad, dup, { ...dup }, far, place('ok', 'coffee', 5)];
    const r = await retrieveRecommendationCandidates({ repository: fakeRepo(set), origin: ORIGIN, radiusMeters: 1000, safetyLimit: 1 });
    expect(arithmeticHolds(r.diagnostics)).toBe(true);
  });

  it('la recuperación no calcula score ni multiplicadores (solo LocavoPlace canónico)', async () => {
    const p = place('a', 'food', 10);
    const r = await retrieveRecommendationCandidates({ repository: fakeRepo([p]), origin: ORIGIN });
    const c = r.candidates[0] as unknown as Record<string, unknown>;
    expect('score' in c).toBe(false);
    expect('rank' in c).toBe(false);
    expect('contextualScore' in c).toBe(false);
    expect(r.candidates[0].id).toBe('a');
  });
});
