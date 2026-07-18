import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { Coordinates } from '../domain/place';
import {
  DEFAULT_MANUAL_LOCATION,
  readCurrentLocation,
  resolveManualLocation,
  type LocationFailureReason,
  type ManualLocation,
} from '../services/location';

/**
 * Estado global mínimo de ubicación.
 *
 * Siempre hay coordenadas utilizables: si no hay permiso o falla el GPS,
 * se usa la ubicación manual (demo) seleccionada, por defecto el Centro
 * de Culiacán. Solo se persiste el id de la zona manual; nunca coordenadas
 * del usuario.
 */

export type LocationSource = 'gps' | 'manual';
export type LocationRequestState = 'idle' | 'requesting' | 'granted' | 'failed';

export interface LocationState {
  coords: Coordinates;
  source: LocationSource;
  requestState: LocationRequestState;
  /** Motivo de la última falla (solo cuando requestState === 'failed'). */
  failureReason: LocationFailureReason | null;
  manualLocation: ManualLocation;
  useCurrentLocation: () => Promise<void>;
  setManualLocation: (location: ManualLocation) => void;
}

const STORAGE_KEY = 'locavo.manualLocation.v1';

const LocationContext = createContext<LocationState | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [manualLocation, setManualState] = useState<ManualLocation>(DEFAULT_MANUAL_LOCATION);
  const [gpsCoords, setGpsCoords] = useState<Coordinates | null>(null);
  const [requestState, setRequestState] = useState<LocationRequestState>('idle');
  const [failureReason, setFailureReason] = useState<LocationFailureReason | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((storedId) => {
        if (!cancelled) {
          // Un id desconocido/corrupto degrada al default seguro.
          setManualState(resolveManualLocation(storedId));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const useCurrentLocation = useCallback(async () => {
    setRequestState('requesting');
    setFailureReason(null);
    const result = await readCurrentLocation();
    if (result.status === 'granted' && result.coords) {
      setGpsCoords(result.coords);
      setRequestState('granted');
      setFailureReason(null);
    } else {
      setGpsCoords(null);
      setRequestState('failed');
      setFailureReason(result.reason ?? 'error');
    }
  }, []);

  const setManualLocation = useCallback((location: ManualLocation) => {
    setManualState(location);
    setGpsCoords(null);
    setRequestState('idle');
    setFailureReason(null);
    AsyncStorage.setItem(STORAGE_KEY, location.id).catch(() => undefined);
  }, []);

  const value = useMemo<LocationState>(() => {
    const usingGps = gpsCoords !== null;
    return {
      coords: usingGps ? gpsCoords : manualLocation.coords,
      source: usingGps ? 'gps' : 'manual',
      requestState,
      failureReason,
      manualLocation,
      useCurrentLocation,
      setManualLocation,
    };
  }, [gpsCoords, manualLocation, requestState, failureReason, useCurrentLocation, setManualLocation]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationState(): LocationState {
  const state = useContext(LocationContext);
  if (!state) {
    throw new Error('useLocationState debe usarse dentro de LocationProvider');
  }
  return state;
}
