import { buildExplanation, gatherEvidence, normalizeContext, type RecommendationContext } from '../index';
import { ALWAYS_CLOSED, ALWAYS_OPEN, makePlace, NOW, ORIGIN } from './helpers';

function explain(place: ReturnType<typeof makePlace>, ctx: RecommendationContext) {
  const n = normalizeContext(ctx);
  return buildExplanation(gatherEvidence(place, n), n);
}

const base: RecommendationContext = { now: NOW, intent: 'food', origin: ORIGIN };

describe('buildExplanation', () => {
  it('refleja la evidencia: abierto+cercano → positivos', () => {
    const ex = explain(makePlace({ id: 'a', hours: ALWAYS_OPEN }), base);
    const codes = ex.positive.map((i) => i.code);
    expect(codes).toContain('INTENT_MATCH');
    expect(codes).toContain('OPEN_NOW');
    expect(codes).toContain('NEARBY');
    const nearby = ex.positive.find((i) => i.code === 'NEARBY');
    expect(typeof nearby?.value?.distanceMeters).toBe('number');
  });

  it('horario desconocido → advertencia HOURS_UNKNOWN (no negativo confirmado)', () => {
    const ex = explain(makePlace({ id: 'a' }), base);
    expect(ex.warnings.map((i) => i.code)).toContain('HOURS_UNKNOWN');
    expect(ex.warnings.map((i) => i.code)).not.toContain('CLOSED_NOW');
  });

  it('cerrado conocido → CLOSED_NOW', () => {
    const ex = explain(makePlace({ id: 'a', hours: ALWAYS_CLOSED }), base);
    expect(ex.warnings.map((i) => i.code)).toContain('CLOSED_NOW');
  });

  it('no afirma evidencia que no participó (accesibilidad falsa ≠ confirmada)', () => {
    const ex = explain(makePlace({ id: 'a', features: { wheelchairAccessible: false } }), base);
    expect(ex.positive.map((i) => i.code)).not.toContain('ACCESSIBILITY_CONFIRMED');
  });

  it('orden determinista de códigos', () => {
    const a = explain(makePlace({ id: 'a', hours: ALWAYS_OPEN }), base);
    const b = explain(makePlace({ id: 'a', hours: ALWAYS_OPEN }), base);
    expect(a.positive.map((i) => i.code)).toEqual(b.positive.map((i) => i.code));
  });

  it('sin prosa: cada ítem es un código estructurado', () => {
    const ex = explain(makePlace({ id: 'a', hours: ALWAYS_OPEN }), base);
    for (const item of [...ex.positive, ...ex.warnings]) {
      expect(item.code).toMatch(/^[A-Z_]+$/);
      expect(['positive', 'warning', 'neutral']).toContain(item.polarity);
    }
  });
});
