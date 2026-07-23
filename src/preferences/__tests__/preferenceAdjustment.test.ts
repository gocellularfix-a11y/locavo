import {
  buildPreferenceSnapshot,
  evaluatePreferenceAdjustment,
  MAX_MULT,
  MIN_MULT,
  normalizeProfile,
  type PreferenceCandidateEvidence,
  type UserPreferenceProfile,
} from '../index';

const snap = (partial: Partial<UserPreferenceProfile>) =>
  buildPreferenceSnapshot(normalizeProfile({ schemaVersion: 1, ...partial }));

const evidence = (over: Partial<PreferenceCandidateEvidence> = {}): PreferenceCandidateEvidence => ({
  placeId: 'p1',
  category: 'food',
  openState: 'open',
  distanceKm: 1,
  ...over,
});

describe('evaluatePreferenceAdjustment', () => {
  it('perfil vacío → sin efecto (multiplier 1, additiveBoost 0)', () => {
    const a = evaluatePreferenceAdjustment(evidence(), snap({}));
    expect(a.multiplier).toBe(1);
    expect(a.additiveBoost).toBe(0);
    expect(a.reasonCodes).toEqual([]);
  });

  it('lugar favorito → beneficio con razón', () => {
    const a = evaluatePreferenceAdjustment(evidence(), snap({ placeSignals: { p1: { favorite: true } } }));
    expect(a.multiplier).toBeGreaterThan(1);
    expect(a.reasonCodes).toContain('PREF_FAVORITE_PLACE');
  });

  it('lugar oculto → exclusión', () => {
    const a = evaluatePreferenceAdjustment(evidence(), snap({ placeSignals: { p1: { hidden: true } } }));
    expect(a.exclusion).toBe('PREF_PLACE_HIDDEN');
  });

  it('categoría favorita sube; categoría reducida baja (sin razón positiva)', () => {
    expect(evaluatePreferenceAdjustment(evidence(), snap({ favoriteCategories: ['food'] })).reasonCodes).toContain('PREF_FAVORITE_CATEGORY');
    const reduced = evaluatePreferenceAdjustment(evidence(), snap({ reducedCategories: ['food'] }));
    expect(reduced.multiplier).toBeLessThan(1);
    expect(reduced.reasonCodes).toEqual([]);
  });

  it('coincidencias de soporte (accesibilidad/familia/parking/abierto/distancia)', () => {
    expect(evaluatePreferenceAdjustment(evidence({ accessible: true }), snap({ prefersAccessible: true })).reasonCodes).toContain('PREF_ACCESSIBILITY_MATCH');
    expect(evaluatePreferenceAdjustment(evidence({ family: true }), snap({ prefersFamilyFriendly: true })).reasonCodes).toContain('PREF_FAMILY_MATCH');
    expect(evaluatePreferenceAdjustment(evidence({ parking: true }), snap({ prefersParking: true })).reasonCodes).toContain('PREF_PARKING_MATCH');
    expect(evaluatePreferenceAdjustment(evidence({ openState: 'open' }), snap({ prefersOpenNow: true })).reasonCodes).toContain('PREF_OPEN_NOW_MATCH');
    expect(evaluatePreferenceAdjustment(evidence({ distanceKm: 2 }), snap({ preferredMaximumDistanceKm: 3 })).reasonCodes).toContain('PREF_DISTANCE_MATCH');
  });

  it('evidencia desconocida no coincide', () => {
    const a = evaluatePreferenceAdjustment(evidence({ accessible: undefined }), snap({ prefersAccessible: true }));
    expect(a.reasonCodes).not.toContain('PREF_ACCESSIBILITY_MATCH');
  });

  it('señal de direcciones (interacción) más débil que la explícita', () => {
    const directions = evaluatePreferenceAdjustment(evidence(), snap({ placeSignals: { p1: { directionsCount: 3 } } }));
    const favorite = evaluatePreferenceAdjustment(evidence(), snap({ placeSignals: { p1: { favorite: true } } }));
    expect(directions.reasonCodes).toContain('PREF_PREVIOUS_DIRECTIONS');
    expect(directions.interactionSignals).toBe(1);
    expect(directions.multiplier).toBeLessThan(favorite.multiplier);
  });

  it('detalle abierto: señal de interacción sin código de razón', () => {
    const a = evaluatePreferenceAdjustment(evidence(), snap({ placeSignals: { p1: { detailOpenCount: 5 } } }));
    expect(a.interactionSignals).toBe(1);
    expect(a.reasonCodes).toEqual([]);
    expect(a.multiplier).toBeGreaterThan(1);
  });

  it('acotado a [MIN_MULT, MAX_MULT]; muchos positivos → tope con capped', () => {
    const a = evaluatePreferenceAdjustment(evidence({ accessible: true, family: true, parking: true, distanceKm: 1 }),
      snap({ placeSignals: { p1: { favorite: true } }, favoriteCategories: ['food'], prefersAccessible: true, prefersFamilyFriendly: true, prefersParking: true, prefersOpenNow: true, preferredMaximumDistanceKm: 3 }));
    expect(a.multiplier).toBeLessThanOrEqual(MAX_MULT);
    expect(a.multiplier).toBeGreaterThanOrEqual(MIN_MULT);
    expect(a.capped).toBe(true);
  });

  it('determinista: independiente del orden de entrada de las señales', () => {
    const s = snap({ favoriteCategories: ['food'], placeSignals: { p1: { favorite: true, directionsCount: 2 } } });
    expect(evaluatePreferenceAdjustment(evidence(), s)).toEqual(evaluatePreferenceAdjustment(evidence(), s));
  });
});
