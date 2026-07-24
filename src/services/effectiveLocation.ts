/**
 * UBICACIÓN EFECTIVA — resolución CANÓNICA ÚNICA (V5.9).
 *
 * Toda distancia visible, ranking por cercanía, recomendación y búsqueda por
 * proximidad parte de aquí. Ningún consumidor decide por su cuenta qué
 * coordenadas usar: piden la ubicación efectiva y la propagan.
 *
 * Orden canónico, sin excepciones:
 *
 *   1. GPS actual válido del usuario
 *      ↓ si no existe
 *   2. ubicación manual seleccionada por el usuario
 *      ↓ si no existe
 *   3. centro de la ciudad activa (ÚNICAMENTE como respaldo final)
 *
 * Honestidad semántica: el respaldo de ciudad es su propia fuente (`city`) y
 * jamás se disfraza de GPS ni de selección manual. Una distancia grande es un
 * resultado correcto —probar desde Santa Bárbara y ver Culiacán a ~1,600 km es
 * el comportamiento esperado—, nunca se sustituye por la distancia desde el
 * centro de la ciudad.
 *
 * Puro y determinista: mismas entradas → misma salida.
 */
import { CULIACAN_CENTER } from '../data/places.mock';
import { isValidCoordinates } from '../domain/distance';
import type { Coordinates } from '../domain/place';

/** Zona manual seleccionable por el usuario (demo actual: Culiacán). */
export interface ManualLocation {
  id: string;
  label: string;
  coords: Coordinates;
}

/** Centro de la ciudad activa: respaldo FINAL, nunca una preferencia. */
export interface CityCenterFallback {
  readonly id: string;
  /** Etiqueta legible, siempre no vacía (invariante del respaldo). */
  readonly label: string;
  readonly coords: Coordinates;
}

/** Ciudad activa del MVP. Cambiar de ciudad = cambiar este descriptor. */
export const ACTIVE_CITY: CityCenterFallback = {
  id: 'culiacan',
  label: 'Centro de Culiacán',
  coords: CULIACAN_CENTER,
};

/** Zonas de demostración para ubicación manual dentro de Culiacán. */
export const MANUAL_LOCATIONS: ManualLocation[] = [
  { id: 'centro', label: 'Centro de Culiacán', coords: CULIACAN_CENTER },
  { id: 'tres-rios', label: 'Tres Ríos', coords: { latitude: 24.8215, longitude: -107.3861 } },
  { id: 'universitaria', label: 'Zona Universitaria', coords: { latitude: 24.8259, longitude: -107.3979 } },
  { id: 'las-vegas', label: 'Las Vegas / Sur', coords: { latitude: 24.7895, longitude: -107.3958 } },
];

/**
 * Zona manual correspondiente a un id persistido. Un id desconocido, corrupto
 * u obsoleto devuelve `null`: NO hay selección manual que honrar y la cadena
 * cae al respaldo de ciudad. Jamás se inventa una selección que el usuario no
 * hizo.
 */
export function resolveManualLocation(storedId: unknown): ManualLocation | null {
  if (typeof storedId !== 'string') {
    return null;
  }
  return MANUAL_LOCATIONS.find((l) => l.id === storedId) ?? null;
}

export type EffectiveLocationSource = 'gps' | 'manual' | 'city';

export interface EffectiveLocation {
  /** Coordenadas que TODO consumidor debe usar como origen. */
  readonly coords: Coordinates;
  readonly source: EffectiveLocationSource;
  /** Etiqueta de la referencia no-GPS usada (zona manual o ciudad activa). */
  readonly label?: string;
}

export interface EffectiveLocationInputs {
  /** Última lectura de GPS, si la hay. Coordenadas inválidas se descartan. */
  readonly gps?: Coordinates | null;
  /** Zona elegida explícitamente por el usuario, si la hay. */
  readonly manual?: ManualLocation | null;
  /** Ciudad activa (default: la del MVP). */
  readonly city?: CityCenterFallback;
}

/**
 * Resolución canónica de la ubicación efectiva. Un GPS con coordenadas
 * inválidas NO gana: se degrada al siguiente escalón en vez de fingir una
 * lectura buena.
 */
export function resolveEffectiveLocation(
  inputs: EffectiveLocationInputs = {},
): EffectiveLocation {
  const city = inputs.city ?? ACTIVE_CITY;

  if (inputs.gps && isValidCoordinates(inputs.gps)) {
    return { coords: inputs.gps, source: 'gps' };
  }

  if (inputs.manual && isValidCoordinates(inputs.manual.coords)) {
    return {
      coords: inputs.manual.coords,
      source: 'manual',
      label: inputs.manual.label,
    };
  }

  return { coords: city.coords, source: 'city', label: city.label };
}

/**
 * Origen de distancia para PRESENTACIÓN. Se deriva de la MISMA ubicación
 * efectiva que aportó las coordenadas, así la frase mostrada y el cálculo
 * jamás se contradicen. `city` nunca se presenta como "tu ubicación".
 */
export type DistanceOrigin =
  | { type: 'gps' }
  | { type: 'manual'; label?: string }
  | { type: 'city'; label: string };

export function distanceOriginOf(location: EffectiveLocation): DistanceOrigin {
  if (location.source === 'gps') {
    return { type: 'gps' };
  }
  const label = location.label?.trim() ?? '';
  if (location.source === 'city') {
    // La ciudad activa siempre tiene etiqueta; el respaldo evita afirmar una
    // selección que no ocurrió.
    return { type: 'city', label: label.length > 0 ? label : ACTIVE_CITY.label };
  }
  return { type: 'manual', label: label.length > 0 ? label : undefined };
}
