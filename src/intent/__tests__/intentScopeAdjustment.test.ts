import { evaluateIntentAdjustment, MAX_MULT, MIN_MULT } from '../intentAdjustment';
import { intentCategoryScope } from '../intentScope';
import { parseIntentText } from '../intentParser';
import { resolveIntent } from '../intentResolver';
import { buildIntentSnapshot } from '../intentSnapshot';
import type { IntentId } from '../intentModel';

const snapFromText = (input: string, locale = 'es') => {
  const r = resolveIntent(parseIntentText(input, locale));
  return r ? buildIntentSnapshot(r) : null;
};
const snapExplicit = (id: IntentId) => buildIntentSnapshot(resolveIntent(parseIntentText('', 'es'), id)!);

const ev = (over: Partial<{ category: string; openState: string; distanceKm: number | null; accessible: boolean; family: boolean }> = {}) => ({
  placeId: 'p1',
  category: (over.category ?? 'pharmacy') as never,
  openState: (over.openState ?? 'open') as 'open' | 'closed' | 'unknown',
  distanceKm: over.distanceKm ?? 0.5,
  accessible: over.accessible,
  family: over.family,
});

describe('intentCategoryScope', () => {
  it('EXACT/STRONG estrechan el alcance', () => {
    expect(intentCategoryScope(snapFromText('farmacia')!)).toEqual(['pharmacy']);
    expect(intentCategoryScope(snapFromText('coffee nearby', 'en')!)).toEqual(['coffee']);
  });
  it('PARTIAL/AMBIGUOUS → alcance amplio (undefined)', () => {
    expect(intentCategoryScope(snapFromText('café con algo raro')!)).toBeUndefined();
    expect(intentCategoryScope(snapFromText('hotel desayuno')!)).toBeUndefined();
  });
});

describe('evaluateIntentAdjustment', () => {
  it('categoría en alcance sube; fuera de alcance baja', () => {
    const s = snapExplicit('PHARMACY');
    expect(evaluateIntentAdjustment(ev({ category: 'pharmacy' }), s).multiplier).toBeGreaterThan(1);
    expect(evaluateIntentAdjustment(ev({ category: 'food' }), s).multiplier).toBeLessThan(1);
    expect(evaluateIntentAdjustment(ev({ category: 'pharmacy' }), s).reasonCodes).toContain('INTENT_PHARMACY_MATCH');
  });
  it('abierto ahora: open sube, closed baja', () => {
    const s = snapExplicit('OPEN_NOW');
    expect(evaluateIntentAdjustment(ev({ category: 'food', openState: 'open' }), s).reasonCodes).toContain('INTENT_OPEN_NOW_MATCH');
    expect(evaluateIntentAdjustment(ev({ category: 'food', openState: 'closed' }), s).multiplier).toBeLessThan(1);
  });
  it('abierto tarde / cerca / accesible / familia', () => {
    expect(evaluateIntentAdjustment(ev({ category: 'food' }), snapExplicit('OPEN_LATE')).reasonCodes).toContain('INTENT_OPEN_LATE_MATCH');
    expect(evaluateIntentAdjustment(ev({ category: 'food', distanceKm: 0.3 }), snapExplicit('NEARBY')).reasonCodes).toContain('INTENT_NEARBY_MATCH');
    expect(evaluateIntentAdjustment(ev({ category: 'food', accessible: true }), snapExplicit('ACCESSIBLE')).reasonCodes).toContain('INTENT_ACCESSIBILITY_MATCH');
    expect(evaluateIntentAdjustment(ev({ category: 'food', family: true }), snapExplicit('FAMILY_ACTIVITY')).reasonCodes).toContain('INTENT_FAMILY_MATCH');
  });
  it('acotado a [MIN_MULT, MAX_MULT]', () => {
    const a = evaluateIntentAdjustment(ev({ category: 'pharmacy', openState: 'open', distanceKm: 0.1, accessible: true }), snapExplicit('PHARMACY'));
    expect(a.multiplier).toBeGreaterThanOrEqual(MIN_MULT);
    expect(a.multiplier).toBeLessThanOrEqual(MAX_MULT);
  });
  it('determinista', () => {
    const s = snapExplicit('PHARMACY');
    expect(evaluateIntentAdjustment(ev(), s)).toEqual(evaluateIntentAdjustment(ev(), s));
  });
});
