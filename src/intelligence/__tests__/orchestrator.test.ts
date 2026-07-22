import { evaluateRecommendations, type RecommendationContext, type RecommendationIntent } from '../index';
import { ALWAYS_CLOSED, ALWAYS_OPEN, makePlace, NOW, ORIGIN } from './helpers';

const base: RecommendationContext = { now: NOW, intent: 'food', origin: ORIGIN };

describe('evaluateRecommendations', () => {
  it('lista vacía → sin resultados', () => {
    const out = evaluateRecommendations(base, []);
    expect(out.results).toEqual([]);
    expect(out.diagnostics.candidatesReceived).toBe(0);
  });

  it('intención no soportada → unsupportedIntent, sin resultados', () => {
    const out = evaluateRecommendations({ ...base, intent: 'breakfast' as RecommendationIntent }, [
      makePlace({ id: 'a' }),
    ]);
    expect(out.diagnostics.unsupportedIntent).toBe(true);
    expect(out.results).toEqual([]);
  });

  it('ordena por score descendente (abierto+cercano por encima de cerrado+lejano)', () => {
    const good = makePlace({ id: 'good', hours: ALWAYS_OPEN, latitude: 24.8005 });
    const bad = makePlace({ id: 'bad', hours: ALWAYS_CLOSED, latitude: 24.83 });
    const out = evaluateRecommendations(base, [bad, good]);
    expect(out.results.map((r) => r.placeId)).toEqual(['good', 'bad']);
    expect(out.results[0].rank).toBe(1);
    expect(out.results[0].score.total).toBeGreaterThan(out.results[1].score.total);
  });

  it('respeta el límite de resultados', () => {
    const places = Array.from({ length: 5 }, (_, i) => makePlace({ id: `p${i}`, hours: ALWAYS_OPEN }));
    const out = evaluateRecommendations({ ...base, maxResults: 2 }, places);
    expect(out.results).toHaveLength(2);
    expect(out.diagnostics.candidatesEligible).toBe(5);
  });

  it('todos inelegibles → resultados vacíos + diagnóstico', () => {
    const out = evaluateRecommendations({ ...base, intent: 'coffee' }, [
      makePlace({ id: 'a', category: 'food' }),
      makePlace({ id: 'b', category: 'food' }),
    ]);
    expect(out.results).toEqual([]);
    expect(out.diagnostics.candidatesRejected).toBe(2);
    expect(out.diagnostics.rejectionReasons.CATEGORY_MISMATCH).toBe(2);
  });

  it('orden estable en ejecuciones repetidas (byte-equivalente)', () => {
    const places = [
      makePlace({ id: 'a', hours: ALWAYS_OPEN }),
      makePlace({ id: 'b', hours: ALWAYS_CLOSED, latitude: 24.81 }),
      makePlace({ id: 'c', latitude: 24.802 }),
    ];
    const a = evaluateRecommendations(base, places);
    const b = evaluateRecommendations(base, places);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('empate de score → desempate por id ascendente', () => {
    // Dos lugares idénticos salvo id → mismo score, orden por id.
    const p2 = makePlace({ id: 'zzz', hours: ALWAYS_OPEN });
    const p1 = makePlace({ id: 'aaa', hours: ALWAYS_OPEN });
    const out = evaluateRecommendations(base, [p2, p1]);
    expect(out.results.map((r) => r.placeId)).toEqual(['aaa', 'zzz']);
    expect(out.diagnostics.ties).toBe(1);
  });

  it('no muta el arreglo de entrada ni los lugares', () => {
    const places = [makePlace({ id: 'a', hours: ALWAYS_OPEN }), makePlace({ id: 'b' })];
    const order = places.map((p) => p.id);
    const snapshot = JSON.stringify(places);
    evaluateRecommendations(base, places);
    expect(places.map((p) => p.id)).toEqual(order);
    expect(JSON.stringify(places)).toBe(snapshot);
  });

  it('surprise: misma semilla → mismo orden; distinta semilla → orden determinista distinto', () => {
    const places = Array.from({ length: 6 }, (_, i) => makePlace({ id: `p${i}`, hours: ALWAYS_OPEN }));
    const s1a = evaluateRecommendations({ now: NOW, intent: 'surprise', seed: 1 }, places);
    const s1b = evaluateRecommendations({ now: NOW, intent: 'surprise', seed: 1 }, places);
    const s2 = evaluateRecommendations({ now: NOW, intent: 'surprise', seed: 2 }, places);
    expect(s1b.results.map((r) => r.placeId)).toEqual(s1a.results.map((r) => r.placeId));
    // Determinista pero sensible a la semilla (orden distinto para 6 elementos).
    expect(s2.results.map((r) => r.placeId)).not.toEqual(s1a.results.map((r) => r.placeId));
  });
});
