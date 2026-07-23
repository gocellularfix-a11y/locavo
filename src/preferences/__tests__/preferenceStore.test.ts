import {
  DEFAULT_PREFERENCE_PROFILE,
  loadPreferenceProfile,
  normalizeProfile,
  PREFERENCE_STORAGE_KEY,
  recordPreferenceAction,
  resetPreferenceProfile,
  savePreferenceProfile,
  type KeyValueStore,
} from '../index';

function memStore(initial?: string): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(PREFERENCE_STORAGE_KEY, initial);
  return {
    map,
    async getItem(key) {
      return map.get(key) ?? null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
}

const throwStore: KeyValueStore = {
  getItem: async () => {
    throw new Error('storage down');
  },
  setItem: async () => {
    throw new Error('storage down');
  },
  removeItem: async () => {
    throw new Error('storage down');
  },
};

describe('preferenceStore (local-only)', () => {
  it('almacenamiento vacío → perfil por defecto', async () => {
    expect(await loadPreferenceProfile(memStore())).toEqual(DEFAULT_PREFERENCE_PROFILE);
  });

  it('guardar y cargar (roundtrip)', async () => {
    const store = memStore();
    await savePreferenceProfile(normalizeProfile({ schemaVersion: 1, favoriteCategories: ['food'] }), store);
    const loaded = await loadPreferenceProfile(store);
    expect(loaded.favoriteCategories).toEqual(['food']);
  });

  it('datos persistidos dañados → defaults (sin crash)', async () => {
    expect(await loadPreferenceProfile(memStore('{not json'))).toEqual(DEFAULT_PREFERENCE_PROFILE);
  });

  it('esquema persistido desconocido → defaults', async () => {
    expect(await loadPreferenceProfile(memStore(JSON.stringify({ schemaVersion: 9, favoriteCategories: ['food'] })))).toEqual(DEFAULT_PREFERENCE_PROFILE);
  });

  it('reset limpia el almacenamiento y devuelve defaults', async () => {
    const store = memStore(JSON.stringify({ schemaVersion: 1, favoriteCategories: ['food'] }));
    const result = await resetPreferenceProfile(store);
    expect(result).toEqual(DEFAULT_PREFERENCE_PROFILE);
    expect(store.map.has(PREFERENCE_STORAGE_KEY)).toBe(false);
  });

  it('fallo de almacenamiento degrada seguro (sin red, sin throw)', async () => {
    expect(await loadPreferenceProfile(throwStore)).toEqual(DEFAULT_PREFERENCE_PROFILE);
    const saved = await savePreferenceProfile(normalizeProfile({ schemaVersion: 1, prefersOpenNow: true }), throwStore);
    expect(saved.prefersOpenNow).toBe(true);
  });

  it('recordPreferenceAction aplica y persiste', async () => {
    const store = memStore();
    await recordPreferenceAction({ type: 'FAVORITE_PLACE', placeId: 'p1' }, '2026-07-22T00:00:00.000Z', store);
    const loaded = await loadPreferenceProfile(store);
    expect(loaded.placeSignals.p1.favorite).toBe(true);
  });

  it('save no muta la entrada', async () => {
    const profile = normalizeProfile({ schemaVersion: 1, favoriteCategories: ['food'] });
    const snapshot = JSON.stringify(profile);
    await savePreferenceProfile(profile, memStore());
    expect(JSON.stringify(profile)).toBe(snapshot);
  });
});
