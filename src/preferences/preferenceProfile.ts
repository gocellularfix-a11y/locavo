/**
 * Modelo de PREFERENCIAS de usuario (V5.4) — privado, local, versionado.
 *
 * No guarda registros de lugar completos: solo ids canónicos + señales acotadas.
 * Sin cadenas de UI, sin timestamps generados dentro de funciones puras de
 * scoring. Normalización determinista y recuperación segura ante datos dañados.
 */
import { isCategoryId } from '../domain/categories';
import type { CategoryId } from '../domain/place';

export const PREFERENCE_SCHEMA_VERSION = 1 as const;

/** Topes duros (privacidad/estabilidad): los contadores nunca crecen sin límite. */
export const DETAIL_OPEN_CAP = 5;
export const DIRECTIONS_CAP = 5;
/** Máximo de lugares con señales persistidas (crecimiento acotado). */
export const MAX_PLACE_SIGNALS = 500;
export const MIN_DISTANCE_KM = 0.1;
export const MAX_DISTANCE_KM = 50;

export interface PlacePreferenceSignal {
  favorite?: boolean;
  hidden?: boolean;
  detailOpenCount?: number;
  directionsCount?: number;
  /** Para uso futuro; NO afecta el scoring en V5.4. */
  lastMeaningfulInteractionAt?: string;
}

export interface UserPreferenceProfile {
  schemaVersion: typeof PREFERENCE_SCHEMA_VERSION;
  favoriteCategories: CategoryId[];
  reducedCategories: CategoryId[];
  preferredMaximumDistanceKm?: number;
  prefersOpenNow?: boolean;
  prefersAccessible?: boolean;
  prefersFamilyFriendly?: boolean;
  prefersParking?: boolean;
  placeSignals: Record<string, PlacePreferenceSignal>;
}

export const DEFAULT_PREFERENCE_PROFILE: UserPreferenceProfile = {
  schemaVersion: PREFERENCE_SCHEMA_VERSION,
  favoriteCategories: [],
  reducedCategories: [],
  placeSignals: {},
};

function cloneDefault(): UserPreferenceProfile {
  return { schemaVersion: PREFERENCE_SCHEMA_VERSION, favoriteCategories: [], reducedCategories: [], placeSignals: {} };
}

function normalizeCategoryList(value: unknown): CategoryId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const set = new Set<CategoryId>();
  for (const item of value) {
    if (typeof item === 'string' && isCategoryId(item)) {
      set.add(item);
    }
  }
  return [...set].sort();
}

function clampDistance(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(MAX_DISTANCE_KM, Math.max(MIN_DISTANCE_KM, value));
}

function boolOrUndef(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeCount(value: unknown, cap: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.min(cap, Math.floor(value));
}

function normalizeSignal(raw: unknown): PlacePreferenceSignal | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const signal: PlacePreferenceSignal = {};
  if (r.favorite === true) signal.favorite = true;
  if (r.hidden === true) signal.hidden = true;
  const detail = normalizeCount(r.detailOpenCount, DETAIL_OPEN_CAP);
  if (detail !== undefined) signal.detailOpenCount = detail;
  const directions = normalizeCount(r.directionsCount, DIRECTIONS_CAP);
  if (directions !== undefined) signal.directionsCount = directions;
  if (typeof r.lastMeaningfulInteractionAt === 'string') {
    signal.lastMeaningfulInteractionAt = r.lastMeaningfulInteractionAt;
  }
  // Una señal sin contenido significativo se descarta.
  return Object.keys(signal).length > 0 ? signal : null;
}

function isValidPlaceId(id: string): boolean {
  return id.length > 0 && id.length <= 128;
}

/**
 * Normaliza cualquier entrada (incluida almacenamiento dañado o de esquema
 * desconocido) a un perfil canónico. NUNCA lanza; esquema desconocido →
 * perfil por defecto.
 */
export function normalizeProfile(raw: unknown): UserPreferenceProfile {
  if (typeof raw !== 'object' || raw === null) {
    return cloneDefault();
  }
  const r = raw as Record<string, unknown>;
  if (r.schemaVersion !== PREFERENCE_SCHEMA_VERSION) {
    return cloneDefault();
  }

  const profile: UserPreferenceProfile = {
    schemaVersion: PREFERENCE_SCHEMA_VERSION,
    favoriteCategories: normalizeCategoryList(r.favoriteCategories),
    reducedCategories: normalizeCategoryList(r.reducedCategories),
    placeSignals: {},
  };

  // Una categoría no puede ser favorita y reducida a la vez: favorita gana.
  if (profile.favoriteCategories.length > 0) {
    const favs = new Set(profile.favoriteCategories);
    profile.reducedCategories = profile.reducedCategories.filter((c) => !favs.has(c));
  }

  const distance = clampDistance(r.preferredMaximumDistanceKm);
  if (distance !== undefined) profile.preferredMaximumDistanceKm = distance;
  const openNow = boolOrUndef(r.prefersOpenNow);
  if (openNow !== undefined) profile.prefersOpenNow = openNow;
  const accessible = boolOrUndef(r.prefersAccessible);
  if (accessible !== undefined) profile.prefersAccessible = accessible;
  const family = boolOrUndef(r.prefersFamilyFriendly);
  if (family !== undefined) profile.prefersFamilyFriendly = family;
  const parking = boolOrUndef(r.prefersParking);
  if (parking !== undefined) profile.prefersParking = parking;

  if (typeof r.placeSignals === 'object' && r.placeSignals !== null) {
    const entries = Object.entries(r.placeSignals as Record<string, unknown>)
      .filter(([id]) => isValidPlaceId(id))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .slice(0, MAX_PLACE_SIGNALS);
    for (const [id, rawSignal] of entries) {
      const signal = normalizeSignal(rawSignal);
      if (signal) {
        profile.placeSignals[id] = signal;
      }
    }
  }

  return profile;
}

/** Serialización determinista: categorías ordenadas + claves de señales ordenadas. */
export function serializeProfile(profile: UserPreferenceProfile): string {
  const normalized = normalizeProfile(profile);
  const orderedSignals: Record<string, PlacePreferenceSignal> = {};
  for (const id of Object.keys(normalized.placeSignals).sort()) {
    orderedSignals[id] = normalized.placeSignals[id];
  }
  return JSON.stringify({ ...normalized, placeSignals: orderedSignals });
}
