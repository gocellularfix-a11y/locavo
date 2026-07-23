import type { ContextSnapshot } from '../../../context';
import type { CategoryId } from '../../../domain/place';
import { buildIntentSnapshot, type IntentId } from '../../../intent';
import { parseIntentText } from '../../../intent/intentParser';
import { resolveIntent } from '../../../intent/intentResolver';
import { buildPreferenceSnapshot, normalizeProfile, type UserPreferenceProfile } from '../../../preferences';
import type { RecommendationCardModel } from '../../recommendations';
import { buildIntentTodayModels } from '../intentToday';
import { buildPersonalizedTodayModels } from '../personalizedToday';

const CTX: ContextSnapshot = { minutesOfDay: 0, dayOfWeek: 3, isWeekend: false, timeBand: 'afternoon', profile: 'quickStop', isHoliday: false };
const prefs = (p: Partial<UserPreferenceProfile> = {}) => buildPreferenceSnapshot(normalizeProfile({ schemaVersion: 1, ...p }));
const intentOf = (id: IntentId) => buildIntentSnapshot(resolveIntent(parseIntentText('', 'es'), id)!);

function model(id: string, scoreTotal: number, category: CategoryId): RecommendationCardModel {
  return {
    placeId: id, name: `P ${id}`, category, rank: 1, stars: 4, scoreTotal, confidence: 'medium',
    badges: [], reasonKeys: ['rec.reason.intentMatch'], warningKeys: [], distanceKm: 0.5, openState: 'open',
  };
}
const NO_PLACES = new Map();

describe('buildIntentTodayModels', () => {
  it('sin intención → mismo orden que el personalizado (limpiar restaura)', () => {
    const input = [model('a', 0.5, 'food'), model('b', 0.9, 'coffee'), model('c', 0.7, 'store')];
    const personalized = buildPersonalizedTodayModels(input, NO_PLACES, CTX, prefs(), 5).models.map((m) => m.today.model.placeId);
    const intentless = buildIntentTodayModels(input, NO_PLACES, CTX, prefs(), null, 5).models.map((m) => m.today.model.placeId);
    expect(intentless).toEqual(personalized);
  });

  it('la intención de categoría favorece la categoría en alcance', () => {
    const { models } = buildIntentTodayModels(
      [model('coffee', 0.6, 'coffee'), model('food', 0.6, 'food')],
      NO_PLACES, CTX, prefs(), intentOf('COFFEE'), 5,
    );
    expect(models[0].today.model.placeId).toBe('coffee'); // 0.6*1.3 > 0.6*0.7
    expect(models[0].intentBadgeKey).toBe('intent.chip.COFFEE');
  });

  it('intención fuerte no deja ganar a lo obviamente incompatible', () => {
    const { models } = buildIntentTodayModels(
      [model('food', 0.85, 'food'), model('pharm', 0.6, 'pharmacy')],
      NO_PLACES, CTX, prefs(), intentOf('PHARMACY'), 5,
    );
    expect(models[0].today.model.placeId).toBe('pharm'); // fuera de alcango ×0.7 vs en alcance ×1.3
  });

  it('lugar oculto (V5.4) sigue excluido bajo intención', () => {
    const { models } = buildIntentTodayModels(
      [model('a', 0.9, 'coffee'), model('b', 0.5, 'coffee')],
      NO_PLACES, CTX, prefs({ placeSignals: { a: { hidden: true } } }), intentOf('COFFEE'), 5,
    );
    expect(models.map((m) => m.today.model.placeId)).not.toContain('a');
  });

  it('score base, confianza y contexto se preservan', () => {
    const { models } = buildIntentTodayModels([model('a', 0.6, 'coffee')], NO_PLACES, CTX, prefs(), intentOf('COFFEE'), 5);
    expect(models[0].today.model.scoreTotal).toBe(0.6);
    expect(models[0].today.model.confidence).toBe('medium');
  });

  it('diagnósticos e independencia del orden de entrada', () => {
    const input = [model('a', 0.6, 'coffee'), model('b', 0.7, 'food')];
    const intent = intentOf('COFFEE');
    const r1 = buildIntentTodayModels(input, NO_PLACES, CTX, prefs(), intent, 5);
    const r2 = buildIntentTodayModels([...input].reverse(), NO_PLACES, CTX, prefs(), intent, 5);
    expect(r2.models.map((m) => m.today.model.placeId)).toEqual(r1.models.map((m) => m.today.model.placeId));
    expect(r1.diagnostics.adjustmentsApplied).toBeGreaterThan(0);
  });
});
