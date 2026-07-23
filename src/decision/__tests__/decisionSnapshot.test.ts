import type { CategoryId } from '../../domain/place';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import type { EvidenceConfidence } from '../../intelligence';
import {
  buildDecisionSnapshots,
  intentStrengthOf,
  preferenceStrengthOf,
  type RankedDecisionModel,
} from '../decisionSnapshot';

interface Over {
  placeId: string;
  finalScore?: number;
  rank?: number;
  category?: CategoryId;
  distanceKm?: number | null;
  openState?: 'open' | 'closed' | 'unknown';
  confidence?: EvidenceConfidence;
  reasonKeys?: string[];
  intentBadge?: boolean;
  prefBadge?: 'favorite' | 'match' | null;
}

function rm(over: Over): RankedDecisionModel {
  return {
    finalScore: over.finalScore ?? 1,
    rank: over.rank ?? 1,
    intentBadgeKey: over.intentBadge ? 'intent.chip.COFFEE' : undefined,
    preferenceBadgeKey:
      over.prefBadge === 'favorite' ? 'pref.badge.favorite' : over.prefBadge === 'match' ? 'pref.badge.match' : undefined,
    today: {
      model: {
        placeId: over.placeId,
        category: over.category ?? 'coffee',
        distanceKm: over.distanceKm === undefined ? 0.5 : over.distanceKm,
        openState: over.openState ?? 'unknown',
        confidence: over.confidence ?? 'medium',
        reasonKeys: over.reasonKeys ?? [],
      },
    },
  };
}

function places(entries: Record<string, { accessible?: boolean; family?: boolean }>): Map<string, LocavoPlace> {
  const m = new Map<string, LocavoPlace>();
  for (const [id, f] of Object.entries(entries)) {
    m.set(id, { features: { wheelchairAccessible: f.accessible, familyFriendly: f.family } } as unknown as LocavoPlace);
  }
  return m;
}

const NO_PLACES = new Map<string, LocavoPlace>();

describe('buildDecisionSnapshots (V5.6)', () => {
  it('(1) entrada vacía → sin snapshots', () => {
    expect(buildDecisionSnapshots([], NO_PLACES)).toEqual([]);
  });

  it('(2) un candidato → campos canónicos mapeados', () => {
    const [s] = buildDecisionSnapshots(
      [rm({ placeId: 'a', finalScore: 0.8, rank: 1, category: 'coffee', distanceKm: 0.3, openState: 'open', confidence: 'high' })],
      NO_PLACES,
    );
    expect(s).toMatchObject({ placeId: 'a', sourceRank: 1, finalScore: 0.8, distanceKm: 0.3, openState: 'open', recommendationConfidence: 'high', category: 'coffee' });
  });

  it('(3) múltiples candidatos → orden de entrada preservado', () => {
    const out = buildDecisionSnapshots([rm({ placeId: 'a', rank: 1 }), rm({ placeId: 'b', rank: 2 }), rm({ placeId: 'c', rank: 3 })], NO_PLACES);
    expect(out.map((s) => s.placeId)).toEqual(['a', 'b', 'c']);
  });

  it('(4) registro de lugar ausente → accesible/familia desconocidos', () => {
    const [s] = buildDecisionSnapshots([rm({ placeId: 'a' })], NO_PLACES);
    expect(s.accessible).toBeUndefined();
    expect(s.familyFriendly).toBeUndefined();
  });

  it('(5) distancia desconocida se preserva como null', () => {
    const [s] = buildDecisionSnapshots([rm({ placeId: 'a', distanceKm: null })], NO_PLACES);
    expect(s.distanceKm).toBeNull();
  });

  it('(6) estado de apertura desconocido se preserva', () => {
    const [s] = buildDecisionSnapshots([rm({ placeId: 'a', openState: 'unknown' })], NO_PLACES);
    expect(s.openState).toBe('unknown');
  });

  it('(7) accesibilidad desconocida no es false', () => {
    const [s] = buildDecisionSnapshots([rm({ placeId: 'a' })], places({ a: {} }));
    expect(s.accessible).toBeUndefined();
    expect(s.accessible).not.toBe(false);
  });

  it('(8) familia desconocida no es false', () => {
    const [s] = buildDecisionSnapshots([rm({ placeId: 'a' })], places({ a: { accessible: true } }));
    expect(s.familyFriendly).toBeUndefined();
    expect(s.accessible).toBe(true);
  });

  it('(9) no muta la entrada', () => {
    const model = rm({ placeId: 'a', reasonKeys: ['intent.reason.match'] });
    const input = Object.freeze([Object.freeze(model)]) as readonly RankedDecisionModel[];
    expect(() => buildDecisionSnapshots(input, NO_PLACES)).not.toThrow();
    expect(model.today.model.reasonKeys).toEqual(['intent.reason.match']);
  });

  it('(10) snapshot estable y repetible', () => {
    const input = [rm({ placeId: 'a', rank: 1 }), rm({ placeId: 'b', rank: 2 })];
    expect(buildDecisionSnapshots(input, NO_PLACES)).toEqual(buildDecisionSnapshots(input, NO_PLACES));
  });
});

describe('derivación de fuerza (sin recálculo de motores)', () => {
  it('fuerza de intención = razones de intención distintas', () => {
    expect(intentStrengthOf(rm({ placeId: 'a', reasonKeys: [] }))).toBe(0);
    expect(intentStrengthOf(rm({ placeId: 'a', reasonKeys: ['intent.reason.match', 'intent.reason.openNow', 'intent.reason.match'] }))).toBe(2);
  });

  it('fuerza de preferencia: favorito ≫ coincidencia ≫ nada', () => {
    const none = preferenceStrengthOf(rm({ placeId: 'a', prefBadge: null }));
    const match = preferenceStrengthOf(rm({ placeId: 'a', prefBadge: 'match' }));
    const fav = preferenceStrengthOf(rm({ placeId: 'a', prefBadge: 'favorite' }));
    expect(none).toBe(0);
    expect(match).toBeGreaterThan(none);
    expect(fav).toBeGreaterThan(match);
  });

  it('razones de preferencia distintas rompen empates de insignia', () => {
    const a = preferenceStrengthOf(rm({ placeId: 'a', prefBadge: 'match', reasonKeys: ['pref.reason.distance'] }));
    const b = preferenceStrengthOf(rm({ placeId: 'b', prefBadge: 'match', reasonKeys: ['pref.reason.distance', 'pref.reason.openNow'] }));
    expect(b).toBeGreaterThan(a);
  });
});
