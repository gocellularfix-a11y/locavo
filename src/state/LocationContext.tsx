import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { Coordinates } from '../domain/place';
import {
  distanceOriginOf,
  resolveEffectiveLocation,
  resolveManualLocation,
  type DistanceOrigin,
  type EffectiveLocationSource,
  type ManualLocation,
} from '../services/effectiveLocation';
import { readCurrentLocation, type LocationFailureReason } from '../services/location';

/**
 * Estado global de ubicación: ÚNICA fuente de coordenadas de la app.
 *
 * Aplica la resolución canónica (`resolveEffectiveLocation`): GPS válido →
 * ubicación manual → centro de la ciudad activa. El GPS se intenta UNA vez al
 * arrancar, así un usuario con ubicación disponible obtiene distancias reales
 * sin tener que pedirlo; si se niega o falla, la cadena degrada de forma
 * honesta y el origen mostrado lo refleja (nunca se finge GPS).
 *
 * Solo se persiste el id de la zona manual; jamás coordenadas del usuario.
 */

export type LocationSource = EffectiveLocationSource;
export type LocationRequestState = 'idle' | 'requesting' | 'granted' | 'failed';

export interface LocationState {
  /** Coordenadas efectivas: el ÚNICO origen válido para distancia y ranking. */
  coords: Coordinates;
  source: LocationSource;
  /** Etiqueta de la referencia cuando no es GPS (zona manual o ciudad). */
  label?: string;
  requestState: LocationRequestState;
  /** Motivo de la última falla (solo cuando requestState === 'failed'). */
  failureReason: LocationFailureReason | null;
  /** Zona elegida por el usuario, o null si nunca eligió una. */
  manualLocation: ManualLocation | null;
  /** Relee el GPS bajo demanda (acción, no hook). */
  requestCurrentLocation: () => Promise<void>;
  setManualLocation: (location: ManualLocation) => void;
}

const STORAGE_KEY = 'locavo.manualLocation.v1';

const LocationContext = createContext<LocationState | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [manualLocation, setManualState] = useState<ManualLocation | null>(null);
  const [gpsCoords, setGpsCoords] = useState<Coordinates | null>(null);
  const [requestState, setRequestState] = useState<LocationRequestState>('idle');
  const [failureReason, setFailureReason] = useState<LocationFailureReason | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((storedId) => {
        if (!cancelled) {
          // Un id desconocido/corrupto NO inventa una selección: queda en null
          // y la cadena canónica cae al centro de la ciudad activa.
          setManualState(resolveManualLocation(storedId));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const requestCurrentLocation = useCallback(async () => {
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

  // Intento AUTOMÁTICO al arrancar: sin esto el GPS "disponible" nunca entra a
  // la cadena y toda la app mediría desde el centro de la ciudad. Una sola vez
  // por montaje; el botón manual queda para reintentar.
  const autoRequested = useRef(false);
  useEffect(() => {
    if (autoRequested.current) {
      return;
    }
    autoRequested.current = true;
    void requestCurrentLocation();
  }, [requestCurrentLocation]);

  const setManualLocation = useCallback((location: ManualLocation) => {
    setManualState(location);
    // Elegir una zona es una anulación EXPLÍCITA del usuario: se suelta la
    // lectura de GPS para que la cadena canónica resuelva a esa zona.
    setGpsCoords(null);
    setRequestState('idle');
    setFailureReason(null);
    AsyncStorage.setItem(STORAGE_KEY, location.id).catch(() => undefined);
  }, []);

  const value = useMemo<LocationState>(() => {
    const effective = resolveEffectiveLocation({ gps: gpsCoords, manual: manualLocation });
    return {
      coords: effective.coords,
      source: effective.source,
      label: effective.label,
      requestState,
      failureReason,
      manualLocation,
      requestCurrentLocation,
      setManualLocation,
    };
  }, [
    gpsCoords,
    manualLocation,
    requestState,
    failureReason,
    requestCurrentLocation,
    setManualLocation,
  ]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationState(): LocationState {
  const state = useContext(LocationContext);
  if (!state) {
    throw new Error('useLocationState debe usarse dentro de LocationProvider');
  }
  return state;
}

/**
 * Origen de distancia (presentación) derivado de la MISMA ubicación efectiva
 * que aporta las coordenadas del cálculo. Fuente única de verdad: no duplica
 * ni reinterpreta el estado de ubicación.
 */
export function useDistanceOrigin(): DistanceOrigin {
  const { coords, source, label } = useLocationState();
  return distanceOriginOf({ coords, source, label });
}
