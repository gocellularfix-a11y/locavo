import { routeSearch } from '../routeSearch';
import { DECISION_CONFIDENCE_THRESHOLD } from '../types';

describe('routeSearch — decision routing', () => {
  it('routes a known category-intent to the Decision Engine with its category', () => {
    const r = routeSearch("I'm hungry", 'en');
    expect(r.kind).toBe('decision');
    if (r.kind === 'decision') {
      expect(r.category).toBe('food');
      expect(r.intent).toBe('FOOD');
      expect(r.detection.confidence).toBeGreaterThanOrEqual(DECISION_CONFIDENCE_THRESHOLD);
    }
  });

  const decisions: [string, string][] = [
    ['need gas', 'gas'],
    ['coffee', 'coffee'],
    ['hotel', 'lodging'],
    ['farmacia', 'pharmacy'],
    ['cerveza', 'beer'],
    ['supermercado', 'store'],
  ];
  it.each(decisions)('%s → decision:%s', (text, category) => {
    const r = routeSearch(text);
    expect(r.kind).toBe('decision');
    if (r.kind === 'decision') {
      expect(r.category).toBe(category);
    }
  });
});

describe('routeSearch — universal search fallback (never blocks)', () => {
  it('routes an unknown query to universal search, preserving the text', () => {
    const r = routeSearch('tacos');
    expect(r.kind).toBe('search');
    if (r.kind === 'search') {
      expect(r.text).toBe('tacos');
      expect(r.detection.intent).toBeNull();
    }
  });

  it('routes a recognized intent WITHOUT a Locavo category to universal search', () => {
    // ATM/HOSPITAL/PARKING are valid intents but Locavo has no such category.
    for (const text of ['atm', 'hospital', 'parking', 'airport', 'bank']) {
      const r = routeSearch(text, 'en');
      expect(r.kind).toBe('search');
      if (r.kind === 'search') {
        expect(r.detection.intent).not.toBeNull();
        expect(r.detection.categories).toEqual([]);
      }
    }
  });

  it('routes brand/dish specifics to universal search where the index is precise', () => {
    for (const text of ['starbucks', 'walmart', 'sushi place downtown']) {
      expect(routeSearch(text).kind).toBe('search');
    }
  });

  it('empty input falls back to search without throwing', () => {
    const r = routeSearch('');
    expect(r.kind).toBe('search');
  });
});
