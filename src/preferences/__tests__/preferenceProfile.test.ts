import {
  DEFAULT_PREFERENCE_PROFILE,
  DETAIL_OPEN_CAP,
  MAX_DISTANCE_KM,
  MIN_DISTANCE_KM,
  normalizeProfile,
  serializeProfile,
} from '../preferenceProfile';

describe('normalizeProfile', () => {
  it('entrada nula/indefinida → perfil por defecto', () => {
    expect(normalizeProfile(undefined)).toEqual(DEFAULT_PREFERENCE_PROFILE);
    expect(normalizeProfile('garbage')).toEqual(DEFAULT_PREFERENCE_PROFILE);
  });

  it('esquema desconocido → perfil por defecto', () => {
    expect(normalizeProfile({ schemaVersion: 2, favoriteCategories: ['food'] })).toEqual(DEFAULT_PREFERENCE_PROFILE);
  });

  it('dedup + orden + descarte de categorías inválidas', () => {
    const p = normalizeProfile({ schemaVersion: 1, favoriteCategories: ['food', 'food', 'xyz', 'coffee'] });
    expect(p.favoriteCategories).toEqual(['coffee', 'food']);
  });

  it('favorita gana sobre reducida en conflicto', () => {
    const p = normalizeProfile({ schemaVersion: 1, favoriteCategories: ['food'], reducedCategories: ['food', 'beer'] });
    expect(p.favoriteCategories).toContain('food');
    expect(p.reducedCategories).toEqual(['beer']);
  });

  it('clampa distancia; NaN → undefined', () => {
    expect(normalizeProfile({ schemaVersion: 1, preferredMaximumDistanceKm: 1000 }).preferredMaximumDistanceKm).toBe(MAX_DISTANCE_KM);
    expect(normalizeProfile({ schemaVersion: 1, preferredMaximumDistanceKm: 0.001 }).preferredMaximumDistanceKm).toBe(MIN_DISTANCE_KM);
    expect(normalizeProfile({ schemaVersion: 1, preferredMaximumDistanceKm: Number.NaN }).preferredMaximumDistanceKm).toBeUndefined();
  });

  it('acota contadores y descarta señales malformadas/vacías', () => {
    const p = normalizeProfile({
      schemaVersion: 1,
      placeSignals: { a: { detailOpenCount: 999, directionsCount: -5 }, '': { favorite: true }, b: {} },
    });
    expect(p.placeSignals.a.detailOpenCount).toBe(DETAIL_OPEN_CAP);
    expect(p.placeSignals.a.directionsCount).toBeUndefined();
    expect(p.placeSignals['']).toBeUndefined();
    expect(p.placeSignals.b).toBeUndefined();
  });

  it('no muta la entrada', () => {
    const raw = { schemaVersion: 1, favoriteCategories: ['food', 'food'] };
    const snapshot = JSON.stringify(raw);
    normalizeProfile(raw);
    expect(JSON.stringify(raw)).toBe(snapshot);
  });
});

describe('serializeProfile', () => {
  it('serialización estable independiente del orden de claves', () => {
    const a = serializeProfile({ schemaVersion: 1, favoriteCategories: ['food', 'coffee'], reducedCategories: [], placeSignals: { b: { favorite: true }, a: { hidden: true } } });
    const b = serializeProfile({ schemaVersion: 1, favoriteCategories: ['coffee', 'food'], reducedCategories: [], placeSignals: { a: { hidden: true }, b: { favorite: true } } });
    expect(a).toBe(b);
  });
});
