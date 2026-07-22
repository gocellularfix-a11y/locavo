import {
  evaluateEligibility,
  gatherEvidence,
  normalizeContext,
  scoreCandidate,
  type RecommendationContext,
} from '../index';
import { ALWAYS_CLOSED, ALWAYS_OPEN, makePlace, NOW, ORIGIN } from './helpers';

function evalWith(place: ReturnType<typeof makePlace>, ctx: RecommendationContext) {
  const n = normalizeContext(ctx);
  const ev = gatherEvidence(place, n);
  return { n, ev, eligibility: evaluateEligibility(place, n, ev) };
}

describe('eligibility', () => {
  it('categoría incompatible → CATEGORY_MISMATCH', () => {
    const { eligibility } = evalWith(makePlace({ id: 'a', category: 'food' }), { now: NOW, intent: 'coffee' });
    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toContain('CATEGORY_MISMATCH');
  });

  it('openNow requerido + cerrado conocido → excluye', () => {
    const { eligibility } = evalWith(makePlace({ id: 'a', hours: ALWAYS_CLOSED }), {
      now: NOW,
      intent: 'food',
      constraints: { openNow: true },
    });
    expect(eligibility.reasons).toContain('CLOSED_NOW_REQUIRED');
  });

  it('openNow requerido + horario DESCONOCIDO → NO excluye', () => {
    const { eligibility } = evalWith(makePlace({ id: 'a' }), {
      now: NOW,
      intent: 'food',
      constraints: { openNow: true },
    });
    expect(eligibility.eligible).toBe(true);
  });

  it('accesibilidad requerida: desconocida excluye, confirmada no', () => {
    const unknown = evalWith(makePlace({ id: 'a' }), { now: NOW, intent: 'food', constraints: { accessible: true } });
    expect(unknown.eligibility.reasons).toContain('ACCESSIBILITY_REQUIRED_UNCONFIRMED');
    const ok = evalWith(makePlace({ id: 'b', features: { wheelchairAccessible: true } }), {
      now: NOW,
      intent: 'food',
      constraints: { accessible: true },
    });
    expect(ok.eligibility.eligible).toBe(true);
  });

  it('registro malformado (coordenadas inválidas) → MALFORMED_RECORD', () => {
    const { eligibility } = evalWith(makePlace({ id: 'a', latitude: 999 }), { now: NOW, intent: 'food' });
    expect(eligibility.reasons).toContain('MALFORMED_RECORD');
  });

  it('inactivo/cerrado permanentemente → INACTIVE_OR_CLOSED', () => {
    const { eligibility } = evalWith(makePlace({ id: 'a', permanentlyClosed: true }), { now: NOW, intent: 'food' });
    expect(eligibility.reasons).toContain('INACTIVE_OR_CLOSED');
  });

  it('fuera de radio → OUTSIDE_RADIUS', () => {
    const far = makePlace({ id: 'a', latitude: 25.0 }); // ~22 km al norte
    const { eligibility } = evalWith(far, { now: NOW, intent: 'food', origin: ORIGIN, radiusMeters: 1000 });
    expect(eligibility.reasons).toContain('OUTSIDE_RADIUS');
  });
});

describe('scoring', () => {
  const base: RecommendationContext = { now: NOW, intent: 'food', origin: ORIGIN };
  const scoreOf = (place: ReturnType<typeof makePlace>, ctx: RecommendationContext = base) => {
    const n = normalizeContext(ctx);
    return scoreCandidate(gatherEvidence(place, n), n);
  };

  it('breakdown estable: componentes suman total; pesos suman 1', () => {
    const r = scoreOf(makePlace({ id: 'a', hours: ALWAYS_OPEN }));
    const sum = r.components.reduce((s, c) => s + c.weighted, 0);
    expect(r.total).toBeCloseTo(sum, 10);
    expect(r.components.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1, 10);
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThanOrEqual(1);
  });

  it('más cerca puntúa más que más lejos', () => {
    const near = scoreOf(makePlace({ id: 'a', latitude: 24.8005 }));
    const far = scoreOf(makePlace({ id: 'b', latitude: 24.83 }));
    const d = (r: typeof near) => r.components.find((c) => c.dimension === 'distance')!.value;
    expect(d(near)).toBeGreaterThan(d(far));
  });

  it('abierto > cerrado en el componente openStatus; desconocido es neutro (0.5)', () => {
    const open = scoreOf(makePlace({ id: 'a', hours: ALWAYS_OPEN }));
    const closed = scoreOf(makePlace({ id: 'b', hours: ALWAYS_CLOSED }));
    const unknown = scoreOf(makePlace({ id: 'c' }));
    const o = (r: typeof open) => r.components.find((c) => c.dimension === 'openStatus')!.value;
    expect(o(open)).toBe(1);
    expect(o(closed)).toBe(0);
    expect(o(unknown)).toBe(0.5);
  });

  it('preferencia (parking): confirmado > desconocido > negativo', () => {
    const ctx: RecommendationContext = { now: NOW, intent: 'food', origin: ORIGIN, preferences: { parking: true } };
    const p = (place: ReturnType<typeof makePlace>) =>
      scoreOf(place, ctx).components.find((c) => c.dimension === 'preferences')!.value;
    expect(p(makePlace({ id: 'a', features: { parking: true } }))).toBe(1);
    expect(p(makePlace({ id: 'b' }))).toBe(0.5);
    expect(p(makePlace({ id: 'c', features: { parking: false } }))).toBe(0);
  });

  it('determinista: mismas entradas → mismo total', () => {
    const a = scoreOf(makePlace({ id: 'a', hours: ALWAYS_OPEN }));
    const b = scoreOf(makePlace({ id: 'a', hours: ALWAYS_OPEN }));
    expect(b.total).toBe(a.total);
  });
});
