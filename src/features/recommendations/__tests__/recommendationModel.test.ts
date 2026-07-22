import type { OpeningHours } from '../../../domain/place';
import type { LocavoPlace } from '../../../domain/places/LocavoPlace';
import { es } from '../../../i18n/locales/es';
import type { RecommendationContext } from '../../../intelligence';
import {
  badgeLabelKey,
  buildRecommendationModels,
  confidenceLabelKey,
  explanationLabelKey,
  scoreToStars,
} from '../recommendationModel';

const NOW = new Date('2026-07-22T18:00:00.000Z');
const ORIGIN = { latitude: 24.8, longitude: -107.4 };
const OPEN: OpeningHours = { weekly: Array.from({ length: 7 }, () => [{ open: '00:00', close: '00:00' }]) };

function place(id: string, o: { lat?: number; hours?: OpeningHours } = {}): LocavoPlace {
  const p: LocavoPlace = {
    id,
    sourceRefs: { denueId: id },
    name: `Café ${id}`,
    normalizedName: `cafe ${id}`,
    category: 'food',
    coordinates: { latitude: o.lat ?? ORIGIN.latitude, longitude: ORIGIN.longitude },
    verification: { status: 'source_verified', confidence: 0.6, sourceDatasetUpdatedAt: '2026-07-01T00:00:00.000Z' },
    provenance: [{ source: 'denue' }],
    status: { active: true },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
  if (o.hours) p.hours = o.hours;
  return p;
}

const ctx = (over: Partial<RecommendationContext> = {}): RecommendationContext => ({
  now: NOW,
  intent: 'food',
  origin: ORIGIN,
  ...over,
});

describe('scoreToStars', () => {
  it('umbrales deterministas y NaN → 1', () => {
    expect(scoreToStars(0.9)).toBe(5);
    expect(scoreToStars(0.72)).toBe(4);
    expect(scoreToStars(0.6)).toBe(3);
    expect(scoreToStars(0.45)).toBe(2);
    expect(scoreToStars(0.2)).toBe(1);
    expect(scoreToStars(Number.NaN)).toBe(1);
  });
});

describe('buildRecommendationModels', () => {
  it('lista vacía → sin modelos', () => {
    expect(buildRecommendationModels(ctx(), []).models).toEqual([]);
  });

  it('todos inelegibles (categoría) → sin modelos', () => {
    const r = buildRecommendationModels(ctx({ intent: 'coffee' }), [place('a', { hours: OPEN })]);
    expect(r.models).toEqual([]);
    expect(r.diagnostics.candidatesRejected).toBe(1);
  });

  it('mapea score→estrellas, insignias y razones desde la evidencia', () => {
    const { models } = buildRecommendationModels(ctx(), [
      place('near', { hours: OPEN, lat: 24.8005 }),
      place('far', { lat: 24.83 }),
    ]);
    expect(models.length).toBe(2);
    const top = models[0];
    expect(top.rank).toBe(1);
    expect(top.stars).toBeGreaterThanOrEqual(4);
    expect(top.badges).toContain('bestMatch');
    expect(top.badges).toContain('openNow');
    expect(top.badges).toContain('nearby');
    expect(top.reasonKeys).toContain('rec.reason.openNow');
    expect(top.reasonKeys).toContain('rec.reason.nearby');
    expect(top.openState).toBe('open');
    expect(top.distanceKm).not.toBeNull();
  });

  it('horario desconocido → advertencia estructurada', () => {
    const { models } = buildRecommendationModels(ctx(), [place('a')]);
    expect(models[0].warningKeys).toContain('rec.warn.hoursUnknown');
    expect(models[0].openState).toBe('unknown');
  });

  it('sin origen → distancia null (no rompe)', () => {
    const { models } = buildRecommendationModels(ctx({ origin: null }), [place('a', { hours: OPEN })]);
    expect(models[0].distanceKm).toBeNull();
  });

  it('determinista: mismas entradas → mismos modelos', () => {
    const a = buildRecommendationModels(ctx(), [place('x', { hours: OPEN })]);
    const b = buildRecommendationModels(ctx(), [place('x', { hours: OPEN })]);
    expect(JSON.stringify(b.models)).toBe(JSON.stringify(a.models));
  });
});

describe('label key mappings resolve to real i18n keys', () => {
  const CODES = [
    'INTENT_MATCH', 'OPEN_NOW', 'NEARBY', 'PARKING_CONFIRMED', 'ACCESSIBILITY_CONFIRMED',
    'FAMILY_FRIENDLY', 'HIGH_EVIDENCE_CONFIDENCE', 'OFFICIAL_SOURCE', 'ENRICHED_SOURCE',
    'HOURS_UNKNOWN', 'CLOSED_NOW', 'ACCESSIBILITY_UNKNOWN', 'PARKING_UNKNOWN', 'FAR',
    'LOW_EVIDENCE_CONFIDENCE', 'SOURCE_CONFLICT',
  ] as const;

  it('cada código de explicación mapea a una clave existente', () => {
    for (const code of CODES) {
      expect(typeof es[explanationLabelKey(code)]).toBe('string');
    }
  });

  it('cada insignia y nivel de confianza mapean a claves existentes', () => {
    for (const badge of ['bestMatch', 'openNow', 'nearby', 'family', 'accessible', 'verified', 'enriched'] as const) {
      expect(typeof es[badgeLabelKey(badge)]).toBe('string');
    }
    for (const level of ['unknown', 'low', 'medium', 'high'] as const) {
      expect(typeof es[confidenceLabelKey(level)]).toBe('string');
    }
  });
});
