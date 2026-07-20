import { appendResults } from '../usePlacesQuery';
import type { ScoredPlace } from '../../services/places/PlaceRankingService';

function scored(id: string): ScoredPlace {
  return {
    place: {
      id,
      sourceRefs: {},
      name: id,
      normalizedName: id,
      category: 'food',
      coordinates: { latitude: 24.8, longitude: -107.4 },
      verification: { status: 'unverified', confidence: 0.5 },
      provenance: [{ source: 'mock' }],
      status: { active: true },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    distanceKm: 1,
    travelMinutes: 3,
    status: { state: 'unknown' },
    score: 0.5,
    reasons: [],
  };
}

describe('appendResults (paginación sin duplicados, orden estable)', () => {
  it('anexa páginas conservando el orden de llegada', () => {
    const page1 = [scored('a'), scored('b')];
    const page2 = [scored('c'), scored('d')];
    expect(appendResults(page1, page2).map((s) => s.place.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('descarta duplicados entre páginas (ids canónicos únicos)', () => {
    const page1 = [scored('a'), scored('b')];
    const page2 = [scored('b'), scored('c')];
    const merged = appendResults(page1, page2);
    expect(merged.map((s) => s.place.id)).toEqual(['a', 'b', 'c']);
    // El registro original se conserva; el duplicado entrante se ignora.
    expect(merged[1]).toBe(page1[1]);
  });

  it('página repetida completa no altera la lista', () => {
    const page1 = [scored('a'), scored('b')];
    expect(appendResults(page1, page1).map((s) => s.place.id)).toEqual(['a', 'b']);
  });

  it('es determinista para las mismas entradas', () => {
    const a = appendResults([scored('x')], [scored('y'), scored('z')]);
    const b = appendResults([scored('x')], [scored('y'), scored('z')]);
    expect(a.map((s) => s.place.id)).toEqual(b.map((s) => s.place.id));
  });
});
