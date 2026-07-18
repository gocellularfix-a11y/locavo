import { CULIACAN_CENTER } from '../../data/places.mock';
import type { Place } from '../place';
import {
  completenessOf,
  explainReasons,
  rankPlaces,
  scorePlace,
} from '../recommendation';

/** Miércoles 12:30 hora local de Culiacán. */
const NOW = new Date('2026-07-15T19:30:00Z');

function makePlace(overrides: Partial<Place> & { id: string }): Place {
  return {
    name: `Demo ${overrides.id}`,
    category: 'food',
    latitude: CULIACAN_CENTER.latitude,
    longitude: CULIACAN_CENTER.longitude,
    address: 'Calle Demo 1',
    openingHours: { weekly: Array(7).fill([{ open: '09:00', close: '22:00' }]) },
    phone: '+52 667 000 0000',
    website: 'https://example.com',
    priceLevel: 1,
    source: 'demo-seed',
    lastVerifiedAt: '2026-07-10T00:00:00Z',
    confidence: 'high',
    keywords: [],
    isDemo: true,
    ...overrides,
  };
}

describe('scorePlace', () => {
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
      makePlace({ id: 'closed', openingHours: { weekly: Array(7).fill([]) } }),
      CULIACAN_CENTER,
      NOW,
    );
    expect(closed.reasons).not.toContain('OPEN_NOW');
    expect(closed.score).toBeLessThan(open.score);
  });

  it('lejanía elimina NEARBY', () => {
    const far = scorePlace(
      makePlace({ id: 'far', latitude: CULIACAN_CENTER.latitude + 0.05 }),
      CULIACAN_CENTER,
      NOW,
    );
    expect(far.distanceKm).toBeGreaterThan(2);
    expect(far.reasons).not.toContain('NEARBY');
  });
});

describe('completenessOf', () => {
  it('cuenta campos opcionales presentes', () => {
    expect(completenessOf(makePlace({ id: 'full' }))).toBe(1);
    expect(
      completenessOf(
        makePlace({ id: 'empty', openingHours: null, phone: null, website: null, priceLevel: null }),
      ),
    ).toBe(0);
  });
});

describe('rankPlaces', () => {
  it('un lugar abierto supera a uno cerrado equivalente', () => {
    const places = [
      makePlace({ id: 'closed', openingHours: { weekly: Array(7).fill([]) } }),
      makePlace({ id: 'open' }),
    ];
    const ranked = rankPlaces(places, CULIACAN_CENTER, NOW);
    expect(ranked[0].place.id).toBe('open');
  });

  it('desempata por distancia y luego por nombre/id de forma determinista', () => {
    const near = makePlace({ id: 'near', latitude: CULIACAN_CENTER.latitude + 0.001 });
    const far = makePlace({ id: 'far', latitude: CULIACAN_CENTER.latitude + 0.01 });
    const rankedA = rankPlaces([far, near], CULIACAN_CENTER, NOW);
    expect(rankedA[0].place.id).toBe('near');

    // Empate total salvo id → ordena por nombre y después id.
    const twinA = makePlace({ id: 'a-1', name: 'Demo Gemelo' });
    const twinB = makePlace({ id: 'b-2', name: 'Demo Gemelo' });
    const ranked1 = rankPlaces([twinB, twinA], CULIACAN_CENTER, NOW).map((r) => r.place.id);
    const ranked2 = rankPlaces([twinA, twinB], CULIACAN_CENTER, NOW).map((r) => r.place.id);
    expect(ranked1).toEqual(['a-1', 'b-2']);
    expect(ranked2).toEqual(['a-1', 'b-2']);
  });

  it('mismo insumo produce el mismo orden (sin aleatoriedad)', () => {
    const places = [
      makePlace({ id: 'x' }),
      makePlace({ id: 'y', confidence: 'low' }),
      makePlace({ id: 'z', openingHours: null }),
    ];
    const a = rankPlaces(places, CULIACAN_CENTER, NOW).map((r) => r.place.id);
    const b = rankPlaces(places, CULIACAN_CENTER, NOW).map((r) => r.place.id);
    expect(a).toEqual(b);
  });
});

describe('explainReasons', () => {
  it('produce la explicación esperada', () => {
    expect(explainReasons(['OPEN_NOW', 'NEARBY', 'RECENTLY_VERIFIED'])).toBe(
      'Recomendado porque está abierto, está cerca y su información fue verificada recientemente.',
    );
  });

  it('una sola razón', () => {
    expect(explainReasons(['OPEN_NOW'])).toBe('Recomendado porque está abierto.');
  });

  it('sin razones → texto neutro', () => {
    expect(explainReasons([])).toBe(
      'Es la opción más conveniente entre los resultados disponibles.',
    );
  });
});
