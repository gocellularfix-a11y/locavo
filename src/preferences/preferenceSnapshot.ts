/**
 * Snapshot de evaluación de preferencias (V5.4) — puro y determinista.
 *
 * Convierte el perfil almacenado (posiblemente crudo) en conjuntos normalizados
 * para consulta O(1). No muta el perfil. La capa de ajuste consume el snapshot,
 * nunca el almacenamiento crudo.
 */
import type { CategoryId } from '../domain/place';
import { normalizeProfile, type UserPreferenceProfile } from './preferenceProfile';

export interface PreferenceSnapshot {
  schemaVersion: number;
  favoriteCategories: ReadonlySet<CategoryId>;
  reducedCategories: ReadonlySet<CategoryId>;
  favoritePlaceIds: ReadonlySet<string>;
  hiddenPlaceIds: ReadonlySet<string>;
  directionsPlaceIds: ReadonlySet<string>;
  detailedPlaceIds: ReadonlySet<string>;
  preferredMaxDistanceKm: number | null;
  prefersOpenNow: boolean;
  prefersAccessible: boolean;
  prefersFamilyFriendly: boolean;
  prefersParking: boolean;
}

export function buildPreferenceSnapshot(profile: UserPreferenceProfile): PreferenceSnapshot {
  const p = normalizeProfile(profile);
  const favoritePlaceIds = new Set<string>();
  const hiddenPlaceIds = new Set<string>();
  const directionsPlaceIds = new Set<string>();
  const detailedPlaceIds = new Set<string>();

  for (const [id, signal] of Object.entries(p.placeSignals)) {
    if (signal.favorite) favoritePlaceIds.add(id);
    if (signal.hidden) hiddenPlaceIds.add(id);
    if ((signal.directionsCount ?? 0) > 0) directionsPlaceIds.add(id);
    if ((signal.detailOpenCount ?? 0) > 0) detailedPlaceIds.add(id);
  }

  return {
    schemaVersion: p.schemaVersion,
    favoriteCategories: new Set(p.favoriteCategories),
    reducedCategories: new Set(p.reducedCategories),
    favoritePlaceIds,
    hiddenPlaceIds,
    directionsPlaceIds,
    detailedPlaceIds,
    preferredMaxDistanceKm: p.preferredMaximumDistanceKm ?? null,
    prefersOpenNow: p.prefersOpenNow === true,
    prefersAccessible: p.prefersAccessible === true,
    prefersFamilyFriendly: p.prefersFamilyFriendly === true,
    prefersParking: p.prefersParking === true,
  };
}
