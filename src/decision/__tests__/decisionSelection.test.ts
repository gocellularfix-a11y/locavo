import type { CategoryId } from '../../domain/place';
import type { LocavoPlace } from '../../domain/places/LocavoPlace';
import type { EvidenceConfidence } from '../../intelligence';
import { DECISION_TRADEOFF_CODES } from '../decisionModel';
import { buildDecisionSet } from '../decisionSelection';
import type { ActiveIntentScope } from '../decisionDifferentiation';
import type { RankedDecisionModel } from '../decisionSnapshot';

interface Over {
  placeId: string;
  finalScore?: number;
  rank?: number;
  category?: CategoryId;
  distanceKm?: number | null;
  openState?: 'open' | 'closed' | 'unknown';
  confidence?: EvidenceConfidence;
  intent?: number; // nº de razones de intención distintas a fabricar
  prefBadge?: 'favorite' | 'match' | null;
}

function rm(over: Over): RankedDecisionModel {
  const intentKeys = ['intent.reason.match', 'intent.reason.openNow', 'intent.reason.nearby', 'intent.reason.family'];
  const reasonKeys = intentKeys.slice(0, over.intent ?? 0);
  return {
    finalScore: over.finalScore ?? 1,
    rank: over.rank ?? 1,
    intentBadgeKey: (over.intent ?? 0) > 0 ? 'intent.chip.COFFEE' : undefined,
    preferenceBadgeKey:
      over.prefBadge === 'favorite' ? 'pref.badge.favorite' : over.prefBadge === 'match' ? 'pref.badge.match' : undefined,
    today: {
      model: {
        placeId: over.placeId,
        category: over.category ?? 'coffee',
        distanceKm: over.distanceKm === undefined ? 0.5 : over.distanceKm,
        openState: over.openState ?? 'unknown',
        confidence: over.confidence ?? 'medium',
        reasonKeys,
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
const SCOPE = (...c: CategoryId[]): ActiveIntentScope => ({ categoryScope: new Set(c) });

const build = (models: RankedDecisionModel[], opts: { placesById?: Map<string, LocavoPlace>; activeIntent?: ActiveIntentScope | null } = {}) =>
  buildDecisionSet({ rankedModels: models, placesById: opts.placesById ?? NO_PLACES, activeIntent: opts.activeIntent ?? null });

const roles = (set: ReturnType<typeof build>) => set.alternatives.map((a) => a.role);

describe('selección de primario', () => {
  it('(11) el mejor rankeado es BEST_MATCH', () => {
    const set = build([rm({ placeId: 'a', rank: 1 }), rm({ placeId: 'b', rank: 2 })]);
    expect(set.primary?.placeId).toBe('a');
    expect(set.primary?.role).toBe('BEST_MATCH');
  });

  it('(13) candidato inválido (placeId vacío o score no finito) se excluye', () => {
    const set = build([rm({ placeId: '', rank: 1 }), rm({ placeId: 'b', rank: 2 }), { ...rm({ placeId: 'c', rank: 3 }), finalScore: Number.NaN }]);
    expect(set.primary?.placeId).toBe('b');
    expect(set.diagnostics.eligible).toBe(1);
  });

  it('(14) sourceRank se preserva', () => {
    const set = build([rm({ placeId: 'a', rank: 7 }), rm({ placeId: 'b', rank: 9, distanceKm: 0.1, confidence: 'high' })]);
    expect(set.primary?.sourceRank).toBe(7);
  });

  it('(15) desempate por placeId canónico en un papel', () => {
    // dos alternativas igualmente confiables → gana placeId menor
    const set = build([
      rm({ placeId: 'p', confidence: 'low' }),
      rm({ placeId: 'y', confidence: 'high' }),
      rm({ placeId: 'x', confidence: 'high' }),
    ]);
    const reliable = set.alternatives.find((a) => a.role === 'MOST_RELIABLE');
    expect(reliable?.placeId).toBe('x');
  });

  it('(16) resultado estable y repetible', () => {
    const models = [rm({ placeId: 'a' }), rm({ placeId: 'b', distanceKm: 0.05 }), rm({ placeId: 'c', confidence: 'high' })];
    expect(build(models)).toEqual(build(models));
  });
});

describe('selección de papeles', () => {
  it('(17) CLOSEST con distancia materialmente menor', () => {
    const set = build([rm({ placeId: 'a', distanceKm: 2 }), rm({ placeId: 'b', distanceKm: 1 })]);
    expect(set.alternatives.find((a) => a.role === 'CLOSEST')?.placeId).toBe('b');
  });

  it('(18) CLOSEST exige diferencia significativa (< 0.5 km no)', () => {
    const set = build([rm({ placeId: 'a', distanceKm: 1.0 }), rm({ placeId: 'b', distanceKm: 0.8 })]);
    expect(roles(set)).not.toContain('CLOSEST');
  });

  it('(19) MOST_RELIABLE por confianza superior', () => {
    const set = build([rm({ placeId: 'a', confidence: 'medium' }), rm({ placeId: 'b', confidence: 'high' })]);
    expect(set.alternatives.find((a) => a.role === 'MOST_RELIABLE')?.placeId).toBe('b');
  });

  it('(20) MOST_RELIABLE exige diferencia de evidencia (misma confianza no)', () => {
    const set = build([rm({ placeId: 'a', confidence: 'high' }), rm({ placeId: 'b', confidence: 'high' })]);
    expect(roles(set)).not.toContain('MOST_RELIABLE');
  });

  it('(21) BEST_INTENT_FIT con intención más fuerte', () => {
    const set = build([rm({ placeId: 'a', intent: 1 }), rm({ placeId: 'b', intent: 3 })], { activeIntent: SCOPE('coffee') });
    expect(set.alternatives.find((a) => a.role === 'BEST_INTENT_FIT')?.placeId).toBe('b');
  });

  it('(22) BEST_PREFERENCE_FIT con preferencia más fuerte', () => {
    const set = build([rm({ placeId: 'a', prefBadge: null }), rm({ placeId: 'b', prefBadge: 'favorite' })]);
    expect(set.alternatives.find((a) => a.role === 'BEST_PREFERENCE_FIT')?.placeId).toBe('b');
  });

  it('(23) OPEN_NOW cuando el primario no está abierto', () => {
    const set = build([rm({ placeId: 'a', openState: 'unknown' }), rm({ placeId: 'b', openState: 'open' })]);
    expect(set.alternatives.find((a) => a.role === 'OPEN_NOW')?.placeId).toBe('b');
  });

  it('(24) ACCESSIBLE solo con evidencia explícita', () => {
    const set = build([rm({ placeId: 'a' }), rm({ placeId: 'b' })], { placesById: places({ b: { accessible: true } }) });
    expect(set.alternatives.find((a) => a.role === 'ACCESSIBLE')?.placeId).toBe('b');
  });

  it('(25) FAMILY_PICK solo con evidencia explícita', () => {
    const set = build([rm({ placeId: 'a' }), rm({ placeId: 'b' })], { placesById: places({ b: { family: true } }) });
    expect(set.alternatives.find((a) => a.role === 'FAMILY_PICK')?.placeId).toBe('b');
  });

  it('(26) evidencia desconocida no califica accesible/familia', () => {
    const set = build([rm({ placeId: 'a' }), rm({ placeId: 'b' })], { placesById: places({ b: {} }) });
    expect(roles(set)).not.toContain('ACCESSIBLE');
    expect(roles(set)).not.toContain('FAMILY_PICK');
    expect(set.diagnostics.missingEvidenceRejected).toBeGreaterThan(0);
  });

  it('(27/66) un mismo lugar no ocupa dos papeles visibles', () => {
    const set = build([rm({ placeId: 'a', distanceKm: 2, confidence: 'medium' }), rm({ placeId: 'x', distanceKm: 1, confidence: 'high' })]);
    const forX = set.alternatives.filter((a) => a.placeId === 'x');
    expect(forX).toHaveLength(1);
    expect(set.diagnostics.duplicatePlacesRejected).toBeGreaterThan(0);
  });

  it('(28) no se emite un papel duplicado', () => {
    const set = build([rm({ placeId: 'a', distanceKm: 2 }), rm({ placeId: 'b', distanceKm: 1 }), rm({ placeId: 'c', distanceKm: 0.5 })]);
    expect(roles(set).filter((r) => r === 'CLOSEST')).toHaveLength(1);
  });

  it('(29) prioridad de papeles determinista: CLOSEST antes que MOST_RELIABLE', () => {
    const set = build([rm({ placeId: 'a', distanceKm: 2, confidence: 'medium' }), rm({ placeId: 'x', distanceKm: 1, confidence: 'high' })]);
    expect(set.alternatives.find((a) => a.placeId === 'x')?.role).toBe('CLOSEST');
  });
});

describe('diferenciación significativa', () => {
  it('(30/31/40) alternativas idénticas (solo difiere el placeId) se rechazan → sin relleno', () => {
    const set = build([rm({ placeId: 'a' }), rm({ placeId: 'b' }), rm({ placeId: 'c' })]);
    expect(set.alternatives).toHaveLength(0);
  });

  it('(32) diferencia de distancia significativa aceptada', () => {
    const set = build([rm({ placeId: 'a', distanceKm: 2 }), rm({ placeId: 'b', distanceKm: 1.4 })]);
    expect(roles(set)).toContain('CLOSEST');
  });

  it('(33) diferencia de confianza significativa aceptada', () => {
    const set = build([rm({ placeId: 'a', confidence: 'low' }), rm({ placeId: 'b', confidence: 'high' })]);
    expect(roles(set)).toContain('MOST_RELIABLE');
  });

  it('(34) diferencia de intención significativa aceptada', () => {
    const set = build([rm({ placeId: 'a', intent: 0 }), rm({ placeId: 'b', intent: 2 })], { activeIntent: SCOPE('coffee') });
    expect(roles(set)).toContain('BEST_INTENT_FIT');
  });

  it('(35) diferencia de preferencia significativa aceptada', () => {
    const set = build([rm({ placeId: 'a', prefBadge: 'match' }), rm({ placeId: 'b', prefBadge: 'favorite' })]);
    expect(roles(set)).toContain('BEST_PREFERENCE_FIT');
  });

  it('(36) categoría compatible distinta aceptada como ALTERNATIVE', () => {
    const set = build([rm({ placeId: 'a', category: 'coffee', openState: 'open' }), rm({ placeId: 'b', category: 'food', openState: 'open' })], {
      activeIntent: SCOPE('coffee', 'food'),
    });
    expect(set.alternatives.find((x) => x.placeId === 'b')?.role).toBe('ALTERNATIVE');
  });

  it('(37) categoría incompatible con la intención rechazada', () => {
    const set = build([rm({ placeId: 'a', category: 'coffee', openState: 'open' }), rm({ placeId: 'b', category: 'food', openState: 'open' })], {
      activeIntent: SCOPE('coffee'),
    });
    expect(roles(set)).not.toContain('ALTERNATIVE');
  });

  it('(38) máximo dos alternativas', () => {
    const set = build([
      rm({ placeId: 'a', distanceKm: 3, confidence: 'low', openState: 'unknown' }),
      rm({ placeId: 'b', distanceKm: 1 }), // CLOSEST
      rm({ placeId: 'c', confidence: 'high' }), // MOST_RELIABLE
      rm({ placeId: 'd', openState: 'open' }), // OPEN_NOW
    ]);
    expect(set.alternatives.length).toBe(2);
  });

  it('(39) menos alternativas cuando la evidencia es insuficiente', () => {
    const set = build([rm({ placeId: 'a', distanceKm: 2 }), rm({ placeId: 'b', distanceKm: 1 }), rm({ placeId: 'c', distanceKm: 1.9 })]);
    expect(set.alternatives.length).toBe(1); // solo CLOSEST (b); c no difiere lo suficiente
  });
});

describe('compromisos (tradeoffs)', () => {
  const tradeoffsOf = (set: ReturnType<typeof build>, placeId: string) =>
    set.alternatives.find((a) => a.placeId === placeId)?.tradeoffCodes ?? [];

  it('(41) más lejos', () => {
    const set = build([rm({ placeId: 'a', confidence: 'medium', distanceKm: 0.5 }), rm({ placeId: 'b', confidence: 'high', distanceKm: 1.3 })]);
    expect(tradeoffsOf(set, 'b')).toContain('TRADEOFF_FARTHER');
  });

  it('(42) menor confianza', () => {
    const set = build([rm({ placeId: 'a', confidence: 'high', distanceKm: 2 }), rm({ placeId: 'b', confidence: 'low', distanceKm: 1 })]);
    expect(tradeoffsOf(set, 'b')).toContain('TRADEOFF_LOWER_CONFIDENCE');
  });

  it('(43) intención más débil', () => {
    const set = build([rm({ placeId: 'a', intent: 3, distanceKm: 2 }), rm({ placeId: 'b', intent: 0, distanceKm: 1 })], { activeIntent: SCOPE('coffee') });
    expect(tradeoffsOf(set, 'b')).toContain('TRADEOFF_WEAKER_INTENT_MATCH');
  });

  it('(44) preferencia más débil', () => {
    const set = build([rm({ placeId: 'a', prefBadge: 'favorite', distanceKm: 2 }), rm({ placeId: 'b', prefBadge: null, distanceKm: 1 })]);
    expect(tradeoffsOf(set, 'b')).toContain('TRADEOFF_WEAKER_PREFERENCE_MATCH');
  });

  it('(45) evidencia limitada', () => {
    const set = build([rm({ placeId: 'a', confidence: 'high', distanceKm: 2 }), rm({ placeId: 'b', confidence: 'unknown', distanceKm: 1 })]);
    expect(tradeoffsOf(set, 'b')).toContain('TRADEOFF_LIMITED_EVIDENCE');
  });

  it('(46) diferencias negligibles no producen compromisos', () => {
    const set = build([rm({ placeId: 'a', distanceKm: 2, confidence: 'high' }), rm({ placeId: 'b', distanceKm: 1, confidence: 'high' })]);
    expect(tradeoffsOf(set, 'b')).toEqual([]); // solo más cerca, sin desventajas
  });

  it('(47) orden de compromisos determinista y canónico', () => {
    const set = build(
      [
        rm({ placeId: 'a', category: 'coffee', confidence: 'high', distanceKm: 0.5, intent: 3, prefBadge: 'favorite', openState: 'open', finalScore: 1 }),
        rm({ placeId: 'b', category: 'food', confidence: 'unknown', distanceKm: 1.6, intent: 0, prefBadge: null, openState: 'open', finalScore: 0.9 }),
      ],
      { activeIntent: SCOPE('coffee', 'food') },
    );
    const codes = set.alternatives.find((x) => x.placeId === 'b')?.tradeoffCodes ?? [];
    expect(codes).toEqual([...DECISION_TRADEOFF_CODES]);
  });
});

describe('diagnósticos', () => {
  it('(65) consistencia aritmética', () => {
    const set = build([rm({ placeId: 'a', distanceKm: 2 }), rm({ placeId: 'b', distanceKm: 1 }), rm({ placeId: 'c', confidence: 'high' })]);
    const d = set.diagnostics;
    expect(d.selected).toBe((set.primary ? 1 : 0) + set.alternatives.length);
    expect(d.eligible).toBeLessThanOrEqual(d.received);
    expect(d.received).toBe(3);
  });

  it('(67) rechazo por diferenciación insuficiente', () => {
    const set = build([rm({ placeId: 'a', distanceKm: 1 }), rm({ placeId: 'b', distanceKm: 0.9 })]);
    expect(set.diagnostics.insufficientDifferentiationRejected).toBeGreaterThan(0);
    expect(set.alternatives).toHaveLength(0);
  });

  it('(68) rechazo por evidencia faltante', () => {
    const set = build([rm({ placeId: 'a', distanceKm: 0.5 }), rm({ placeId: 'b', distanceKm: null })]);
    expect(set.diagnostics.missingEvidenceRejected).toBeGreaterThan(0);
  });

  it('máximo de opciones acotado y respetado', () => {
    const set = buildDecisionSet({
      rankedModels: [rm({ placeId: 'a', distanceKm: 3 }), rm({ placeId: 'b', distanceKm: 1 }), rm({ placeId: 'c', confidence: 'high' })],
      placesById: NO_PLACES,
      activeIntent: null,
      maximumOptions: 2,
    });
    expect(set.alternatives.length).toBeLessThanOrEqual(1);
  });
});
