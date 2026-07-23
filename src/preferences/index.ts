/**
 * Preferencias privadas y deterministas (V5.4) — API pública. Local-only, sin
 * cuentas, sin red, sin ML; explicable y controlada por el usuario.
 */
export {
  DEFAULT_PREFERENCE_PROFILE,
  PREFERENCE_SCHEMA_VERSION,
  DETAIL_OPEN_CAP,
  DIRECTIONS_CAP,
  MAX_PLACE_SIGNALS,
  MIN_DISTANCE_KM,
  MAX_DISTANCE_KM,
  normalizeProfile,
  serializeProfile,
  type UserPreferenceProfile,
  type PlacePreferenceSignal,
} from './preferenceProfile';
export { reducePreference, type PreferenceAction } from './preferenceActions';
export { buildPreferenceSnapshot, type PreferenceSnapshot } from './preferenceSnapshot';
export {
  evaluatePreferenceAdjustment,
  FAVORITE_PLACE_MULT,
  FAVORITE_CATEGORY_MULT,
  REDUCED_CATEGORY_MULT,
  MIN_MULT,
  MAX_MULT,
  type PreferenceAdjustment,
  type PreferenceCandidateEvidence,
  type PreferenceReasonCode,
  type PreferenceExclusionCode,
} from './preferenceAdjustment';
export {
  loadPreferenceProfile,
  savePreferenceProfile,
  resetPreferenceProfile,
  recordPreferenceAction,
  PREFERENCE_STORAGE_KEY,
  type KeyValueStore,
} from './preferenceStore';
