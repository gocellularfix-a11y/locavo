/**
 * Acciones de preferencia (V5.4): mutaciones estructuradas y deterministas.
 *
 * El reductor es PURO. Los timestamps de interacción se pasan como argumento
 * (`at`), nunca se leen del reloj dentro del reductor. Ids malformados → no-op.
 * Los contadores están acotados. Explícito y reproducible.
 */
import type { CategoryId } from '../domain/place';
import {
  DETAIL_OPEN_CAP,
  DIRECTIONS_CAP,
  normalizeProfile,
  type PlacePreferenceSignal,
  type UserPreferenceProfile,
} from './preferenceProfile';

export type PreferenceAction =
  | { type: 'FAVORITE_PLACE'; placeId: string }
  | { type: 'UNFAVORITE_PLACE'; placeId: string }
  | { type: 'HIDE_PLACE'; placeId: string }
  | { type: 'UNHIDE_PLACE'; placeId: string }
  | { type: 'OPEN_PLACE_DETAILS'; placeId: string }
  | { type: 'REQUEST_DIRECTIONS'; placeId: string }
  | { type: 'SET_FAVORITE_CATEGORY'; categoryId: CategoryId; enabled: boolean }
  | { type: 'SET_REDUCED_CATEGORY'; categoryId: CategoryId; enabled: boolean }
  | { type: 'SET_DISTANCE_PREFERENCE'; kilometers: number | null }
  | { type: 'SET_ACCESSIBILITY_PREFERENCE'; enabled: boolean }
  | { type: 'SET_FAMILY_PREFERENCE'; enabled: boolean }
  | { type: 'SET_PARKING_PREFERENCE'; enabled: boolean }
  | { type: 'SET_OPEN_NOW_PREFERENCE'; enabled: boolean };

function validPlaceId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 128;
}

function updateSignal(
  profile: UserPreferenceProfile,
  placeId: string,
  update: (signal: PlacePreferenceSignal) => PlacePreferenceSignal,
  at?: string,
): void {
  const current = profile.placeSignals[placeId] ?? {};
  const next = update({ ...current });
  if (at) {
    next.lastMeaningfulInteractionAt = at;
  }
  if (Object.keys(next).length === 0) {
    delete profile.placeSignals[placeId];
  } else {
    profile.placeSignals[placeId] = next;
  }
}

function toggleCategory(list: CategoryId[], category: CategoryId, enabled: boolean): CategoryId[] {
  const set = new Set(list);
  if (enabled) {
    set.add(category);
  } else {
    set.delete(category);
  }
  return [...set];
}

/**
 * Aplica una acción y devuelve un perfil normalizado nuevo (no muta la entrada).
 */
export function reducePreference(
  profile: UserPreferenceProfile,
  action: PreferenceAction,
  at?: string,
): UserPreferenceProfile {
  const next = normalizeProfile(profile);

  switch (action.type) {
    case 'FAVORITE_PLACE':
      if (!validPlaceId(action.placeId)) break;
      updateSignal(next, action.placeId, (s) => {
        delete s.hidden;
        return { ...s, favorite: true };
      }, at);
      break;
    case 'UNFAVORITE_PLACE':
      if (!validPlaceId(action.placeId)) break;
      updateSignal(next, action.placeId, (s) => {
        delete s.favorite;
        return s;
      });
      break;
    case 'HIDE_PLACE':
      if (!validPlaceId(action.placeId)) break;
      updateSignal(next, action.placeId, (s) => {
        delete s.favorite;
        return { ...s, hidden: true };
      }, at);
      break;
    case 'UNHIDE_PLACE':
      if (!validPlaceId(action.placeId)) break;
      updateSignal(next, action.placeId, (s) => {
        delete s.hidden;
        return s;
      });
      break;
    case 'OPEN_PLACE_DETAILS':
      if (!validPlaceId(action.placeId)) break;
      updateSignal(next, action.placeId, (s) => ({
        ...s,
        detailOpenCount: Math.min(DETAIL_OPEN_CAP, (s.detailOpenCount ?? 0) + 1),
      }), at);
      break;
    case 'REQUEST_DIRECTIONS':
      if (!validPlaceId(action.placeId)) break;
      updateSignal(next, action.placeId, (s) => ({
        ...s,
        directionsCount: Math.min(DIRECTIONS_CAP, (s.directionsCount ?? 0) + 1),
      }), at);
      break;
    case 'SET_FAVORITE_CATEGORY':
      next.favoriteCategories = toggleCategory(next.favoriteCategories, action.categoryId, action.enabled);
      if (action.enabled) {
        next.reducedCategories = next.reducedCategories.filter((c) => c !== action.categoryId);
      }
      break;
    case 'SET_REDUCED_CATEGORY':
      next.reducedCategories = toggleCategory(next.reducedCategories, action.categoryId, action.enabled);
      if (action.enabled) {
        next.favoriteCategories = next.favoriteCategories.filter((c) => c !== action.categoryId);
      }
      break;
    case 'SET_DISTANCE_PREFERENCE':
      if (action.kilometers === null) {
        delete next.preferredMaximumDistanceKm;
      } else {
        next.preferredMaximumDistanceKm = action.kilometers;
      }
      break;
    case 'SET_ACCESSIBILITY_PREFERENCE':
      next.prefersAccessible = action.enabled;
      break;
    case 'SET_FAMILY_PREFERENCE':
      next.prefersFamilyFriendly = action.enabled;
      break;
    case 'SET_PARKING_PREFERENCE':
      next.prefersParking = action.enabled;
      break;
    case 'SET_OPEN_NOW_PREFERENCE':
      next.prefersOpenNow = action.enabled;
      break;
  }

  return normalizeProfile(next);
}
