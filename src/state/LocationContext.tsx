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
  MANUAL_LOCATIONS,
  readCurrentLocation,
  type ManualLocation,
} from '../services/location';

/**
 * Estado global mínimo de ubicación.
 *
 * Siempre hay coordenadas utilizables: si no hay permiso o falla el GPS,
 * se usa la ubicación manual (demo) seleccionada, por defecto el Centro
 * de Culiacán. Solo se guarda en el dispositivo el id de la zona manual.
 */

export type LocationSource = 'gps' | 'manual';
export type LocationRequestState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

export interface LocationState {
  coords: Coordinates;
  source: LocationSource;
  label: string;
  requestState: LocationRequestState;
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

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((storedId) => {
        const found = MANUAL_LOCATIONS.find((l) => l.id === storedId);
        if (!cancelled && found) {
          setManualState(found);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const useCurrentLocation = useCallback(async () => {
    setRequestState('requesting');
    const result = await readCurrentLocation();
    if (result.permission === 'granted' && result.coords) {
      setGpsCoords(result.coords);
      setRequestState('granted');
    } else {
      setGpsCoords(null);
      setRequestState(result.permission === 'denied' ? 'denied' : 'unavailable');
    }
  }, []);

  const setManualLocation = useCallback((location: ManualLocation) => {
    setManualState(location);
    setGpsCoords(null);
    setRequestState('idle');
    AsyncStorage.setItem(STORAGE_KEY, location.id).catch(() => undefined);
  }, []);

  const value = useMemo<LocationState>(() => {
    const usingGps = gpsCoords !== null;
    return {
      coords: usingGps ? gpsCoords : manualLocation.coords,
      source: usingGps ? 'gps' : 'manual',
      label: usingGps ? 'Tu ubicación actual' : manualLocation.label,
      requestState,
      manualLocation,
      useCurrentLocation,
      setManualLocation,
    };
  }, [gpsCoords, manualLocation, requestState, useCurrentLocation, setManualLocation]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationState(): LocationState {
  const state = useContext(LocationContext);
  if (!state) {
    throw new Error('useLocationState debe usarse dentro de LocationProvider');
  }
  return state;
}
