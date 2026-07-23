import type { ContextSnapshot } from '../../../context';
import { buildDecisionSet } from '../../../decision';
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

function model(id: string, scoreTotal: number, category: CategoryId, distanceKm = 0.5): RecommendationCardModel {
  return {
    placeId: id, name: `P ${id}`, category, rank: 1, stars: 4, scoreTotal, confidence: 'medium',
    badges: [], reasonKeys: ['rec.reason.intentMatch'], warningKeys: [], distanceKm, openState: 'open',
  };
}
const NO_PLACES = new Map();

/** Pipeline canónico V5.5 → V5.6. */
function decide(input: RecommendationCardModel[], intent: ReturnType<typeof intentOf> | null, p = prefs()) {
  const models = buildIntentTodayModels(input, NO_PLACES, CTX, p, intent, 5).models;
  const decision = buildDecisionSet({ rankedModels: models, placesById: NO_PLACES, activeIntent: intent });
  return { models, decision };
}

describe('integración decisión sobre Today (V5.6)', () => {
  it('(48) buildIntentTodayModels precede a la selección: el primario es el modelo top rankeado', () => {
    const input = [model('a', 0.5, 'food', 2), model('b', 0.9, 'coffee', 1), model('c', 0.7, 'store', 0.3)];
    const { models, decision } = decide(input, null);
    expect(decision.primary?.placeId).toBe(models[0].today.model.placeId);
    expect(decision.primary?.finalScore).toBe(models[0].finalScore);
  });

  it('(49) no introduce lugares fuera de los modelos rankeados', () => {
    const input = [model('a', 0.9, 'coffee', 2), model('b', 0.6, 'coffee', 0.5)];
    const { models, decision } = decide(input, null);
    const ids = new Set(models.map((m) => m.today.model.placeId));
    const chosen = [decision.primary, ...decision.alternatives].filter(Boolean);
    for (const opt of chosen) {
      expect(ids.has(opt!.placeId)).toBe(true);
    }
  });

  it('(54) limpiar la intención produce un set de decisión general y determinista', () => {
    const input = [model('a', 0.6, 'coffee', 2), model('b', 0.7, 'food', 0.4)];
    const first = decide(input, null).decision;
    const second = decide(input, null).decision;
    expect(first).toEqual(second);
    const personalizedTop = buildPersonalizedTodayModels(input, NO_PLACES, CTX, prefs(), 5).models[0].today.model.placeId;
    expect(first.primary?.placeId).toBe(personalizedTop);
  });

  it('(55/56) intención desconocida/ambigua (sin snapshot) no crea papel de intención', () => {
    const input = [model('a', 0.6, 'coffee'), model('b', 0.9, 'food', 0.1)];
    const { decision } = decide(input, null);
    expect(decision.alternatives.map((x) => x.role)).not.toContain('BEST_INTENT_FIT');
  });

  it('(57) los lugares ocultos (V5.4) nunca entran al set de decisión', () => {
    const input = [model('a', 0.95, 'coffee'), model('b', 0.5, 'coffee', 0.2)];
    const { decision } = decide(input, intentOf('COFFEE'), prefs({ placeSignals: { a: { hidden: true } } }));
    const ids = [decision.primary?.placeId, ...decision.alternatives.map((x) => x.placeId)];
    expect(ids).not.toContain('a');
  });

  it('(58) los favoritos siguen siendo efectivos (pueden surgir como preferencia)', () => {
    const input = [model('a', 0.9, 'coffee', 0.5), model('b', 0.55, 'coffee', 0.5)];
    const { decision } = decide(input, null, prefs({ placeSignals: { b: { favorite: true } } }));
    const chosen = [decision.primary?.placeId, ...decision.alternatives.map((x) => x.placeId)];
    expect(chosen).toContain('b');
    expect(decision.alternatives.some((x) => x.role === 'BEST_PREFERENCE_FIT')).toBe(true);
  });

  it('(59/60) confianza, score y multiplicadores del modelo se preservan intactos', () => {
    const input = [model('a', 0.6, 'coffee')];
    const { models, decision } = decide(input, intentOf('COFFEE'));
    expect(models[0].today.model.confidence).toBe('medium');
    expect(models[0].today.model.scoreTotal).toBe(0.6);
    expect(decision.primary?.finalScore).toBe(models[0].finalScore);
  });

  it('(61/63) buildDecisionSet es puro: no muta los modelos rankeados de entrada', () => {
    const input = [model('a', 0.6, 'coffee', 2), model('b', 0.8, 'coffee', 0.5)];
    const models = buildIntentTodayModels(input, NO_PLACES, CTX, prefs(), null, 5).models;
    const snapshot = JSON.stringify(models);
    buildDecisionSet({ rankedModels: models, placesById: NO_PLACES, activeIntent: null });
    expect(JSON.stringify(models)).toBe(snapshot);
  });

  it('(62) el conjunto comparable es exactamente primario + alternativas', () => {
    const input = [model('a', 0.9, 'coffee', 3), model('b', 0.6, 'coffee', 0.5), model('c', 0.55, 'store', 0.4)];
    const { decision } = decide(input, null);
    const compareOptions = [decision.primary, ...decision.alternatives].filter(Boolean);
    expect(compareOptions).toHaveLength(1 + decision.alternatives.length);
    expect(decision.diagnostics.selected).toBe(compareOptions.length);
  });
});
