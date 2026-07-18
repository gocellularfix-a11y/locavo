import { CULIACAN_CENTER } from '../../../data/places.mock';
import type { LocavoPlace } from '../../../domain/places/LocavoPlace';
import { completenessOf, rankPlaces, scorePlace } from '../PlaceRankingService';

/** Miércoles 12:30 hora local de Culiacán. */
const NOW = new Date('2026-07-15T19:30:00Z');

function makePlace(overrides: Partial<LocavoPlace> & { id: string }): LocavoPlace {
  const base: LocavoPlace = {
    id: overrides.id,
    sourceRefs: { locavoId: overrides.id },
    name: `Demo ${overrides.id}`,
    normalizedName: `demo ${overrides.id}`,
    category: 'food',
    coordinates: { latitude: CULIACAN_CENTER.latitude, longitude: CULIACAN_CENTER.longitude },
    address: { formatted: 'Calle Demo 1', countryCode: 'MX' },
    contact: { phone: '+52 667 000 0000', website: 'https://example.com' },
    hours: { weekly: Array(7).fill([{ open: '09:00', close: '22:00' }]) },
    price: { level: 1, currency: 'MXN' },
    verification: { status: 'unverified', confidence: 0.9, lastVerifiedAt: '2026-07-10T00:00:00Z' },
    provenance: [{ source: 'mock', importedAt: '2026-07-01T00:00:00Z' }],
    status: { active: true },
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-10T00:00:00Z',
  };
  return { ...base, ...overrides };
}

describe('scorePlace (modelo canónico)', () => {
  it('genera razones estructuradas esperadas', () => {
    const scored = scorePlace(makePlace({ id: 'a' }), CULIACAN_CENTER, NOW);
    expect(scored.reasons).toEqual([
      'OPEN_NOW',
      'NEARBY',
      'RECENTLY_VERIFIED',
      'HIGH_CONFIDENCE',
      'COMPLETE_INFORMATION',
    ]);
    expect(scored.status.state).toBe('open');
    expect(scored.score).toBeGreaterThan(0.9);
  });

  it('lugar cerrado no recibe OPEN_NOW y puntúa menos', () => {
    const open = scorePlace(makePlace({ id: 'open' }), CULIACAN_CENTER, NOW);
    const closed = scorePlace(
      makePlace({ id: 'closed', hours: { weekly: Array(7).fill([]) } }),
      CULIACAN_CENTER,
      NOW,
    );
    expect(closed.reasons).not.toContain('OPEN_NOW');
    expect(closed.score).toBeLessThan(open.score);
  });

  it('confianza numérica baja elimina HIGH_CONFIDENCE', () => {
    const low = scorePlace(
      makePlace({
        id: 'low',
        verification: { status: 'unverified', confidence: 0.3, lastVerifiedAt: '2026-07-10T00:00:00Z' },
      }),
      CULIACAN_CENTER,
      NOW,
    );
    expect(low.reasons).not.toContain('HIGH_CONFIDENCE');
  });
});

describe('completenessOf', () => {
  it('cuenta campos informados del modelo canónico', () => {
    expect(completenessOf(makePlace({ id: 'full' }))).toBe(1);
    expect(
      completenessOf(
        makePlace({ id: 'empty', hours: undefined, contact: {}, price: undefined }),
      ),
    ).toBe(0);
  });
});

describe('rankPlaces', () => {
  it('un lugar abierto supera a uno cerrado equivalente', () => {
    const places = [
      makePlace({ id: 'closed', hours: { weekly: Array(7).fill([]) } }),
      makePlace({ id: 'open' }),
    ];
    expect(rankPlaces(places, CULIACAN_CENTER, NOW)[0].place.id).toBe('open');
  });

  it('desempata por distancia, nombre normalizado e id de forma determinista', () => {
    const near = makePlace({
      id: 'near',
      coordinates: { latitude: CULIACAN_CENTER.latitude + 0.001, longitude: CULIACAN_CENTER.longitude },
    });
    const far = makePlace({
      id: 'far',
      coordinates: { latitude: CULIACAN_CENTER.latitude + 0.01, longitude: CULIACAN_CENTER.longitude },
    });
    expect(rankPlaces([far, near], CULIACAN_CENTER, NOW)[0].place.id).toBe('near');

    const twinA = makePlace({ id: 'a-1', name: 'Demo Gemelo', normalizedName: 'demo gemelo' });
    const twinB = makePlace({ id: 'b-2', name: 'Demo Gemelo', normalizedName: 'demo gemelo' });
    expect(rankPlaces([twinB, twinA], CULIACAN_CENTER, NOW).map((r) => r.place.id)).toEqual([
      'a-1',
      'b-2',
    ]);
    expect(rankPlaces([twinA, twinB], CULIACAN_CENTER, NOW).map((r) => r.place.id)).toEqual([
      'a-1',
      'b-2',
    ]);
  });

  it('mismo insumo produce el mismo orden (sin aleatoriedad)', () => {
    const places = [
      makePlace({ id: 'x' }),
      makePlace({
        id: 'y',
        verification: { status: 'unverified', confidence: 0.3 },
      }),
      makePlace({ id: 'z', hours: undefined }),
    ];
    const a = rankPlaces(places, CULIACAN_CENTER, NOW).map((r) => r.place.id);
    const b = rankPlaces(places, CULIACAN_CENTER, NOW).map((r) => r.place.id);
    expect(a).toEqual(b);
  });
});
