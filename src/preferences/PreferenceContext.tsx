/**
 * Contexto de preferencias (V5.4): carga UNA vez, persiste en cada cambio.
 * Local-only; expone perfil, snapshot y acciones. Sin red.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { buildPreferenceSnapshot, type PreferenceSnapshot } from './preferenceSnapshot';
import { reducePreference, type PreferenceAction } from './preferenceActions';
import { normalizeProfile, DEFAULT_PREFERENCE_PROFILE, type UserPreferenceProfile } from './preferenceProfile';
import {
  loadPreferenceProfile,
  resetPreferenceProfile,
  savePreferenceProfile,
} from './preferenceStore';

export interface PreferenceContextValue {
  profile: UserPreferenceProfile;
  snapshot: PreferenceSnapshot;
  dispatch: (action: PreferenceAction) => void;
  reset: () => void;
}

const PreferenceContext = createContext<PreferenceContextValue | null>(null);

export function PreferenceProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserPreferenceProfile>(() =>
    normalizeProfile(DEFAULT_PREFERENCE_PROFILE),
  );

  useEffect(() => {
    let cancelled = false;
    loadPreferenceProfile()
      .then((loaded) => {
        if (!cancelled) {
          setProfile(loaded);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const dispatch = useCallback((action: PreferenceAction) => {
    setProfile((prev) => {
      const next = reducePreference(prev, action, new Date().toISOString());
      void savePreferenceProfile(next).catch(() => undefined);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setProfile(normalizeProfile(DEFAULT_PREFERENCE_PROFILE));
    void resetPreferenceProfile().catch(() => undefined);
  }, []);

  const snapshot = useMemo(() => buildPreferenceSnapshot(profile), [profile]);
  const value = useMemo<PreferenceContextValue>(
    () => ({ profile, snapshot, dispatch, reset }),
    [profile, snapshot, dispatch, reset],
  );

  return <PreferenceContext.Provider value={value}>{children}</PreferenceContext.Provider>;
}

export function usePreferences(): PreferenceContextValue {
  const value = useContext(PreferenceContext);
  if (!value) {
    throw new Error('usePreferences debe usarse dentro de PreferenceProvider');
  }
  return value;
}
