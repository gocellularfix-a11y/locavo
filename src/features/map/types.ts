import type { Coordinates } from '../../domain/place';

/**
 * Superficie de mapa de Locavo.
 *
 * Componente puramente presentacional: recibe marcadores y selección,
 * emite eventos. Sin lógica de negocio.
 *
 * Implementaciones:
 * - Nativo (Android/iOS): WebView con Leaflet + teselas de OpenStreetMap.
 * - Web: Leaflet directo sobre el DOM.
 *
 * No se usa ninguna clave de API ni integración comercial con Google Maps;
 * Google Maps solo se usa para navegación EXTERNA.
 */
export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
}

export interface MapSurfaceProps {
  center: Coordinates;
  markers: MapMarker[];
  selectedId: string | null;
  userLocation: Coordinates | null;
  onSelectMarker?: (id: string) => void;
  height?: number;
}

export interface MapPalette {
  marker: string;
  markerSelected: string;
  user: string;
}

export interface MapUpdatePayload {
  center: Coordinates;
  markers: MapMarker[];
  selectedId: string | null;
  userLocation: Coordinates | null;
  palette: MapPalette;
}

export const DEFAULT_MAP_HEIGHT = 260;
export const DEFAULT_ZOOM = 14;
