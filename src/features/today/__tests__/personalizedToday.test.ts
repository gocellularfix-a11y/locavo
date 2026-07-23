import type { ContextSnapshot } from '../../../context';
import type { CategoryId } from '../../../domain/place';
import {
  buildPreferenceSnapshot,
  normalizeProfile,
  type UserPreferenceProfile,
} from '../../../preferences';
import type { RecommendationCardModel } from '../../recommendations';
import { buildPersonalizedTodayModels } from '../personalizedToday';
import { buildTodayModels } from '../todayModel';

// quickStop + food → multiplicador de contexto neutro (1): aísla preferencias.
const CTX: ContextSnapshot = {
  minutesOfDay: 0,
  dayOfWeek: 3,
  isWeekend: false,
  timeBand: 'afternoon',
  profile: 'quickStop',
  isHoliday: false,
};

const snap = (partial: Partial<UserPreferenceProfile>) =>
  buildPreferenceSnapshot(normalizeProfile({ schemaVersion: 1, ...partial }));

function model(id: string, scoreTotal: number, category: CategoryId = 'food'): RecommendationCardModel {
  return {
    placeId: id,
    name: `P ${id}`,
    category,
    rank: 1,
    stars: 4,
    scoreTotal,
    confidence: 'medium',
    badges: [],
    reasonKeys: ['rec.reason.intentMatch'],
    warningKeys: [],
    distanceKm: 1,
    openState: 'open',
  };
}
const NO_PLACES = new Map();

describe('buildPersonalizedTodayModels', () => {
  it('favorito recibe beneficio ACOTADO y encabeza; score base y confianza intactos', () => {
    const { models } = buildPersonalizedTodayModels(
      [model('a', 0.6), model('b', 0.6)],
      NO_PLACES,
      CTX,
      snap({ placeSignals: { a: { favorite: true } } }),
    );
    expect(models[0].today.model.placeId).toBe('a');
    expect(models[0].personalizedScore).toBeLessThanOrEqual(0.6 * 1.6);
    expect(models[0].today.model.scoreTotal).toBe(0.6); // base V5.0 sin cambios
    expect(models[0].today.model.confidence).toBe('medium'); // confianza sin cambios
    expect(models[0].preferenceBadgeKey).toBe('pref.badge.favorite');
  });

  it('lugar oculto no llega a Today (excluido)', () => {
    const { models, diagnostics } = buildPersonalizedTodayModels(
      [model('a', 0.9), model('b', 0.5)],
      NO_PLACES,
      CTX,
      snap({ placeSignals: { a: { hidden: true } } }),
    );
    expect(models.map((m) => m.today.model.placeId)).not.toContain('a');
    expect(diagnostics.excludedByHiddenPreference).toBe(1);
  });

  it('interacción débil no supera a una base claramente superior', () => {
    const { models } = buildPersonalizedTodayModels(
      [model('high', 0.9), model('low', 0.5)],
      NO_PLACES,
      CTX,
      snap({ placeSignals: { low: { directionsCount: 5, detailOpenCount: 5 } } }),
    );
    expect(models[0].today.model.placeId).toBe('high');
  });

  it('independiente del orden de entrada', () => {
    const prefs = snap({ placeSignals: { a: { favorite: true } } });
    const o1 = buildPersonalizedTodayModels([model('a', 0.6), model('b', 0.7)], NO_PLACES, CTX, prefs).models.map((m) => m.today.model.placeId);
    const o2 = buildPersonalizedTodayModels([model('b', 0.7), model('a', 0.6)], NO_PLACES, CTX, prefs).models.map((m) => m.today.model.placeId);
    expect(o2).toEqual(o1);
  });

  it('empate → desempate por placeId', () => {
    const { models } = buildPersonalizedTodayModels([model('zzz', 0.5), model('aaa', 0.5)], NO_PLACES, CTX, snap({}));
    expect(models.map((m) => m.today.model.placeId)).toEqual(['aaa', 'zzz']);
  });

  it('sin preferencias → mismo orden que solo-contexto (reset restaura)', () => {
    const input = [model('a', 0.5), model('b', 0.9), model('c', 0.7)];
    const contextOnly = buildTodayModels(input, CTX, 5).map((t) => t.model.placeId);
    const personalized = buildPersonalizedTodayModels(input, NO_PLACES, CTX, snap({})).models.map((m) => m.today.model.placeId);
    expect(personalized).toEqual(contextOnly);
  });

  it('diagnósticos consistentes', () => {
    const { diagnostics } = buildPersonalizedTodayModels(
      [model('a', 0.6)],
      NO_PLACES,
      CTX,
      snap({ placeSignals: { a: { favorite: true, directionsCount: 2 } } }),
    );
    expect(diagnostics.explicitSignalsApplied).toBeGreaterThanOrEqual(1);
    expect(diagnostics.interactionSignalsApplied).toBeGreaterThanOrEqual(1);
    expect(diagnostics.profileSchemaVersion).toBe(1);
    expect(diagnostics.malformedSignalsIgnored).toBe(0);
  });

  it('estable en ejecuciones repetidas', () => {
    const input = [model('a', 0.6), model('b', 0.7)];
    const prefs = snap({ favoriteCategories: ['food'] });
    const a = buildPersonalizedTodayModels(input, NO_PLACES, CTX, prefs);
    const b = buildPersonalizedTodayModels(input, NO_PLACES, CTX, prefs);
    expect(JSON.stringify(b.models)).toBe(JSON.stringify(a.models));
  });
});
