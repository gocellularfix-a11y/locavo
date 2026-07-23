import { reducePreference, type PreferenceAction } from '../preferenceActions';
import { DEFAULT_PREFERENCE_PROFILE, DIRECTIONS_CAP, normalizeProfile } from '../preferenceProfile';

const base = () => normalizeProfile(DEFAULT_PREFERENCE_PROFILE);
const apply = (actions: PreferenceAction[]) => actions.reduce((p, a) => reducePreference(p, a), base());

describe('reducePreference', () => {
  it('favorite / unfavorite', () => {
    const fav = reducePreference(base(), { type: 'FAVORITE_PLACE', placeId: 'p1' });
    expect(fav.placeSignals.p1.favorite).toBe(true);
    const un = reducePreference(fav, { type: 'UNFAVORITE_PLACE', placeId: 'p1' });
    expect(un.placeSignals.p1).toBeUndefined();
  });

  it('hide / unhide, y favorite limpia hidden', () => {
    const hidden = reducePreference(base(), { type: 'HIDE_PLACE', placeId: 'p1' });
    expect(hidden.placeSignals.p1.hidden).toBe(true);
    const fav = reducePreference(hidden, { type: 'FAVORITE_PLACE', placeId: 'p1' });
    expect(fav.placeSignals.p1.hidden).toBeUndefined();
    expect(fav.placeSignals.p1.favorite).toBe(true);
  });

  it('acciones idempotentes (favorite repetido)', () => {
    const a = apply([{ type: 'FAVORITE_PLACE', placeId: 'p1' }, { type: 'FAVORITE_PLACE', placeId: 'p1' }]);
    expect(a.placeSignals.p1).toEqual({ favorite: true });
  });

  it('categorías: enable/disable y exclusión mutua', () => {
    const fav = reducePreference(base(), { type: 'SET_FAVORITE_CATEGORY', categoryId: 'food', enabled: true });
    expect(fav.favoriteCategories).toEqual(['food']);
    const both = reducePreference(fav, { type: 'SET_REDUCED_CATEGORY', categoryId: 'food', enabled: true });
    expect(both.reducedCategories).toContain('food');
    expect(both.favoriteCategories).not.toContain('food');
  });

  it('distancia: set y clear', () => {
    const set = reducePreference(base(), { type: 'SET_DISTANCE_PREFERENCE', kilometers: 3 });
    expect(set.preferredMaximumDistanceKm).toBe(3);
    const clear = reducePreference(set, { type: 'SET_DISTANCE_PREFERENCE', kilometers: null });
    expect(clear.preferredMaximumDistanceKm).toBeUndefined();
  });

  it('contador de direcciones acotado', () => {
    let p = base();
    for (let i = 0; i < 20; i++) p = reducePreference(p, { type: 'REQUEST_DIRECTIONS', placeId: 'p1' });
    expect(p.placeSignals.p1.directionsCount).toBe(DIRECTIONS_CAP);
  });

  it('id malformado → no-op', () => {
    const p = reducePreference(base(), { type: 'FAVORITE_PLACE', placeId: '' });
    expect(p).toEqual(base());
  });

  it('replay determinista', () => {
    const actions: PreferenceAction[] = [
      { type: 'FAVORITE_PLACE', placeId: 'a' },
      { type: 'SET_FAVORITE_CATEGORY', categoryId: 'coffee', enabled: true },
      { type: 'OPEN_PLACE_DETAILS', placeId: 'b' },
    ];
    expect(JSON.stringify(apply(actions))).toBe(JSON.stringify(apply(actions)));
  });
});
