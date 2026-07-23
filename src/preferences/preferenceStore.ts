/**
 * Almacén LOCAL de preferencias (V5.4).
 *
 * Persistencia solo local vía `AsyncStorage` (patrón del proyecto), con un
 * adaptador clave-valor inyectable para pruebas. Normalización determinista al
 * guardar, recuperación segura ante datos dañados, sin respaldo remoto, sin
 * red. Reemplazo atómico por clave. Tamaño acotado (ver `MAX_PLACE_SIGNALS`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { reducePreference, type PreferenceAction } from './preferenceActions';
import {
  DEFAULT_PREFERENCE_PROFILE,
  normalizeProfile,
  serializeProfile,
  type UserPreferenceProfile,
} from './preferenceProfile';

export const PREFERENCE_STORAGE_KEY = 'locavo.preferences.v1';

/** Adaptador mínimo (compatible con AsyncStorage y con mocks en memoria). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const defaultStore: KeyValueStore = AsyncStorage;

export async function loadPreferenceProfile(store: KeyValueStore = defaultStore): Promise<UserPreferenceProfile> {
  try {
    const raw = await store.getItem(PREFERENCE_STORAGE_KEY);
    if (!raw) {
      return normalizeProfile(DEFAULT_PREFERENCE_PROFILE);
    }
    return normalizeProfile(JSON.parse(raw));
  } catch {
    // Datos dañados / almacenamiento ausente → defaults canónicos (sin crash).
    return normalizeProfile(DEFAULT_PREFERENCE_PROFILE);
  }
}

export async function savePreferenceProfile(
  profile: UserPreferenceProfile,
  store: KeyValueStore = defaultStore,
): Promise<UserPreferenceProfile> {
  const normalized = normalizeProfile(profile);
  try {
    await store.setItem(PREFERENCE_STORAGE_KEY, serializeProfile(normalized));
  } catch {
    // Local-only: un fallo de escritura no propaga ni cae a la nube.
  }
  return normalized;
}

export async function resetPreferenceProfile(store: KeyValueStore = defaultStore): Promise<UserPreferenceProfile> {
  try {
    await store.removeItem(PREFERENCE_STORAGE_KEY);
  } catch {
    // Ignorado: reset siempre devuelve defaults canónicos.
  }
  return normalizeProfile(DEFAULT_PREFERENCE_PROFILE);
}

export async function recordPreferenceAction(
  action: PreferenceAction,
  at?: string,
  store: KeyValueStore = defaultStore,
): Promise<UserPreferenceProfile> {
  const current = await loadPreferenceProfile(store);
  const next = reducePreference(current, action, at);
  return savePreferenceProfile(next, store);
}
