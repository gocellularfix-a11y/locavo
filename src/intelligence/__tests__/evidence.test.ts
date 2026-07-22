import { gatherEvidence, normalizeContext, type RecommendationIntent } from '../index';
import { ALWAYS_CLOSED, ALWAYS_OPEN, makePlace, NOW, ORIGIN } from './helpers';

function ctx(intent: RecommendationIntent, origin: typeof ORIGIN | null = ORIGIN) {
  return normalizeContext({ now: NOW, intent, origin });
}

describe('gatherEvidence', () => {
  it('lugar canónico (DENUE): distancia conocida, procedencia, confianza media', () => {
    const place = makePlace({ id: 'a', category: 'food', hours: ALWAYS_OPEN });
    const ev = gatherEvidence(place, ctx('food'));
    expect(ev.intentMatch).toBe(true);
    expect(ev.distanceMeters).toBeCloseTo(0, 3);
    expect(ev.openState).toBe('open');
    expect(ev.sources).toEqual(['denue']);
    expect(ev.byDimension.provenance).toBe('medium');
  });

  it('sin origen → distancia desconocida', () => {
    const ev = gatherEvidence(makePlace({ id: 'a' }), ctx('food', null));
    expect(ev.distanceMeters).toBeNull();
    expect(ev.byDimension.distance).toBe('unknown');
  });

  it('sin horarios → openState unknown; sin features → accesibilidad unknown', () => {
    const ev = gatherEvidence(makePlace({ id: 'a' }), ctx('food'));
    expect(ev.openState).toBe('unknown');
    expect(ev.accessible).toBe('unknown');
    expect(ev.parking).toBe('unknown');
  });

  it('cerrado se refleja como known/closed', () => {
    const ev = gatherEvidence(makePlace({ id: 'a', hours: ALWAYS_CLOSED }), ctx('food'));
    expect(ev.openState).toBe('closed');
  });

  it('enriquecido (denue + openstreetmap): dos fuentes concordantes elevan confianza', () => {
    const place = makePlace({
      id: 'a',
      provenance: [{ source: 'denue' }, { source: 'openstreetmap' }],
      features: { wheelchairAccessible: true, parking: true },
    });
    const ev = gatherEvidence(place, ctx('food'));
    expect(ev.sources).toEqual(['denue', 'openstreetmap']);
    expect(ev.byDimension.provenance).toBe('high'); // medium + acuerdo → high
    expect(ev.accessible).toBe(true);
  });

  it('overallConfidence es el más bajo entre lo CONOCIDO', () => {
    // openState unknown no arrastra; provenance medium domina.
    const ev = gatherEvidence(makePlace({ id: 'a' }), ctx('food'));
    expect(ev.overallConfidence).toBe('medium');
  });

  it('no muta el lugar canónico', () => {
    const place = makePlace({ id: 'a', hours: ALWAYS_OPEN });
    const snapshot = JSON.stringify(place);
    gatherEvidence(place, ctx('food'));
    expect(JSON.stringify(place)).toBe(snapshot);
  });
});
